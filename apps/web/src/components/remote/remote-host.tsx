"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { desktop } from "@/lib/desktop";
import { joinChannel, leaveChannel, subscribed, type Req, type Res } from "@/lib/remote";
import { createHostHandler, localModels } from "@/lib/remote-host";
import { getState, updateNow, useStore } from "@/lib/store";
import { supabase, useUser } from "@/lib/supabase/client";

/** Is this session signed in with two-step sign-in? */
export async function hasTwoStep() {
  const { data } = await supabase().auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal2";
}

/**
 * Desktop app only: lists this PC under your account, and while remote control is on (and you're signed in with
 * two-step sign-in), answers your other devices. Every request is checked by the desktop app itself.
 */
export function RemoteHost() {
  const user = useUser();
  const enabled = useStore((s) => !!s.remoteEnabled);
  const [aal2, setAal2] = useState(false);
  const b = desktop();
  const uid = user?.id;

  // Register this PC and keep "last seen" fresh, so it shows up on your other devices.
  useEffect(() => {
    if (!b || !uid) return;
    let stop = false;
    const beat = async () => {
      const info = await b.device.info();
      // Once: before 0.6.17 the switch only stuck after Settings > Save, so an app restart turned it off. Keep it on
      // if this PC was last listed with remote control on.
      if (!getState().remoteCarried) {
        const { data } = await supabase().from("devices").select("remote_enabled").eq("id", info.id).maybeSingle();
        updateNow((s) => ({ ...s, remoteCarried: true, remoteEnabled: s.remoteEnabled || !!data?.remote_enabled }));
        if (data?.remote_enabled && !enabled) return;
      }
      const row = {
        id: info.id,
        user_id: uid,
        name: info.name,
        os: info.os,
        app_version: info.version,
        remote_enabled: enabled,
        local_models: await localModels(),
        last_seen: new Date().toISOString(),
      };
      if (!stop) await supabase().from("devices").upsert(row);
      setAal2(await hasTwoStep());
    };
    beat();
    const t = setInterval(beat, 60_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [b, uid, enabled]);

  // Answer requests while remote control is on.
  useEffect(() => {
    if (!b || !uid || !enabled || !aal2) return;
    let ch: RealtimeChannel | undefined;
    let closed = false;
    const send = (event: string, payload: unknown) =>
      ch?.send({ type: "broadcast", event, payload });
    const host = createHostHandler(b, send);
    (async () => {
      const info = await b.device.info();
      ch = await joinChannel(info.id, { key: `host:${info.id}` });
      ch.on("broadcast", { event: "req" }, async ({ payload }) => {
        const req = payload as Req;
        let res: Res;
        try {
          res = {
            id: req.id,
            to: req.from,
            ok: true,
            result: await host.handle(req),
          };
        } catch (e) {
          res = {
            id: req.id,
            to: req.from,
            ok: false,
            error: e instanceof Error ? e.message : String(e),
          };
        }
        send("res", res);
      });
      if (closed) return;
      await subscribed(ch).catch(() => {});
      await ch.track({ role: "host", name: info.name });
    })();
    // When a session ends on the PC (panic key, timeout, revoke), close that device's terminals too.
    const offState = b.remote.onState((sessions) =>
      host.sessionsChanged(sessions.map((x) => x.clientId)),
    );
    return () => {
      closed = true;
      offState();
      host.closeAll();
      b.remote.end(undefined, "remote control turned off");
      if (ch) leaveChannel(ch);
    };
  }, [b, uid, enabled, aal2]);

  return null;
}
