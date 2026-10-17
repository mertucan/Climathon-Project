# Yayınlanan Tabak İz uygulamasının dışa aktarılan istemci paketi

Bu klasör, `https://tabak-i-z.ai.studio` adresinde yayımlanan uygulamanın herkese açık istemci dosyalarının bire bir kopyasını içerir:

- `index.html`
- `assets/index-UUZqqOZe.js`
- `assets/index-KIIn1nFl.css`

Önemli: Gemini çağrısı uygulamanın yayın ortamındaki `/api/analyze` sunucu uç noktasından yürütülür. Bu uç noktanın kaynak kodu ve `GEMINI_API_KEY` secret değeri herkese açık pakete dahil değildir; anahtar bu klasöre yazılmamıştır.

Tam düzenlenebilir proje kaynağını AI Studio hesabından dışa aktarmak için uygulamanın Build düzenleyicisindeki **Get code** seçeneği kullanılmalıdır. Bu yayın paketi; arayüzü incelemek, yedeklemek ve yayımlanmış istemci sürümünü korumak içindir.
