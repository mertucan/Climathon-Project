# Climathon Haftalık Görev 3 | Build & Show - Form Yanıtları

## Ad Soyad

[Ad Soyad]

## E-Posta Adresi

[E-posta adresi]

## Çalışan prototipinin linki

https://tabak-i-z.ai.studio

## Prototipinde şu anda gerçekten çalışan temel fonksiyon nedir?

Prototip, yemekten sonra yalnızca tabağı gösteren bir fotoğrafı alıyor ve Gemini ile analiz ederek tabakta kalan yemeğin tahmini oranını hesaplıyor. Sonuç ekranında toplam tahmini artık oranı, yemek bazlı kırılım, gezegen puanı, tahmini su karşılığı ve 6-13 yaş grubu için suçlayıcı olmayan bir geri bildirim gösteriliyor. Bu akış, paylaşılabilir bağlantı üzerinden gerçek fotoğraf ve hazır örnek tepsiyle test edildi.

## Hangi araç ve teknolojileri kullandın, neden bu araçları seçtin?

Prototipi Google AI Studio Build mode ile geliştirdim. Görüntü analizi için Gemini 3.8 Flash ve Google GenAI SDK kullanılıyor; fotoğraf analizi uygulamanın sunucu tarafındaki /api/analyze uç noktasından yapılıyor. AI Studio'yu kurulum gerektirmeden hızlıca çalışan bir web prototipi oluşturabildiğim, API anahtarını secret olarak yönetebildiğim ve jüriyle paylaşılabilir bir bağlantı sunabildiği için seçtim.

## Prototipinin hangi bölümleri gerçekten çalışıyor, hangi bölümleri şu anda mock veya placeholder?

Gerçekten çalışan bölüm fotoğraf yükleme, Gemini'nin görüntüden yemek/artık analizi üretmesi, yapılandırılmış sonuçların ekranda gösterilmesi ve çocuk dostu geri bildirim akışıdır. Hazır örnek tepsi ile gerçek Gemini analizi de çalışıyor. Ayrıca sunum için açıkça “Demo verisi” olarak etiketlenmiş örnek sonuç modu bulunuyor. Gerçek tartımla kalibrasyon, öğrenci hesabı, sınıf sıralaması, kalıcı veri kaydı ve mutfak yöneticisi paneli bu sürümde yer almıyor; bunlar saha pilotundan sonraki ürün aşamasıdır.

## AI çözümünün içinde kullanıcı için ne yapıyor?

Gemini, fotoğrafta yalnızca tabağa ve yiyeceklere odaklanarak hangi yemeklerin göründüğünü ve her birinden yaklaşık ne kadar kaldığını tahmin ediyor. Bu tahmini toplam artık oranına çeviriyor; ardından uygulama bunu gezegen puanına ve tahmini su karşılığına dönüştürüyor. Model ayrıca sonucu 6-13 yaş grubu için yargılamayan, küçük ve uygulanabilir bir öneriye dönüştürüyor. Sistem yüz veya kişi analizi yapmıyor; fotoğrafın yalnızca tabak içermesi isteniyor.

## Etki iddiası ve sınırlar (sunumda kullanmak için)

Bu prototipin etkisi, Task 1'deki başlangıç durumuyla ilişkilidir: okul yemeklerinde tabak artığının sürekli ölçülmemesi. Pilot aşamada hedef, 1 haftalık kendi baseline ölçümünün ardından 3 haftalık geri bildirim ve menü denemesiyle tabak artığı oranını göreli olarak %25 azaltmaktır. Bu ilk prototip bu etkinin gerçekleştiğini henüz kanıtlamaz; ölçüm ve geri bildirim döngüsünün teknik olarak çalışabildiğini kanıtlar. Görüntü tahminlerinin gerçek tartım sonuçlarıyla kalibre edilmesi bir sonraki adımdır.
