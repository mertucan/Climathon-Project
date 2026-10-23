# Kırıntı: Benchmark ve Kanıt Dokümanı

Bu doküman Kırıntı'yı dört eksende karşılaştırır: (1) problemin büyüklüğü, (2) ölçüm yöntemleri, (3) mevcut çözümler, (4) müdahalelerin etkisi. Ayrıca yapay zekâ doğruluğunu iki gerçek veri setiyle nasıl ölçtüğümüzü anlatır. Uygulamadaki **Kanıt** sekmesi aynı içeriği canlı gösterir. Köşeli parantezli numaralar ([1]) sondaki kaynakçaya karşılık gelir ve uygulamadaki numaralarla aynıdır.

**Dürüstlük notu:** Firma açıklamaları (vendor) bağımsız çalışmalardan ayrı işaretlenmiştir. Uygulamadaki geçmiş haftalar sentetik örnek veridir ve her ekranda öyle etiketlenir. Doğrulama pilotları canlı uygulamada gerçek Gemini ile çalıştırıldı (23 Ekim 2026); sonuçlar 6. bölümde, zayıf çıkan ilk ölçüm de dahil olmak üzere olduğu gibi verilmiştir.

## 1. Öne çıkanlar

- **Problem gerçek ve ölçülebilir:**
  - ABD'de okul öğle yemeği kalorilerinin ~%20'si, ilkokullarda %25'ten fazlası tabakta kalıyor [1][2].
  - İtalya'daki 78 ilkokulda hazırlanan yemeğin %16,7'si tabakta kalıyor [3].
  - Türkiye'de bir okulda tabak artığı yemek maliyetinin ~%15'ine ulaşıyor [7].
- **Türkiye'de boşluk var:** İlkokul düzeyinde sürekli ve tabak bazında ölçüm yapan yayımlanmış bir sisteme rastlamadık. Mevcut çalışmalar tek seferlik ve tartıma dayalı.
- **Yapay zekâ artığı insan kadar doğru ölçüyor:** 14 gerçek tabak fotoğrafında Gemini'nin artık tahmini insan görsel tahminine ortalama **6,3 puan** yakın, tahminlerin **%86**'sı ±15 puan içinde, korelasyon **r = 0,96** (6. bölüm).
- **Hangi yemeğin kaldığı biliniyor:** ABD'de sebze (%31), süt (%29) ve meyve (%26) en çok bırakılan gruplar; ana yemek (%16) ve et (%14) en az [1]. Bu yüzden Kırıntı'nın menü önerileri sebzeyi menüden kaldırmak yerine sunumunu değiştirmeyi hedefler.
- **Ölçmek azaltıyor:** Firma açıklamaları %30-35 azalma bildiriyor [12][13][14]. İsveç okullarında yalnızca farkındalık kampanyası porsiyon başına 13 g azaltma sağladı [5]. Kırıntı'nın **%25 hedefi firma açıklamalarının altında tutuldu**.
- **Kırıntı'nın farkı:**
  - Ticari sistemler özel donanım (kamera + tartı istasyonu) ve lisans gerektiriyor, çoğu kurumsal mutfaklara odaklanıyor [12][14]. Kırıntı **donanım gerektirmiyor**, telefonla çalışıyor.
  - **Çocuğa sesli ve suçlamayan geri bildirim** veriyor.
  - Mutfağa **ertesi gün ne kadar pişirileceğini** tahmin ediyor.

## 2. Problemin büyüklüğü: dünyada okul tabak artığı

Çalışmalar farklı metrikler kullandığı için karşılaştırma yol göstericidir.

### Yüzde temelli bulgular

