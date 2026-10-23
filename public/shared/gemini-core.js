// Tarayıcı ve sunucu tarafından ortak kullanılan Gemini istek/yanıt mantığı.
// Bağımlılık yok: hem Node 18+ hem tarayıcıda çalışır.

export const DEFAULT_MODEL = 'gemini-flash-latest';
// Yedek model zinciri. Ücretsiz katmanda kota model başına işler: biri dolunca ya da bulunamayınca sıradaki denenir.
export const MODEL_CHAIN = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
export const parseModels = value => String(value || '').split(',').map(s => s.trim()).filter(Boolean);
// TTS model adları sürümle değişebildiği için sırayla denenir; çalışan ilk model hatırlanır.
export const TTS_MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];

export const FOOD_CATEGORIES = ['kirmizi_et', 'tavuk_balik', 'baklagil', 'tahil', 'sebze', 'meyve', 'sut_urunu', 'corba', 'tatli', 'diger'];

const LANG_NAME = { tr: 'Türkçe', en: 'English (İngilizce)' };
const languageLine = lang => `DİL: foods[].name, childMessage, kitchenNote ve issue alanlarının tamamını ${LANG_NAME[lang] || LANG_NAME.tr} yaz.`;

const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    imageOk: { type: 'BOOLEAN', description: 'Fotoğrafta analiz edilebilir bir yemek tabağı/tepsisi var mı?' },
    personVisible: { type: 'BOOLEAN', description: 'Fotoğrafta bir insan yüzü veya kişi görünüyor mu?' },
    issue: { type: 'STRING', description: 'Sorun varsa kısa açıklama, yoksa boş metin.' },
    foods: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Yemeğin adı (ör. Mercimek çorbası).' },
          category: { type: 'STRING', enum: FOOD_CATEGORIES },
          servedGrams: { type: 'NUMBER', description: 'Servis edilen tahmini miktar (gram).' },
          leftoverPercent: { type: 'NUMBER', description: 'Servis edilen miktarın tabakta kalan yüzdesi, 0-100.' }
        },
        required: ['name', 'category', 'servedGrams', 'leftoverPercent']
      }
    },
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    childMessage: { type: 'STRING', description: '6-13 yaş için suçlamayan, en fazla 35 kelimelik geri bildirim.' },
    kitchenNote: { type: 'STRING', description: 'Mutfak için tek cümlelik gözlem.' }
  },
  required: ['imageOk', 'personVisible', 'issue', 'foods', 'confidence', 'childMessage', 'kitchenNote']
};

const SUGGESTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: 'Mutfak yetkilisi için 2 cümlelik özet.' },
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dish: { type: 'STRING' },
          type: { type: 'STRING', enum: ['menu', 'porsiyon', 'servis', 'sunum'] },
          title: { type: 'STRING', description: 'En fazla 8 kelimelik öneri başlığı.' },
          action: { type: 'STRING', description: 'Mutfağın yapacağı somut değişiklik, 1-2 cümle.' },
          rationale: { type: 'STRING', description: 'Veriye dayalı gerekçe, 1 cümle.' },
          expectedReductionPercent: { type: 'NUMBER', description: 'Bu yemeğin artığında beklenen göreli azalma, ihtiyatlı, 0-50.' }
        },
        required: ['dish', 'type', 'title', 'action', 'rationale', 'expectedReductionPercent']
      }
    }
  },
  required: ['summary', 'suggestions']
};

