// Yerel geliştirme ve Google Cloud Run için bağımlılıksız sunucu.
// Kullanım: GEMINI_API_KEY=... node server.js  ->  http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyze, health, suggest, tts } from './lib/handlers.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const port = Number(process.env.PORT || 8080);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};

// .env dosyası varsa basitçe oku (yalnızca yerel kullanım için).
try {
  for (const line of (await readFile('.env', 'utf8')).split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8_000_000) throw new Error('İstek çok büyük.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res, status, json) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(json));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anon').split(',')[0];
  try {
    if (url.pathname === '/api/health') return send(res, 200, health().json);
    const routes = { '/api/analyze': analyze, '/api/suggest': suggest, '/api/tts': tts };
    if (routes[url.pathname]) {
      if (req.method === 'GET') { res.writeHead(204); return res.end(); }
      if (req.method !== 'POST') return send(res, 405, { error: 'POST gerekli.' });
      const body = await readBody(req);
      const { status, json } = await routes[url.pathname](body, ip);
      return send(res, status, json);
    }
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) return send(res, 403, { error: 'Yasak.' });
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, 'index.html');
    // Sekme adresleri (/olc, /sinif, /mutfak, /etki) doğrudan açıldığında uygulamanın kendisi döner.
    if (/^\/(olc|sinif|mutfak|etki|kanit)\/?$/.test(url.pathname)) path = join(root, 'index.html');
    const file = await readFile(path).catch(() => null);
    if (!file) return send(res, 404, { error: 'Bulunamadı.' });
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(file);
  } catch (error) {
    send(res, 400, { error: error.message });
  }
});
// Gemini ücretsiz sürümde uzun sürebilir; istek süresine üst sınır koyma.
server.requestTimeout = 0;
server.listen(port, () => console.log(`Tabak İz: http://localhost:${port}  (Gemini: ${process.env.GEMINI_API_KEY ? 'açık' : 'anahtar yok, demo modu'})`));
