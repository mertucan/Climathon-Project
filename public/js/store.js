// Cihazda (öğretmen tableti/telefonu) tutulan veri. Fotoğraflar asla saklanmaz; yalnızca ölçüm sonuçları.
import { footprint } from './impact.js';

const KEY = 'kirinti.v1';

const DEFAULT_MENU = {
  1: ['Mercimek çorbası', 'Tavuk sote', 'Bulgur pilavı', 'Ayran'],
  2: ['Kuru fasulye', 'Pirinç pilavı', 'Mevsim salatası', 'Ekmek'],
  3: ['Ispanak yemeği', 'Makarna', 'Yoğurt', 'Elma'],
  4: ['Izgara köfte', 'Pirinç pilavı', 'Mevsim salatası', 'Mandalina'],
  5: ['Taze fasulye', 'Bulgur pilavı', 'Yoğurt', 'Sütlaç']
};

// Örnek veri için yemek kataloğu: kategori, porsiyon (g) ve başlangıç (baseline) artık oranı (%).
// Oranlar literatüre göre ayarlandı: yemek grubu sırası ve büyüklüğü USDA SNMCS 2014-15 bulgularını izler
// (sebze %31, süt %29, meyve %26, yan tahıl/ekmek %23, tatlı %20, ana yemek %16, et %14) [evidence.js, kaynak 1];
// süt ürünleri, sütten daha az bırakılan ayran/yoğurt olduğu için biraz aşağıda tutuldu. Ağırlıklı ortalama ~%20,
// Türkiye'deki ~%15 (maliyet) ile İtalya'daki %16,7 ve ABD ilkokullarındaki >%25 arasında kalır.
export const DISH_CATALOG = {
  'Mercimek çorbası': ['corba', 200, 18], 'Tavuk sote': ['tavuk_balik', 120, 16], 'Bulgur pilavı': ['tahil', 150, 24],
  'Ayran': ['sut_urunu', 200, 22], 'Kuru fasulye': ['baklagil', 180, 18], 'Pirinç pilavı': ['tahil', 150, 20],
  'Mevsim salatası': ['sebze', 80, 32], 'Ekmek': ['tahil', 50, 28], 'Ispanak yemeği': ['sebze', 150, 34],
  'Makarna': ['tahil', 150, 18], 'Yoğurt': ['sut_urunu', 150, 20], 'Elma': ['meyve', 120, 28],
  'Izgara köfte': ['kirmizi_et', 100, 12], 'Mandalina': ['meyve', 100, 24], 'Taze fasulye': ['sebze', 150, 28],
  'Sütlaç': ['tatli', 120, 22]
};

// Gün, dile bağlı olmasın diye 0 (Pazar) - 6 (Cumartesi) indeksi olarak tutulur; ad arayüzde çevrilir.
export const weekday = date => new Date(`${date}T12:00:00`).getDay();
export const isoDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => isoDate(new Date());

export function mondayOf(date) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(d);
}
export function addDays(date, n) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

function defaultState() {
  const thisMonday = mondayOf(today());
  return {
    settings: {
      schoolName: 'Pilot İlkokulu',
      classes: [
        { id: '3A', name: '3-A', ageGroup: '8-9', students: 26 },
        { id: '4B', name: '4-B', ageGroup: '9-10', students: 24 },
        { id: '5C', name: '5-C', ageGroup: '10-11', students: 25 }
      ],
      costPerKgTL: 120,
      targetReductionPercent: 25,
      baselineEnd: addDays(thisMonday, -17), // 4 haftalık pilotun ilk haftası baseline
      menu: DEFAULT_MENU,
      onboarded: false
    },
    measurements: [],
    suggestions: [],
    apiKey: ''
  };
}

let state;
export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    state = saved ? { ...defaultState(), ...saved, settings: { ...defaultState().settings, ...saved.settings } } : null;
  } catch { state = null; }
  if (!state) {
    state = defaultState();
    seedSample();
  }
  return state;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
export const getState = () => state;

