// functions/_lib/sfu.js
// Minimal client for Cloudflare Realtime SFU (https://developers.cloudflare.com/realtime/sfu/),
// shared by the WHIP (/start/sfu/publish) and WHEP (/sfu/play) Pages Functions.
// No onRequest export, so Pages creates no route for this file.
const API = "https://rtc.live.cloudflare.com/v1/apps/";
export const ID = /^[A-Za-z0-9_-]{1,128}$/;

// POST (or PUT) to the SFU. sessions/new must go without a body; the API rejects "{}".
export async function sfu(env, path, body, method = "POST") {
  const r = await fetch(API + env.REALTIME_APP_ID + "/" + path, {
    method,
    headers: { Authorization: "Bearer " + env.REALTIME_API_TOKEN, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.errorCode) throw new Error(json.errorDescription || json.errorCode || "SFU returned " + r.status);
  return json;
}

// The play URL carries everything a viewer needs, so nothing is stored server-side.
export const playPath = (sessionId, trackNames) => "/sfu/play/" + sessionId + "/" + trackNames.join(".");

export function parsePlay(parts) {
  if (!parts || parts.length < 2 || !ID.test(parts[0])) return null;
  const trackNames = parts[1].split(".");
  if (trackNames.length > 4 || !trackNames.every(t => ID.test(t))) return null;
  return { sessionId: parts[0], trackNames };
}

export const sdp = (body, status, headers = {}) =>
  new Response(body, { status, headers: { "content-type": "application/sdp", ...headers } });

export const text = (body, status) => new Response(body, { status, headers: { "content-type": "text/plain" } });
