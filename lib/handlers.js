// API uç noktalarının platformdan bağımsız mantığı.
// Vercel fonksiyonları (api/*.js) ve yerel/Cloud Run sunucusu (server.js) bunu kullanır.
// Hatalar { error, code, retryAfterMs? } biçiminde döner; istemci kodu kendi dilinde gösterir ve
// geçici hatalarda (kota, yoğunluk) bekleyip kendisi tekrar dener.
import {
  MODEL_CHAIN, TTS_MODELS, buildAnalysisRequest, buildSuggestionRequest, buildTtsRequest,
  callGemini, callWithFallback, extractAudio, normalizeAnalysis, normalizeSuggestions, parseModels
} from '../public/shared/gemini-core.js';

const MAX_IMAGE_CHARS = 3_000_000; // ~2.2 MB base64; istemci görüntüyü zaten ~768 px'e küçültür
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const LANGS = ['tr', 'en'];

const apiKey = () => process.env.GEMINI_API_KEY || '';
// Model zinciri: GEMINI_MODELS="a,b,c" tam listeyi verir; GEMINI_MODEL tek bir birincil model seçer (yedekler arkasından gelir).
const models = () => {
  const list = parseModels(process.env.GEMINI_MODELS);
  if (list.length) return list;
  const primary = process.env.GEMINI_MODEL;
  return primary ? [primary, ...MODEL_CHAIN.filter(m => m !== primary)] : MODEL_CHAIN;
};
const ttsModels = () => [...new Set([...parseModels(process.env.GEMINI_TTS_MODEL), ...TTS_MODELS])];
// Test için sahte bir Gemini sunucusuna yönlendirmek amacıyla değiştirilebilir.
const baseUrl = () => process.env.GEMINI_API_BASE || undefined;
const langOf = body => LANGS.includes(body?.lang) ? body.lang : 'tr';

// Basit, bellek içi istek sınırlayıcı (IP başına dakikada 40 istek; pilot setini de karşılar).
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 40;
}

function checkImage(image, label) {
  if (!image) return null;
  if (typeof image.data !== 'string' || !ALLOWED_MIME.includes(image.mimeType)) return `${label} fotoğrafı geçersiz.`;
  if (image.data.length > MAX_IMAGE_CHARS) return `${label} fotoğrafı çok büyük.`;
  return null;
}

const fail = (status, code, error, extra = {}) => ({ status, json: { error, code, ...extra } });
function guard(ip) {
  if (!apiKey()) return fail(503, 'no_key', 'Sunucuda GEMINI_API_KEY tanımlı değil.');
  if (rateLimited(ip)) return fail(429, 'rate', 'Çok fazla istek.', { retryAfterMs: 15_000 });
  return null;
}
function fromError(error, where) {
  console.error(where, error.code, error.message);
  return fail(error.status || 502, error.code || 'gemini', error.message, error.retryAfterMs ? { retryAfterMs: error.retryAfterMs } : {});
}

export function health() {
  return { status: 200, json: { ai: Boolean(apiKey()), models: models() } };
}

export async function analyze(body, ip) {
  const blocked = guard(ip);
  if (blocked) return blocked;
  const { before, after, ageGroup, menu } = body || {};
  const served = body?.served === true; // yemek öncesi (servis edilmiş) tabak: yalnızca gram ölçülür
  if (!after) return fail(400, 'bad_image', 'Yemek sonrası fotoğrafı gerekli.');
  const invalid = checkImage(before, 'Önce') || checkImage(after, 'Sonra');
  if (invalid) return fail(400, 'bad_image', invalid);
  try {
    const { value: raw, model } = await callWithFallback({
      apiKey: apiKey(), models: models(), baseUrl: baseUrl(), thinking: served ? 'medium' : 'low',
      body: buildAnalysisRequest({ before, after, served, lang: langOf(body), ageGroup: String(ageGroup || '6-13').slice(0, 10), menu: Array.isArray(menu) ? menu.slice(0, 8).map(m => String(m).slice(0, 40)) : [] })
    });
    return { status: 200, json: { ...normalizeAnalysis(raw), model } };
  } catch (error) { return fromError(error, 'analyze'); }
}

export async function suggest(body, ip) {
  const blocked = guard(ip);
  if (blocked) return blocked;
  const stats = Array.isArray(body?.stats) ? body.stats.slice(0, 5) : [];
  if (!stats.length) return fail(400, 'bad_request', 'Öneri için yemek istatistiği gerekli.');
  try {
    const { value: raw, model } = await callWithFallback({
      apiKey: apiKey(), models: models(), baseUrl: baseUrl(),
      body: buildSuggestionRequest({ stats, lang: langOf(body), ageGroup: String(body.ageGroup || '6-13').slice(0, 20), schoolName: String(body.schoolName || 'Pilot okul').slice(0, 60) })
    });
    return { status: 200, json: { ...normalizeSuggestions(raw), model } };
  } catch (error) { return fromError(error, 'suggest'); }
}

// Çalışan TTS modeli bulunana kadar listedeki modeller denenir; ses adı reddedilirse varsayılan sesle tekrar denenir.
let ttsModel = null;
export async function tts(body, ip) {
  const blocked = guard(ip);
  if (blocked) return blocked;
  const text = String(body?.text || '').slice(0, 400).trim();
  if (!text) return fail(400, 'bad_request', 'Seslendirilecek metin gerekli.');
  const mood = ['celebrate', 'encourage', 'gentle'].includes(body?.mood) ? body.mood : 'encourage';
  const candidates = [...new Set([ttsModel, ...ttsModels()].filter(Boolean))];
  let lastError;
  for (const candidate of candidates) {
    for (const withVoice of [true, false]) {
      try {
        const payload = await callGemini({
          apiKey: apiKey(), model: candidate, baseUrl: baseUrl(), raw: true, thinking: false,
          body: buildTtsRequest({ text, mood, lang: langOf(body), withVoice })
        });
        ttsModel = candidate;
        return { status: 200, json: extractAudio(payload) };
      } catch (error) {
        lastError = error;
        if (error.code === 'unreachable') return fromError(error, 'tts');
        if (['model', 'quota', 'busy'].includes(error.code)) break; // bu model yok ya da dolu: sıradaki ses modeline geç
      }
    }
  }
  return fromError(lastError || Object.assign(new Error('TTS kullanılamıyor.'), { code: 'model' }), 'tts');
}
