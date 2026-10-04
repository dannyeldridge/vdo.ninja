// functions/start/sfu/publish/[[path]].js
// WHIP ingest for fan-out sessions. It lives under /start/, so Cloudflare Access
// (staff login) guards it the same way it guards the Go Live console.
// POST /start/sfu/publish/<sid> with the edit bay's SDP offer → SDP answer, plus a `whep`
// header that VDO.Ninja advertises to viewers over its encrypted peer connection.
import { sfu, ID, playPath, sdp, text } from "../../../_lib/sfu.js";

export async function onRequest({ request, env, params }) {
  const [sid] = params.path || [];
  // /start checks this before Go live. VDO.Ninja doesn't fall back to direct when the WHIP
  // upload fails (clients just wait), so /start picks Direct itself if the SFU is unreachable.
  if (request.method === "GET" && sid === "health") {
    try { await sfu(env, "sessions/new"); return text("ok", 200); }
    catch (e) { return text("Fan-out unavailable: " + e.message, 502); }
  }
  // VDO.Ninja may PATCH (trickle ICE) or DELETE (hang up) the Location. The SFU closes
  // tracks itself when the peer goes away, so acknowledge and move on.
  if (request.method === "DELETE" || request.method === "PATCH") return new Response(null, { status: 204 });
  if (request.method !== "POST") return text("Method not allowed", 405);
  if (!sid || !ID.test(sid)) return text("Bad session id", 400);
  const offer = await request.text();
  if (!offer.startsWith("v=0")) return text("Expected an SDP offer", 400);
  try {
    const { sessionId } = await sfu(env, "sessions/new");
    const res = await sfu(env, "sessions/" + sessionId + "/tracks/new", { sessionDescription: { type: "offer", sdp: offer }, autoDiscover: true });
    const failed = res.tracks.find(t => t.errorCode);
    if (failed) throw new Error(failed.errorDescription || failed.errorCode);
    const whep = new URL(playPath(sessionId, res.tracks.map(t => t.trackName)), request.url).href;
    return sdp(res.sessionDescription.sdp, 201, {
      location: "/start/sfu/publish/" + sid + "/" + sessionId,
      whep,
      "access-control-expose-headers": "location, whep",
    });
  } catch (e) {
    return text("Fan-out unavailable: " + e.message, 502);
  }
}
