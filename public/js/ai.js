// Gemini erişimi: önce sunucu (/api, anahtar gizli), yoksa kullanıcının kendi anahtarı, o da yoksa demo.
// Zaman aşımı yoktur. Kota/yoğunluk gibi geçici hatalarda beklenip sonuç alınana kadar tekrar denenir;
// yalnızca kullanıcı "İptal" derse durur.
import {
  TTS_MODELS, buildAnalysisRequest, buildSuggestionRequest, buildTtsRequest, callGemini, callWithFallback,
  extractAudio, isRetryable, normalizeAnalysis, normalizeSuggestions
} from '../shared/gemini-core.js';
import { DISH_CATALOG, getState } from './store.js';
import { getLang } from './i18n.js';

let serverAi = null;

export async function detectMode() {
  if (serverAi === null) {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      serverAi = res.ok && (await res.json()).ai === true;
    } catch { serverAi = false; }
  }
  if (serverAi) return 'server';
  return getState().apiKey ? 'direct' : 'demo';
}

async function postJson(path, body, signal) {
  let res;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch {
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { code: 'aborted' });
    throw Object.assign(new Error('unreachable'), { code: 'unreachable' });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Platform fonksiyonu süre sınırında kestiyse (504) bu da geçici sayılır ve tekrar denenir.
    const code = json.code || (res.status === 504 ? 'timeout' : res.status >= 500 ? 'busy' : 'gemini');
    throw Object.assign(new Error(json.error || `HTTP ${res.status}`), { code, retryAfterMs: json.retryAfterMs });
  }
  return json;
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('aborted'), { code: 'aborted' })); }, { once: true });
});
const BACKOFF = [4000, 8000, 15000, 25000, 40000, 60000];

// onWait({ attempt, waitMs, code }) ilerleme kartında "tekrar denenecek" bilgisini göstermek için çağrılır.
// maxAttempts verilmezse sonuç gelene kadar dener (analiz ve öneriler); ses için sınırlıdır, çünkü yedeği vardır.
async function withRetry(fn, { signal, onWait, maxAttempts = Infinity } = {}) {
  for (let attempt = 1; ; attempt++) {
    try { return await fn(); }
    catch (error) {
      if (signal?.aborted || error.code === 'aborted') throw Object.assign(error, { code: 'aborted', aborted: true });
      if (!isRetryable(error.code) || attempt >= maxAttempts) throw error;
      const waitMs = Math.max(error.retryAfterMs || 0, BACKOFF[Math.min(attempt - 1, BACKOFF.length - 1)]);
      onWait?.({ attempt, waitMs, code: error.code });
      await sleep(waitMs, signal);
      onWait?.(null);
    }
  }
}

// Sunucusuz örnekler birkaç dakika boşta kalınca uyur; 4 dakikada bir en fazla bir ısıtma isteği gönderilir.
const warmed = new Map();
export async function warmUp(path) {
  if (Date.now() - (warmed.get(path) || 0) < 240_000 || (await detectMode()) !== 'server') return;
  warmed.set(path, Date.now());
  fetch(path, { method: 'GET', cache: 'no-store' }).catch(() => warmed.delete(path));
}

// Son analiz sürelerinden beklenen süreyi tahmin eder (ilerleme çubuğu için).
const TIMING_KEY = 'kirinti.timing';
export function expectedMs(kind) {
  const fallback = { analyze: 8000, suggest: 7000, tts: 6000 }[kind] || 7000;
  try { return JSON.parse(localStorage.getItem(TIMING_KEY) || '{}')[kind] || fallback; }
  catch { return fallback; }
}
function recordMs(kind, ms) {
  try {
    const all = JSON.parse(localStorage.getItem(TIMING_KEY) || '{}');
    all[kind] = Math.round(all[kind] ? all[kind] * 0.6 + ms * 0.4 : ms);
    localStorage.setItem(TIMING_KEY, JSON.stringify(all));
  } catch {}
}
async function timed(kind, fn) {
  const start = performance.now();
  const value = await fn();
  const ms = performance.now() - start;
  if (value.mode !== 'demo' && !value.cached) recordMs(kind, ms);
  return { ...value, ms };
}
const demoDelay = signal => sleep(900, signal);

// Kendi anahtarıyla doğrudan bağlantı: sunucudaki gibi yedek model zinciriyle çağırır.
async function direct(body, normalize, signal, thinking = 'low') {
  const { value, model } = await callWithFallback({ apiKey: getState().apiKey, body, signal, thinking });
  return { ...normalize(value), model };
}