export function buildAnalysisRequest({ before, after, ageGroup = '6-13', menu = [], lang = 'tr' }) {
  const parts = [];
  const menuLine = menu.length ? `Bugünkü menü (ipucu, görüntüyle doğrula): ${menu.join(', ')}.` : 'Menü bilgisi verilmedi; yemekleri görüntüden tanı.';
  parts.push({ text: [
    'Sen bir okul yemekhanesi tabak artığı ölçüm asistanısın. Görevin yalnızca tabak/tepsideki yiyecekleri analiz etmek.',
    'GİZLİLİK: İnsanlar, yüzler, eller veya kimlik hakkında hiçbir çıkarım yapma. Fotoğrafta bir kişi veya yüz görünüyorsa personVisible=true yap, foods boş bırak.',
    before
      ? 'İki fotoğraf verildi: ÖNCE (servis edilen tabak) ve SONRA (yemek sonrası tabak). Her yemek için servedGrams değerini ÖNCE fotoğrafından, leftoverPercent değerini iki fotoğrafı karşılaştırarak tahmin et.'
      : 'Yalnızca yemek SONRASI fotoğrafı verildi. Hiç yenmemiş görünen bir yemekte servedGrams değerini tabakta GÖRDÜĞÜN miktardan tahmin et (tabak ~26 cm, çatal ~19 cm ölçek olarak) ve leftoverPercent=100 ver. Kısmen yenmiş ya da tamamen yenmiş yemeklerde servis miktarı için Türkiye okul yemeği standart porsiyonlarını kullan (çorba ~200 g, ana yemek ~150 g, pilav/makarna ~150 g, salata ~80 g, yoğurt ~150 g, meyve ~120 g, ekmek ~50 g); tamamen yenmiş yemekleri izlerinden (sos, kırıntı) tanıyabiliyorsan leftoverPercent=0 ile listele.',
    menuLine,
    `Öğrenci yaş grubu: ${ageGroup}.`,
    'Kategoriler: kirmizi_et, tavuk_balik, baklagil, tahil, sebze, meyve, sut_urunu, corba, tatli, diger.',
    'Tabak tamamen boşsa görebildiğin izlerden yemekleri yine listele ve leftoverPercent=0 ver. Görüntü bulanık veya tabak yoksa imageOk=false yap ve issue alanında nedenini söyle.',
    'childMessage: sıcak, suçlamayan; çocuğu kahraman gibi gören, bir sonraki öğün için tek küçük ve uygulanabilir öneri içeren, en fazla 35 kelime. Suçlayıcı ifadeler ("kötü", "israf ettin") kullanma. Sesli okunacağı için doğal, coşkulu konuşma dili kullan.',
    'kitchenNote: mutfak için tarafsız tek cümle (ör. hangi yemeğin neden kalmış olabileceği).',
    'Tahminlerinde dürüst ol; emin değilsen confidence=low ver.',
    languageLine(lang)
  ].join('\n') });
  if (before) {
    parts.push({ text: 'ÖNCE fotoğrafı:' });
    parts.push({ inline_data: { mime_type: before.mimeType, data: before.data } });
    parts.push({ text: 'SONRA fotoğrafı:' });
  }
  parts.push({ inline_data: { mime_type: after.mimeType, data: after.data } });
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: ANALYSIS_SCHEMA }
  };
}

