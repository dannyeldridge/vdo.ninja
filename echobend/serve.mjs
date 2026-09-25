// Local static server for the whole site (repo root), mimicking the nginx try_files rules in ../install.md.
// Cloudflare Pages resolves paths the same way: /start -> start/index.html, unknown paths -> /index.html.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const PORT = Number(process.env.PORT || 8080);
const ROOT = path.resolve(import.meta.dirname, '..');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.wasm':'application/wasm', '.woff2':'font/woff2', '.jpg':'image/jpeg', '.webp':'image/webp', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.onnx':'application/octet-stream', '.tflite':'application/octet-stream' };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  for (const c of [url, url + '.html', path.join(url, 'index.html')]) {
    const p = path.join(ROOT, c);
    if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isFile()) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
      return fs.createReadStream(p).pipe(res);
    }
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  fs.createReadStream(path.join(ROOT, 'index.html')).pipe(res);
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
