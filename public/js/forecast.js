// "Yarın ne pişirilmeli?": geçmiş tabak artığından bir sonraki okul gününün yemek bazlı artığını tahmin eder
// ve üretim miktarını önerir. Model: zaman ağırlıklı ortalama (yarı ömür 14 gün) + aynı hafta günü ağırlığı.
// Tabaktaki israftan önce, mutfakta fazla pişirilen yemeği de önlemeyi hedefler.
import * as S from './store.js';
import { FACTORS } from './impact.js';

const HALF_LIFE_DAYS = 14;
const SAME_WEEKDAY_BOOST = 1.5;
const SAFETY = 0.6; // tahmini artığın yalnızca %60'ı kadar az pişir: tahmin hatasına ve ikinci servise pay bırakır

export function nextSchoolDay(from = S.today()) {
  let date = S.addDays(from, 1);
  while ([0, 6].includes(S.weekday(date))) date = S.addDays(date, 1);
  return date;
}

export function forecast(date = nextSchoolDay()) {
  const st = S.getState();
  const menu = S.menuFor(date);
  const students = st.settings.classes.reduce((sum, c) => sum + (Number(c.students) || 25), 0);
  const target = new Date(`${date}T12:00:00`);
  const day = S.weekday(date);
  const history = new Map();
  const categoryHistory = new Map();
  for (const m of st.measurements) {
    const ageDays = Math.max(0, (target - new Date(`${m.date}T12:00:00`)) / 864e5);
    const weight = 0.5 ** (ageDays / HALF_LIFE_DAYS) * (S.weekday(m.date) === day ? SAME_WEEKDAY_BOOST : 1);
    for (const f of m.foods) {
      for (const [map, key] of [[history, f.name], [categoryHistory, f.category]]) {
        const h = map.get(key) || { served: 0, left: 0, n: 0, category: f.category, servedGrams: 0 };
        h.served += f.servedGrams * weight; h.left += f.leftoverGrams * weight; h.n++; h.servedGrams += f.servedGrams;
        map.set(key, h);
      }
    }
  }
  const dishes = menu.map(name => {
    const own = history.get(name);
    const [catalogCategory, catalogGrams] = S.DISH_CATALOG[name] || ['diger', 120];
    const category = own?.category || catalogCategory;
    const basis = own && own.n >= 3 ? own : categoryHistory.get(category);
    const predicted = basis?.served ? basis.left / basis.served : 0.2;
    const portion = own ? own.servedGrams / own.n : catalogGrams;
    const standardKg = portion * students / 1000;
    const savedKg = standardKg * predicted * SAFETY;
    return {
      dish: name, category, samples: own?.n || 0,
      source: own && own.n >= 3 ? 'dish' : basis ? 'category' : 'default',
      predictedPercent: predicted * 100,
      portionGrams: Math.round(portion),
      standardKg, cookKg: standardKg - savedKg, savedKg,
      co2Kg: savedKg * (FACTORS[category] || FACTORS.diger).co2
    };
  }).sort((a, b) => b.savedKg - a.savedKg);
  const total = dishes.reduce((s, d) => ({ standardKg: s.standardKg + d.standardKg, savedKg: s.savedKg + d.savedKg, co2Kg: s.co2Kg + d.co2Kg }), { standardKg: 0, savedKg: 0, co2Kg: 0 });
  return { date, students, dishes, ...total, costTL: total.savedKg * st.settings.costPerKgTL, safety: SAFETY };
}