export function analyzePlate({ before, after, ageGroup, menu, served = false }, { signal, onWait } = {}) {
  const lang = getLang();
  return timed('analyze', async () => {
    const mode = await detectMode();
    if (mode === 'demo') { await demoDelay(signal); return { mode, result: demoAnalysis(menu) }; }
    const result = await withRetry(async () => mode === 'server'
      ? postJson('/api/analyze', { before, after, ageGroup, menu, lang, served }, signal)
      : direct(buildAnalysisRequest({ before, after, ageGroup, menu, lang, served }), normalizeAnalysis, signal, served ? 'medium' : 'low'),
    { signal, onWait });
    return { mode, result };
  });
}

// Aynı veri için öneriyi tekrar istemez; mutfak paneli yeniden açıldığında anında gelir.
const suggestionCache = new Map();
export function suggestMenu({ stats, ageGroup, schoolName }, { signal, onWait } = {}) {
  const lang = getLang();
  return timed('suggest', async () => {
    const mode = await detectMode();
    const key = JSON.stringify([mode, lang, stats.map(s => [s.dish, s.avgLeftover, s.samples])]);
    if (suggestionCache.has(key)) return { mode, result: suggestionCache.get(key), cached: true };
    let result;
    if (mode === 'demo') { await demoDelay(signal); result = demoSuggestions(stats, lang); }
    else result = await withRetry(async () => mode === 'server'
      ? postJson('/api/suggest', { stats, ageGroup, schoolName, lang }, signal)
      : direct(buildSuggestionRequest({ stats, ageGroup, schoolName, lang }), normalizeSuggestions, signal),
    { signal, onWait });
    suggestionCache.set(key, result);
    return { mode, result };
  });
}

// Gemini TTS: ham PCM döner, tarayıcıda WAV'a sarılır. Demo modunda null döner (tarayıcı sesi kullanılır).
let directTtsModel = null;
export async function synthesize({ text, mood }, { signal, onWait } = {}) {
  const lang = getLang();
  const mode = await detectMode();
  if (mode === 'demo') return null;
  return timed('tts', async () => {
    const audio = await withRetry(async () => {
      if (mode === 'server') return postJson('/api/tts', { text, mood, lang }, signal);
      let lastError;
      for (const model of [directTtsModel, ...TTS_MODELS].filter(Boolean)) {
        for (const withVoice of [true, false]) {
          try {
            const payload = await callGemini({ apiKey: getState().apiKey, model, raw: true, thinking: false, body: buildTtsRequest({ text, mood, lang, withVoice }), signal });
            directTtsModel = model;
            return extractAudio(payload);
          } catch (error) {
            lastError = error;
            if (isRetryable(error.code) || error.code === 'aborted') throw error;
            if (error.code === 'model') break;
          }
        }
      }
      throw lastError;
    }, { signal, onWait, maxAttempts: 2 });
    return { mode, result: audio };
  });
}

// ---- Görüntü hazırlama: küçült, JPEG'e çevir, meta verileri (EXIF/konum) at ----
// 768 px: Gemini görüntüyü 768x768 karolara böler; tek karo hem token sayısını hem yükleme süresini düşürür,
// tabak artığı tahmini için yeterli ayrıntıyı korur.
export async function prepareImage(source, maxSide = 768) {
  const src = typeof source === 'string' ? source : URL.createObjectURL(source);
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(Object.assign(new Error('bad_photo'), { code: 'bad_photo' }));
    el.src = src;
  }).finally(() => { if (src !== source) URL.revokeObjectURL(src); });
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  const data = dataUrl.split(',')[1];
  return { mimeType: 'image/jpeg', data, preview: dataUrl, bytes: Math.round(data.length * 0.75) };
}

// ---- Demo modu (API yokken arayüz akışını göstermek için; ekranda "Demo" etiketiyle) ----
function demoAnalysis(menu) {
  const names = menu.length ? menu : ['Mercimek çorbası', 'Pirinç pilavı', 'Mevsim salatası', 'Yoğurt'];
  const foods = names.map((name, i) => {
    const [category, servedGrams, base] = DISH_CATALOG[name] || ['diger', 120, 15];
    const leftoverPercent = Math.round(Math.min(90, base * (0.7 + ((i * 37) % 10) / 10)));
    return { name, category, servedGrams, leftoverPercent };
  });
  const en = getLang() === 'en';
  return normalizeAnalysis({
    imageOk: true, personVisible: false, issue: '', foods, confidence: 'medium',
    childMessage: en
      ? 'You are a superstar! You finished most of your plate and earned points for your planet. How about one more bite of salad tomorrow? Your hero is cheering for you!'
      : 'Süpersin! Tabağının çoğunu bitirdin ve gezegenine puan kazandırdın. Yarın salatadan bir çatal fazla denemeye ne dersin? Kahramanın seni bekliyor!',
    kitchenNote: en ? 'Demo data: salad and vegetable dish leftovers look higher.' : 'Demo verisi: salata ve sebze yemeğinde artık daha yüksek görünüyor.'
  });
}

