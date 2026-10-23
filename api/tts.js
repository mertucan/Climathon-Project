import { tts } from '../lib/handlers.js';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  // GET: fonksiyonu önceden ısıtır (cold start), kullanıcı butona bastığında beklemeyi kısaltır.
  if (req.method === 'GET') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST gerekli.' });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'anon';
  const { status, json } = await tts(req.body, ip);
  res.status(status).json(json);
}
