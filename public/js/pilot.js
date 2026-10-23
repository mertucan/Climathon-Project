// Doğrulama pilotları. Sonuçlar cihazda saklanır; yarıda kalırsa kaldığı yerden devam eder.
//  visual: Wikimedia Commons'tan 14 gerçek tabak; referans insan görsel tahmini (Comstock benzeri), artık %.
//  mass:   Nutrition5k'den 16 kafeterya tabağı; referans terazide tartılmış gerçek kütle (g) ve enerji (kcal).
import { analyzePlate, detectMode, prepareImage } from './ai.js';
import { NUTRIENTS } from './impact.js';

export const PILOT_SETS = {
  visual: { manifest: '/pilot/manifest.json', key: 'tabakiz.pilot' },
  mass: { manifest: '/pilot/mass/manifest.json', key: 'tabakiz.pilot.mass' }
};
const manifests = {};

export async function loadManifest(set = 'visual') {
  if (!manifests[set]) manifests[set] = await (await fetch(PILOT_SETS[set].manifest)).json();
  return manifests[set];
}

export function getResults(set = 'visual') {
  try { return JSON.parse(localStorage.getItem(PILOT_SETS[set].key) || 'null'); } catch { return null; }
}
function saveResults(set, results) {
  try { localStorage.setItem(PILOT_SETS[set].key, JSON.stringify(results)); } catch {}
}
export function clearResults(set = 'visual') {
  try { localStorage.removeItem(PILOT_SETS[set].key); } catch {}
}

// Gemini'nin listelediği yemeklerin toplam gramı ve kategori katsayılarıyla enerjisi (servis edilen miktar üzerinden).
function plateTotals(foods) {
  let grams = 0, kcal = 0;
  for (const f of foods) {
    grams += f.servedGrams;
    kcal += f.servedGrams / 100 * (NUTRIENTS[f.category] || NUTRIENTS.diger).kcal;
  }
  return { grams: Math.round(grams), kcal: Math.round(kcal) };
}

// onItem(index, total, item) her fotoğraf başlarken çağrılır.
export async function runPilot({ set = 'visual', signal, onItem, onWait, restart = false } = {}) {
  if ((await detectMode()) === 'demo') throw Object.assign(new Error('demo'), { code: 'demo' });
  const { items } = await loadManifest(set);
  const results = (!restart && getResults(set)) || { startedAt: new Date().toISOString(), items: {} };
  for (const [index, item] of items.entries()) {
    const done = results.items[item.id];
    if (done && (typeof done.ai === 'number' || done.skipped)) continue; // atlananlar da tekrar denenmez
    onItem?.(index, items.length, item);
    const blob = await (await fetch(item.file, { signal })).blob();
    const image = await prepareImage(blob);
    const { result, ms } = await analyzePlate({ after: { mimeType: image.mimeType, data: image.data }, ageGroup: '6-13', menu: [] }, { signal, onWait });
    const usable = !result.personVisible && result.imageOk && result.foods.length;
    const totals = plateTotals(result.foods);
    results.items[item.id] = {
      // visual: artık yüzdesi; mass: tabaktaki toplam gram tahmini
      ai: usable ? (set === 'mass' ? totals.grams : result.totalLeftoverPercent) : null,
      kcal: usable ? totals.kcal : null,
      leftover: result.totalLeftoverPercent,
      skipped: result.personVisible ? 'person' : !usable ? 'image' : null,
      foods: result.foods.map(f => ({ name: f.name, category: f.category, servedGrams: f.servedGrams, leftoverPercent: f.leftoverPercent })),
      confidence: result.confidence, model: result.model || null, ms: Math.round(ms)
    };
    results.finishedAt = new Date().toISOString();
    saveResults(set, results);
  }
  return results;
}

const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
function pearson(xs, ys) {
  const mx = mean(xs), my = mean(ys);
  const cov = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  const sx = Math.sqrt(xs.reduce((s, x) => s + (x - mx) ** 2, 0));
  const sy = Math.sqrt(ys.reduce((s, y) => s + (y - my) ** 2, 0));
  return sx && sy ? cov / (sx * sy) : null;
}

export function summarizePilot(man, results, set = 'visual') {
  if (!man || !results) return null;
  const refOf = item => set === 'mass' ? item.reference.massGrams : item.reference.totalLeftoverPercent;
  const pairs = man.items
    .map(item => ({ item, r: results.items[item.id] }))
    .filter(p => typeof p.r?.ai === 'number')
    .map(p => ({ ...p, ai: p.r.ai, ref: refOf(p.item), err: p.r.ai - refOf(p.item) }));
  if (!pairs.length) return { n: 0, total: man.items.length };
  const base = {
    n: pairs.length, total: man.items.length,
    mae: mean(pairs.map(p => Math.abs(p.err))),
    bias: mean(pairs.map(p => p.err)),
    r: pearson(pairs.map(p => p.ref), pairs.map(p => p.ai)),
    avgMs: mean(pairs.map(p => p.r.ms || 0)),
    points: pairs.map(p => ({ ref: p.ref, ai: p.ai, label: p.item.id }))
  };
  if (set === 'mass') {
    const kcalPairs = pairs.filter(p => typeof p.r.kcal === 'number');
    return {
      ...base,
      mape: mean(pairs.map(p => Math.abs(p.err) / p.ref * 100)),
      within25: pairs.filter(p => Math.abs(p.err) / p.ref <= 0.25).length / pairs.length * 100,
      kcalMape: kcalPairs.length ? mean(kcalPairs.map(p => Math.abs(p.r.kcal - p.item.reference.kcal) / p.item.reference.kcal * 100)) : null,
      untouchedShare: pairs.filter(p => p.r.leftover >= 80).length / pairs.length * 100
    };
  }
  const byKind = {};
  for (const p of pairs) (byKind[p.item.kind] ||= []).push(Math.abs(p.err));
  return {
    ...base,
    within15: pairs.filter(p => Math.abs(p.err) <= 15).length / pairs.length * 100,
    byKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, mean(v)]))
  };
}
