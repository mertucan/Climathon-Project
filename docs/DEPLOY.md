# Yayına Alma ve Mobil Teslim Rehberi

Bu rehber Kırıntı'yı yayına almayı, telefona kurmayı ve teslimden önce doğrulama pilotunu çalıştırmayı adım adım anlatır. Toplam süre yaklaşık 30 dakikadır (pilot dahil).

## Neden PWA? (mobil teslim kararı)

Jürinin ürünü **sen yanında olmadan** deneyebilmesi gerekiyor. Mağaza uygulamasıyla (Play Store / App Store) bu zor: inceleme günler sürer, jürinin bir şey indirmesi gerekir, iOS'ta TestFlight daveti şarttır. Bu yüzden Kırıntı bir **PWA (Progressive Web App)**:

- Tek bir link telefonda, tablette ve bilgisayarda açılır; kurulum gerekmez.
- "Ana ekrana ekle" ile uygulama simgesiyle tam ekran açılır, çevrimdışı da başlar.
- Kamera doğrudan açılır, sesli geri bildirim telefon hoparlöründen çalar.
- İstenirse aynı PWA'dan **Android APK** üretilebilir (5. adım, isteğe bağlı).

## Neler yayına gidiyor?

| Parça | Nerede | Not |
|---|---|---|
| Uygulama (HTML/CSS/JS, pilot fotoğrafları) | `public/` | Statik dosyalar |
| Gemini analizi | `api/analyze.js` | Önce/sonra fotoğraflarından yemek bazlı artık |
| Menü önerisi | `api/suggest.js` | En çok kalan 3 yemek için öneri |
| Sesli geri bildirim | `api/tts.js` | Gemini TTS, duygulu çocuk sesi |
| Durum | `api/health.js` | Uygulama "Gemini bağlı" rozetini buradan öğrenir |

Gemini anahtarı yalnızca sunucuda durur ve tarayıcıya hiç gönderilmez. Bu sayede jüri anahtar girmeden kullanabilir.

## 1. Gemini API anahtarı al (2 dk)

1. https://aistudio.google.com/apikey adresine git ve Google hesabınla giriş yap.
2. **Create API key** ile bir anahtar oluştur ve kopyala (`AIza...` ile başlar).
3. Ücretsiz katman jüri kullanımı için yeterli. Uygulama kota dolduğunda **iptal etmez**: Gemini'nin söylediği süre kadar bekleyip sonuç gelene kadar otomatik olarak tekrar dener ve bunu ekranda gösterir.

## 2. Kodu GitHub'a gönder (3 dk)

```bash
git add -A
git commit -m "Kırıntı final: PWA, jüri turu, sesli geri bildirim, TR/EN, tahmin, pilot, rapor"
git push origin main
```

> `.env` dosyası `.gitignore` içinde; anahtar GitHub'a gitmez. Anahtarı hiçbir dosyaya yazma.

## 3. Vercel'e yayınla (önerilen, ücretsiz, ~10 dk)

1. https://vercel.com adresine git → **Continue with GitHub**.
2. **Add New… → Project** → `Climathon` reposunu seç → **Import**.
3. **Framework Preset: Other**. Build ve Output ayarlarına dokunma; `vercel.json` zaten `public` klasörünü yayınlıyor, `api/` klasörü otomatik sunucusuz fonksiyon oluyor.
4. **Environment Variables** bölümüne ekle:

   | Ad | Değer | Zorunlu mu? |
   |---|---|---|
   | `GEMINI_API_KEY` | AI Studio anahtarın | Evet |
   | `GEMINI_MODELS` | ör. `gemini-flash-latest,gemini-2.5-flash` | Hayır. Yedek model zincirinin tamamı; varsayılan `gemini-flash-latest → gemini-2.5-flash → gemini-flash-lite-latest → gemini-2.5-flash-lite` |
   | `GEMINI_MODEL` | ör. `gemini-2.5-flash` | Hayır. Yalnızca birincil modeli değiştirir, yedekler arkasından gelir |
   | `GEMINI_TTS_MODEL` | ör. `gemini-2.5-flash-preview-tts` | Hayır (uygulama güncel TTS modelini kendisi bulur) |