export function menuFor(date) {
  return state.settings.menu[new Date(`${date}T12:00:00`).getDay()] || [];
}

export function addMeasurement(analysis, { classId, source, lang = 'tr', date = today() }) {
  const { co2g, waterL } = footprint(analysis.foods);
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    ts: new Date().toISOString(), date, classId, source, lang,
    foods: analysis.foods, servedGrams: analysis.servedGrams, leftoverGrams: analysis.leftoverGrams,
    totalLeftoverPercent: analysis.totalLeftoverPercent, co2g, waterL,
    confidence: analysis.confidence, childMessage: analysis.childMessage, kitchenNote: analysis.kitchenNote,
    weighedGrams: null
  };
  state.measurements.push(record);
  save();
  return record;
}

export function setWeighed(id, grams) {
  const m = state.measurements.find(x => x.id === id);
  if (m) { m.weighedGrams = grams; save(); }
}

// ---- Örnek (sentetik) pilot verisi: 1 hafta baseline + 3 hafta müdahale, 3 sınıf ----
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function seedSample() {
  const rand = rng(31);
  const start = addDays(mondayOf(today()), -21);
  const baselineEnd = state.settings.baselineEnd;
  const topWaste = new Set(['Ispanak yemeği', 'Mevsim salatası', 'Taze fasulye']);
  const classBias = { '3A': 1.08, '4B': 1, '5C': 0.9 };
  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 5; d++) {
      const date = addDays(start, w * 7 + d);
      if (date > today()) continue;
      const intervention = date > baselineEnd;
      for (const cls of state.settings.classes) {
        for (let p = 0; p < 6; p++) {
          const foods = menuFor(date).map(name => {
            const [category, servedGrams, base] = DISH_CATALOG[name] || ['diger', 120, 15];
            // Müdahale haftalarında geri bildirim + menü değişikliği etkisi kademeli artar.
            const effect = intervention ? (topWaste.has(name) ? 0.12 + 0.09 * w : 0.06 + 0.05 * w) : 0;
            const pct = Math.round(Math.min(100, Math.max(0, base * classBias[cls.id] * (1 - effect) * (0.55 + rand() * 0.9))));
            return { name, category, servedGrams, leftoverPercent: pct, leftoverGrams: Math.round(servedGrams * pct / 100) };
          });
          const served = foods.reduce((s, f) => s + f.servedGrams, 0);
          const left = foods.reduce((s, f) => s + f.leftoverGrams, 0);
          const { co2g, waterL } = footprint(foods);
          state.measurements.push({
            id: `sample-${date}-${cls.id}-${p}`, ts: `${date}T12:${String(10 + p).padStart(2, '0')}:00`, date, classId: cls.id,
            source: 'sample', foods, servedGrams: served, leftoverGrams: left,
            totalLeftoverPercent: Math.round(left / served * 100), co2g, waterL,
            confidence: 'medium', childMessage: '', kitchenNote: '', weighedGrams: null
          });
        }
      }
    }
  }
  save();
}

export function clearSample() {
  state.measurements = state.measurements.filter(m => m.source !== 'sample');
  state.suggestions = state.suggestions.filter(s => s.source !== 'sample');
  save();
}
export function resetAll() {
  state = defaultState();
  state.settings.onboarded = true;
  save();
}
export const hasSample = () => state.measurements.some(m => m.source === 'sample');

// ---- Toplulaştırmalar ----
const pct = (left, served) => served ? left / served * 100 : 0;

export function summarize(list) {
  const served = list.reduce((s, m) => s + m.servedGrams, 0);
  const left = list.reduce((s, m) => s + m.leftoverGrams, 0);
  return {
    plates: list.length, served, left,
    avgPercent: pct(left, served),
    perPlateLeft: list.length ? left / list.length : 0,
    co2g: list.reduce((s, m) => s + m.co2g, 0),
    waterL: list.reduce((s, m) => s + m.waterL, 0),
    days: new Set(list.map(m => m.date)).size
  };
}

