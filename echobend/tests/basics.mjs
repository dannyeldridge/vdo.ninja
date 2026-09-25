import { chromium } from 'playwright';
const B = 'http://localhost:8080';
const SS = 'screenshots';
const sid = 'echobendDemo' + Math.floor(Math.random()*1e6);
const pw = 'ClientPass42';
const browser = await chromium.launch({ args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--use-file-for-fake-video-capture=media/bars.y4m', '--use-file-for-fake-audio-capture=media/tone.wav',
  '--autoplay-policy=no-user-gesture-required'] });
const mk = async () => { const c = await browser.newContext({ viewport: { width: 1280, height: 760 }, permissions: ['camera','microphone'] }); return c.newPage(); };

const home = await mk();
await home.goto(B + '/'); await home.waitForTimeout(3000);
await home.screenshot({ path: `${SS}/01-landing.png` });

const sender = await mk();
sender.on('console', m => { if (m.type()==='error') console.log('[sender err]', m.text().slice(0,200)); });
await sender.goto(`${B}/?push=${sid}&password=${pw}&webcam&autostart&quality=0&label=EditBay1`);
await sender.waitForTimeout(8000);
await sender.screenshot({ path: `${SS}/02-sender.png` });

const viewer = await mk();
await viewer.goto(`${B}/?view=${sid}&password=${pw}&codec=h264&bitrate=8000&scale=100`);
await viewer.waitForTimeout(15000);
await viewer.screenshot({ path: `${SS}/03-viewer.png` });
const vinfo = await viewer.evaluate(() => [...document.querySelectorAll('video')].map(v => ({ id: v.id, w: v.videoWidth, h: v.videoHeight, paused: v.paused, t: v.currentTime })));
console.log('viewer videos', JSON.stringify(vinfo));

const bad = await mk();
await bad.goto(`${B}/?view=${sid}&password=WrongPass`);
await bad.waitForTimeout(12000);
await bad.screenshot({ path: `${SS}/04-wrong-password.png` });
const binfo = await bad.evaluate(() => [...document.querySelectorAll('video')].map(v => ({ id: v.id, w: v.videoWidth, h: v.videoHeight })));
console.log('bad videos', JSON.stringify(binfo));
console.log('sid', sid);
await browser.close();
