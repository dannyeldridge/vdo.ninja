import { chromium } from 'playwright';
const B = 'http://localhost:8080', SS = 'screenshots';
const browser = await chromium.launch({ args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--ignore-certificate-errors',
  '--use-file-for-fake-video-capture=media/bars.y4m', '--use-file-for-fake-audio-capture=media/tone.wav',
  '--autoplay-policy=no-user-gesture-required'] });
const mk = async (w=1280,h=760) => (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: w, height: h }, permissions: ['camera','microphone','clipboard-read','clipboard-write'] })).newPage();

const ed = await mk(1360, 800);
ed.on('pageerror', e => console.log('[editor pageerror]', e.message));
await ed.goto(`${B}/start/?webcam`);
await ed.waitForTimeout(1000);
await ed.screenshot({ path: `${SS}/13-editor-console-before.png` });
await ed.click('#go');
await ed.waitForTimeout(9000);
await ed.screenshot({ path: `${SS}/14-editor-console-live.png` });
const txt = await ed.locator('#clientLink').innerText();
const [link, pwLine] = txt.split('\n'); const pw = pwLine.replace('Password: ', '').trim();
console.log('client link', link, 'pw', pw);

// client: gate card (desktop + phone)
const cl = await mk();
cl.on('pageerror', e => console.log('[client pageerror]', e.message));
await cl.goto(link); await cl.waitForTimeout(800);
await cl.screenshot({ path: `${SS}/15-gate-card.png` });
const phone = await mk(390, 780);
await phone.goto(link); await phone.waitForTimeout(800);
await phone.screenshot({ path: `${SS}/16-gate-card-phone.png` });
await phone.context().close();

await cl.fill('#pw', pw); await cl.click('button[type=submit]');
await cl.waitForTimeout(16000);
await cl.screenshot({ path: `${SS}/17-gate-player-live.png` });
console.log('live text', await cl.locator('#liveText').innerText(), await cl.locator('#meta').innerText());

// draw from the gate's Draw button
await cl.click('#drawBtn'); await cl.waitForTimeout(1500);
const fr = cl.frameLocator('iframe');
await fr.getByRole('button', { name: /pen|enable drawing/i }).first().click().catch(e => console.log('pen', e.message));
const st = await cl.locator('#stage').boundingBox();
await cl.mouse.move(st.x + st.width*0.30, st.y + st.height*0.25);
await cl.mouse.down();
for (let i=0;i<=30;i++){ const a=i/30*Math.PI*2; await cl.mouse.move(st.x+st.width*(0.55+0.16*Math.cos(a)), st.y+st.height*(0.35+0.2*Math.sin(a))); }
await cl.mouse.up();
await cl.waitForTimeout(2500);
await cl.screenshot({ path: `${SS}/18-gate-client-drawing.png` });
await ed.screenshot({ path: `${SS}/19-editor-sees-client-drawing.png` });

// wrong password on the gate
const bad = await mk();
await bad.goto(link); await bad.fill('#pw', 'WrongPassword1'); await bad.click('button[type=submit]');
await bad.waitForTimeout(18000);
await bad.screenshot({ path: `${SS}/20-gate-wrong-password.png` });
await browser.close();
