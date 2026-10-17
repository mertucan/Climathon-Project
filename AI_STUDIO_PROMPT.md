# Google AI Studio Build Mode promptu

```text
Türkçe çalışan, mobil uyumlu tek sayfalık bir web uygulaması oluştur. Uygulamanın adı “Tabak İz” olsun. Amaç: okul yemekhanesinde yemekten sonra çekilen yalnızca-tabak fotoğrafını Gemini ile analiz edip tahmini yemek artığı oranını göstermek.

Arayüz sıcak, çocuk dostu ama jüride sunulabilecek kadar temiz olsun: krem arka plan, koyu yeşil vurgu, turuncu küçük ayrıntılar ve “Bir tabak fotoğrafı, daha az israf.” başlığı. Fotoğraf yükleme alanı, “Gemini ile analiz et” ana düğmesi ve API anahtarı / secret yapılandırma açıklaması olsun. Kullanıcının yüzünü analiz etme veya kişisel veri çıkarımı yapma; ekranda yalnızca tabak görünmesi gerektiğini açıkça yaz.

Gemini çağrısına yüklenen resmi ekle. Modelden sadece JSON iste: totalLeftoverPercent (0-100 sayı), foods (name ve leftoverPercent alanları) ve 6-13 yaş için suçlayıcı olmayan Türkçe childMessage. Modelin yüz/kişi analizi yapmaması gerektiğini, yalnızca yiyecek ve tabak üzerinde çalışması gerektiğini promptta belirt. Gelen JSON'u doğrula; sonucunda tahmini tabak artığını yüzde olarak, 100 eksi artık oranından hesaplanan “gezegen puanı”nı, artık oranı x 1.8 L olan “tahmini su karşılığı”nı, yemek bazlı çubukları ve çocuk mesajını göster.

Bir “Demo sonucu göster” düğmesi de ekle. Bu düğme açıkça “Demo verisi” rozetiyle şu örnek sonucu gösterir: toplam artık %28; Sebzeli makarna %35, Yoğurt %10, Mevsim salatası %40. Gemini ile yapılan gerçek çağrıda rozet “Gemini analizi” olsun. Sonucun altında bunun görüntü tabanlı tahmin olduğu, saha pilotunda gerçek tartım sonuçlarıyla kalibre edilmesi gerektiği yazsın.

Veriyi kalıcı saklama, giriş sistemi, liderlik tablosu veya mutfak paneli ekleme. Bu prototipin kritik kanıtı yalnızca fotoğraf -> Gemini analizi -> çocuk geri bildirimi akışı olsun. Hata durumunda Türkçe, anlaşılır bir hata mesajı göster.
```
