import * as S from './store.js';
import { analyzePlate, detectMode, expectedMs, prepareImage, suggestMenu, warmUp } from './ai.js';
import { DAILY_NEEDS, FACTORS, nutrientLoss } from './impact.js';
import { drawSampleTray, SAMPLE_MENU } from './sample-tray.js';
import { LANGUAGES, category, date, dayLabel, dish, flag, getLang, kg, num, pct, sec, setLang, t, translateStatic } from './i18n.js';
import { compareBars, pairedBars, pilotScatter, weeklyChart } from './charts.js';
import { FOOD_GROUPS, INTERVENTIONS, METHODS, REFERENCES, SOLUTIONS, WORLD_GRAMS, WORLD_PERCENT } from './evidence.js';
import { forecast } from './forecast.js';
import { clearResults, getResults, loadManifest, runPilot, summarizePilot } from './pilot.js';
import { speak, stopVoice } from './voice.js';
import { endTour, isTouring, refreshTour, startTour } from './tour.js';
import { impactSummary, SCALE } from './metrics.js';
import { printReport } from './report.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const TABS = { measure: 'olc', class: 'sinif', kitchen: 'mutfak', impact: 'etki', evidence: 'kanit' };
const MODE_LABEL = { server: 'Gemini bağlı', direct: 'Gemini (kendi anahtarın)', demo: 'Demo modu' };
const TYPE_LABEL = { menu: 'Menü', porsiyon: 'Porsiyon', servis: 'Servis', sunum: 'Sunum' };
const CONF_LABEL = { low: 'düşük', medium: 'orta', high: 'yüksek' };
const ERROR_TEXT = {
  no_key: 'Sunucuda Gemini anahtarı tanımlı değil.',
  bad_image: 'Fotoğraf geçersiz ya da çok büyük. Başka bir fotoğraf dene.',
  bad_photo: 'Fotoğraf okunamadı. Başka bir fotoğraf dene.',
  bad_request: 'İstek eksik. Sayfayı yenileyip tekrar dene.',
  format: 'Gemini beklenmeyen bir yanıt verdi. Tekrar dene.',
  empty: 'Gemini boş yanıt döndürdü. Tekrar dene.',
  model: 'Seçilen Gemini modeli bulunamadı. Sunucudaki GEMINI_MODEL ayarını kontrol et.',
  gemini: 'Gemini isteği reddetti. API anahtarını kontrol et.'
};
const WAIT_TEXT = {
  quota: 'Gemini ücretsiz kotası şu an dolu.',
  rate: 'Çok sık istek gönderildi.',
  busy: 'Gemini şu an yoğun.',
  unreachable: 'Bağlantı kurulamadı.',
  timeout: 'Sunucu yanıtı zaman aşımına uğradı.'
};
const errorText = e => t(ERROR_TEXT[e?.code] || 'Beklenmeyen bir hata oluştu.');

let mode = 'demo';
const measure = { classId: null, menuText: '', before: null, after: null, result: null, record: null, busy: false, error: null, controller: null, ms: 0 };
let selectedClass = null;
let kitchenRange = 'week';
let suggestBusy = false;
let suggestController = null;
let pilotRun = null; // { controller, index, total, title }
let voiceState = null; // null | 'loading' | 'playing'
let voiceController = null;
let confirmReset = null;

// ---------- Ortak parçalar ----------
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 3200);
}

function planetSvg(score, size = 120) {
  const s = score ?? 75;
  const mood = s >= 85 ? 'happy' : s >= 72 ? 'ok' : 'sad';
  const mouth = mood === 'happy' ? 'M44 70 Q60 86 76 70' : mood === 'ok' ? 'M46 72 Q60 80 74 72' : 'M46 76 Q60 70 74 76';
  const trees = mood === 'happy' ? '<g fill="#2e7d4f"><path d="M30 24 l6 -12 l6 12z"/><path d="M84 20 l5 -10 l5 10z"/><path d="M92 92 l5 -9 l5 9z"/></g>' : '';
  const label = { happy: 'çok mutlu', ok: 'mutlu', sad: 'biraz yorgun' }[mood];
  return `<svg class="planet" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${esc(t('Sınıfın gezegeni: {mood}', { mood: t(label) }))}">
    <circle cx="60" cy="60" r="50" fill="${mood === 'sad' ? '#7aa7cf' : '#4f9be0'}"/>
    <path d="M22 44c10-8 22-6 26 2s16 6 18-2 16-10 26 0c4 10-4 16-14 16s-12 10-22 10-18-6-26-4-12-12-8-22Z" fill="${mood === 'sad' ? '#9bbf8a' : '#5dbb6f'}"/>
    <path d="M30 88c8 4 16 2 22 6s14 2 20-2" stroke="#5dbb6f" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${trees}
    <circle cx="46" cy="56" r="5" fill="#1d2b24"/><circle cx="74" cy="56" r="5" fill="#1d2b24"/>
    <circle cx="48" cy="54" r="1.6" fill="#fff"/><circle cx="76" cy="54" r="1.6" fill="#fff"/>
    <path d="${mouth}" stroke="#1d2b24" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${mood === 'happy' ? '<circle cx="38" cy="68" r="5" fill="#f4a4a4" opacity=".7"/><circle cx="82" cy="68" r="5" fill="#f4a4a4" opacity=".7"/>' : ''}
  </svg>`;
}

function sampleBanner() {
  if (!S.hasSample()) return '';
  return `<div class="banner">
    <strong>${t('Örnek pilot verisi')}</strong>
    <p>${t('Geçmiş haftalar sentetik örnek veridir (1 hafta baseline + 3 hafta müdahale), gerçek pilot sonucu değildir. Ölç sekmesinde yaptığın her yeni ölçüm buraya eklenir.')}</p>
    <button class="link" data-action="clear-sample">${t('Örnek veriyi kaldır')}</button>
  </div>`;
}

function foodBars(foods) {
  return `<ul class="bars">${foods.map(f => `
    <li><span class="bar-label">${esc(dish(f.name))}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, f.leftoverPercent)}%"></span></span>
      <span class="bar-value">${pct(f.leftoverPercent)}</span></li>`).join('')}</ul>`;
}

// Besin kaybı: tabakta kalan yemekle çocuğun alamadığı enerji, protein, lif ve demir.
function nutrientBlock(loss, { title, perWhat = '' } = {}) {
  const items = [
    ['kcal', 'enerji', `${num(loss.kcal)} kcal`],
    ['protein', 'protein', `${num(loss.protein, 1)} g`],
    ['fiber', 'lif', `${num(loss.fiber, 1)} g`],
    ['iron', 'demir', `${num(loss.iron, 1)} mg`]
  ];
  return `<div class="nutrients">
    <h3>${esc(title || t('Tabakta kalan besin'))}${perWhat ? ` <small>${esc(perWhat)}</small>` : ''}</h3>
    <div class="nutrient-grid">${items.map(([key, label, value]) => {
      const share = loss[key] / DAILY_NEEDS[key] * 100;
      return `<div class="nutrient"><strong>${value}</strong><span>${t(label)}</span>
        <span class="mini-track" title="${esc(t('Günlük ihtiyacın {pct} kadarı', { pct: pct(share) }))}"><span style="width:${Math.min(100, share * 2)}%"></span></span>
        <em>${t('günlük ihtiyacın {pct}', { pct: pct(share) })}</em></div>`;
    }).join('')}</div>
  </div>`;
}

// ---------- Uzun süren yapay zekâ işlemleri için ilerleme göstergesi ----------
const ANALYZE_STAGES = ['Fotoğraflar hazırlandı', 'Gemini\'ye gönderiliyor', 'Yemekler tanınıyor', 'Kalan miktar hesaplanıyor', 'Çocuk mesajı yazılıyor'];
const SUGGEST_STAGES = ['Yemek verileri toplandı', 'Gemini\'ye gönderiliyor', 'Artık örüntüleri inceleniyor', 'Menü önerileri yazılıyor'];
const tickers = {};
const waits = {};

function progressCard(id, title, stages, note = '') {
  return `<div class="card progress" id="${id}" role="status" aria-live="polite">
    <div class="progress-head"><span class="spinner"></span><strong>${esc(title)}</strong><span class="elapsed" data-elapsed>${sec(0)}</span></div>
    <div class="bar-track big" aria-hidden="true"><span class="bar-fill progress-fill" data-fill></span></div>
    <ol class="stages">${stages.map((s, i) => `<li data-stage="${i}">${esc(t(s))}</li>`).join('')}</ol>
    ${note ? `<p class="small-muted">${note}</p>` : ''}
    <p class="retry-note" data-retry hidden></p>
    <p class="slow-note" data-slow hidden>${t('Ücretsiz Gemini sürümünde yanıt uzun sürebilir; bu normal. Sonuç gelene kadar bekleniyor, istersen iptal edebilirsin.')}</p>
    <button class="btn small ghost" data-action="cancel" data-target="${id}">${t('İptal')}</button>
  </div>`;
}

// Gerçek ilerleme bilinmediği için beklenen süreye göre asimptotik ilerler: hiçbir zaman %100'e ulaşmaz,
// yanıt geldiğinde kart kaybolur. Kart yeniden çizilse bile id ile bulunduğu için sayaç devam eder.
function startTicker(id, startedAt, expected) {
  stopTicker(id);
  const tick = () => {
    const root = document.getElementById(id);
    if (!root) return;
    const elapsed = performance.now() - startedAt;
    const frac = 1 - Math.exp(-1.9 * elapsed / expected);
    const stages = root.querySelectorAll('[data-stage]');
    const active = Math.min(stages.length - 1, 1 + Math.floor(frac * (stages.length - 1)));
    root.querySelector('[data-fill]').style.width = `${Math.max(4, frac * 95)}%`;
    root.querySelector('[data-elapsed]').textContent = sec(elapsed);
    stages.forEach((li, i) => { li.className = i < active ? 'done' : i === active ? 'active' : ''; });
    const w = waits[id];
    const retry = root.querySelector('[data-retry]');
    retry.hidden = !w;
    if (w) retry.textContent = t('{reason} {s} sn sonra otomatik tekrar denenecek (deneme {n}). Sonuç gelene kadar bekleniyor.', { reason: t(WAIT_TEXT[w.code] || WAIT_TEXT.busy), s: Math.max(0, Math.ceil((w.until - Date.now()) / 1000)), n: w.attempt + 1 });
    root.querySelector('[data-slow]').hidden = Boolean(w) || elapsed < Math.max(12000, expected * 2.2);
  };
  tick();
  tickers[id] = setInterval(tick, 200);
}
function stopTicker(id) {
  clearInterval(tickers[id]);
  delete tickers[id];
  delete waits[id];
}
const waitHandler = id => info => { waits[id] = info && { ...info, until: Date.now() + info.waitMs }; };