export function byDish(list) {
  const map = new Map();
  for (const m of list) for (const f of m.foods) {
    const item = map.get(f.name) || { dish: f.name, category: f.category, samples: 0, served: 0, left: 0, days: {}, weeks: new Set() };
    item.samples++; item.served += f.servedGrams; item.left += f.leftoverGrams;
    const day = weekday(m.date);
    item.days[day] = item.days[day] || { served: 0, left: 0 };
    item.days[day].served += f.servedGrams; item.days[day].left += f.leftoverGrams;
    item.weeks.add(mondayOf(m.date));
    map.set(f.name, item);
  }
  return [...map.values()].map(item => {
    const worst = Object.entries(item.days).sort((a, b) => pct(b[1].left, b[1].served) - pct(a[1].left, a[1].served))[0];
    return {
      dish: item.dish, category: item.category, samples: item.samples,
      avgLeftover: Math.round(pct(item.left, item.served)),
      wastedKg: item.left / 1000,
      wastedKgPerWeek: Math.round(item.left / 1000 / Math.max(1, item.weeks.size) * 10) / 10,
      worstDay: worst ? Number(worst[0]) : null
    };
  }).sort((a, b) => b.avgLeftover - a.avgLeftover);
}

export function weekly(list) {
  const map = new Map();
  for (const m of list) {
    const week = mondayOf(m.date);
    map.set(week, [...(map.get(week) || []), m]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, items]) => ({ week, ...summarize(items) }));
}

export function phases() {
  const { baselineEnd } = state.settings;
  const baseline = summarize(state.measurements.filter(m => m.date <= baselineEnd));
  const intervention = summarize(state.measurements.filter(m => m.date > baselineEnd));
  const relative = baseline.avgPercent && intervention.plates ? (baseline.avgPercent - intervention.avgPercent) / baseline.avgPercent * 100 : null;
  return { baseline, intervention, relative };
}

export function classBoard() {
  const week = mondayOf(today());
  const { baselineEnd } = state.settings;
  return state.settings.classes.map(cls => {
    const mine = state.measurements.filter(m => m.classId === cls.id);
    const thisWeek = summarize(mine.filter(m => mondayOf(m.date) === week));
    const base = summarize(mine.filter(m => m.date <= baselineEnd));
    const all = summarize(mine);
    const score = thisWeek.plates ? Math.round(100 - thisWeek.avgPercent) : null;
    const improvement = base.plates && thisWeek.plates ? Math.round((base.avgPercent - thisWeek.avgPercent) / base.avgPercent * 100) : null;
    // Toplam puan: tabak başına (100 - artık %) puanının toplamı; seviye her 1000 puanda bir artar.
    const points = Math.round(mine.reduce((s, m) => s + (100 - m.totalLeftoverPercent), 0));
    return { ...cls, thisWeek, base, all, score, improvement, points, level: 1 + Math.floor(points / 1000) };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

export function calibration() {
  const rows = state.measurements.filter(m => m.weighedGrams != null);
  if (!rows.length) return null;
  const errors = rows.map(m => Math.abs(m.leftoverGrams - m.weighedGrams));
  const totalWeighed = rows.reduce((s, m) => s + m.weighedGrams, 0);
  return {
    count: rows.length,
    maeGrams: Math.round(errors.reduce((s, e) => s + e, 0) / rows.length),
    bias: Math.round(rows.reduce((s, m) => s + (m.leftoverGrams - m.weighedGrams), 0) / rows.length),
    wape: totalWeighed ? Math.round(errors.reduce((s, e) => s + e, 0) / totalWeighed * 100) : null
  };
}

export function toCsv() {
  const head = ['tarih', 'sinif', 'kaynak', 'yemek', 'kategori', 'servis_g', 'artik_yuzde', 'artik_g', 'tabak_tartim_g'];
  const rows = [head.join(',')];
  for (const m of state.measurements) for (const f of m.foods) {
    rows.push([m.date, m.classId, m.source, `"${f.name}"`, f.category, f.servedGrams, f.leftoverPercent, f.leftoverGrams, m.weighedGrams ?? ''].join(','));
  }
  return rows.join('\n');
}