| Ülke / kapsam | Değer | Metrik | Kaynak |
|---|---|---|---|
| ABD, ilkokullar | >%25 | Kalori ve besinlerin tabakta kalan payı | [2] |
| ABD, tüm okullar (SY 2014-15, 6.253 tepsi, 165 okul) | ≈%20 | Öğle yemeği kalorileri | [1] |
| ABD, 1978-2015 çalışmaları | Çoğu >%30 | Sistematik derleme; hiçbir çalışma %5'in altında değil | [8] |
| İtalya, 78 ilkokul (~110.000 öğün) | %16,7 | Hazırlanan yemeğe göre tabak artığı | [3] |
| Türkiye, Gaziantep özel okul (6-13 yaş, 300 öğrenci) | ≈%15 | Yemek maliyetine göre | [7] |

### Öğrenci başına gram

| Ülke / kapsam | g | Metrik | Kaynak |
|---|---|---|---|
| İtalya, ilkokul | 90 | Tabak artığı / öğrenci / gün | [3] |
| İsveç, okullar | 79 | Toplam atık / porsiyon (servis atığı dahil) | [4] |
| İsveç, büyük öğrenciler | 36 | Tabak artığı / öğrenci | [6] |
| İsveç, küçük öğrenciler | 18 | Tabak artığı / öğrenci | [6] |

### Yemek grubuna göre (ABD ulusal çalışması [1])

| Grup | Tabakta kalan |
|---|---|
| Sebze | %31 |
| Süt | %29 |
| Meyve ve %100 meyve suyu | %26 |
| Ayrı tahıl / ekmek | %23 |
| Tatlı ve diğer | %20 |
| Ana yemek | %16 |
| Et / et alternatifi | %14 |

> Uygulamadaki sentetik örnek veri bu sıraya ve büyüklüklere göre ayarlanmıştır (ağırlıklı ortalama ~%20). Amaç örnek verinin gerçekçi görünmesidir; gerçek ölçüm girildikçe uygulama okulun kendi sırasını gösterir. Örnek veriyi literatürle "doğrulanmış" gibi sunmuyoruz.

## 3. Ölçüm yöntemleri benchmark'ı

| Yöntem | Doğruluk kanıtı | Hız ve emek | Donanım | Kaynak |
|---|---|---|---|---|
| Dijital fotoğraf + uzman | Hastane validasyonunda tartımla r = 0,99, ortalama fark 4,7 g | Fotoğraf hızlı, değerlendirme sonradan uzmanca | Kamera | [9] |
| Derin öğrenme (özel eğitimli) | YOLOv11 mAP 0,343; U-Net mIoU %68,6 (tespit metrikleri, gram hatası değil) | Özel veri seti ve model eğitimi gerekir | Kamera + GPU | [10][11] |
| **Kırıntı (Gemini, eğitim yok)** | **Artık %: insan tahminine ortalama 6,3 puan, r = 0,96 (14 fotoğraf). Gram: ilk ölçümde %44 hata, düzeltme sonrası yeniden ölçülecek (Bölüm 6)** | Analiz başına ~6 sn; yeni menüye eğitim gerekmez | Telefon / tablet | – |

**Çıkarım:** Fotoğraf temelli ölçüm tartımla çok yakın sonuç verebiliyor [9], ama uzmanın fotoğrafları tek tek değerlendirmesini gerektiriyor. Kırıntı bu değerlendirmeyi Gemini ile otomatikleştiriyor. Özel eğitimli modeller ise menü değiştikçe yeni veri seti ve yeniden eğitim istiyor [10][11].

## 4. Mevcut çözümler benchmark'ı

