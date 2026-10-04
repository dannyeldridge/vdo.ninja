// Sticky Ping on /review/: after arming Ping once, every click on the picture pings
// until the client clicks the button again. Screenshot 22 should show three pings at once.
import { chromium } from 'playwright';
const B = process.env.BASE_URL || 'http://localhost:8080', SS = 'screenshots';
const browser = await chromium.launch({ args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--ignore-certificate-errors',
  '--use-file-for-fake-video-capture=media/bars.y4m', '--autoplay-policy=no-user-gesture-required'] });
const mk = async (w=1280,h=760) => (await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: w, height: h }, permissions: ['camera','microphone'] })).newPage();

const ed = await mk(1360, 800);
await ed.goto(`${B}/start/?webcam${process.env.FANOUT ? '&fanout' : ''}`); await ed.waitForTimeout(1000);
await ed.click('#go'); await ed.waitForTimeout(8000);
const link = new URL(B).protocol + '//' + await ed.locator('#clientUrl').innerText();

const cl = await mk();
cl.on('pageerror', e => console.log('[client pageerror]', e.message));
await cl.goto(link); await cl.click('button[type=submit]'); await cl.waitForTimeout(14000);
console.log('client', await cl.locator('#liveText').innerText());
await cl.click('#drawBtn'); await cl.waitForTimeout(1000);
const fr = cl.frameLocator('iframe');
const ping = fr.locator('.buttonContainer button').nth(1);
await ping.click();
const canvas = await fr.locator('canvas').last().boundingBox();
const states = [];
for (const [fx, fy] of [[0.25, 0.3], [0.5, 0.6], [0.75, 0.35]]) {
  await cl.mouse.click(canvas.x + canvas.width * fx, canvas.y + canvas.height * fy);
  await cl.waitForTimeout(150);
  states.push(await ping.innerText());
}
await ed.waitForTimeout(300);
await ed.screenshot({ path: `${SS}/22-editor-sees-three-pings.png` });
console.log('button after each ping:', states.join(' | '), states.every(s => s === 'Disable Ping') ? 'PASS' : 'FAIL');

await ping.click();   // turn it off
const off = await ping.innerText();
await cl.mouse.click(canvas.x + canvas.width * 0.5, canvas.y + canvas.height * 0.5);
await cl.waitForTimeout(150);
console.log('after turning off:', off, '| after a click:', await ping.innerText(), off === 'Ping' && (await ping.innerText()) === 'Ping' ? 'PASS' : 'FAIL');
await browser.close();
