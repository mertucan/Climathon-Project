// Etki ekranı ve PDF raporunun ortak hesapları.
import * as S from './store.js';
import { nutrientLoss } from './impact.js';

export const SCALE = { students: 300, days: 180 }; // ölçekleme: 300 öğrencilik okul, 1 eğitim yılı

function perPlate(list) {
  if (!list.length) return null;
  const n = list.length;
  const nutr = list.reduce((acc, m) => {
    const loss = nutrientLoss(m.foods);
    for (const k of Object.keys(loss)) acc[k] = (acc[k] || 0) + loss[k];
    return acc;
  }, {});
  return {
    left: list.reduce((s, m) => s + m.leftoverGrams, 0) / n,
    co2: list.reduce((s, m) => s + m.co2g, 0) / n,
    water: list.reduce((s, m) => s + m.waterL, 0) / n,
    nutr: Object.fromEntries(Object.entries(nutr).map(([k, v]) => [k, v / n]))
  };
}

export function impactSummary() {
  const st = S.getState();
  const { baselineEnd } = st.settings;
  const { baseline, intervention, relative } = S.phases();
  const pb = perPlate(st.measurements.filter(m => m.date <= baselineEnd));
  const pi = perPlate(st.measurements.filter(m => m.date > baselineEnd));
  const week = S.mondayOf(S.today());
  const thisWeek = perPlate(st.measurements.filter(m => S.mondayOf(m.date) === week));
  let delta = null;
  if (pb && pi) {
    delta = { food: pb.left - pi.left, co2: pb.co2 - pi.co2, water: pb.water - pi.water, nutr: {} };
    for (const k of Object.keys(pb.nutr)) delta.nutr[k] = pb.nutr[k] - pi.nutr[k];
  }
  const scaleBy = (factor, d) => d && {
    food: Math.max(0, d.food * factor), co2: Math.max(0, d.co2 * factor), water: Math.max(0, d.water * factor),
    tl: Math.max(0, d.food * factor) / 1000 * st.settings.costPerKgTL,
    nutr: Object.fromEntries(Object.entries(d.nutr).map(([k, v]) => [k, Math.max(0, v * factor)]))
  };
  return {
    baseline, intervention, relative, target: st.settings.targetReductionPercent, baselineEnd,
    perPlateBaseline: pb, perPlateIntervention: pi, perPlateThisWeek: thisWeek, delta,
    saved: scaleBy(intervention.plates, delta),
    year: delta && delta.food > 0 ? scaleBy(SCALE.students * SCALE.days, delta) : null,
    status: relative == null ? 'none' : relative >= st.settings.targetReductionPercent ? 'good' : relative > 0 ? 'warn' : 'bad'
  };
}