5. **Deploy**'a bas. Çıkan `https://<proje>.vercel.app` linkini telefonda aç; üst sağda **"Gemini bağlı"** yazmalı (dar ekranda "Gemini ✓").
6. İsteğe bağlı: **Settings → Domains** bölümünden adı `kirinti.vercel.app` gibi kısa bir şeye çevir.

**Uzun süren yanıtlar:** Fonksiyonların süre sınırı `maxDuration: 300` (5 dk) olarak ayarlı. Vercel bu değeri kabul etmezse (eski projelerde Hobby planında sınır 60 sn olabilir), `api/analyze.js`, `api/suggest.js` ve `api/tts.js` dosyalarında `300` değerini `60` yapıp tekrar gönder. Uygulama, sunucu süre sınırına takılan istekleri de otomatik tekrar dener; kullanıcı yine sonucu alır.

**Kod değiştirince:** GitHub'a her `git push` Vercel'de otomatik yeni sürüm yayınlar. Telefonda eski sürüm görünürse uygulamayı kapatıp yeniden aç (service worker yeni sürümü indirir).

## 4. Alternatif: Google Cloud Run (tamamen Google altyapısı)

```bash
gcloud run deploy kirinti --source . --region europe-west1 --allow-unauthenticated \
  --timeout 3600 --set-env-vars GEMINI_API_KEY=ANAHTARIN
```

Dockerfile gerekmez: Google'ın Node.js derleyicisi `package.json`'daki `npm start` (`node server.js`) komutunu kullanır. `--timeout 3600` ile istek başına 1 saate kadar beklenebilir; `server.js`'te süre sınırı zaten kapalı.

## 5. İsteğe bağlı: Android APK (PWABuilder)

1. https://www.pwabuilder.com adresine Vercel linkini gir → **Package for stores → Android**.
2. İndirilen paketteki APK'yı telefona kurup test et. Play Store'a yüklemek zorunlu değil; forma bir Google Drive linki olarak eklenebilir.

Ana teslim linki yine web linki olmalı; jürinin en kolay açacağı yol bu.

## 6. Telefona kurulum (jüri ve okullar için)

- **Android (Chrome):** linki aç → menü (⋮) → **Uygulamayı yükle / Ana ekrana ekle**.
- **iPhone (Safari):** linki aç → Paylaş → **Ana Ekrana Ekle**.

## 7. Teslimden önce: iki doğrulama pilotunu çalıştır (~10 dk)

Uygulamanın **Kanıt** sekmesinde iki doğrulama pilotu var. İkisi de gerçek veriyle Gemini'nin ne kadar doğru ölçtüğünü hesaplar:

| Pilot | Veri | Referans |
|---|---|---|
| 1. Görsel | 14 açık lisanslı (CC BY-SA) gerçek tabak fotoğrafı (Türk okul menüleri, okul tepsileri, yarım ve bitmiş tabaklar) | İnsan görsel tahmini (Comstock benzeri, ±10-15 puan belirsizlik) |
| 2. Terazi | Google Nutrition5k veri setinden 16 kafeterya tabağı | **Terazide tartılmış gerçek gram ve kalori** |

1. Yayındaki linki aç → **Kanıt** sekmesi → **Doğrulama pilotu 1** → **Pilotu Gemini ile çalıştır**. Bitince **Doğrulama pilotu 2** için de aynısını yap (iki pilot aynı anda çalışmaz).
2. Fotoğraflar sırayla analiz edilir; ücretsiz kota dolarsa uygulama bekleyip devam eder. Durdurulursa **Pilota devam et** ile kaldığı yerden sürer.
3. Bitince kartlarda metrikler ve dağılım grafiği görünür:
   - Pilot 1: ortalama mutlak hata (puan), ±15 puan içindeki oran, korelasyon.
   - Pilot 2: ortalama gram hatası, ortalama yüzde hata, ±%25 içindeki oran, kalori hatası.
4. Aynı sekmedeki **Ölçüm yöntemleri karşılaştırması** tablosunda Kırıntı satırı bu sonuçlarla kendiliğinden dolar.
5. Rakamları PDR'a, form cevaplarına, videoya ve `docs/BENCHMARK.md` dosyasındaki "_pilot çalıştırılınca eklenecek_" yerlerine ekle. Örnek cümle: "16 terazide tartılmış tabakta Gemini'nin gram tahmini ortalama %X sapıyor; 14 gerçek fotoğrafta insan tahminine ortalama Y puan yakın."
6. **Okul etki raporu (PDF)** iki pilot sonucunu da rapora ekler.

