# Tabak İz - Climathon Build & Show

Bu proje, okul yemekhanesinde yemekten sonraki tabak fotoğrafını Gemini ile analiz ederek tahmini tabak artığını, yemek bazlı kırılımı ve çocuk dostu geri bildirimi gösteren çalışan prototiptir.

## Çalıştırma

`index.html` dosyasını tarayıcıda açın. Fotoğrafı yükledikten sonra Google AI Studio'dan aldığınız Gemini API anahtarını ilgili alana girin ve **Gemini ile analiz et** düğmesini seçin. API anahtarı girmeden akışı göstermek için **Demo sonucu göster** düğmesi kullanılabilir.

## Prototip kapsamı

- Çalışan: Fotoğraf yükleme, Gemini ile yapılandırılmış tabak-artığı analizi, yemek bazlı yüzde sonucu, puan ve çocuk dostu geri bildirim.
- Demo modu: API anahtarı gerektirmeden arayüz akışını gösteren örnek sonuç.
- Henüz kapsam dışı: Gerçek tartımla kalibrasyon, öğrenci hesabı, sınıf sıralaması, mutfak paneli ve kalıcı veri saklama.

## Google AI Studio'ya aktarım

`AI_STUDIO_PROMPT.md` dosyasındaki metni AI Studio Build mode'a yapıştırın. Oluşan uygulamada kendi Gemini API anahtarınızı (AI Studio'nun güvenli secrets yapısı üzerinden) tanımlayın ve paylaşılabilir `.ai.studio` bağlantısını alın.
