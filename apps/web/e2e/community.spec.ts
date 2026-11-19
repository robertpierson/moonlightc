import { expect, test, type Page, type Route } from "@playwright/test";
import { nav } from "./helpers";

// Community and Friends against the deployed site, with its Supabase answered here: a pretend signed-in person
// ("shawn") and a friend ("maya"). No real accounts or data are made. The database rules themselves are checked in SQL
// (see the community migration notes in docs/PROGRESS.md).
test.skip(!process.env.BASE_URL, "accounts are only switched on for the deployed site");

const ME = "11111111-1111-4111-8111-111111111111";
const MAYA = "22222222-2222-4222-8222-222222222222";
const b64url = (s: string) => Buffer.from(s).toString("base64url");
const jwt = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" })) + "." + b64url(JSON.stringify({ sub: ME, role: "authenticated", aal: "aal1", exp: 4102444800 })) + ".x";
const user = { id: ME, aud: "authenticated", role: "authenticated", email: "test@example.com", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

async function fakeSupabase(page: Page) {
  const db = {
    friends: [{ id: MAYA, username: "maya", display_name: "Maya", status: "accepted", incoming: false }] as Record<string, unknown>[],
    dms: [{ id: "m1", sender: MAYA, recipient: ME, body: "hey! want to plan the trip?", kind: "text", created_at: "2026-11-19T10:00:00Z", read_at: null }] as Record<string, unknown>[],
    creations: [
      { id: "c1", author: MAYA, author_name: "Maya", kind: "theme", name: "Ocean night", description: "Deep blue and calm", installs: 12, created_at: "2026-11-18T00:00:00Z", look: { theme: "cobalt", overrides: {} }, mode: null, command: null, distro: null, manifest: null },
      { id: "c2", author: MAYA, author_name: "Maya", kind: "command", name: "Trip planner", description: "", installs: 4, created_at: "2026-11-18T00:00:00Z", look: null, mode: null, command: { name: "trip-plan", prompt: "Plan 3 days in {input} on a budget." }, distro: null, manifest: null },
    ] as Record<string, unknown>[],
    published: [] as Record<string, unknown>[],
    asked: [] as string[],
  };
  const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route(/supabase\.co\/(auth|rest|realtime|storage|functions)\//, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const one = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    const path = url.pathname;
    if (path.endsWith("/auth/v1/user")) return json(route, user);
    if (path.includes("/auth/v1/")) return json(route, {});
    if (path.endsWith("/rpc/my_friends")) return json(route, db.friends);
    if (path.endsWith("/rpc/request_friend")) {
      db.asked.push(JSON.parse(req.postData() ?? "{}").u);
      return json(route, "asked");
    }
    if (path.endsWith("/rpc/security_level")) return json(route, 1);
    if (path.includes("/rpc/")) return json(route, null);
    if (path.endsWith("/profiles")) {
      const p = { id: ME, username: "shawn", display_name: "Shawn", age_confirmed: true, onboarded_at: "2026-01-01T00:00:00Z", is_admin: false };
      return json(route, one ? p : [p]);
    }
    if (path.endsWith("/direct_messages")) {
      if (req.method() === "POST") {
        const m = { id: `m${db.dms.length + 1}`, sender: ME, created_at: new Date().toISOString(), read_at: null, kind: "text", ...JSON.parse(req.postData() ?? "{}") };
        db.dms.push(m);
        return json(route, one ? m : [m], 201);
      }
      if (req.method() === "PATCH") return json(route, []);
      return json(route, url.searchParams.get("select") === "sender" ? db.dms.filter((m) => !m.read_at && m.recipient === ME).map((m) => ({ sender: m.sender })) : [...db.dms].reverse());
    }
    if (path.endsWith("/creations")) {
      if (req.method() === "POST") {
        const c = JSON.parse(req.postData() ?? "{}");
        db.published.push(c);
        return json(route, one ? { id: "new1" } : [{ id: "new1" }], 201);
      }
      return json(route, url.searchParams.get("author") ? db.published : db.creations);
    }
    return json(route, one ? null : []);
  });
  return db;
}

async function signIn(page: Page) {
  const ref = new URL(process.env.SUPABASE_URL_FOR_TESTS ?? "https://znkusjdspjssmwohrbzl.supabase.co").hostname.split(".")[0];
  const session = { access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user };
  await page.context().addCookies([{ name: `sb-${ref}-auth-token`, value: `base64-${b64url(JSON.stringify(session))}`, url: process.env.BASE_URL! }]);
}

test("Community: browse, add a command, try a theme, and make and share one with a live preview", async ({ page }) => {
  const db = await fakeSupabase(page);
  await signIn(page);
  await page.goto("/app");
  await nav(page, "Community");
  await expect(page.getByText("Ocean night")).toBeVisible();
  await page.getByRole("button", { name: "Add Trip planner" }).click();
  await expect(page.getByText(/Added Trip planner\. Type \/trip-plan/)).toBeVisible();
  await page.getByRole("button", { name: "Try Ocean night" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "cobalt");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "cobalt");

  await page.getByRole("button", { name: "Make something" }).click();
  const dialog = page.getByRole("dialog", { name: "Make something" });
  await dialog.getByRole("radio", { name: "Command" }).click();
  await dialog.getByLabel("Name").fill("Haiku");
  await dialog.getByLabel("What you type", { exact: true }).fill("haiku");
  await dialog.getByLabel(/The prompt it fills in/).fill("Write a haiku about {input}.");
  await expect(dialog.getByText("Write a haiku about Lisbon.")).toBeVisible();
  await dialog.getByRole("button", { name: "Share with everyone" }).click();
  await expect(page.getByText(/Haiku is shared/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("community.png") });
  expect(db.published[0]).toMatchObject({ kind: "command", name: "Haiku", payload: { kind: "command", command: { name: "haiku" } } });
});

test("Friends: add by username, read and send messages", async ({ page }) => {
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(e.message));
  const db = await fakeSupabase(page);
  await signIn(page);
  await page.goto("/app");
  await nav(page, "Friends");
  await expect(page.getByText("@shawn")).toBeVisible();
  await page.getByLabel("Friend's username").fill("@sam_k");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Request sent to @sam_k.")).toBeVisible();
  expect(db.asked).toEqual(["sam_k"]);

  await page.getByRole("button", { name: /Maya/ }).click();
  await expect(page.getByText("hey! want to plan the trip?")).toBeVisible();
  await page.getByLabel("Message Maya").fill("yes! Lisbon?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("yes! Lisbon?")).toBeVisible();
  expect(db.dms.at(-1)).toMatchObject({ recipient: MAYA, body: "yes! Lisbon?" });
  expect(crashes).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("friends.png") });
});
