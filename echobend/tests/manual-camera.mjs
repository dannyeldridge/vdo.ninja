// Editor flow without ?webcam: Go live -> Share your Camera -> START, then a client joins via /review/.
import { chromium } from 'playwright';
const B = process.env.BASE_URL || 'http://localhost:8080', tag = process.argv[2] || 'x';
const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--use-file-for-fake-video-capture=media/bars.y4m','--use-file-for-fake-audio-capture=media/tone.wav','--autoplay-policy=no-user-gesture-required'] });
const mk = async () => (await b.newContext({ viewport: { width: 1360, height: 800 }, permissions: ['camera','microphone'] })).newPage();
const ed = await mk();
await ed.goto(`${B}/start/`); await ed.waitForTimeout(800);
await ed.evaluate(() => { const s = document.getElementById('preset'); s.insertAdjacentHTML('afterbegin', '<option value="demo">demo</option>'); s.value = 'demo'; });
await ed.fill('#proj', 'Test Project v1'); await ed.click('#go'); await ed.waitForTimeout(4000);
const f = ed.frameLocator('iframe');
await f.getByText('Share your Camera').click(); await ed.waitForTimeout(4000);
await f.locator('#gowebcam:visible').click({ force: true }); // START pulses, so Playwright never sees it as "stable"
await ed.waitForTimeout(5000);
await ed.screenshot({ path: `screenshots/manual-${tag}-editor.png` });
const link = new URL(B).protocol + '//' + await ed.locator('#clientUrl').innerText(), pw = await ed.locator('#clientPw').innerText();
const cl = await mk(); await cl.goto(link); await cl.fill('#pw', pw); await cl.click('button[type=submit]');
await cl.waitForTimeout(15000);
console.log(tag, 'client:', await cl.locator('#liveText').innerText(), await cl.locator('#meta').innerText());
await b.close();
