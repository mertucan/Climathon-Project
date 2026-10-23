// Yemek kategorisine göre yaklaşık çevresel katsayılar (pişmiş porsiyon, 1 kg başına).
// Kaynak: Poore & Nemecek (2018) / Our World in Data ürün ayak izleri ve Water Footprint
// Network değerleri; pişmiş, karışık okul yemeğine (su ve diğer malzemelerle seyrelme) ihtiyatlı uyarlandı.
// Bunlar saha pilotunda yerel değerlerle güncellenecek yaklaşık katsayılardır.
export const FACTORS = {
  kirmizi_et: { co2: 15, water: 1500 },
  tavuk_balik: { co2: 5, water: 600 },
  baklagil: { co2: 1.2, water: 450 },
  tahil: { co2: 1.4, water: 500 },
  sebze: { co2: 0.6, water: 150 },
  meyve: { co2: 0.6, water: 250 },
  sut_urunu: { co2: 2.5, water: 300 },
  corba: { co2: 0.8, water: 200 },
  tatli: { co2: 2.5, water: 400 },
  diger: { co2: 2, water: 300 }
};

// Pişmiş okul yemeği için 100 g başına yaklaşık besin değerleri (USDA FoodData Central ve
// TÜBER 2022 / Türkiye Beslenme Rehberi değerlerinden kategori ortalaması olarak uyarlandı).
export const NUTRIENTS = {
  kirmizi_et: { kcal: 230, protein: 17, fiber: 0.5, iron: 2.2 },
  tavuk_balik: { kcal: 160, protein: 20, fiber: 0.5, iron: 0.9 },
  baklagil: { kcal: 110, protein: 6.5, fiber: 5, iron: 1.8 },
  tahil: { kcal: 150, protein: 4, fiber: 1.5, iron: 0.8 },
  sebze: { kcal: 60, protein: 2, fiber: 2.5, iron: 1.2 },
  meyve: { kcal: 52, protein: 0.4, fiber: 2.2, iron: 0.2 },
  sut_urunu: { kcal: 55, protein: 3.3, fiber: 0, iron: 0.1 },
  corba: { kcal: 60, protein: 3.5, fiber: 1.5, iron: 1 },
  tatli: { kcal: 120, protein: 3, fiber: 0.2, iron: 0.2 },
  diger: { kcal: 100, protein: 3, fiber: 1, iron: 0.5 }
};

// 7-12 yaş için yaklaşık günlük ihtiyaç (EFSA / IOM referans değerlerinin yaş ortalaması).
export const DAILY_NEEDS = { kcal: 1800, protein: 28, fiber: 25, iron: 10 };

export const AVERAGE_FACTOR = { co2: 2.5, water: 300 }; // FAO Food Wastage Footprint ortalaması (~2,5 kg CO2e / kg)

export function footprint(foods) {
  let co2 = 0, water = 0;
  for (const food of foods) {
    const f = FACTORS[food.category] || FACTORS.diger;
    co2 += food.leftoverGrams / 1000 * f.co2;
    water += food.leftoverGrams / 1000 * f.water;
  }
  return { co2g: Math.round(co2 * 1000), waterL: Math.round(water * 10) / 10 };
}

// Tabakta kalan yemekle çocuğun alamadığı besin miktarı.
export function nutrientLoss(foods) {
  const out = { kcal: 0, protein: 0, fiber: 0, iron: 0 };
  for (const food of foods) {
    const n = NUTRIENTS[food.category] || NUTRIENTS.diger;
    for (const key of Object.keys(out)) out[key] += food.leftoverGrams / 100 * n[key];
  }
  return out;
}

// Günlük ihtiyacın yüzde kaçı tabakta kaldı.
export const shareOfDaily = loss => Object.fromEntries(Object.keys(DAILY_NEEDS).map(k => [k, loss[k] / DAILY_NEEDS[k] * 100]));
