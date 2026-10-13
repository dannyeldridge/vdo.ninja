// Fan-out end to end: one editor in fan-out mode, three clients.
// Checks: every client plays (including a client who opened the link before Go live and
// two who join at the same instant), the editor sends no direct video, clients receive over
// WHEP at a sane resolution/bitrate, and the editor sees a client's drawing.
// Run against wrangler: BASE_URL=http://localhost:8788 node tests/fanout.mjs
// FALLBACK=1 (with REALTIME_API_TOKEN=bad in .dev.vars): /start must fall back to Direct and the client must still play.
import { chromium } from 'playwright';
const B = process.env.BASE_URL || 'http://localhost:8788';
const browser = await chromium.launch({ args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--ignore-certificate-errors',
  '--use-file-for-fake-video-capture=media/bars.y4m', '--autoplay-policy=no-user-gesture-required'] });
const mk = async () => (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 760 }, permissions: ['camera', 'microphone'] })).newPage();
const inner = p => p.frames().find(f => f !== p.mainFrame());   // the page's one VDO.Ninja iframe
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' (' + detail + ')' : ''}`); if (!ok) failed++; };

const ed = await mk();
ed.on('pageerror', e => console.log('[editor pageerror]', e.message));
await ed.goto(`${B}/start/?webcam&fanout`); await ed.waitForTimeout(1000);
await ed.click('#go'); await ed.locator('#livebar').waitFor();   // Go live is async (fan-out health check)
const link = new URL(B).protocol + '//' + await ed.locator('#clientUrl').innerText();
// Client 0 opens immediately, before the WHIP publish has finished (Review Focus #2).
const c0 = await mk(); await c0.goto(link); await c0.click('button[type=submit]');
await ed.waitForTimeout(8000);
const directBytes = () => inner(ed).evaluate(async () => {
  const out = []; for (const pc of Object.values(session.pcs || {})) { let b = 0; (await pc.getStats()).forEach(x => { if (x.type === 'outbound-rtp' && x.kind === 'video') b += x.bytesSent; }); out.push(b); } return out;
});
if (process.env.FALLBACK) {
  await ed.waitForTimeout(8000);
  check('live bar shows Direct (fan-out unavailable)', (await ed.locator('#liveMode').innerText()) === 'Direct (fan-out unavailable)');
  check('client 0 LIVE', (await c0.locator('#liveText').innerText()) === 'LIVE');
  const d = await directBytes();
  check('editor sends direct video', d.length >= 1 && d.every(b => b > 0), JSON.stringify(d));
  await browser.close();
  console.log(failed ? `${failed} FAILED` : 'ALL PASS');
  process.exit(failed ? 1 : 0);
}
check('live bar shows Fan-out', (await ed.locator('#liveMode').innerText()) === 'Fan-out');
// Clients 1 and 2 join at the same instant (Review Focus #1).
const [c1, c2] = await Promise.all([mk(), mk()]);
await Promise.all([c1, c2].map(async c => { await c.goto(link); await c.click('button[type=submit]'); }));
await ed.waitForTimeout(20000);

const clients = [c0, c1, c2];
for (const [i, c] of clients.entries()) {
  check(`client ${i} LIVE`, (await c.locator('#liveText').innerText()) === 'LIVE');
  const s = await inner(c).evaluate(async () => {
    const o = { whepBytes: 0, w: 0, h: 0, p2pBytes: 0 };
    for (const r of Object.values(session.rpcs)) {
      (await r.getStats()).forEach(x => { if (x.type === 'inbound-rtp' && x.kind === 'video') o.p2pBytes += x.bytesReceived; });
      if (r.whep) (await r.whep.getStats()).forEach(x => { if (x.type === 'inbound-rtp' && x.kind === 'video') { o.whepBytes += x.bytesReceived; o.w = x.frameWidth; o.h = x.frameHeight; } });
    }
    return o;
  });
  check(`client ${i} receives over WHEP`, s.whepBytes > 0 && s.p2pBytes === 0, JSON.stringify(s));
  check(`client ${i} resolution`, s.w >= 640, `${s.w}x${s.h}`);
}
// Bitrate. The fake camera (static bars + timecode) needs only ~50 kbps in either mode, so the
// client's received rate says nothing about fan-out; it's printed for reference. What fan-out
// controls is the encoder's budget on the WHIP upload (&whipoutvideobitrate), so assert on that.
const rate = async () => inner(c1).evaluate(async () => { let b = 0; for (const r of Object.values(session.rpcs)) if (r.whep) (await r.whep.getStats()).forEach(x => { if (x.type === 'inbound-rtp' && x.kind === 'video') b += x.bytesReceived; }); return b; });
const b0 = await rate(); await ed.waitForTimeout(10000); const kbps = Math.round((await rate() - b0) * 8 / 10000);
console.log(`INFO client 1 receives ${kbps} kbps (limited by the test picture)`);
const whip = await inner(ed).evaluate(async () => { const o = {}; if (session.whipOut) (await session.whipOut.getStats()).forEach(x => { if (x.type === 'outbound-rtp' && x.kind === 'video') { o.target = Math.round(x.targetBitrate / 1000); o.limit = x.qualityLimitationReason; } }); return o; });
check('WHIP upload budget over 1000 kbps', whip.target > 1000 && whip.limit === 'none', JSON.stringify(whip));

const editorDirect = await directBytes();
check('editor sends no direct video', editorDirect.length >= 3 && editorDirect.every(b => b === 0), JSON.stringify(editorDirect));

// Drawing still travels over the peer connection: client 1 presses Draw and draws a stroke.
await c1.click('#drawBtn'); await c1.waitForTimeout(800);
await c1.frameLocator('iframe').getByRole('button', { name: /enable drawing/i }).click();   // the pen starts off
const box = await c1.frameLocator('iframe').locator('canvas').last().boundingBox();
await c1.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3); await c1.mouse.down();
await c1.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 10 }); await c1.mouse.up();
await ed.waitForTimeout(1500);
const inked = await inner(ed).evaluate(() => [...document.querySelectorAll('canvas')].some(cv => {
  try { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; } catch (e) {} return false;
}));
check('editor sees client drawing', inked);
await ed.screenshot({ path: 'screenshots/30-fanout-editor.png' });
await c1.screenshot({ path: 'screenshots/31-fanout-client.png' });
await browser.close();
console.log(failed ? `${failed} FAILED` : 'ALL PASS');
process.exit(failed ? 1 : 0);