// ---------- ÖLÇ ----------
function renderMeasure() {
  const { classes } = S.getState().settings;
  if (!measure.classId || !classes.find(c => c.id === measure.classId)) measure.classId = classes[0]?.id;
  if (!measure.menuText) measure.menuText = S.menuFor(S.today()).map(dish).join(', ');
  const slot = (key, title, hint) => {
    const img = measure[key];
    return `<div class="photo-slot ${img ? 'filled' : ''}">
      <span class="slot-title">${title}</span>
      ${img ? `<img src="${img.preview}" alt="${esc(t('{title} fotoğrafı önizlemesi', { title }))}">` : `<div class="slot-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/></svg><small>${hint}</small></div>`}
      <label class="btn small ${img ? 'ghost' : ''}">${img ? t('Değiştir') : t('Fotoğraf çek / seç')}<input type="file" accept="image/*" capture="environment" data-photo="${key}" hidden></label>
      ${img ? `<button class="link" data-action="remove-photo" data-key="${key}">${t('Kaldır')}</button>` : ''}
    </div>`;
  };
  $('#view-measure').innerHTML = `
    <div class="card intro">
      <h1>${t('Bir tabak fotoğrafı, daha az israf.')}</h1>
      <p>${t('Yemekten önce ve sonra yalnızca tabağın fotoğrafını çek; Gemini hangi yemeğin ne kadar kaldığını ölçsün, çocuğa geri bildirim, mutfağa veri versin.')}</p>
    </div>
    <div class="card ${measure.busy ? 'is-busy' : ''}" id="measure-form">
      <span class="field-label">${t('Sınıf')}</span>
      <div class="chips" role="radiogroup" aria-label="${esc(t('Sınıf'))}">${classes.map(c => `<button role="radio" aria-checked="${c.id === measure.classId}" class="chip ${c.id === measure.classId ? 'on' : ''}" data-action="pick-class" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>
      <label class="field-label" for="menu-input">${t('Bugünün menüsü')} <small>${t('(Gemini\'ye ipucu)')}</small></label>
      <input id="menu-input" class="input" value="${esc(measure.menuText)}" placeholder="${esc(t('Mercimek çorbası, Pilav, Salata'))}">
      <div class="photo-grid">
        ${slot('before', t('1 · Önce'), t('İsteğe bağlı, servis edilen tabak'))}
        ${slot('after', t('2 · Sonra'), t('Yemek bittikten sonra'))}
      </div>
      <button class="btn ghost full" data-action="sample-tray">${t('Elinde tabak yok mu? Örnek tepsiyle dene')}</button>
      <p class="privacy"><strong>${t('Mahremiyet:')}</strong> ${t('Yalnızca tabağı çek, yüz ya da kişi görünmesin. Fotoğraflar küçültülüp yalnızca analiz için gönderilir; cihazda veya sunucuda saklanmaz. Kişi algılanırsa ölçüm kaydedilmez.')}</p>
      <button class="btn primary full" data-action="analyze" ${measure.after && !measure.busy ? '' : 'disabled'}>
        ${measure.busy ? `<span class="spinner"></span> ${t('Analiz ediliyor…')}` : `${mode === 'demo' ? t('Demo analizi yap') : t('Gemini ile analiz et')} →`}
      </button>
      ${mode === 'demo' ? `<p class="hint">${t('Demo modundasın: sonuç örnek veriyle üretilir. Gerçek analiz için uygulama sunucusunda Gemini anahtarı olmalı ya da Ayarlar\'dan kendi anahtarını girebilirsin.')}</p>` : ''}
    </div>
    <div id="measure-result">${renderResult()}</div>`;
}

function renderResult() {
  if (measure.busy) {
    const kb = Math.round(((measure.before?.bytes || 0) + (measure.after?.bytes || 0)) / 1024);
    return progressCard('measure-progress', mode === 'demo' ? t('Demo analizi hazırlanıyor') : t('Gemini tabağı inceliyor'), ANALYZE_STAGES,
      t('{photos} · {kb} KB gönderiliyor · genelde {s} civarı sürer', { photos: measure.before ? t('2 fotoğraf') : t('1 fotoğraf'), kb, s: sec(expectedMs('analyze')) }));
  }
  if (measure.error) return `<div class="card warn"><strong>${t('Ölçüm kaydedilmedi')}</strong><p>${esc(measure.error)}</p>
    ${measure.after ? `<button class="btn small" data-action="analyze">${t('Tekrar dene')}</button>` : ''}</div>`;
  const r = measure.result, rec = measure.record;
  if (!r || !rec) return '';
  const points = 100 - r.totalLeftoverPercent;
  const cls = S.getState().settings.classes.find(c => c.id === rec.classId);
  const loss = nutrientLoss(r.foods);
  const cups = Math.round(rec.waterL / 0.25), charges = Math.round(rec.co2g / 8);
  const equivalents = [cups >= 1 && t('{n} bardak su', { n: num(cups) }), charges >= 1 && t('{n} telefon şarjı kadar karbon', { n: num(charges) })].filter(Boolean);
  return `<div class="card result">
    <div class="result-head">
      <span class="badge ${rec.source === 'demo' ? 'muted' : 'good'}">${rec.source === 'demo' ? t('Demo verisi') : t('Gemini analizi')}</span>
      <span class="small-muted">${t('Güven: {c}', { c: t(CONF_LABEL[r.confidence]) })} · ${esc(cls?.name || '')}${measure.ms ? ` · ${sec(measure.ms)}` : ''}${r.model ? ` · <span title="${esc(t('Yanıt veren Gemini modeli'))}">${esc(r.model)}</span>` : ''}</span>
    </div>
    <div class="hero">
      ${planetSvg(points, 110)}
      <div>
        <div class="hero-number">+${points}</div>
        <div class="hero-label">${t('gezegen puanı')}</div>
        <div class="small-muted">${t('Tabakta kalan: {pct} · ~{kg}', { pct: pct(r.totalLeftoverPercent), kg: kg(r.leftoverGrams) })}</div>
      </div>
    </div>
    ${r.childMessage ? `<div class="child-msg" id="child-msg"><p>${esc(r.childMessage)}</p>
      <button class="btn small voice-btn ${voiceState ? 'on' : ''}" data-action="voice" aria-pressed="${voiceState === 'playing'}">${voiceButtonLabel()}</button></div>` : ''}
    <h3>${t('Yemek bazında kalan')}</h3>
    ${r.foods.length ? foodBars(r.foods) : `<p class="small-muted">${t('Tabakta tanınan yemek bulunamadı.')}</p>`}
    <div class="equiv">
      <div><strong>${num(rec.waterL, 1)} L</strong><span>${t('su ayak izi')}</span></div>
      <div><strong>${num(rec.co2g)} g</strong><span>CO₂e</span></div>
      ${equivalents.length ? `<p>${t('Tabakta kalan yemeğin yolculuğu ≈ {eq}.', { eq: equivalents.join(t(' ve ')) })}</p>` : `<p>${t('Neredeyse hiç artık yok, harika!')}</p>`}
    </div>
    ${nutrientBlock(loss)}
    ${r.kitchenNote ? `<p class="note"><strong>${t('Mutfak notu:')}</strong> ${esc(r.kitchenNote)}</p>` : ''}
    <form class="calibrate" data-form="weigh">
      <label for="weigh-input">${t('Tartım (kalibrasyon, isteğe bağlı): tabakta kalan gerçek ağırlık')}</label>
      <div class="row"><input id="weigh-input" class="input" type="number" inputmode="numeric" min="0" max="2000" placeholder="g" value="${rec.weighedGrams ?? ''}"><button class="btn small" type="submit">${t('Kaydet')}</button></div>
      <small>${t('Tartım girildikçe Etki ekranında yapay zekâ tahmininin gerçek ağırlıktan ortalama sapması hesaplanır.')}</small>
    </form>
    <button class="btn primary full" data-action="next-plate">${t('Sıradaki tabak')}</button>
  </div>`;
}

function voiceButtonLabel() {
  const icon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z"/></svg>';
  if (voiceState === 'loading') return `<span class="spinner"></span> ${t('Ses hazırlanıyor…')}`;
  if (voiceState === 'playing') return `${icon} ${t('Durdur')}`;
  return `${icon} ${t('Kahramanın sesini dinle')}`;
}
function refreshVoiceButton() {
  const btn = $('[data-action=voice]');
  if (!btn) return;
  btn.innerHTML = voiceButtonLabel();
  btn.classList.toggle('on', Boolean(voiceState));
  btn.setAttribute('aria-pressed', String(voiceState === 'playing'));
}

async function toggleVoice() {
  if (voiceState) {
    voiceController?.abort();
    stopVoice();
    voiceState = null;
    return refreshVoiceButton();
  }
  const r = measure.result;
  if (!r?.childMessage) return;
  voiceState = 'loading';
  voiceController = new AbortController();
  refreshVoiceButton();
  try {
    const source = await speak({ text: r.childMessage, leftoverPercent: r.totalLeftoverPercent }, {
      signal: voiceController.signal,
      started: () => { voiceState = 'playing'; refreshVoiceButton(); }
    });
    if (source === 'browser' && mode !== 'demo') toast(t('Gemini sesi alınamadı; cihazın kendi sesi kullanıldı.'));
  } catch (error) {
    if (error.code !== 'aborted') toast(t('Ses çalınamadı.'));
  }
  voiceState = null;
  voiceController = null;
  refreshVoiceButton();
}

async function onPhoto(input) {
  const file = input.files?.[0];
  if (!file) return;
  warmUp('/api/analyze');
  try {
    measure[input.dataset.photo] = await prepareImage(file);
    measure.result = measure.record = measure.error = null;
  } catch (e) { toast(errorText(e)); }
  renderMeasure();
}

async function useSampleTray() {
  warmUp('/api/analyze');
  measure.before = await prepareImage(drawSampleTray('before'));
  measure.after = await prepareImage(drawSampleTray('after'));
  measure.menuText = SAMPLE_MENU.map(dish).join(', ');
  measure.result = measure.record = measure.error = null;
  renderMeasure();
  if (!isTouring()) toast(t('Örnek tepsi yüklendi. Şimdi analiz et.'));
}

async function runAnalysis() {
  if (!measure.after || measure.busy) return;
  stopVoice(); voiceState = null;
  measure.busy = true; measure.error = null; measure.result = measure.record = null;
  measure.controller = new AbortController();
  renderMeasure();
  startTicker('measure-progress', performance.now(), expectedMs('analyze'));
  if (!isTouring()) $('#measure-result')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const cls = S.getState().settings.classes.find(c => c.id === measure.classId);
  const menu = measure.menuText.split(',').map(s => s.trim()).filter(Boolean);
  try {
    const { mode: used, result, ms } = await analyzePlate(
      { before: measure.before && strip(measure.before), after: strip(measure.after), ageGroup: cls?.ageGroup, menu },
      { signal: measure.controller.signal, onWait: waitHandler('measure-progress') });
    if (result.personVisible) throw Object.assign(new Error(), { message: t('Fotoğrafta bir kişi veya yüz algılandı. Gizlilik için ölçüm kaydedilmedi; lütfen yalnızca tabağı çekerek tekrar dene.'), shown: true });
    if (!result.imageOk || !result.foods.length) throw Object.assign(new Error(), { message: result.issue || t('Fotoğrafta analiz edilebilir bir tabak bulunamadı. Daha yakından ve iyi ışıkta tekrar çek.'), shown: true });
    measure.result = result;
    measure.ms = ms;
    measure.record = S.addMeasurement(result, { classId: measure.classId, source: used === 'demo' ? 'demo' : 'gemini', lang: getLang() });
  } catch (e) {
    if (e.code === 'aborted') toast(t('Analiz iptal edildi.'));
    else measure.error = e.shown ? e.message : errorText(e);
  }
  stopTicker('measure-progress');
  measure.busy = false;
  measure.controller = null;
  if (currentTab() !== 'measure') {
    if (measure.result) toast(t('Tabak analizi hazır. Sonuç Ölç sekmesinde.'));
    return;
  }
  renderMeasure();
  if (isTouring()) refreshTour();
  else $('#measure-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
const strip = img => ({ mimeType: img.mimeType, data: img.data });

// ---------- SINIF (çocuk ekranı) ----------
function renderClass() {
  const board = S.classBoard();
  const { targetReductionPercent } = S.getState().settings;
  if (!selectedClass || !board.find(b => b.id === selectedClass)) selectedClass = board[0]?.id;
  const me = board.find(b => b.id === selectedClass);
  if (!me) { $('#view-class').innerHTML = `<div class="card">${t('Ayarlardan sınıf ekle.')}</div>`; return; }
  const progress = me.improvement == null ? 0 : Math.max(0, Math.min(100, me.improvement / targetReductionPercent * 100));
  const weekList = S.getState().measurements.filter(m => m.classId === me.id && S.mondayOf(m.date) === S.mondayOf(S.today()));
  const vegWeek = S.byDish(weekList).filter(d => d.category === 'sebze');
  const vegAvg = vegWeek.length ? vegWeek.reduce((s, d) => s + d.avgLeftover, 0) / vegWeek.length : null;
  const badges = [
    [t('İlk ölçüm'), me.all.plates > 0],
    [t('100 tabak'), me.all.plates >= 100],
    [t('{pct} iyileşme', { pct: pct(10) }), (me.improvement ?? 0) >= 10],
    [t('{pct} hedef', { pct: pct(targetReductionPercent) }), (me.improvement ?? 0) >= targetReductionPercent],
    [t('Sebze kahramanı'), vegAvg != null && vegAvg < 25]
  ];
  const weekLoss = weekList.length ? weekList.reduce((acc, m) => {
    const l = nutrientLoss(m.foods);
    for (const k of Object.keys(l)) acc[k] = (acc[k] || 0) + l[k] / weekList.length;
    return acc;
  }, {}) : null;
  $('#view-class').innerHTML = `
    ${sampleBanner()}
    <div class="chips" role="radiogroup" aria-label="${esc(t('Sınıf'))}">${board.map(c => `<button role="radio" aria-checked="${c.id === me.id}" class="chip ${c.id === me.id ? 'on' : ''}" data-action="select-class" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>
    <div class="card planet-card">
      ${planetSvg(me.score, 150)}
      <h2>${t('{name} sınıfının gezegeni', { name: esc(me.name) })}</h2>
      <p class="small-muted">${t('Seviye {level} · {points} toplam gezegen puanı', { level: me.level, points: num(me.points) })}</p>
      <div class="stat-row">
        <div><strong>${me.score ?? '–'}</strong><span>${t('bu haftaki sınıf puanı')}</span></div>
        <div><strong>${me.thisWeek.plates ? pct(me.thisWeek.avgPercent) : '–'}</strong><span>${t('ortalama tabak artığı')}</span></div>
      </div>
      <div class="goal">
        <div class="goal-head"><span>${t('İsrafsız Hafta hedefi: artığı {pct} azalt', { pct: pct(targetReductionPercent) })}</span><strong>${me.improvement == null ? '–' : pct(me.improvement)}</strong></div>
        <div class="bar-track big"><span class="bar-fill" style="width:${progress}%"></span></div>
      </div>
    </div>
    <div class="card" id="class-board">
      <h3>${t('İsrafsız Hafta yarışı')}</h3>
      <ol class="board">${board.map((c, i) => `
        <li class="${c.id === me.id ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="name">${esc(c.name)}</span>
          <span class="score">${t('{n} puan', { n: c.score ?? '–' })}</span>
          <span class="delta ${(c.improvement ?? 0) >= 0 ? 'up' : 'down'}">${c.improvement == null ? t('yeni') : `${c.improvement >= 0 ? '▲' : '▼'} ${pct(Math.abs(c.improvement))}`}</span></li>`).join('')}</ol>
      <p class="small-muted">${t('Puan, sınıfın bu haftaki ortalamasından hesaplanır (100 − ortalama artık %). Bireysel çocuk sıralaması yoktur; yüzde, sınıfın kendi başlangıç haftasına göre iyileşmedir.')}</p>
    </div>
    ${weekLoss ? `<div class="card">${nutrientBlock(weekLoss, { title: t('Kahraman enerjisi: bir öğünde tabakta kalan'), perWhat: t('(bu hafta, tabak başı ortalama)') })}
      <p class="small-muted">${t('Tabakta kalan her lokma, çocuğun büyümek ve öğrenmek için alamadığı enerji demek. Amaç tabağı zorla bitirmek değil, yiyebileceği kadar almak.')}</p></div>` : ''}
    <div class="card">
      <h3>${t('Rozetler')}</h3>
      <div class="badges">${badges.map(([name, on]) => `<span class="rozet ${on ? 'on' : ''}">${on ? '★' : '☆'} ${esc(name)}</span>`).join('')}</div>
    </div>
    <div class="card">
      <h3>${t('Veli haftalık özeti')}</h3>
      <p class="parent">${esc(parentSummary(me))}</p>
      <button class="btn small" data-action="share-summary">${t('Paylaş / kopyala')}</button>
    </div>`;
}

function parentSummary(c) {
  const school = S.getState().settings.schoolName;
  if (!c.thisWeek.plates) return t('{school} {name} sınıfında bu hafta henüz ölçüm yapılmadı.', { school, name: c.name });
  const parts = [t('{school} {name} sınıfı bu hafta {n} tabakta ortalama {pct} artık bıraktı', { school, name: c.name, n: c.thisWeek.plates, pct: pct(c.thisWeek.avgPercent) })];
  if (c.improvement != null) parts.push(c.improvement > 0
    ? t(' (başlangıç haftasına göre {pct} daha az).', { pct: pct(c.improvement) })
    : t(' (başlangıç haftasına göre {pct} daha fazla).', { pct: pct(Math.abs(c.improvement)) }));
  else parts.push('.');
  parts.push(t(' Sınıf gezegeni seviye {level}. Evde de "tabağına yiyebileceğin kadar al" alışkanlığını destekleyebilirsiniz.', { level: c.level }));
  return parts.join('');
}

// ---------- MUTFAK ----------
function renderKitchen() {
  const st = S.getState();
  const week = S.mondayOf(S.today());
  const list = kitchenRange === 'week' ? st.measurements.filter(m => S.mondayOf(m.date) === week) : st.measurements;
  const lastWeekStart = S.mondayOf(S.isoDate(new Date(Date.now() - 7 * 864e5)));
  const sumNow = S.summarize(st.measurements.filter(m => S.mondayOf(m.date) === week));
  const sumPrev = S.summarize(st.measurements.filter(m => S.mondayOf(m.date) === lastWeekStart));
  const dishes = S.byDish(list);
  const max = Math.max(50, ...dishes.map(d => d.avgLeftover));
  const delta = sumPrev.plates && sumNow.plates ? sumNow.avgPercent - sumPrev.avgPercent : null;
  // Gemini notları üretildikleri dilde saklanır; yalnızca seçili dildekiler gösterilir.
  const notes = st.measurements.filter(m => m.kitchenNote && (m.lang || 'tr') === getLang()).slice(-4).reverse();
  $('#view-kitchen').innerHTML = `
    ${sampleBanner()}
    <div class="kpis">
      <div class="kpi"><span>${t('Bu hafta tabak')}</span><strong>${num(sumNow.plates)}</strong></div>
      <div class="kpi"><span>${t('Ortalama artık')}</span><strong>${sumNow.plates ? pct(sumNow.avgPercent) : '–'}</strong>${delta == null ? '' : `<em class="${delta <= 0 ? 'up' : 'down'}">${delta <= 0 ? '▼' : '▲'} ${t('{n} puan, geçen haftaya göre', { n: num(Math.abs(delta), 1) })}</em>`}</div>
      <div class="kpi"><span>${t('Çöpe giden')}</span><strong>${kg(sumNow.left)}</strong></div>
      <div class="kpi"><span>${t('Tahmini maliyet')}</span><strong>${num(sumNow.left / 1000 * st.settings.costPerKgTL)} TL</strong></div>
    </div>
    ${renderForecast()}
    <div class="card" id="dish-card">
      <div class="card-head"><h3>${t('Yemek bazında tabak artığı')}</h3>
        <div class="seg" role="radiogroup" aria-label="${esc(t('Dönem'))}">
          <button role="radio" aria-checked="${kitchenRange === 'week'}" class="${kitchenRange === 'week' ? 'on' : ''}" data-action="range" data-range="week">${t('Bu hafta')}</button>
          <button role="radio" aria-checked="${kitchenRange === 'all'}" class="${kitchenRange === 'all' ? 'on' : ''}" data-action="range" data-range="all">${t('Tümü')}</button>
        </div></div>
      ${dishes.length ? `<ul class="bars dish">${dishes.map((d, i) => `
        <li class="${i < 3 ? 'top' : ''}" title="${esc(t('{dish}: ortalama {pct} artık, {n} tabak, haftada ~{kg} kg, en çok kalan gün {day}', { dish: dish(d.dish), pct: pct(d.avgLeftover), n: d.samples, kg: num(d.wastedKgPerWeek, 1), day: dayLabel(d.worstDay) }))}">
          <span class="bar-label">${i < 3 ? `<b class="top-tag">${i + 1}</b>` : ''}${esc(dish(d.dish))}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${d.avgLeftover / max * 100}%"></span></span>
          <span class="bar-value">${pct(d.avgLeftover)}</span></li>`).join('')}</ul>
        <p class="small-muted">${t('Çubuk: servis edilen miktarın ortalama ne kadarının tabakta kaldığı. Numaralı ilk 3 yemek öneri için kullanılır.')}</p>` : `<p class="small-muted">${t('Bu dönemde ölçüm yok. Ölç sekmesinden ilk tabağı ekle.')}</p>`}
    </div>
    <div class="card" id="suggest-card">
      <h3>${t('Yapay zekâ menü önerileri')}</h3>
      <p class="small-muted">${t('Gemini, en çok artık bırakılan 3 yemeğin verisine bakarak besin değerini koruyan menü, porsiyon, servis veya sunum değişikliği önerir. Kararı mutfak verir.')}</p>
      <button class="btn primary full" data-action="suggest" ${dishes.length && !suggestBusy ? '' : 'disabled'}>${suggestBusy ? `<span class="spinner"></span> ${t('Öneriler hazırlanıyor…')}` : `${t('En çok kalan 3 yemek için öneri üret')}${mode === 'demo' ? ` ${t('(demo)')}` : ''}`}</button>
      ${suggestBusy ? progressCard('suggest-progress', t('Gemini menü önerisi hazırlıyor'), SUGGEST_STAGES, t('{dishes} için · genelde {s} civarı sürer', { dishes: esc(dishes.slice(0, 3).map(d => dish(d.dish)).join(', ')), s: sec(expectedMs('suggest')) })) : ''}
      ${st.suggestSummary && st.suggestions.length ? `<p class="note"><strong>${t('Gemini özeti:')}</strong> ${esc(st.suggestSummary)}</p>` : ''}
      <div class="suggestions">${st.suggestions.slice().reverse().map(s => `
        <article class="suggestion ${s.status}">
          <div class="s-head"><span class="badge">${t(TYPE_LABEL[s.type])}</span><span class="small-muted">${esc(dish(s.dish))} · ${t('beklenen')} −${pct(s.expectedReductionPercent)}</span></div>
          <h4>${esc(s.title)}</h4>
          <p>${esc(s.action)}</p>
          <p class="small-muted">${esc(s.rationale)}</p>
          ${s.status === 'pending' ? `<div class="row"><button class="btn small" data-action="decide" data-id="${s.id}" data-status="accepted">${t('Kabul et')}</button><button class="btn small ghost" data-action="decide" data-id="${s.id}" data-status="rejected">${t('Reddet')}</button></div>`
            : `<p class="status">${s.status === 'accepted' ? `✓ ${t('Kabul edildi, menüye eklendi')}` : `✕ ${t('Reddedildi')}`} <button class="link" data-action="decide" data-id="${s.id}" data-status="pending">${t('geri al')}</button></p>`}
        </article>`).join('')}</div>
    </div>
    ${notes.length ? `<div class="card"><h3>${t('Son mutfak notları (Gemini)')}</h3><ul class="notes">${notes.map(m => `<li><span class="small-muted">${esc(date(m.date))} · ${esc(m.classId)}</span> ${esc(m.kitchenNote)}</li>`).join('')}</ul></div>` : ''}`;
}

// "Yarın ne pişirilmeli?": tahmini artık ve önerilen üretim miktarı.
function renderForecast() {
  const f = forecast();
  if (!f.dishes.length) return `<div class="card" id="forecast-card"><h3>${t('Yarın ne pişirilmeli?')}</h3><p class="small-muted">${t('{day} için menü tanımlı değil. Ayarlar\'dan haftalık menüyü gir.', { day: date(f.date, { weekday: 'long', day: 'numeric', month: 'long' }) })}</p></div>`;
  return `<div class="card forecast" id="forecast-card">
    <div class="card-head"><h3>${t('Yarın ne pişirilmeli?')}</h3><span class="badge">${esc(date(f.date, { weekday: 'long', day: 'numeric', month: 'short' }))}</span></div>
    <p class="small-muted">${t('{n} öğrenci için, geçmiş tabak artığına göre tahmin. Yakın tarihli ve aynı güne ait ölçümler daha ağırlıklı.', { n: f.students })}</p>
    <div class="table-wrap"><table class="forecast-table">
      <thead><tr><th>${t('Yemek')}</th><th>${t('Tahmini artık')}</th><th>${t('Standart')}</th><th>${t('Önerilen')}</th></tr></thead>
      <tbody>${f.dishes.map(d => `<tr>
        <td>${esc(dish(d.dish))}${d.source !== 'dish' ? ` <small class="small-muted" title="${esc(t('Bu yemek için yeterli ölçüm yok; kategori ortalaması kullanıldı.'))}">*</small>` : ''}</td>
        <td>${pct(d.predictedPercent)}</td><td>${num(d.standardKg, 1)} kg</td><td><strong>${num(d.cookKg, 1)} kg</strong></td></tr>`).join('')}</tbody>
    </table></div>
    <p class="scale">${f.savedKg >= 0.1 ? t('Önerilen miktarlarla pişirilirse ≈ <strong>{kg}</strong> daha az yemek çöpe gider: <strong>{tl} TL</strong> ve <strong>{co2}</strong> CO₂e tasarruf.', { kg: kg(f.savedKg * 1000), tl: num(f.costTL), co2: kg(f.co2Kg * 1000) }) : t('Tahmini artık düşük; standart miktarlar uygun.')}</p>
    <p class="small-muted">${t('Güvenlik payı: tahmini artığın yalnızca {pct} kadarı azaltılır; isteyen çocuğa ikinci servis yapılabilir. * işaretli yemeklerde kategori ortalaması kullanıldı.', { pct: pct(f.safety * 100) })}</p>
  </div>`;
}

async function runSuggest() {
  const st = S.getState();
  const stats = S.byDish(kitchenRange === 'week' ? st.measurements.filter(m => S.mondayOf(m.date) === S.mondayOf(S.today())) : st.measurements)
    .slice(0, 3).map(s => ({ ...s, worstDay: dayLabel(s.worstDay) }));
  if (!stats.length) return;
  suggestBusy = true;
  suggestController = new AbortController();
  renderKitchen();
  startTicker('suggest-progress', performance.now(), expectedMs('suggest'));
  if (!isTouring()) $('#suggest-progress')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    const ageGroup = st.settings.classes.map(c => c.ageGroup).join(', ');
    const { mode: used, result, cached, ms } = await suggestMenu({ stats, ageGroup, schoolName: st.settings.schoolName },
      { signal: suggestController.signal, onWait: waitHandler('suggest-progress') });
    if (cached) toast(t('Bu veriler için öneriler zaten listede. Yeni ölçümler geldikçe yeni öneri üretilir.'));
    else {
      for (const s of result.suggestions) st.suggestions.push({ ...s, id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, status: 'pending', ts: new Date().toISOString(), source: used });
      st.suggestSummary = result.summary;
      S.save();
      toast(t('{n} öneri hazır ({s}).', { n: result.suggestions.length, s: sec(ms) }));
    }
  } catch (e) { toast(e.code === 'aborted' ? t('Öneri üretimi iptal edildi.') : errorText(e)); }
  stopTicker('suggest-progress');
  suggestBusy = false;
  suggestController = null;
  if (currentTab() === 'kitchen') renderKitchen();
  if (isTouring()) refreshTour();
}

// ---------- ETKİ ----------
async function renderImpact() {
  const st = S.getState();
  const m = impactSummary();
  const { baseline, intervention, relative, target, saved, year, status } = m;
  const weeks = S.weekly(st.measurements);
  const cal = S.calibration();
  const decided = st.suggestions.filter(s => s.status !== 'pending');
  const accepted = st.suggestions.filter(s => s.status === 'accepted');
  const statusText = { good: `✓ ${t('Hedefe ulaşıldı.')}`, warn: `● ${t('Hedefe doğru ilerliyor.')}`, bad: `▲ ${t('Artık artmış, menü önerilerini gözden geçir.')}` }[status];
  $('#view-impact').innerHTML = `
    ${sampleBanner()}
    <div class="card impact-hero ${status}">
      <span class="small-muted">${t('Baseline haftasına göre tabak artığında göreli değişim')}</span>
      <div class="hero-number">${relative == null ? '–' : `${relative >= 0 ? '−' : '+'}${pct(Math.abs(relative))}`}</div>
      <p>${relative == null ? t('Karşılaştırma için hem baseline hem müdahale dönemi ölçümü gerekli.') : `${t('Ortalama artık {a} → {b}. Hedef: −{t}.', { a: pct(baseline.avgPercent), b: pct(intervention.avgPercent), t: pct(target) })} ${statusText}`}</p>
      <p class="small-muted">${t('Baseline: {d} tarihine kadar ({n} tabak) · Müdahale: sonrası ({m} tabak)', { d: date(st.settings.baselineEnd, { day: 'numeric', month: 'long' }), n: baseline.plates, m: intervention.plates })}</p>
      <button class="btn primary" data-action="report">${t('Okul etki raporu (PDF)')}</button>
    </div>
    <div class="card">
      <h3>${t('Haftalık ortalama tabak artığı')}</h3>
      ${weeklyChart(weeks, baseline, target, st.settings.baselineEnd)}
      <div class="legend"><span><i class="sw base"></i>${t('Baseline (geri bildirim yok)')}</span><span><i class="sw int"></i>${t('Müdahale (geri bildirim + menü)')}</span><span><i class="sw tgt"></i>${t('Hedef çizgisi')}</span></div>
      <details><summary>${t('Tablo görünümü')}</summary><div class="table-wrap"><table><thead><tr><th>${t('Hafta')}</th><th>${t('Tabak')}</th><th>${t('Ort. artık')}</th><th>${t('Artık/tabak')}</th></tr></thead><tbody>${weeks.map(w => `<tr><td>${esc(date(w.week))}</td><td>${w.plates}</td><td>${pct(w.avgPercent)}</td><td>${Math.round(w.perPlateLeft)} g</td></tr>`).join('')}</tbody></table></div></details>
    </div>
    <div class="card">
      <h3>${t('Pilotta kurtarılan (tahmini)')}</h3>
      <div class="kpis inner">
        <div class="kpi"><span>${t('Gıda')}</span><strong>${kg(saved?.food || 0)}</strong></div>
        <div class="kpi"><span>CO₂e</span><strong>${kg(saved?.co2 || 0)}</strong></div>
        <div class="kpi"><span>${t('Su')}</span><strong>${num(saved?.water || 0)} L</strong></div>
        <div class="kpi"><span>${t('Maliyet')}</span><strong>${num(saved?.tl || 0)} TL</strong></div>
      </div>
      <p class="small-muted">${t('Hesap: (baseline tabak başı artık − müdahale tabak başı artık) × müdahale dönemindeki tabak sayısı. CO₂e ve su, yemek kategorisine göre katsayılarla hesaplanır.')}</p>
      <h4>${t('{students} öğrencilik bir okulda 1 eğitim yılı ({days} gün)', SCALE)}</h4>
      <p class="scale">${year ? t('≈ <strong>{food}</strong> gıda, <strong>{co2}</strong> CO₂e, <strong>{water} L</strong> su ve <strong>{tl} TL</strong> tasarruf', { food: kg(year.food), co2: kg(year.co2), water: num(year.water), tl: num(year.tl) }) : t('Müdahale döneminde iyileşme oluştuğunda ölçeklenmiş etki burada görünür.')}</p>
    </div>
    ${renderNutritionImpact(m)}
    <div class="card evidence-link">
      <h3>${t('Kanıt ve benchmark')}</h3>
      <p class="small-muted">${t('Sonuçlarının dünyadaki okul verileriyle karşılaştırması, ölçüm yöntemleri ve rakip çözümler, gerçek fotoğraflarla iki doğrulama pilotu ve kaynakça.')}</p>
      <button class="btn small" data-action="goto" data-tab="evidence">${t('Kanıt sekmesine git')} →</button>
    </div>
    <div class="card">
      <h3>${t('Ölçüm güvenilirliği ve mutfak kararları')}</h3>
      <ul class="facts">
        <li>${t('<strong>{n}</strong> tabak ölçümü, <strong>{d}</strong> gün, <strong>{c}</strong> sınıf', { n: num(st.measurements.length), d: new Set(st.measurements.map(x => x.date)).size, c: st.settings.classes.length })}</li>
        <li>${t('Menü önerileri: <strong>{n}</strong> üretildi, <strong>{a}</strong> kabul edildi', { n: st.suggestions.length, a: accepted.length })}${decided.length ? ` ${t('(karar verilenlerin {pct}\'i)', { pct: pct(accepted.length / decided.length * 100) })}` : ''}</li>
        <li>${cal ? t('Tartım kalibrasyonu: <strong>{n}</strong> tabak, ortalama mutlak sapma <strong>{mae} g</strong> ({wape}), eğilim {bias} g', { n: cal.count, mae: cal.maeGrams, wape: pct(cal.wape ?? 0), bias: `${cal.bias >= 0 ? '+' : ''}${cal.bias}` }) : t('Tartım kalibrasyonu: henüz tartım yok. Ölç ekranında sonuç altına gerçek tartımı girerek yapay zekâ tahmininin doğruluğunu ölç.')}</li>
      </ul>
    </div>
    <div class="card">
      <h3>${t('Veri')}</h3>
      <div class="row wrap">
        <button class="btn small" data-action="export-csv">${t('CSV dışa aktar')}</button>
        ${S.hasSample() ? `<button class="btn small ghost" data-action="clear-sample">${t('Örnek veriyi kaldır')}</button>` : `<button class="btn small ghost" data-action="reseed">${t('Örnek veriyi yükle')}</button>`}
        <button class="btn small danger" data-action="reset-all">${confirmReset ? t('Emin misin? Tekrar dokun') : t('Tüm veriyi sil')}</button>
      </div>
      <p class="small-muted">${t('Veriler yalnızca bu cihazda saklanır. Fotoğraf saklanmaz.')}</p>
    </div>
    <div class="card">
      <details>
        <summary>${t('Yöntem, katsayılar ve kaynaklar')}</summary>
        <p>${t('Tabak artığı oranı, servis edilen tahmini miktara göre kalan miktarın ağırlıklı ortalamasıdır. Gemini, önce/sonra fotoğraflarını karşılaştırarak yemek bazında gram ve yüzde tahmini yapar; tahmin, pilotta gerçek tartımla kalibre edilir.')}</p>
        <div class="table-wrap"><table><thead><tr><th>${t('Kategori')}</th><th>kg CO₂e / kg</th><th>${t('L su / kg')}</th></tr></thead><tbody>${Object.entries(FACTORS).map(([key, f]) => `<tr><td>${esc(category(key))}</td><td>${num(f.co2, 1)}</td><td>${num(f.water)}</td></tr>`).join('')}</tbody></table></div>
        <p class="small-muted">${t('Katsayılar: Poore & Nemecek (2018) / Our World in Data ve Water Footprint Network ürün değerlerinin pişmiş okul yemeğine ihtiyatlı uyarlaması (yaklaşık). Besin değerleri: USDA FoodData Central ve TÜBER 2022 kategori ortalamaları; günlük ihtiyaç 7-12 yaş için EFSA/IOM referans değerleri. Baseline literatürü: Gaziantep okul yemekhanesi çalışması (tabak artığı maliyeti ~%15), UNEP Food Waste Index 2024, Winnow/LSE (2021, nudge ile %35\'e kadar azalma).')}</p>
      </details>
    </div>`;
}

function renderNutritionImpact(m) {
  if (!m.perPlateThisWeek && !m.delta) return '';
  const children = Math.max(1, S.getState().settings.classes.reduce((s, c) => s + (Number(c.students) || 25), 0));
  return `<div class="card" id="nutrition-card">
    ${m.perPlateThisWeek ? nutrientBlock(m.perPlateThisWeek.nutr, { title: t('Besin kaybı göstergesi'), perWhat: t('(bu hafta, tabak başı)') }) : ''}
    ${m.delta && m.year ? `<p class="scale">${t('Baseline\'a göre tabak başına <strong>{kcal} kcal</strong> ve <strong>{protein} g protein</strong> daha az çöpe gidiyor. {students} öğrencilik okulda 1 yılda çocuklar <strong>{yp} kg protein</strong> ve <strong>{yf} kg lifi</strong> tabakta bırakmak yerine alır.', { kcal: num(m.delta.nutr.kcal), protein: num(m.delta.nutr.protein, 1), students: SCALE.students, yp: num(m.year.nutr.protein / 1000, 1), yf: num(m.year.nutr.fiber / 1000, 1) })}</p>` : ''}
    <p class="small-muted">${t('Ölçülen {n} öğrencinin her biri haftada 5 öğün yerse, bu hafta tabakta kalan enerji çocuk başı ≈ {kcal} kcal ediyor.', { n: children, kcal: num((m.perPlateThisWeek?.nutr.kcal || 0) * 5) })}</p>
  </div>`;
}

// ---------- KANIT: benchmark, doğrulama pilotları ve kaynakça ----------
// Kaynak numarası: adrese # eklemeden kaynakçadaki satıra kaydırır ve vurgular.
const refLink = ref => [].concat(ref ?? []).map(n => `<button type="button" class="ref" data-action="ref" data-ref="${n}" aria-label="${esc(t('Kaynak {n}', { n }))}">[${n}]</button>`).join('');

async function renderEvidence() {
  const st = S.getState();
  const m = impactSummary();
  const base = m.baseline.plates ? m.baseline : S.summarize(st.measurements);
  const sample = S.hasSample();
  const ourLabel = sample ? t('Tabak İz pilot okulu (örnek veri)') : t('Tabak İz ölçümleriniz');
  // Tabak İz yemek grubu oranları (baseline dönemi; yoksa tüm ölçümler).
  const baseList = m.baseline.plates ? st.measurements.filter(x => x.date <= st.settings.baselineEnd) : st.measurements;
  const byCat = {};
  for (const x of baseList) for (const f of x.foods) {
    const c = byCat[f.category] ||= { served: 0, left: 0 };
    c.served += f.servedGrams; c.left += f.leftoverGrams;
  }
  const groupPct = cats => {
    const s = cats.reduce((a, c) => ({ served: a.served + (byCat[c]?.served || 0), left: a.left + (byCat[c]?.left || 0) }), { served: 0, left: 0 });
    return s.served ? s.left / s.served * 100 : null;
  };
  const pctFmt = (v, d = 0) => getLang() === 'tr' ? `%${num(v, d)}` : `${num(v, d)}%`;
  const percentRows = WORLD_PERCENT.map(r => ({ label: t(r.label), value: r.value, display: `${r.prefix || ''}${pctFmt(r.value, r.decimals)}`, note: t(r.metric), refHtml: refLink(r.ref) }));
  if (base.plates) percentRows.push({ label: ourLabel, value: base.avgPercent, display: pct(base.avgPercent), note: t('servis edilen miktara göre tabak artığı'), highlight: true });
  const gramRows = WORLD_GRAMS.map(r => ({ label: t(r.label), value: r.value, display: `${r.value} g`, note: t(r.metric), refHtml: refLink(r.ref) }));
  if (base.plates) gramRows.push({ label: ourLabel, value: base.perPlateLeft, display: `${Math.round(base.perPlateLeft)} g`, note: t('tabak artığı / tabak'), highlight: true });
  const [visual, mass] = await Promise.all([renderPilot('visual'), renderPilot('mass')]);

  $('#view-evidence').innerHTML = `
    <div class="card intro">
      <h1>${t('Kanıt ve benchmark')}</h1>
      <p>${t('Bu sayfadaki her dış rakam yayımlanmış bir kaynaktan gelir; köşeli parantezdeki numara aşağıdaki kaynakçayı gösterir. Firma açıklamaları ayrıca işaretlenmiştir.')}</p>
    </div>
    ${sample ? `<div class="banner"><strong>${t('Not')}</strong><p>${t('"Tabak İz pilot okulu" satırları uygulamadaki sentetik örnek veriden gelir; örnek veri literatürdeki yemek grubu oranlarına göre ayarlanmıştır. Gerçek okul verisi girildikçe bu satırlar gerçek ölçümünüzü gösterir.')}</p></div>` : ''}

    <div class="card" id="bench-world">
      <h3>${t('Dünyada okul tabak artığı')}</h3>
      <p class="small-muted">${t('Çalışmalar farklı metrikler kullanır (kalori, hazırlanan yemek, maliyet). Çubuğun üzerine gelince metrik görünür.')}</p>
      ${compareBars(percentRows, 40)}
      <h4>${t('Öğrenci başına gram')}</h4>
      ${compareBars(gramRows, 100)}
      <p class="small-muted">${t('Türkiye\'de ilkokul düzeyinde sürekli ve tabak bazında ölçüm yapan yayımlanmış bir sistem bulunamadı; mevcut çalışmalar tek seferlik ve tartıma dayalı. Tabak İz bu boşluğu hedefler.')}</p>
    </div>

    <div class="card" id="bench-groups">
      <h3>${t('Hangi yemek grubu daha çok kalıyor?')}</h3>
      <p class="small-muted">${t('ABD ulusal okul yemeği çalışması (6.253 tepsi, 165 okul) ile Tabak İz yemek grubu oranları.')} ${refLink(1)}</p>
      ${pairedBars(FOOD_GROUPS.map(g => { const ours = groupPct(g.categories); return { label: t(g.label), a: g.usda, aText: `USDA ${pct(g.usda)}`, b: ours, bText: ours == null ? null : pct(ours) }; }), 45)}
      <div class="legend"><span><i class="sw base"></i>${t('USDA SNMCS (ABD)')}</span><span><i class="sw int"></i>${esc(ourLabel)}</span></div>
      <p class="small-muted">${sample
        ? t('Örnek veri bu literatür sırasına göre ayarlandığı için iki seri benzer; gerçek ölçüm girildikçe yeşil seri sizin okulunuzun sırasını gösterir. USDA\'ya göre sebze en çok, ana yemek en az bırakılan grup; bu yüzden Tabak İz sebzeyi menüden çıkarmak yerine sunumunu değiştirmeyi önerir.')
        : t('USDA\'ya göre sebze en çok, ana yemek en az bırakılan grup. Okulunuzun sırası farklıysa Gemini menü önerileri bu farka göre şekillenir; sebzeyi menüden çıkarmak yerine sunumunu değiştirmeyi önerir.')}</p>
    </div>

    <div class="card" id="bench-methods">
      <h3>${t('Ölçüm yöntemleri karşılaştırması')}</h3>
      <p class="scroll-hint">${t('Tabloyu yana kaydırabilirsin →')}</p><div class="table-wrap"><table class="bench-table">
        <thead><tr><th>${t('Yöntem')}</th><th>${t('Doğruluk kanıtı')}</th><th>${t('Hız ve emek')}</th><th>${t('Donanım')}</th></tr></thead>
        <tbody>${METHODS.map(x => `<tr class="${x.ours ? 'ours' : ''}"><td><strong>${esc(t(x.name))}</strong> ${refLink(x.ref)}</td>
          <td>${x.ours ? pilotAccuracyText() : esc(t(x.accuracy))}</td><td>${esc(t(x.effort))}</td><td>${esc(t(x.hardware))}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="card" id="bench-solutions">
      <h3>${t('Mevcut çözümlerle karşılaştırma')}</h3>
      <p class="scroll-hint">${t('Tabloyu yana kaydırabilirsin →')}</p><div class="table-wrap"><table class="bench-table">
        <thead><tr><th>${t('Çözüm')}</th><th>${t('Donanım')}</th><th>${t('Okul')}</th><th>${t('Çocuğa geri bildirim')}</th><th>${t('Üretim tahmini')}</th><th>${t('Bildirilen etki')}</th></tr></thead>
        <tbody>${SOLUTIONS.map(x => `<tr class="${x.ours ? 'ours' : ''}"><td><strong>${esc(t(x.name))}</strong> ${refLink(x.ref)}${x.vendor ? ` <span class="vendor">${t('firma')}</span>` : ''}</td>
          <td>${esc(t(x.hardware))}</td><td>${x.school ? '✓' : '–'}</td><td>${x.child ? '✓' : '–'}</td><td>${x.forecast ? '✓' : '–'}</td><td>${esc(t(x.impact))}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="small-muted">${t('Ticari sistemler ölçmenin israfı azalttığını gösteriyor; ancak çoğu özel donanım ve lisans gerektiriyor ve kurumsal mutfaklara odaklanıyor. Tabak İz\'in farkı: donanımsız (telefon), çocuğa sesli ve suçlamayan geri bildirim, ertesi gün üretim tahmini ve Türk okul menüsü.')}</p>
    </div>

    <div class="card" id="bench-interventions">
      <h3>${t('Müdahaleler ne kadar azaltıyor?')}</h3>
      <ul class="ranges">${INTERVENTIONS.map(x => `<li class="${x.ours ? 'ours' : ''}"><span class="range-label">${esc(t(x.label))} ${refLink(x.ref)}</span>
        <span class="range-track"><span class="range-fill" style="left:${x.range[0] / 50 * 100}%;width:${Math.max(1.5, (x.range[1] - x.range[0]) / 50 * 100)}%"></span></span>
        <span class="bar-value">${x.range[0] === x.range[1] ? pct(x.range[0]) : `${pct(x.range[0])}–${pct(x.range[1])}`}</span></li>`).join('')}</ul>
      <p class="small-muted">${t('Tabak İz\'in %25 göreli azalma hedefi, firma açıklamalarındaki %30-35\'in altında tutuldu. İsveç okullarında yalnızca farkındalık kampanyası bile porsiyon başına 13 g azaltma sağladı.')} ${refLink(5)}</p>
    </div>

    <div class="card" id="pilot-card">${visual}</div>
    <div class="card" id="pilot-mass-card">${mass}</div>

    <div class="card" id="bench-sources">
      <h3>${t('Kaynakça')}</h3>
      <ol class="sources">${REFERENCES.map(r => `<li id="ref-${r.id}">${esc(t(r.text))}${r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\//, '').slice(0, 60))}${r.url.length > 68 ? '…' : ''}</a>` : ''}</li>`).join('')}</ol>
    </div>`;
}

// Yöntem tablosundaki Tabak İz satırı: pilot sonuçlarından canlı doğruluk metni.
function pilotAccuracyText() {
  const parts = [];
  const visual = summarizePilot(pilotCache.visual, getResults('visual'), 'visual');
  const mass = summarizePilot(pilotCache.mass, getResults('mass'), 'mass');
  if (visual?.n) parts.push(t('{n} gerçek fotoğrafta insan tahminine göre ortalama hata {mae} puan', { n: visual.n, mae: num(visual.mae, 1) }));
  if (mass?.n) parts.push(t('{n} tartılmış tabakta gram hatası %{mape}', { n: mass.n, mape: num(mass.mape, 0) }));
  return parts.length ? esc(parts.join('; ')) : esc(t('Aşağıdaki iki doğrulama pilotuyla ölçülür (henüz çalıştırılmadı)'));
}

const pilotCache = {};

// Doğrulama pilotları. visual: insan görsel tahmini (artık %); mass: terazi ölçümü (g, kcal).
async function renderPilot(set) {
  const man = await loadManifest(set).catch(() => null);
  pilotCache[set] = man;
  if (!man) return `<h3>${t('Doğrulama pilotu')}</h3><p class="small-muted">${t('Pilot fotoğrafları yüklenemedi.')}</p>`;
  const isMass = set === 'mass';
  const results = getResults(set);
  const sum = summarizePilot(man, results, set);
  const running = pilotRun?.set === set;
  const busyOther = pilotRun && !running;
  const doneCount = results ? Object.keys(results.items).length : 0;
  const head = isMass
    ? `<h3>${t('Doğrulama pilotu 2: {n} terazide tartılmış tabak', { n: man.items.length })}</h3>
       <p class="small-muted">${t('Google\'ın Nutrition5k veri setinden kafeterya tabakları: her malzeme terazide tartılmış, toplam gram ve kalori gerçek ölçüm. Gemini\'nin tabaktaki yemek miktarını fotoğraftan ne kadar doğru tahmin ettiği ölçülür.')} ${refLink(15)}</p>`
    : `<h3>${t('Doğrulama pilotu 1: {n} gerçek tabak fotoğrafı', { n: man.items.length })}</h3>
       <p class="small-muted">${t('Açık lisanslı (Wikimedia Commons) okul tepsisi ve yemek sonrası tabak fotoğrafları Gemini ile analiz edilir; sonuç, insan görsel tahminiyle (Comstock benzeri yöntem) karşılaştırılır. Referans gerçek tartım değildir; ±10-15 puan belirsizlik içerir.')}</p>`;
  const kpis = !sum?.n ? '' : isMass
    ? `<div class="kpis inner">
        <div class="kpi"><span>${t('Ortalama mutlak hata')}</span><strong>${num(sum.mae)} g</strong></div>
        <div class="kpi"><span>${t('Ortalama yüzde hata')}</span><strong>${pct(sum.mape)}</strong></div>
        <div class="kpi"><span>${t('±%25 içinde')}</span><strong>${pct(sum.within25)}</strong></div>
        <div class="kpi"><span>${t('Kalori hatası')}</span><strong>${sum.kcalMape == null ? '–' : pct(sum.kcalMape)}</strong></div>
      </div>
      ${pilotScatter(sum.points, { unit: 'g', xLabel: 'Terazi ölçümü' })}
      <p class="small-muted">${t('{n}/{total} tabak analiz edildi · korelasyon r = {r} · eğilim {bias} g · ortalama {s}. Bu tabaklar yenmemiş olduğu için Gemini\'nin "dokunulmamış" demesi beklenir: {u} tabakta öyle dedi. Yeşil bant ±%25\'i gösterir.', { n: sum.n, total: sum.total, r: sum.r == null ? '–' : num(sum.r, 2), bias: `${sum.bias >= 0 ? '+' : ''}${num(sum.bias)}`, s: sec(sum.avgMs), u: pct(sum.untouchedShare) })}</p>`
    : `<div class="kpis inner">
        <div class="kpi"><span>${t('Ortalama mutlak hata')}</span><strong>${num(sum.mae, 1)} ${t('puan')}</strong></div>
        <div class="kpi"><span>${t('±15 puan içinde')}</span><strong>${pct(sum.within15)}</strong></div>
        <div class="kpi"><span>${t('Korelasyon (r)')}</span><strong>${sum.r == null ? '–' : num(sum.r, 2)}</strong></div>
        <div class="kpi"><span>${t('Eğilim')}</span><strong>${sum.bias >= 0 ? '+' : ''}${num(sum.bias, 1)}</strong></div>
      </div>
      ${pilotScatter(sum.points)}
      <p class="small-muted">${t('{n}/{total} fotoğraf analiz edildi · ortalama {s}. Eğilim pozitifse Gemini artığı olduğundan fazla, negatifse az tahmin ediyor. Köşegen tam uyumu, yeşil bant ±15 puanı gösterir.', { n: sum.n, total: sum.total, s: sec(sum.avgMs) })}</p>`;
  const refText = item => isMass ? `${num(item.reference.massGrams)} g · ${item.reference.kcal} kcal` : pct(item.reference.totalLeftoverPercent);
  const aiText = (item, r) => {
    if (typeof r?.ai !== 'number') return r?.skipped ? t('atlandı') : '–';
    if (isMass) return `${num(r.ai)} g${r.kcal ? ` · ${r.kcal} kcal` : ''} · ${t('fark')} ${r.ai - item.reference.massGrams >= 0 ? '+' : ''}${num(r.ai - item.reference.massGrams)} g`;
    return `${pct(r.ai)} · ${t('fark')} ${r.ai - item.reference.totalLeftoverPercent >= 0 ? '+' : ''}${r.ai - item.reference.totalLeftoverPercent}`;
  };
  return `${head}${kpis}
    ${running ? progressCard('pilot-progress', t('Pilot çalışıyor: {i}/{n}', { i: pilotRun.index + 1, n: pilotRun.total }), ANALYZE_STAGES, esc(pilotRun.title)) : ''}
    <div class="row wrap">
      ${mode === 'demo' ? `<p class="hint">${t('Pilot gerçek Gemini analizi gerektirir; demo modunda çalışmaz.')}</p>` : `
        <button class="btn small primary" data-action="pilot-run" data-set="${set}" ${running || busyOther ? 'disabled' : ''}>${doneCount && doneCount < man.items.length ? t('Pilota devam et ({n} kaldı)', { n: man.items.length - doneCount }) : doneCount ? t('Pilotu yeniden çalıştır') : t('Pilotu Gemini ile çalıştır')}</button>
        ${doneCount && !running ? `<button class="btn small ghost" data-action="pilot-clear" data-set="${set}">${t('Sonuçları sıfırla')}</button>` : ''}`}
    </div>
    <details class="pilot-list"><summary>${t('Fotoğraflar, referans değerler ve lisanslar')}</summary>
      <ul class="pilot-items">${man.items.map(item => {
        const r = results?.items[item.id];
        const caption = isMass ? item.ingredients.slice(0, 4).map(i => i.name).join(', ') : t(item.note);
        const credit = isMass ? `Nutrition5k · ${item.source.dish} · CC BY 4.0` : `${item.source.author} · ${item.source.license}`;
        return `<li>
          <img src="${item.file}" alt="${esc(caption)}" loading="lazy" width="96" height="72">
          <div><strong>${esc(item.id)}</strong> · ${esc(caption)}<br>
            <span class="small-muted">${t('Referans')}: ${refText(item)} · Gemini: ${aiText(item, r)}</span><br>
            <a class="small-muted" href="${esc(isMass ? item.source.image : item.source.page)}" target="_blank" rel="noopener">${esc(credit)}</a></div>
        </li>`;
      }).join('')}</ul>
    </details>`;
}

async function startPilot(set, restart) {
  if (pilotRun) return;
  if (restart) clearResults(set);
  pilotRun = { set, controller: new AbortController(), index: 0, total: 0, title: '' };
  const cardId = set === 'mass' ? '#pilot-mass-card' : '#pilot-card';
  if (currentTab() === 'evidence') await renderEvidence(); // diğer pilotun düğmesi de kilitlensin
  try {
    await runPilot({
      set,
      signal: pilotRun.controller.signal,
      onWait: waitHandler('pilot-progress'),
      onItem: async (index, total, item) => {
        Object.assign(pilotRun, { index, total, title: set === 'mass' ? item.ingredients.slice(0, 3).map(i => i.name).join(', ') : t(item.note) });
        if (currentTab() === 'evidence') {
          $(cardId).innerHTML = await renderPilot(set);
          startTicker('pilot-progress', performance.now(), expectedMs('analyze'));
        }
      }
    });
    toast(t('Pilot tamamlandı.'));
  } catch (e) { toast(e.code === 'aborted' ? t('Pilot durduruldu; kaldığı yerden devam edebilirsin.') : errorText(e)); }
  stopTicker('pilot-progress');
  pilotRun = null;
  if (currentTab() === 'evidence') renderEvidence();
}

// ---------- Ayarlar, karşılama ve dil ----------
function renderSettings() {
  const st = S.getState(), s = st.settings;
  $('#settings-dialog').innerHTML = `<form method="dialog" data-form="settings">
    <div class="sheet-head"><h2>${t('Ayarlar')}</h2><button class="icon-btn" value="cancel" aria-label="${esc(t('Kapat'))}">✕</button></div>
    <span class="field-label">${t('Dil')}</span>
    <div class="chips lang-chips" role="radiogroup" aria-label="${esc(t('Dil'))}">${Object.entries(LANGUAGES).map(([code, l]) => `<label class="chip lang-chip"><input type="radio" name="lang" value="${code}" ${code === getLang() ? 'checked' : ''}>${flag(code)}<span>${l.name}</span></label>`).join('')}</div>
    <label class="field-label" for="set-school">${t('Okul adı')}</label><input id="set-school" class="input" name="schoolName" value="${esc(s.schoolName)}">
    <span class="field-label">${t('Sınıflar (ad · yaş grubu · öğrenci sayısı)')}</span>
    <div id="class-rows">${s.classes.map(c => classRow(c)).join('')}</div>
    <button type="button" class="link" data-action="add-class">+ ${t('Sınıf ekle')}</button>
    <div class="grid2">
      <div><label class="field-label" for="set-baseline">${t('Baseline bitiş tarihi')}</label><input id="set-baseline" class="input" type="date" name="baselineEnd" value="${esc(s.baselineEnd)}"></div>
      <div><label class="field-label" for="set-cost">${t('Gıda maliyeti (TL/kg)')}</label><input id="set-cost" class="input" type="number" min="1" name="costPerKgTL" value="${s.costPerKgTL}"></div>
    </div>
    <label class="field-label" for="set-target">${t('Hedef göreli azalma (%)')}</label><input id="set-target" class="input" type="number" min="5" max="80" name="targetReductionPercent" value="${s.targetReductionPercent}">
    <span class="field-label">${t('Haftalık menü (virgülle)')}</span>
    ${[1, 2, 3, 4, 5].map(d => `<label class="menu-row"><span>${dayLabel(d)}</span><input class="input" name="menu-${d}" value="${esc((s.menu[d] || []).join(', '))}"></label>`).join('')}
    ${mode !== 'server' ? `<span class="field-label">${t('Gemini API anahtarı (isteğe bağlı)')}</span>
      <input class="input" name="apiKey" type="password" autocomplete="off" placeholder="AIza…" value="${esc(st.apiKey)}">
      <small class="small-muted">${t('Sunucuda anahtar tanımlı olmadığında kullanılır; yalnızca bu cihazda saklanır. Anahtar: aistudio.google.com/apikey')}</small>` : ''}
    <div class="row wrap end">
      <button type="button" class="btn small ghost" data-action="start-tour">${t('Jüri turu')}</button>
      <button class="btn small primary" value="save">${t('Kaydet')}</button>
    </div>
  </form>`;
}
const classRow = c => `<div class="class-row"><input class="input" data-k="name" value="${esc(c.name)}" aria-label="${esc(t('Sınıf adı'))}"><input class="input" data-k="ageGroup" value="${esc(c.ageGroup)}" aria-label="${esc(t('Yaş grubu'))}"><input class="input" data-k="students" type="number" min="1" max="60" value="${Number(c.students) || 25}" aria-label="${esc(t('Öğrenci sayısı'))}"><input type="hidden" data-k="id" value="${esc(c.id)}"><button type="button" class="icon-btn" data-action="remove-class" aria-label="${esc(t('Sınıfı kaldır'))}">✕</button></div>`;

function saveSettings(form) {
  const st = S.getState(), s = st.settings;
  const data = new FormData(form);
  s.schoolName = String(data.get('schoolName') || s.schoolName).trim();
  s.baselineEnd = String(data.get('baselineEnd') || s.baselineEnd);
  s.costPerKgTL = Math.max(1, Number(data.get('costPerKgTL')) || s.costPerKgTL);
  s.targetReductionPercent = Math.min(80, Math.max(5, Number(data.get('targetReductionPercent')) || s.targetReductionPercent));
  for (const d of [1, 2, 3, 4, 5]) s.menu[d] = String(data.get(`menu-${d}`) || '').split(',').map(x => x.trim()).filter(Boolean);
  const classes = [...form.querySelectorAll('.class-row')].map(row => ({
    id: row.querySelector('[data-k=id]').value || row.querySelector('[data-k=name]').value.replace(/\W/g, '') || String(Date.now()),
    name: row.querySelector('[data-k=name]').value.trim(),
    ageGroup: row.querySelector('[data-k=ageGroup]').value.trim() || '6-13',
    students: Math.min(60, Math.max(1, Number(row.querySelector('[data-k=students]').value) || 25))
  })).filter(c => c.name);
  if (classes.length) s.classes = classes;
  if (data.has('apiKey')) st.apiKey = String(data.get('apiKey')).trim();
  S.save();
  measure.classId = null; measure.menuText = '';
  const lang = String(data.get('lang'));
  if (lang !== getLang()) changeLanguage(lang);
  else boot();
  toast(t('Ayarlar kaydedildi.'));
}

function renderWelcome() {
  $('#welcome-dialog').innerHTML = `<form method="dialog">
    <div class="welcome">
      ${planetSvg(90, 96)}
      <h2>${t('Tabak İz\'e hoş geldin')}</h2>
      <p>${t('Okul yemeğinde tabak artığını ölçen, çocuğa iklim odaklı geri bildirim ve mutfağa menü önerisi veren uygulama. Özel donanım gerekmez; telefon veya tablet yeterli.')}</p>
      <div class="lang-pick" role="radiogroup" aria-label="${esc(t('Dil'))}">${Object.entries(LANGUAGES).map(([code, l]) => `<button type="button" role="radio" aria-checked="${code === getLang()}" class="chip lang-chip ${code === getLang() ? 'on' : ''}" data-action="welcome-lang" data-lang="${code}">${flag(code)}<span>${l.name}</span></button>`).join('')}</div>
      <ol class="steps">
        <li>${t('<strong>Ölç:</strong> "Örnek tepsiyle dene" ya da kendi tabağının önce/sonra fotoğrafını çek, Gemini ile analiz et; sonucu kahramanın sesiyle dinle.')}</li>
        <li>${t('<strong>Sınıf:</strong> Çocukların gördüğü gezegen, sınıf puanı ve İsrafsız Hafta yarışı.')}</li>
        <li>${t('<strong>Mutfak:</strong> Yarın ne kadar pişirilmeli, yemek bazlı israf ve Gemini\'nin menü önerileri.')}</li>
        <li>${t('<strong>Etki:</strong> Baseline haftasına göre azalma, kurtarılan gıda, besin, CO₂e, su ve TL; gerçek fotoğraflarla doğrulama pilotu ve PDF rapor.')}</li>
      </ol>
      <p class="small-muted">${t('Geçmiş haftalarda sentetik örnek pilot verisi yüklüdür ve öyle etiketlenmiştir. Telefona kurmak için tarayıcı menüsünden "Ana ekrana ekle"yi seç.')}</p>
      <button class="btn primary full" value="tour">${t('2 dakikalık jüri turunu başlat')}</button>
      <button class="btn ghost full" value="ok">${t('Kendim keşfedeceğim')}</button>
    </div></form>`;
}

function renderLangMenu() {
  const current = LANGUAGES[getLang()];
  $('#lang-btn').innerHTML = flag(getLang());
  $('#lang-btn').setAttribute('aria-label', t('Dil: {name} (değiştir)', { name: current.name }));
  $('#lang-btn').title = current.name;
  $('#lang-menu').innerHTML = Object.entries(LANGUAGES).map(([code, l]) =>
    `<button role="menuitemradio" aria-checked="${code === getLang()}" class="${code === getLang() ? 'on' : ''}" data-action="set-lang" data-lang="${code}">${flag(code)}<span>${l.name}</span></button>`).join('');
}

function changeLanguage(lang) {
  setLang(lang);
  measure.menuText = '';
  translateStatic();
  renderLangMenu();
  applyTheme(getTheme());
  renderModeBadge();
  show(currentTab());
}

// ---------- Jüri turu ----------
function tourSteps() {
  const go = tab => () => { if (currentTab() !== tab) show(tab); };
  return [
    { enter: go('measure'), target: '.card.intro', title: t('Tabak İz\'e hoş geldin'), body: t('Bu 2 dakikalık tur ürünün tamamını gösterir: tabak ölçümü, çocuk geri bildirimi, mutfak kararları ve ölçülen etki. "Benim için yap" düğmeleri işlemi senin yerine çalıştırır.') },
    { enter: go('measure'), target: '[data-action=sample-tray]', title: t('1. Tabağı fotoğrafla'), body: t('Öğretmen yemekten önce ve sonra yalnızca tabağı çeker. Elinde tabak yoksa örnek tepsiyi yükle.'), action: { label: t('Örnek tepsiyi yükle'), run: useSampleTray, advance: true } },
    { enter: go('measure'), target: '[data-action=analyze]', title: t('2. Gemini ölçsün'), body: t('Gemini iki fotoğrafı karşılaştırıp her yemekten ne kadar kaldığını ölçer. Ücretsiz sürümde birkaç saniye ile birkaç dakika sürebilir; sonuç gelene kadar beklenir.'), action: { label: t('Analiz et'), run: async () => { if (!measure.after) await useSampleTray(); await runAnalysis(); }, advance: true } },
    { enter: go('measure'), target: () => $('.card.result') ? '.card.result .hero' : '#measure-result', title: t('3. Çocuğa geri bildirim'), body: t('Çocuk gezegen puanını ve kendisine özel, suçlamayan bir mesaj görür. Kalan yemek su, CO₂e ve kaçırılan besin olarak gösterilir.') },
    { enter: go('measure'), target: () => $('#child-msg') ? '#child-msg' : '#measure-result', title: t('4. Kahramanın sesi'), body: t('Mesaj, sonuca göre coşkulu, cesaretlendirici ya da yumuşak bir tonla Gemini sesiyle okunur; okumayı yeni öğrenen çocuklar için.'), action: { label: t('Sesi dinle'), run: async () => { if (measure.result) await toggleVoice(); } } },
    { enter: go('class'), target: '.planet-card', title: t('5. Sınıfın gezegeni'), body: t('Puan bireysel değil, sınıf ortalamasıyla verilir; sınıflar İsrafsız Hafta için yarışır, veliler haftalık özet alır.') },
    { enter: go('kitchen'), target: '#forecast-card', title: t('6. Yarın ne pişirilmeli?'), body: t('Geçmiş ölçümlerden her yemeğin yarınki artığı tahmin edilir ve mutfağa daha az pişirme önerilir. İsraf tabağa gelmeden önlenir.') },
    { enter: go('kitchen'), target: '#suggest-card', title: t('7. Gemini menü önerisi'), body: t('En çok kalan yemekler için besin değerini koruyan öneriler üretilir; kararı mutfak verir.'), action: { label: t('Öneri üret'), run: runSuggest } },
    { enter: go('impact'), target: '.impact-hero', title: t('8. Ölçülen etki'), body: t('İlk hafta baseline alınır; değişim, kurtarılan gıda, CO₂e, su, TL ve besin otomatik hesaplanır. Tek dokunuşla PDF rapor alınır.') },
    { enter: go('evidence'), target: '#bench-world', title: t('9. Kanıt ve benchmark'), body: t('Sonuçlar dünyadaki okul verileriyle, ölçüm yöntemleriyle ve rakip çözümlerle karşılaştırılır; Gemini\'nin doğruluğu gerçek fotoğraflarla ve terazide tartılmış tabaklarla ölçülür. Her rakamın kaynağı numaralıdır.') },
    { enter: go('impact'), target: '#lang-btn', title: t('10. Dil ve tema'), body: t('Uygulama Türkçe ve İngilizce kullanılabilir; açık ve koyu tema desteklenir. Tur bitti, şimdi kendin dene!') }
  ];
}
const beginTour = () => startTour(tourSteps(), { onEnd: () => { S.getState().settings.onboarded = true; S.save(); } });

// ---------- Gezinme ----------
function show(tab) {
  if (!TABS[tab]) tab = 'measure';
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.dataset.view !== tab; });
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ({ measure: renderMeasure, class: renderClass, kitchen: renderKitchen, impact: renderImpact, evidence: renderEvidence })[tab]();
  if (tab === 'kitchen') warmUp('/api/suggest');
  if (tab === 'evidence' && pilotRun) setTimeout(() => startTicker('pilot-progress', performance.now(), expectedMs('analyze')), 50);
  // Temiz adres (/olc, /mutfak …): sekme değişince geçmişe eklenir, böylece geri tuşu önceki sekmeye döner.
  const path = `/${TABS[tab]}`;
  if (location.pathname !== path || location.hash) {
    const first = location.pathname === '/' || location.hash || !tabFromPath(false);
    history[first ? 'replaceState' : 'pushState'](null, '', path);
  }
  if (!isTouring()) window.scrollTo({ top: 0 });
}
// Adres çubuğundaki sekme. Eski #olc biçimindeki bağlantılar da tanınır.
const tabFromPath = (fallback = true) => {
  const slug = location.pathname.replace(/^\/+|\/+$/g, '') || location.hash.slice(1);
  return Object.keys(TABS).find(k => TABS[k] === slug) || (fallback ? 'measure' : null);
};
const currentTab = () => document.querySelector('.tabbar button.active')?.dataset.tab || 'measure';

async function exportCsv() {
  const name = `tabak-iz-${S.today()}.csv`;
  const blob = new Blob(['﻿' + S.toCsv()], { type: 'text/csv;charset=utf-8' });
  // iOS'ta ana ekrandan açılan uygulamada indirme çalışmaz; paylaşım menüsüyle dosyayı ver.
  const file = new File([blob], name, { type: 'text/csv' });
  if (/iPhone|iPad|iPod/.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Tabak İz' }); } catch {}
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t('{n} ölçüm CSV olarak indirildi.', { n: S.getState().measurements.length }));
}

// ---------- Tema: Sistem → Açık → Koyu ----------
const THEME_KEY = 'tabakiz.theme';
const THEME_LABEL = { system: 'Sistem teması', light: 'Açık tema', dark: 'Koyu tema' };
const THEME_ICON = {
  system: '<path d="M12 3a9 9 0 1 0 0 18V3Z" fill="currentColor"/><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>',
  light: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  dark: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="currentColor"/>'
};
function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
}
function applyTheme(theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name=theme-color]').content = dark ? '#121a16' : '#1f4d3a';
  const btn = $('#theme-toggle');
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${THEME_ICON[theme]}</svg>`;
  btn.setAttribute('aria-label', t('{theme} (değiştirmek için dokun)', { theme: t(THEME_LABEL[theme]) }));
  btn.title = t(THEME_LABEL[theme]);
}
function cycleTheme() {
  const next = { system: 'light', light: 'dark', dark: 'system' }[getTheme()];
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  applyTheme(next);
  toast(t(THEME_LABEL[next]));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(getTheme()));

// ---------- Olaylar ----------
document.addEventListener('click', async event => {
  if (!event.target.closest('#lang-menu, #lang-btn')) $('#lang-menu').hidden = true;
  const tabBtn = event.target.closest('.tabbar button');
  if (tabBtn) return show(tabBtn.dataset.tab);
  const el = event.target.closest('[data-action]');
  if (!el) return;
  const { action } = el.dataset;
  if (action !== 'reset-all') confirmReset = null;
  switch (action) {
    case 'pick-class': measure.classId = el.dataset.id; return renderMeasure();
    case 'remove-photo': measure[el.dataset.key] = null; measure.result = measure.record = measure.error = null; return renderMeasure();
    case 'sample-tray': return useSampleTray();
    case 'analyze': return runAnalysis();
    case 'voice': return toggleVoice();
    case 'next-plate': stopVoice(); voiceState = null; Object.assign(measure, { before: null, after: null, result: null, record: null, error: null }); renderMeasure(); return window.scrollTo({ top: 0, behavior: 'smooth' });
    case 'select-class': selectedClass = el.dataset.id; return renderClass();
    case 'cancel': {
      const target = el.dataset.target;
      ({ 'suggest-progress': suggestController, 'pilot-progress': pilotRun?.controller, 'measure-progress': measure.controller })[target]?.abort();
      return;
    }
    case 'share-summary': {
      const text = $('.parent')?.textContent || '';
      // Telefonda paylaşım menüsü, bilgisayarda doğrudan panoya kopyalama.
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title: t('Tabak İz haftalık özet'), text }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
      }
      try { await navigator.clipboard.writeText(text); toast(t('Özet panoya kopyalandı.')); }
      catch {
        const range = document.createRange();
        range.selectNodeContents($('.parent'));
        getSelection().removeAllRanges(); getSelection().addRange(range);
        toast(t('Metin seçildi; kopyalayıp paylaşabilirsin.'));
      }
      return;
    }
    case 'theme': return cycleTheme();
    case 'lang-menu': { const menu = $('#lang-menu'); menu.hidden = !menu.hidden; return; }
    case 'set-lang': $('#lang-menu').hidden = true; changeLanguage(el.dataset.lang); return toast(LANGUAGES[getLang()].name);
    case 'welcome-lang': changeLanguage(el.dataset.lang); return renderWelcome();
    case 'start-tour': $('#settings-dialog').close(); return beginTour();
    case 'help': return beginTour();
    case 'range': kitchenRange = el.dataset.range; return renderKitchen();
    case 'suggest': return runSuggest();
    case 'decide': {
      const s = S.getState().suggestions.find(x => x.id === el.dataset.id);
      if (s) { s.status = el.dataset.status; S.save(); }
      return renderKitchen();
    }
    case 'report': return printReport();
    case 'pilot-run': {
      const set = el.dataset.set || 'visual';
      const done = getResults(set);
      return startPilot(set, Boolean(done) && Object.keys(done.items).length >= (await loadManifest(set)).items.length);
    }
    case 'pilot-clear': clearResults(el.dataset.set || 'visual'); toast(t('Pilot sonuçları sıfırlandı.')); return renderEvidence();
    case 'goto': return show(el.dataset.tab);
    case 'ref': {
      const target = document.getElementById(`ref-${el.dataset.ref}`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.remove('flash');
      void target.offsetWidth;
      target.classList.add('flash');
      return;
    }
    case 'clear-sample': S.clearSample(); toast(t('Örnek veri kaldırıldı.')); return show(currentTab());
    case 'reseed': S.seedSample(); toast(t('Örnek veri yüklendi.')); return show(currentTab());
    case 'reset-all':
      if (!confirmReset) { confirmReset = true; return renderImpact(); }
      confirmReset = null; S.resetAll(); toast(t('Tüm veri silindi.')); return boot();
    case 'export-csv': return exportCsv();
    case 'add-class': $('#class-rows').insertAdjacentHTML('beforeend', classRow({ id: '', name: '', ageGroup: '6-13', students: 25 })); return;
    case 'remove-class': el.closest('.class-row').remove(); return;
  }
});

document.addEventListener('change', event => {
  if (event.target.matches('input[data-photo]')) onPhoto(event.target);
});
document.addEventListener('input', event => {
  if (event.target.id === 'menu-input') measure.menuText = event.target.value;
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (form.dataset.form === 'weigh') {
    event.preventDefault();
    const raw = $('#weigh-input').value.trim();
    const grams = Number(raw);
    if (!raw || !Number.isFinite(grams) || grams < 0 || grams > 2000) return toast(t('0-2000 arasında bir gram değeri gir.'));
    S.setWeighed(measure.record.id, Math.round(grams));
    measure.record.weighedGrams = Math.round(grams);
    toast(t('Tartım kaydedildi. Yapay zekâ tahmini: {ai} g, tartım: {w} g.', { ai: measure.record.leftoverGrams, w: Math.round(grams) }));
  }
  if (form.dataset.form === 'settings' && event.submitter?.value === 'save') saveSettings(form);
});
$('#open-settings').addEventListener('click', () => { renderSettings(); $('#settings-dialog').showModal(); });
$('#welcome-dialog').addEventListener('close', () => {
  S.getState().settings.onboarded = true;
  S.save();
  if ($('#welcome-dialog').returnValue === 'tour') beginTour();
});
window.addEventListener('popstate', () => show(tabFromPath()));
window.addEventListener('afterprint', () => { $('#print-root').innerHTML = ''; });

// Dar ekranda rozetin kısa hali gösterilir ("Gemini ✓" / "Demo").
function renderModeBadge() {
  const badge = $('#mode-badge');
  badge.innerHTML = `<span class="badge-long">${esc(t(MODE_LABEL[mode]))}</span><span class="badge-short">${mode === 'demo' ? 'Demo' : 'Gemini ✓'}</span>`;
  badge.title = t(MODE_LABEL[mode]);
  badge.className = `badge ${mode === 'demo' ? 'muted' : 'good'}`;
}

async function boot() {
  setLang(getLang());
  translateStatic();
  renderLangMenu();
  applyTheme(getTheme());
  S.load();
  $('#school-name').textContent = S.getState().settings.schoolName;
  mode = await detectMode();
  renderModeBadge();
  show(tabFromPath());
  warmUp('/api/analyze');
  if (!S.getState().settings.onboarded && !isTouring()) { renderWelcome(); $('#welcome-dialog').showModal(); }
}

boot();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('/sw.js').catch(() => {});
