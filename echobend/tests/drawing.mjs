import { chromium } from 'playwright';
const B = 'http://localhost:8080', SS = 'screenshots';
const sid = 'echobendDraw' + Math.floor(Math.random()*1e6), pw = 'ClientPass42';
const browser = await chromium.launch({ args: [
  '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
  '--use-file-for-fake-video-capture=media/bars.y4m', '--use-file-for-fake-audio-capture=media/tone.wav',
  '--autoplay-policy=no-user-gesture-required'] });
const mk = async (w=1280,h=760) => (await browser.newContext({ viewport: { width: w, height: h }, permissions: ['camera','microphone'] })).newPage();

const sender = await mk();
await sender.goto(`${B}/?push=${sid}&password=${pw}&webcam&autostart&quality=0&drawing&label=EditBay1`);
await sender.waitForTimeout(6000);
const clientA = await mk();
await clientA.goto(`${B}/?view=${sid}&password=${pw}&drawing&codec=h264&bitrate=8000&scale=100`);
const clientB = await mk();
await clientB.goto(`${B}/?view=${sid}&password=${pw}&drawing&codec=h264&bitrate=8000&scale=100`);
await clientA.waitForTimeout(14000);

// right-click the incoming video on client A
const vid = clientA.locator('video[id^="videosource_"]').first();
const box = await vid.boundingBox();
console.log('video box', JSON.stringify(box));
await clientA.mouse.click(box.x + box.width/2, box.y + box.height/2, { button: 'right' });
await clientA.waitForTimeout(800);
await clientA.screenshot({ path: `${SS}/05-context-menu.png` });
const menuItem = clientA.locator('a[data-action="DrawOnVideo"]');
console.log('menu label:', await menuItem.innerText().catch(e => 'ERR ' + e.message));
await menuItem.click();
await clientA.waitForTimeout(1500);
await clientA.screenshot({ path: `${SS}/06-draw-tools.png` });
// click "Pen"
const pen = clientA.getByRole('button', { name: /pen|enable drawing/i }).first();
await pen.click().catch(e => console.log('pen click err', e.message));
await clientA.waitForTimeout(500);
// draw a circle around the timecode, then an arrow stroke
const cx = box.x + box.width*0.5, cy = box.y + box.height*0.84, r = box.height*0.1;
await clientA.mouse.move(cx + r*2, cy);
await clientA.mouse.down();
for (let a = 0; a <= 2*Math.PI + 0.3; a += 0.15) await clientA.mouse.move(cx + Math.cos(a)*r*2.2, cy + Math.sin(a)*r, { steps: 2 });
await clientA.mouse.up();
await clientA.mouse.move(box.x + box.width*0.2, box.y + box.height*0.3);
await clientA.mouse.down();
await clientA.mouse.move(box.x + box.width*0.38, box.y + box.height*0.62, { steps: 20 });
await clientA.mouse.up();
await clientA.waitForTimeout(2500);
await clientA.screenshot({ path: `${SS}/07-clientA-drew.png` });
await sender.screenshot({ path: `${SS}/08-sender-sees-drawing.png` });
await clientB.screenshot({ path: `${SS}/09-clientB-sees-drawing.png` });
const canv = async p => p.evaluate(() => [...document.querySelectorAll('canvas')].map(c => { try { const d = c.getContext('2d')?.getImageData(0,0,c.width,c.height).data; let n=0; if (d) for (let i=3;i<d.length;i+=4) if (d[i]>0) n++; return {w:c.width,h:c.height,painted:n}; } catch(e){ return {err:e.message}; } }));
console.log('sender canvases', JSON.stringify(await canv(sender)));
console.log('clientB canvases', JSON.stringify(await canv(clientB)));
await browser.close();