export function buildSuggestionRequest({ stats, ageGroup = '6-13', schoolName = 'Pilot okul', lang = 'tr' }) {
  const lines = stats.map(s => `- ${s.dish} (${s.category}): ortalama artık %${s.avgLeftover}, ${s.samples} tabak, haftalık ~${s.wastedKgPerWeek} kg çöpe, en çok kalan gün: ${s.worstDay || 'bilinmiyor'}`);
  return {
    contents: [{ role: 'user', parts: [{ text: [
      `Sen Türkiye'de okul yemekhaneleriyle çalışan bir beslenme ve gıda israfı uzmanısın. Okul: ${schoolName}. Öğrenci yaş grubu: ${ageGroup}.`,
      'Aşağıda son haftaların tabak artığı ölçümlerine göre en çok artık bırakılan yemekler var:',
      ...lines,
      'Her yemek için TEK, somut ve düşük maliyetli bir öneri üret. Öneri türleri: menu (tarif/menü değişikliği), porsiyon (servis miktarı), servis (sıra, eşleştirme, seçim hakkı), sunum (şekil, isim, görünüm).',
      'Kurallar: Besin değerini koru; sebze/baklagili menüden çıkarmayı önerme, onun yerine çocukların seveceği bir forma veya eşleşmeye dönüştür (ör. ıspanağı köfte/börek formuna çevir, yanına sevilen yemeği koy). Türk okul menüsüne ve MEB okul beslenme yaklaşımına uygun ol. Çocukları suçlama.',
      'expectedReductionPercent ihtiyatlı olsun (literatürde menü iyileştirmesi ve nudge ile %10-35 aralığı görülür).',
      `DİL: summary, dish, title, action ve rationale alanlarının tamamını ${LANG_NAME[lang] || LANG_NAME.tr} yaz.`
    ].join('\n') }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: SUGGESTION_SCHEMA }
  };
}

// Çocuğa yönelik duygulu seslendirme: sonuca göre ton seçilir, ton yönergesi metnin başına eklenir.
const TTS_STYLE = {
  tr: {
    celebrate: 'Sesli oku: 7-10 yaş bir çocuğa, çizgi film kahramanı gibi neşeyle, coşkuyla ve gülümseyerek, alkışlar gibi kutlayarak söyle',
    encourage: 'Sesli oku: 7-10 yaş bir çocuğa, sıcak, sevecen ve cesaretlendirici bir sesle, heyecanlı bir abla/ağabey gibi söyle',
    gentle: 'Sesli oku: 7-10 yaş bir çocuğa, yumuşak, şefkatli ve umut veren bir sesle, sakin ama neşeli söyle'
  },
  en: {
    celebrate: 'Read aloud to a 7-10 year old child, joyfully and excitedly like a cartoon hero, smiling and celebrating',
    encourage: 'Read aloud to a 7-10 year old child in a warm, loving and encouraging voice, like an excited older sibling',
    gentle: 'Read aloud to a 7-10 year old child in a soft, caring and hopeful voice, calm but cheerful'
  }
};
const TTS_VOICE = { celebrate: 'Puck', encourage: 'Leda', gentle: 'Kore' };
export const moodFor = leftoverPercent => leftoverPercent <= 15 ? 'celebrate' : leftoverPercent <= 40 ? 'encourage' : 'gentle';

export function buildTtsRequest({ text, mood = 'encourage', lang = 'tr', withVoice = true }) {
  const style = (TTS_STYLE[lang] || TTS_STYLE.tr)[mood] || TTS_STYLE.tr.encourage;
  return {
    contents: [{ parts: [{ text: `${style}: ${text}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      ...(withVoice ? { speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE[mood] || 'Kore' } } } } : {})
    }
  };
}

export function extractAudio(payload) {
  const part = payload?.candidates?.[0]?.content?.parts?.find(p => p.inlineData || p.inline_data);
  const data = part?.inlineData || part?.inline_data;
  if (!data?.data) throw Object.assign(new Error('Gemini ses döndürmedi.'), { code: 'empty', status: 502 });
  const mimeType = data.mimeType || data.mime_type || 'audio/L16;rate=24000';
  return { mimeType, data: data.data, sampleRate: Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000) };
}

export function extractJson(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) {
    const reason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason;
    throw Object.assign(new Error(reason ? `Gemini yanıt vermedi (${reason}).` : 'Gemini boş yanıt döndürdü.'), { code: 'empty', status: 502 });
  }
  try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
  catch { throw Object.assign(new Error('Gemini yanıtı okunamadı.'), { code: 'format', status: 502 }); }
}

const clamp = (v, min, max) => Math.min(Math.max(Number.isFinite(v) ? v : 0, min), max);

export function normalizeAnalysis(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.foods)) throw Object.assign(new Error('Gemini beklenen biçimde yanıt vermedi.'), { code: 'format', status: 502 });
  const foods = raw.foods.slice(0, 8).map(f => {
    const servedGrams = Math.round(clamp(Number(f.servedGrams), 5, 600));
    const leftoverPercent = Math.round(clamp(Number(f.leftoverPercent), 0, 100));
    return {
      name: String(f.name || 'Yemek').slice(0, 40),
      category: FOOD_CATEGORIES.includes(f.category) ? f.category : 'diger',
      servedGrams,
      leftoverPercent,
      leftoverGrams: Math.round(servedGrams * leftoverPercent / 100)
    };
  });
  const served = foods.reduce((s, f) => s + f.servedGrams, 0);
  const left = foods.reduce((s, f) => s + f.leftoverGrams, 0);
  return {
    imageOk: raw.imageOk !== false,
    personVisible: raw.personVisible === true,
    issue: String(raw.issue || ''),
    foods: raw.personVisible === true ? [] : foods,
    servedGrams: served,
    leftoverGrams: left,
    totalLeftoverPercent: served ? Math.round(left / served * 100) : 0,
    confidence: ['low', 'medium', 'high'].includes(raw.confidence) ? raw.confidence : 'medium',
    childMessage: String(raw.childMessage || '').slice(0, 300),
    kitchenNote: String(raw.kitchenNote || '').slice(0, 300)
  };
}

export function normalizeSuggestions(raw) {
  if (!raw || !Array.isArray(raw.suggestions)) throw Object.assign(new Error('Gemini öneri listesi döndürmedi.'), { code: 'format', status: 502 });
  return {
    summary: String(raw.summary || ''),
    suggestions: raw.suggestions.slice(0, 5).map(s => ({
      dish: String(s.dish || ''),
      type: ['menu', 'porsiyon', 'servis', 'sunum'].includes(s.type) ? s.type : 'menu',
      title: String(s.title || ''),
      action: String(s.action || ''),
      rationale: String(s.rationale || ''),
      expectedReductionPercent: Math.round(clamp(Number(s.expectedReductionPercent), 0, 50))
    }))
  };
}

// Hız: bu görevler derin akıl yürütme gerektirmez; düşünme bütçesini düşük tutmak yanıt süresini belirgin kısaltır.
// Gemini 2.5 ailesi thinkingBudget, Gemini 3.x ailesi thinkingLevel kullanır. Model parametreyi reddederse
// istek bir kez parametresiz tekrarlanır ve bu model için bir daha gönderilmez.
const noThinkingConfig = new Set();
function thinkingConfigFor(model) {
  return /2\.5/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: 'low' };
}

// Ücretsiz kotada 429 yanıtı, ne kadar beklenmesi gerektiğini RetryInfo.retryDelay ("17s") ile bildirir.
function retryDelayMs(payload) {
  const info = payload?.error?.details?.find(d => String(d['@type'] || '').includes('RetryInfo'));
  const seconds = parseFloat(info?.retryDelay);
  return Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : null;
}

// Zaman aşımı yoktur: ücretsiz sürümde yanıt gecikebilir, istek kullanıcı iptal edene kadar beklenir.
export async function callGemini({ apiKey, model = DEFAULT_MODEL, body, fetchImpl = fetch, baseUrl = 'https://generativelanguage.googleapis.com', signal, raw = false, thinking = true }) {
  const send = async withThinking => {
    const request = withThinking
      ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: thinkingConfigFor(model) } }
      : body;
    const response = await fetchImpl(`${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(request),
      signal
    });
    return { response, payload: await response.json().catch(() => ({})) };
  };
  let result;
  try {
    const withThinking = thinking && !noThinkingConfig.has(model);
    result = await send(withThinking);
    if (withThinking && result.response.status === 400 && /thinking/i.test(result.payload?.error?.message || '')) {
      noThinkingConfig.add(model);
      result = await send(false);
    }
  } catch (error) {
    if (signal?.aborted) throw Object.assign(new Error('İşlem iptal edildi.'), { status: 499, code: 'aborted' });
    throw Object.assign(new Error('Gemini\'ye ulaşılamadı.'), { status: 502, code: 'unreachable' });
  }
  const { response, payload } = result;
  if (!response.ok) {
    const message = payload?.error?.message || `HTTP ${response.status}`;
    if (response.status === 429) throw Object.assign(new Error('Gemini ücretsiz kota sınırında.'), { status: 429, code: 'quota', retryAfterMs: retryDelayMs(payload) });
    throw Object.assign(new Error(`Gemini hatası: ${message}`), { status: response.status >= 500 ? 503 : 502, code: response.status === 404 ? 'model' : response.status >= 500 ? 'busy' : 'gemini', upstream: response.status });
  }
  return raw ? payload : extractJson(payload);
}

// Yedek modellerle çağrı. Bulunamayan model (404) bu çalışma süresince bir daha denenmez; kotası dolan model
// Gemini'nin bildirdiği süre boyunca atlanır. Hepsi kotadaysa en kısa bekleme süresiyle 'quota' hatası döner;
// istemci bu süre kadar bekleyip tekrar dener.
const unavailableModels = new Set();
const modelCooldown = new Map();
export async function callWithFallback({ models = MODEL_CHAIN, ...options }) {
  const usable = models.filter(m => !unavailableModels.has(m));
  if (!usable.length) throw Object.assign(new Error('Hiçbir Gemini modeli bulunamadı.'), { status: 502, code: 'model' });
  const now = Date.now();
  const ready = usable.filter(m => (modelCooldown.get(m) || 0) <= now);
  let lastError = null;
  let shortestWait = Infinity;
  for (const model of ready.length ? ready : usable) {
    try {
      const value = await callGemini({ ...options, model });
      modelCooldown.delete(model);
      return { value, model };
    } catch (error) {
      lastError = error;
      if (error.code === 'aborted' || error.code === 'unreachable') throw error; // ağ sorunu tüm modelleri etkiler
      if (error.code === 'model') { unavailableModels.add(model); continue; }
      if (error.code === 'quota') {
        const wait = error.retryAfterMs || 60_000;
        modelCooldown.set(model, Date.now() + wait);
        shortestWait = Math.min(shortestWait, wait);
        continue;
      }
      if (['busy', 'format', 'empty'].includes(error.code)) continue;
      throw error; // anahtar hatası gibi kalıcı hatalar: diğer modeller de aynı sonucu verir
    }
  }
  if (lastError?.code === 'quota' && Number.isFinite(shortestWait)) lastError.retryAfterMs = shortestWait;
  throw lastError;
}

// Hangi hataların beklenip tekrar denenmesi gerektiği (geçici olanlar).
export const isRetryable = code => ['quota', 'busy', 'unreachable', 'rate', 'timeout'].includes(code);