function demoSuggestions(stats, lang) {
  const en = lang === 'en';
  const byDish = {
    'Ispanak yemeği': ['menu', en ? 'Turn spinach into fritters or börek' : 'Ispanağı börek ya da köfte formuna çevir', en ? 'Once a week, serve spinach-and-cheese börek or spinach fritters instead of the stew; nutrition is kept.' : 'Haftada bir ıspanak yemeği yerine ıspanaklı peynirli börek veya ıspanaklı mücver servis edin; besin değeri korunur.'],
    'Mevsim salatası': ['servis', en ? 'Serve salad in a small bowl next to the main' : 'Salatayı ana yemeğin yanına küçük kâsede ver', en ? 'Put the salad in a small bowl with a lemon dressing next to the main dish instead of a separate tray slot; allow second helpings.' : 'Salatayı tepsinin ayrı bölmesine değil, ana yemeğin yanına küçük kâsede ve limonlu sosla verin; isteyen ikinci kez alsın.'],
    'Taze fasulye': ['sunum', en ? 'Serve green beans with mince and yoghurt' : 'Taze fasulyeyi kıymalı ve yoğurtla sun', en ? 'Cook with a little minced meat instead of olive-oil style and add yoghurt on the side; a familiar pairing for children.' : 'Zeytinyağlı yerine az kıymalı pişirip yanına yoğurt koyun; çocukların tanıdık bulduğu bir eşleşme olur.']
  };
  const ideas = {
    sebze: ['menu', en ? 'Turn the vegetable into a loved format' : 'Sebzeyi sevilen bir forma dönüştür', en ? 'Once a week, serve it inside meatballs, börek or an omelette; nutrition is kept and it looks familiar.' : 'Yemeği haftada bir kez köfte, börek ya da omlet içinde servis edin; besin değeri korunur, görünüm çocuklara tanıdık gelir.'],
    baklagil: ['servis', en ? 'Pair it with a favourite dish' : 'Sevilen yemekle eşleştir', en ? 'On legume days, pair with bulgur pilaf and ayran that children like.' : 'Baklagil gününde yanına çocukların sevdiği bulgur pilavı ve ayran koyun.'],
    meyve: ['sunum', en ? 'Serve fruit sliced' : 'Meyveyi dilimleyerek servis et', en ? 'Serve sliced fruit instead of whole fruit; younger children finish more.' : 'Bütün meyve yerine dilimlenmiş meyve verin; küçük yaşlarda bitirme oranı artar.'],
    tahil: ['porsiyon', en ? 'Make bread optional' : 'Ekmeği isteğe bağlı ver', en ? 'Instead of placing bread on every tray, let children take it from a basket.' : 'Ekmeği tepsiye otomatik koymak yerine ayrı sepetten isteyen alsın.'],
    diger: ['porsiyon', en ? 'Smaller first portion, seconds allowed' : 'Porsiyonu küçült, tekrar hakkı ver', en ? 'Reduce the first portion by 20% and offer a second helping on request.' : 'İlk porsiyonu %20 küçültün ve isteyen çocuğa ikinci servis yapın.']
  };
  return {
    summary: en ? 'Demo suggestions: Gemini is not connected, so rule-based sample suggestions are shown.' : 'Demo önerileri: Gemini bağlı olmadığı için kurallara dayalı örnek öneriler gösteriliyor.',
    suggestions: stats.slice(0, 3).map(s => {
      const [type, title, action] = byDish[s.dish] || ideas[s.category] || ideas.diger;
      return { dish: s.dish, type, title, action, rationale: en ? `Average leftover ${s.avgLeftover}%; ~${s.wastedKgPerWeek} kg a week.` : `Ortalama artık %${s.avgLeftover}; haftada ~${s.wastedKgPerWeek} kg.`, expectedReductionPercent: 20 };
    })
  };
}