| Çözüm | Donanım | Okul odağı | Çocuğa geri bildirim | Üretim tahmini | Bildirilen etki | Kaynak |
|---|---|---|---|---|---|---|
| Winnow | Çöp kutusu üstü kamera + tartı | – | – | ✓ | %50 (firma); nudge denemesinde %35'e kadar (firma) | [12][13] |
| Leanpath | Görüntü + tartı istasyonu | – | – | ✓ | Tipik %50 (derlemede firma verisi) | [12] |
| KITRO | Kamera + tartı cihazı | – | – | – | Ort. %30 (firma) | [12] |
| Nuvilab | Tepsi tarayıcı (kamera + sensör) | ✓ (Kore'de 22 okul, 2022) | – | – | Ort. %30, >%95 doğruluk (firma) | [14] |
| Sabit kamera istasyonu + açık kaynak görüntü modelleri | İade hattında kamera istasyonu ve sunucu | ✓ | – | – | Simülasyon | – |
| **Kırıntı** | **Telefon / tablet** | **✓** | **✓ (sesli, suçlamayan)** | **✓ (yemek bazında kg)** | **Hedef −%25, pilotla ölçülecek** | – |

**Kırıntı'nın farkları:**
- **Kurulum yok:** Öğretmenin telefonu yeterli; sabit istasyon, sunucu ya da GPU gerekmiyor.
- **Çocuk katmanı:** gezegen puanı, sınıf yarışı ve sonuca göre tonu değişen sesli geri bildirim.
- **Mutfak katmanı:** ertesi gün yemek bazında üretim miktarı ve besin değerini koruyan menü önerisi.
- **Besin kaybı:** tabakta kalan enerji, protein, lif ve demir, günlük ihtiyaca oranlanarak gösteriliyor.
- **Doğrulama:** Gemini'nin gram tahmini, terazide tartılmış gerçek tabaklarla (Nutrition5k [15]) ölçülüyor.

## 5. Müdahalelerin etkisi ve hedefimizin yeri

| Müdahale | Azalma | Tür | Kaynak |
|---|---|---|---|
| Ölçüm + nudge, personel yemekhanesi | %35'e kadar | Firma | [13] |
| Okul yemekhaneleri, tepsi tarayıcı | Ort. %30 | Firma | [14] |
| İsveç okulları, farkındalık kampanyası | Porsiyon başına −13 g | Bağımsız | [5] |
| **Kırıntı hedefi** | **%25 (baseline'a göre göreli)** | **Hedef** | – |

## 6. Yapay zekâ doğruluğu: iki doğrulama pilotu

İki pilot da uygulamanın **Kanıt** sekmesinden tek dokunuşla çalışır. Sonuçlar cihazda saklanır ve PDF rapora eklenir.

### Pilot 1: 14 gerçek tabak fotoğrafı, insan görsel tahmini

- **Veri:** 14 açık lisanslı (CC BY-SA) gerçek fotoğraf. Türk okul ve esnaf menüleri, okul tepsileri, yarım kalmış ve bitmiş tabaklar. Her fotoğrafın yazarı ve lisansı `public/pilot/manifest.json` dosyasında ve uygulamada fotoğrafın altında yazılı.
- **Referans:** Tek değerlendiricinin görsel tahmini (Comstock benzeri yöntem). Gerçek tartım değil; ±10-15 puan belirsizlik içerir.
- **Metrikler:** Ortalama mutlak hata (puan), ±15 puan içindeki oran, korelasyon (r), eğilim.
- **Sonuç (canlı uygulama, 23 Ekim 2026):**

  | Metrik | Değer |
  |---|---|
  | Analiz edilen fotoğraf | 14 / 14 |
  | Ortalama mutlak hata | **6,3 puan** |
  | ±15 puan içinde | **%86** (14 fotoğrafın 12'si) |
  | Korelasyon | **r = 0,96** |
  | Eğilim | −4,1 puan (Gemini artığı hafifçe az tahmin ediyor) |
  | Ortalama süre | 6,0 sn / fotoğraf |

  **Yorum:** Hata, referansın kendi belirsizliğinden (±10-15 puan) küçük. Gemini, dokunulmamış tabaktan neredeyse boş tabağa kadar bütün aralıkta artık oranını insan değerlendiriciyle aynı sırada ve yakın büyüklükte ölçüyor. Hafif negatif eğilim, gerçek kullanımda okulun israfı bir miktar az görmesi anlamına gelir; bu yüzden Etki ekranındaki azalma hesapları ihtiyatlı kalır.

### Pilot 2: 16 terazide tartılmış tabak (Nutrition5k)

- **Veri:** Google'ın Nutrition5k veri setinden 16 kafeterya tabağı. Hepsi ana yemekli, 186-609 g arası. Her malzeme terazide tartılmış; toplam kütle ve kalori **gerçek ölçüm** [15]. Lisans CC BY 4.0.
- **Ne ölçülüyor:**
  - Gemini'nin fotoğraftan tahmin ettiği toplam gramın terazi değerinden sapması.
  - Uygulamanın kategori katsayılarıyla hesapladığı kalorinin gerçek kaloriden sapması.
  - Tabaklar yenmemiş olduğu için Gemini'nin bunları "dokunulmamış" (artık ≈ %100) olarak tanıyıp tanımadığı.
- **Metrikler:** Ortalama mutlak hata (g), ortalama yüzde hata, ±%25 içindeki oran, kalori hatası, korelasyon.
- **İlk ölçüm (v1, canlı uygulama, 23 Ekim 2026):**

  | Metrik | Değer |
  |---|---|
  | Analiz edilen tabak | 15 / 16 |
  | Ortalama mutlak hata | 140 g |
  | Ortalama yüzde hata | %44 |
  | ±%25 içinde | %47 |
  | Kalori hatası | %46 |
  | Korelasyon | r = −0,03 |
  | "Dokunulmamış" diye tanınan | %27 |

  **Teşhis:** Sonuç zayıf, ama son satır sebebi gösteriyor. Tabaklar yenmemiş olduğu halde Gemini yalnızca %27'sine "dokunulmamış" dedi. Bu ilk sürümde tabaklar "yemek **sonrası** fotoğrafı" olarak gönderildi. Yönerge, kısmen yenmiş görünen yemeklerde gram için standart porsiyon kullanılmasını söylüyordu; Gemini tabakların çoğunu yarı yenmiş sandığı için fotoğraftaki miktarı ölçmek yerine standart porsiyon yazdı. Korelasyonun sıfıra düşmesi, gram tahmininin fotoğraftan kopmasından kaynaklanıyor. Yani bu ölçüm Gemini'nin gram ölçme becerisini değil, test kurgusundaki bir hatayı gösterdi.

  **Düzeltme (v2):** Gerçek kullanımda servis gramı "önce" fotoğrafından gelir. Terazi pilotu artık bu yolu test ediyor: tabak Gemini'ye "servis edilmiş, henüz yenmemiş" bilgisiyle gönderiliyor. Yönergeye ölçek ipuçları (tabak ~26-27 cm, tepsi bölmesi, çatal), yemek türüne göre yoğunluklar ve "gördüğün miktarı tahmin et, standart porsiyon varsayma" kuralı eklendi; gram tahmininde model orta düzeyde düşünüyor. Aynı iyileştirme uygulamadaki normal önce/sonra analizine de uygulandı.
- **Sonuç (v2):** _[düzeltilmiş sürümle yeniden çalıştırılınca eklenecek]_
- **Sınırlılık:** Nutrition5k tabakları ABD kafeterya yemekleridir, Türk okul menüsü değildir. Gram tahmini, artık tahmininin temelidir (kalan gram = servis gramı × artık oranı); bu pilot ölçüm zincirinin ilk halkasını gerçek kütleyle sınar.

### Sahada sonraki adım

Pilot okulda en az 30 tabağın gerçek tartımı, sonuç ekranındaki **Tartım** alanına girilir. Uygulama yapay zekâ tahmininin ortalama mutlak sapmasını (g ve %) otomatik raporlar.

## 7. Neler gerçek, neler örnek?

| Bileşen | Durum |
|---|---|
| Dünya okul artık oranları, yemek grubu oranları, yöntem doğrulukları, müdahale etkileri | **Gerçek**, yayımlanmış kaynaklar [1]-[14] |
| Pilot 1 fotoğrafları | **Gerçek** fotoğraflar; referans insan tahmini |
| Pilot 2 tabakları | **Gerçek** fotoğraflar ve **gerçek terazi ölçümü** [15] |
| CO₂e, su ve besin katsayıları | Yayımlanmış ürün değerlerinden **yaklaşık** kategori katsayıları [17][18] |
| Uygulamadaki geçmiş haftalar (baseline + müdahale) | **Sentetik örnek veri**; literatüre göre ayarlandı ve etiketli |
| Yıllık etki (1 t gıda, 1,3-2,5 t CO₂e, ~120.000 TL) | **Hesaplanmış tahmin** (varsayımlar PDR'da) |

## Kaynakça

1. USDA FNS (2019). *School Nutrition and Meal Cost Study: Summary of Findings.* SY 2014-15, 6.253 tepsi, 165 okul. https://fns-prod.azureedge.us/sites/default/files/resource-files/SNMCS_Summary-Findings.pdf
2. USDA FNS (2019). *School Nutrition and Meal Cost Study, Final Report Volume 4: Student Participation, Satisfaction, Plate Waste, and Dietary Intakes.* https://fns-prod.azureedge.us/sites/default/files/resource-files/SNMCS-Volume4.pdf
3. *Who Cleans the Plate? Quantity and Type of Food Waste in 78 Primary Schools' Canteens in Italy.* Sustainability 17(17):7836, 2025. https://doi.org/10.3390/su17177836
4. Eriksson M. vd. (2017). *Quantification of food waste in public catering services: A case study from a Swedish municipality.* Waste Management. https://pubmed.ncbi.nlm.nih.gov/28161338/
5. Malefors C. vd. (2022). *Testing interventions to reduce food waste in school catering.* Resources, Conservation and Recycling. https://www.sciencedirect.com/science/article/pii/S0921344921006066
6. Malefors C. vd. (2025). *Understanding food waste generation in school canteens.* SLU. https://pub.epsilon.slu.se/38912/1/malefors-c-et-al-20251120.pdf
7. *Özel bir okul yemekhanesinde oluşan besin artık miktarlarının ve maliyetinin saptanması.* Hasan Kalyoncu Üniversitesi (Gaziantep). https://openaccess.hku.edu.tr/items/6469c12e-ce67-411d-b638-97313f7b46f9
8. Byker Shanks C. vd. (2017). *Food Waste in the National School Lunch Program 1978-2015: A Systematic Review.* J Acad Nutr Diet. https://www.jandonline.org/article/S2212-2672(17)30598-1/fulltext
9. *Validation of a digital photography method for assessing plate waste in an acute care hospital setting.* British Food Journal, 2025. https://doi.org/10.1108/BFJ-11-2025-1534
10. *Food Waste Detection in Canteen Plates Using YOLOv11.* Applied Sciences 15(13):7137, 2025. https://doi.org/10.3390/app15137137
11. *Strategies for Automated Identification of Food Waste in University Cafeterias: A Machine Vision Recognition Approach.* Applied Sciences 15(9):5036, 2025. https://www.mdpi.com/2076-3417/15/9/5036
12. *Exploring the potential of AI-driven food waste management strategies used in the hospitality industry.* Frontiers in Artificial Intelligence, 2024. https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2024.1429477/full
13. Winnow (2021). *Melco combines advanced technology with the latest thinking in behavioral science to cut plate waste by 35%* (firma açıklaması). https://www.winnowsolutions.com/resources/news/melco-combines-advanced-technology-with-the-latest-thinking-in-behavioral-science-to-cut-plate-waste-by-35
14. KED Global (2022). *Nuvilab uses the latest tech to tackle age-old issue of food waste* (firma açıklamaları). https://www.kedglobal.com/korean-startups/newsView/ked202202090016
15. Thames Q. vd. (2021). *Nutrition5k: Towards Automatic Nutritional Understanding of Generic Food.* CVPR 2021. Veri seti CC BY 4.0. https://github.com/google-research-datasets/Nutrition5k
16. UNEP (2024). *Food Waste Index Report 2024.* https://www.unep.org/resources/publication/food-waste-index-report-2024
17. Poore J., Nemecek T. (2018). *Reducing food's environmental impacts through producers and consumers.* Science 360:987-992. https://doi.org/10.1126/science.aaq0216
18. USDA FoodData Central (besin değerleri). https://fdc.nal.usda.gov/
