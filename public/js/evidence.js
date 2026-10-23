// Kanıt ve benchmark verisi. Buradaki her sayı yayımlanmış bir kaynaktan alınmıştır; [n] = REFERENCES[n-1].
// Firma açıklamaları (vendor) bağımsız çalışmalardan ayrı işaretlenir. Metrikler çalışmalar arasında farklıdır
// (kalori %, hazırlanan yemeğe göre %, maliyete göre %, öğrenci başı gram); karşılaştırma yol göstericidir.

export const REFERENCES = [
  { id: 1, text: 'USDA FNS (2019). School Nutrition and Meal Cost Study: Summary of Findings. SY 2014-15, 6.253 tepsi, 165 okul.', url: 'https://fns-prod.azureedge.us/sites/default/files/resource-files/SNMCS_Summary-Findings.pdf' },
  { id: 2, text: 'USDA FNS (2019). School Nutrition and Meal Cost Study, Final Report Volume 4: Student Participation, Satisfaction, Plate Waste, and Dietary Intakes.', url: 'https://fns-prod.azureedge.us/sites/default/files/resource-files/SNMCS-Volume4.pdf' },
  { id: 3, text: 'Who Cleans the Plate? Quantity and Type of Food Waste in 78 Primary Schools\' Canteens in Italy. Sustainability 17(17):7836, 2025. ~110.000 öğün.', url: 'https://doi.org/10.3390/su17177836' },
  { id: 4, text: 'Eriksson M. vd. (2017). Quantification of food waste in public catering services: A case study from a Swedish municipality. Waste Management.', url: 'https://pubmed.ncbi.nlm.nih.gov/28161338/' },
  { id: 5, text: 'Malefors C. vd. (2022). Testing interventions to reduce food waste in school catering. Resources, Conservation and Recycling.', url: 'https://www.sciencedirect.com/science/article/pii/S0921344921006066' },
  { id: 6, text: 'Malefors C. vd. (2025). Understanding food waste generation in school canteens. SLU.', url: 'https://pub.epsilon.slu.se/38912/1/malefors-c-et-al-20251120.pdf' },
  { id: 7, text: 'Özel bir okul yemekhanesinde oluşan besin artık miktarlarının ve maliyetinin saptanması. Hasan Kalyoncu Üniversitesi (Gaziantep, 6-13 yaş, 300 öğrenci).', url: 'https://openaccess.hku.edu.tr/items/6469c12e-ce67-411d-b638-97313f7b46f9' },
  { id: 8, text: 'Byker Shanks C. vd. (2017). Food Waste in the National School Lunch Program 1978-2015: A Systematic Review. J Acad Nutr Diet.', url: 'https://www.jandonline.org/article/S2212-2672(17)30598-1/fulltext' },
  { id: 9, text: 'Validation of a digital photography method for assessing plate waste in an acute care hospital setting. British Food Journal, 2025.', url: 'https://doi.org/10.1108/BFJ-11-2025-1534' },
  { id: 10, text: 'Food Waste Detection in Canteen Plates Using YOLOv11. Applied Sciences 15(13):7137, 2025.', url: 'https://doi.org/10.3390/app15137137' },
  { id: 11, text: 'Strategies for Automated Identification of Food Waste in University Cafeterias: A Machine Vision Recognition Approach. Applied Sciences 15(9):5036, 2025.', url: 'https://www.mdpi.com/2076-3417/15/9/5036' },
  { id: 12, text: 'Exploring the potential of AI-driven food waste management strategies used in the hospitality industry. Frontiers in Artificial Intelligence, 2024.', url: 'https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2024.1429477/full' },
  { id: 13, text: 'Winnow (2021). Melco, Winnow ve LSE davranış bilimi denemesi: personel yemekhanesinde tabak artığı %35\'e kadar azaldı (firma açıklaması).', url: 'https://www.winnowsolutions.com/resources/news/melco-combines-advanced-technology-with-the-latest-thinking-in-behavioral-science-to-cut-plate-waste-by-35' },
  { id: 14, text: 'KED Global (2022). Nuvilab uses the latest tech to tackle age-old issue of food waste (Kore\'de 22 okul yemekhanesi; firma açıklamaları).', url: 'https://www.kedglobal.com/korean-startups/newsView/ked202202090016' },
  { id: 15, text: 'Thames Q. vd. (2021). Nutrition5k: Towards Automatic Nutritional Understanding of Generic Food. CVPR 2021. Veri seti CC BY 4.0.', url: 'https://github.com/google-research-datasets/Nutrition5k' },
  { id: 16, text: 'UNEP (2024). Food Waste Index Report 2024.', url: 'https://www.unep.org/resources/publication/food-waste-index-report-2024' },
  { id: 17, text: 'Poore J., Nemecek T. (2018). Reducing food\'s environmental impacts through producers and consumers. Science 360:987-992.', url: 'https://doi.org/10.1126/science.aaq0216' },
  { id: 18, text: 'USDA FoodData Central (besin değerleri).', url: 'https://fdc.nal.usda.gov/' }
];

