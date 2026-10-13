// Fake Google sign-in and Gmail API for end-to-end tests.
import { createServer } from "node:http";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4030");
  if (url.pathname === "/auth") {
    const back = new URL(url.searchParams.get("redirect_uri"));
    back.searchParams.set("code", "test-code");
    back.searchParams.set("state", url.searchParams.get("state"));
    return res.writeHead(302, { location: back.toString() }).end();
  }
  if (url.pathname === "/token") {
    let body = "";
    for await (const c of req) body += c;
    const p = new URLSearchParams(body);
    const ok = (p.get("grant_type") === "authorization_code" && p.get("code") === "test-code" && p.get("code_verifier")) || p.get("grant_type") === "refresh_token";
    if (!ok) return res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error_description: "bad grant" }));
    return res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ access_token: "g-access", refresh_token: "g-refresh", expires_in: 3600, scope: "openid email gmail", id_token: `${b64({ alg: "none" })}.${b64({ email: "shawn@example.com" })}.x` }),
    );
  }
  if (req.headers.authorization !== "Bearer g-access") return res.writeHead(401).end();
  res.setHeader("content-type", "application/json");
  if (url.pathname === "/gmail/v1/users/me/messages") return res.end(JSON.stringify({ messages: [{ id: "m1" }] }));
  if (url.pathname === "/gmail/v1/users/me/messages/m1")
    return res.end(JSON.stringify({ id: "m1", snippet: "Lunch at noon?", payload: { headers: [{ name: "From", value: "Ann" }, { name: "Subject", value: "Lunch" }, { name: "Date", value: "Mon" }] } }));
  if (url.pathname === "/youtube/v3/subscriptions") return res.end(JSON.stringify({ items: [{ snippet: { title: "Moon Science", resourceId: { channelId: "UC1" } } }] }));
  res.writeHead(404).end("{}");
}).listen(4030, "127.0.0.1");
