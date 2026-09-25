import { chromium } from 'playwright';
const B = process.env.BASE_URL || 'http://localhost:8080', SS = 'screenshots';
const browser = await chromium.launch({ args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--use-file-for-fake-video-capture=media/bars.y4m', '--use-file-for-fake-audio-capture=media/tone.wav',
  '--autoplay-policy=no-user-gesture-required'] });
const mk = async (w=1280,h=760) => (await browser.newContext({ viewport: { width: w, height: h }, permissions: ['camera','microphone'] })).newPage();
const stats = p => p.evaluate(async () => { for (const k in session.rpcs) { const r = await session.rpcs[k].getStats(); let o; const c={}; r.forEach(s=>{if(s.type==='codec')c[s.id]=s.mimeType}); r.forEach(s => { if (s.type==='inbound-rtp' && s.kind==='video') o = { codec:c[s.codecId], w:s.frameWidth, h:s.frameHeight, fps:s.framesPerSecond, bytes:s.bytesReceived }; }); if (o) return o; } });
// wrong password gate screenshot (after fix)
const bad = await mk();
await bad.goto(`${B}/review/?s=nosuchsession&n=Acme%20Spring%20Spot%20v3`); await bad.fill('#pw','WrongPassword1'); await bad.click('button[type=submit]');
await bad.waitForTimeout(17000); await bad.screenshot({ path: `${SS}/20-gate-wrong-password.png` }); await bad.context().close();
// resolution over time, two sender configs
for (const [label, q] of [['quality=0 (soft 1080 target)', '&quality=0'], ['explicit 960x540', '&width=960&height=540']]) {
  const sid = 'eqt' + Math.floor(Math.random()*1e6);
  const s = await mk(); await s.goto(`${B}/?push=${sid}&password=abc123${q}&webcam&autostart&contenthint=detail`);
  await s.waitForTimeout(5000);
  const v = await mk(); await v.goto(`${B}/?view=${sid}&password=abc123&codec=h264&bitrate=12000&scale=100`);
  let prev = 0;
  for (const t of [10, 20, 30, 45]) { await v.waitForTimeout(t === 10 ? 10000 : (t === 45 ? 15000 : 10000)); const st = await stats(v); const kb = st ? Math.round((st.bytes - prev)*8/1000/10) : 0; prev = st?.bytes || 0; console.log(label, `t=${t}s`, JSON.stringify({ ...st, bytes: undefined, approxKbps: kb })); }
  await s.context().close(); await v.context().close();
}
await browser.close();
