// The connector's sign-in page sends people back here; the code goes to the app in the address fragment.
// In the desktop app the sign-in page opens in the system browser, so the code returns through a moonlightc:// link.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const hash = new URLSearchParams({
    mcpauth: url.searchParams.get("code") ?? "",
    mcpstate: url.searchParams.get("state") ?? "",
    ...(url.searchParams.get("error") ? { mcperror: url.searchParams.get("error_description") ?? url.searchParams.get("error")! } : {}),
  }).toString();
  const target = process.env.MOONC_DESKTOP === "1" ? `moonlightc://mcpauth#${hash}` : `${url.origin}/app#${hash}`;
  return new Response(null, { status: 302, headers: { location: target } });
}