> Pilot 1'in referansı gerçek tartım değil, tek değerlendiricinin görsel tahminidir; Pilot 2'ninki gerçek terazi ölçümüdür ama ABD kafeterya yemekleridir. Bunu dürüstçe belirtmek jüride güveni artırır. Kendi tabaklarınla tartım yaparsan, sonuç ekranındaki **Tartım** alanına gram girerek sahada gerçek kalibrasyon da yapabilirsin.

## 8. Okul etki raporunu PDF olarak al

**Etki → Okul etki raporu (PDF)** tarayıcının yazdırma penceresini açar:

- **Bilgisayar (Chrome/Edge):** Hedef olarak **PDF olarak kaydet**'i seç → Kaydet.
- **Android:** Yazdır → **PDF olarak kaydet**.
- **iPhone:** Yazdır penceresinde önizlemeyi iki parmakla büyüt → Paylaş → Dosyalar'a kaydet. iOS'ta ana ekrandan açılan uygulamada yazdırma açılmazsa linki Safari'de açıp tekrar dene.

Rapor seçili dilde (Türkçe/İngilizce) ve her zaman açık renklerle basılır.

## 9. Yerelde çalıştır (geliştirme)

```bash
cp .env.example .env    # içine GEMINI_API_KEY yaz
node server.js          # http://localhost:8080
```

Anahtar yoksa uygulama **Demo modunda** açılır (pilot ve Gemini sesi çalışmaz, örnek sonuçlar gösterilir). Ayarlar'dan kendi anahtarını girerek tarayıcıdan doğrudan Gemini'ye de bağlanabilirsin.

Telefonda yerel test için bilgisayar ve telefon aynı Wi-Fi'de olmalı: `http://<bilgisayar-IP>:8080`. Kamera, ses ve PWA kurulumu HTTPS gerektirdiği için asıl testi Vercel linkinde yap.

## Teslim öncesi kontrol listesi

- [ ] Vercel linki telefonda açılıyor; rozet "Gemini bağlı" / "Gemini ✓"
- [ ] Gizli pencerede (incognito) açınca karşılama ekranı geliyor; **2 dakikalık jüri turu** baştan sona çalışıyor
- [ ] "Örnek tepsiyle dene" → "Gemini ile analiz et" gerçek sonuç veriyor
- [ ] **Kahramanın sesini dinle** sesli okuyor (Gemini sesi alınamazsa cihaz sesi devreye girer)
- [ ] Kendi tabak fotoğrafınla bir ölçüm yapıldı
- [ ] Mutfak → **Yarın ne pişirilmeli?** tablosu ve **Öneri üret** çalışıyor
- [ ] Dil menüsünden (**TR/EN**) İngilizceye geçince ekranlar ve Gemini çıktıları İngilizce
- [ ] Kanıt → **iki doğrulama pilotu** çalıştırıldı; rakamlar PDR, form, video ve BENCHMARK.md dosyasına eklendi
- [ ] Etki → **Okul etki raporu (PDF)** kaydedildi
- [ ] Video YouTube'da **Liste dışı**
- [ ] `docs/Final_Problem_Definition.pdf` ve `docs/Final_PDR.pdf` forma yüklendi

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| Rozet "Demo modu" diyor | Vercel'de `GEMINI_API_KEY` eklenmemiş ya da yeniden deploy edilmemiş. Ekleyip **Redeploy** yap. |
| "Gemini ücretsiz kotası şu an dolu… tekrar denenecek" | Normal; uygulama bekleyip kendisi dener. Sık oluyorsa AI Studio'da faturalandırmayı aç. |
| "Seçilen Gemini modeli bulunamadı" | `GEMINI_MODEL` değişkenini sil ya da güncel bir model adı yaz. |
| Ses yerine cihaz sesi çıkıyor | TTS kotası dolmuş ya da model adı değişmiş. `GEMINI_TTS_MODEL` ile güncel TTS modelini belirt. |
| Vercel deploy `maxDuration` hatası veriyor | `api/*.js` içindeki `maxDuration: 300` değerini `60` yap. |
| Telefonda eski sürüm görünüyor | Uygulamayı tamamen kapatıp aç ya da tarayıcıda sayfayı yenile. |
