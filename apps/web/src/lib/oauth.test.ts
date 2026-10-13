import { describe, expect, it } from "vitest";
import { makeState, parseToken, readState } from "./oauth";

describe("oauth", () => {
  it("reads Slack's nested user token and Google-style tokens", () => {
    const slack = parseToken({ authed_user: { access_token: "xoxp-1", scope: "channels:read,chat:write" } });
    expect(slack.accessToken).toBe("xoxp-1");
    expect(slack.scopes).toEqual(["channels:read", "chat:write"]);
    const g = parseToken({ access_token: "a", refresh_token: "r", expires_in: 60, scope: "openid email" });
    expect(g.refreshToken).toBe("r");
    expect(() => parseToken({ error: "invalid_grant" })).toThrow("invalid_grant");
  });
  it("signed state can't be swapped between providers or tampered with", () => {
    process.env.OAUTH_STATE_SECRET = "test";
    const { state } = makeState("spotify");
    expect(readState(state, "spotify").verifier).toBeTruthy();
    expect(() => readState(state, "google")).toThrow();
    expect(() => readState(state.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "spotify")).toThrow();
  });
});
