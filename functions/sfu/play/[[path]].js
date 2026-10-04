// functions/sfu/play/[[path]].js
// WHEP playback for fan-out sessions. Public on purpose: the URL is only handed to viewers
// over VDO.Ninja's password-encrypted peer connection, and it names one live session.
// POST /sfu/play/<publisherSessionId>/<track>.<track> with the viewer's SDP offer → SDP answer.
import { sfu, parsePlay, sdp, text } from "../../_lib/sfu.js";

export async function onRequest({ request, env, params }) {
  if (request.method === "DELETE" || request.method === "PATCH") return new Response(null, { status: 204 });
  if (request.method !== "POST") return text("Method not allowed", 405);
  const target = parsePlay(params.path);
  if (!target) return text("Bad play URL", 400);
  const offer = await request.text();
  if (!offer.startsWith("v=0")) return text("Expected an SDP offer", 400);
  try {
    const { sessionId } = await sfu(env, "sessions/new");
    const res = await sfu(env, "sessions/" + sessionId + "/tracks/new", {
      tracks: target.trackNames.map(trackName => ({ location: "remote", sessionId: target.sessionId, trackName })),
      sessionDescription: { type: "offer", sdp: offer },
    });
    if (res.tracks.some(t => t.errorCode)) return text("Session is not live", 404);
    // Verified Oct 4: a viewer offer gets a direct answer. A renegotiation here would need
    // a second round trip that WHEP clients don't do, so fail loudly instead of hanging.
    if (res.requiresImmediateRenegotiation) return text("Fan-out needs renegotiation; not supported", 502);
    return sdp(res.sessionDescription.sdp, 201, {
      location: "/sfu/play/" + params.path.slice(0, 2).join("/") + "/" + sessionId,
      "access-control-expose-headers": "location",
    });
  } catch (e) {
    return text("Fan-out unavailable: " + e.message, 502);
  }
}