// Okul tabak artığı: yüzde temelli bulgular (metrik her satırda belirtilir).
export const WORLD_PERCENT = [
  { label: 'ABD, ilkokul', value: 25, prefix: '>', metric: 'kalori ve besinlerin', ref: 2 },
  { label: 'ABD, tüm okullar', value: 20, prefix: '≈', metric: 'öğle yemeği kalorilerinin', ref: 1 },
  { label: 'İtalya, 78 ilkokul', value: 16.7, decimals: 1, metric: 'hazırlanan yemeğin (tabak artığı)', ref: 3 },
  { label: 'Türkiye, Gaziantep', value: 15, prefix: '≈', metric: 'yemek maliyetinin', ref: 7 }
];

// Öğrenci başı gram (aynı metrik değil: kimi tabak artığı, kimi servis dahil toplam atık).
export const WORLD_GRAMS = [
  { label: 'İtalya, ilkokul', value: 90, metric: 'tabak artığı / öğrenci / gün', ref: 3 },
  { label: 'İsveç, okullar', value: 79, metric: 'toplam atık / porsiyon (servis dahil)', ref: 4 },
  { label: 'İsveç, büyük öğrenciler', value: 36, metric: 'tabak artığı / öğrenci', ref: 6 },
  { label: 'İsveç, küçük öğrenciler', value: 18, metric: 'tabak artığı / öğrenci', ref: 6 }
];

// USDA SNMCS (SY 2014-15) yemek grubuna göre tabak artığı [1] ve Tabak İz kategori eşlemesi.
export const FOOD_GROUPS = [
  { label: 'Sebze', usda: 31, categories: ['sebze'] },
  { label: 'Süt / süt ürünü', usda: 29, categories: ['sut_urunu'] },
  { label: 'Meyve', usda: 26, categories: ['meyve'] },
  { label: 'Tahıl / ekmek (yan)', usda: 23, categories: ['tahil'] },
  { label: 'Tatlı ve diğer', usda: 20, categories: ['tatli', 'diger'] },
  { label: 'Ana yemek', usda: 16, categories: ['kirmizi_et', 'tavuk_balik', 'baklagil'] }
];

// Ölçüm yöntemleri: doğruluk kanıtı, hız/emek, donanım.
export const METHODS = [
  { name: 'Dijital fotoğraf + uzman', accuracy: 'Hastane validasyonunda tartımla r = 0,99, ortalama fark 4,7 g', effort: 'Fotoğraf hızlı, değerlendirme sonradan uzmanca', hardware: 'Kamera', ref: 9 },
  { name: 'Derin öğrenme (özel eğitimli)', accuracy: 'YOLOv11 mAP 0,343; U-Net mIoU %68,6 (tespit metriği, gram değil)', effort: 'Özel veri seti ve model eğitimi gerekir', hardware: 'Kamera + GPU', ref: [10, 11] },
  { name: 'Tabak İz (Gemini, eğitim yok)', accuracy: 'pilot', effort: 'Saniyeler; yeni menüye eğitim gerekmez', hardware: 'Telefon / tablet', ref: null, ours: true }
];

// Çözüm benchmark'ı. vendor: true = firma açıklaması, bağımsız doğrulanmadı.
export const SOLUTIONS = [
  { name: 'Winnow', hardware: 'Çöp kutusu üstü kamera + tartı', school: false, child: false, forecast: true, impact: '%50 (firma); nudge denemesi %35\'e kadar', ref: [12, 13], vendor: true },
  { name: 'Leanpath', hardware: 'Görüntü + tartı istasyonu', school: false, child: false, forecast: true, impact: 'Tipik %50', ref: 12, vendor: true },
  { name: 'KITRO', hardware: 'Kamera + tartı cihazı', school: false, child: false, forecast: false, impact: 'Ort. %30 (firma)', ref: 12, vendor: true },
  { name: 'Nuvilab', hardware: 'Tepsi tarayıcı (kamera + sensör)', school: true, child: false, forecast: false, impact: 'Ort. %30, >%95 doğruluk (firma)', ref: 14, vendor: true },
  { name: 'Sabit kamera istasyonu + açık modeller', hardware: 'İade hattında kamera istasyonu, sunucu', school: true, child: false, forecast: false, impact: 'Simülasyon', ref: null },
  { name: 'Tabak İz', hardware: 'Telefon / tablet', school: true, child: true, forecast: true, impact: 'Hedef −%25 (pilotla ölçülecek)', ref: null, ours: true }
];

// Müdahalelerin etkisi: Tabak İz'in %25 hedefi firma açıklamalarının altında tutuldu.
export const INTERVENTIONS = [
  { label: 'Nudge + ölçüm, personel yemekhanesi (firma)', range: [0, 35], ref: 13, vendor: true },
  { label: 'Okul yemekhaneleri, tepsi tarayıcı (firma)', range: [30, 30], ref: 14, vendor: true },
  { label: 'Tabak İz hedefi', range: [25, 25], ours: true }
];
