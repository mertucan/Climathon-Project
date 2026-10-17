const photoInput = document.querySelector('#plate-photo');
const preview = document.querySelector('#preview');
const uploadEmpty = document.querySelector('#upload-empty');
const analyzeButton = document.querySelector('#analyze-button');
const demoButton = document.querySelector('#demo-button');
const apiKeyInput = document.querySelector('#api-key');
const result = document.querySelector('#result');

const demoAnalysis = {
  totalLeftoverPercent: 28,
  foods: [
    { name: 'Sebzeli makarna', leftoverPercent: 35 },
    { name: 'Yoğurt', leftoverPercent: 10 },
    { name: 'Mevsim salatası', leftoverPercent: 40 }
  ],
  childMessage: 'Harika bir başlangıç! Bugün tabağının büyük kısmını bitirdin. Bir dahaki sefere salatadan alacağın küçük bir lokma daha, gezegenine ekstra puan kazandırabilir.'
};

photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  uploadEmpty.hidden = true;
  analyzeButton.disabled = false;
});

demoButton.addEventListener('click', () => renderAnalysis(demoAnalysis, true));
analyzeButton.addEventListener('click', analyzePlate);

async function analyzePlate() {
  const file = photoInput.files?.[0];
  const apiKey = apiKeyInput.value.trim();
  if (!file) return;
  if (!apiKey) {
    document.querySelector('.api-panel').open = true;
    apiKeyInput.focus();
    return;
  }

  setBusy(true);
  try {
    const imageBase64 = await toBase64(file);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: `Bu fotoğrafta yalnızca okul yemeği tabağını analiz et. Yüz veya kişiyle ilgili hiçbir çıkarım yapma. Her yemeğin yaklaşık ne kadarının kaldığını tahmin et. Sadece geçerli JSON döndür, Markdown kullanma. Şema: {"totalLeftoverPercent":number,"foods":[{"name":string,"leftoverPercent":number}],"childMessage":string}. totalLeftoverPercent 0-100 arasında olmalı. childMessage Türkçe, 6-13 yaşa uygun, yargılamayan, en fazla 35 kelime olmalı. Görüntüde tabak görünmüyorsa foods boş olsun ve childMessage bunu nazikçe söylesin.` },
          { inline_data: { mime_type: file.type, data: imageBase64 } }
        ] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
      })
    });
    if (!response.ok) throw new Error('Gemini analizi şu an tamamlanamadı. API anahtarını ve bağlantıyı kontrol et.');
    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
    validateAnalysis(parsed);
    renderAnalysis(parsed, false);
  } catch (error) {
    alert(error.message || 'Beklenmeyen bir hata oluştu.');
  } finally { setBusy(false); }
}

function renderAnalysis(analysis, isDemo) {
  const leftover = clamp(Math.round(Number(analysis.totalLeftoverPercent)), 0, 100);
  document.querySelector('#leftover-value').textContent = `%${leftover}`;
  document.querySelector('#planet-points').textContent = `+${Math.max(0, 100 - leftover)}`;
  document.querySelector('#water-value').textContent = `${Math.round(leftover * 1.8)} L`;
  document.querySelector('#child-message').textContent = analysis.childMessage;
  document.querySelector('#analysis-badge').textContent = isDemo ? 'Demo verisi' : 'Gemini analizi';
  const list = document.querySelector('#food-list');
  list.replaceChildren(...(analysis.foods || []).slice(0, 6).map(food => {
    const value = clamp(Math.round(Number(food.leftoverPercent)), 0, 100);
    const item = document.createElement('li');
    item.innerHTML = `<span>${escapeHtml(String(food.name))}</span><span class="bar"><b style="width:${value}%"></b></span><strong>%${value}</strong>`;
    return item;
  }));
  if (!list.children.length) list.innerHTML = '<li><span>Tabakta tanınan bir yemek bulunamadı.</span></li>';
  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function validateAnalysis(value) {
  if (!value || typeof value.totalLeftoverPercent !== 'number' || !Array.isArray(value.foods) || typeof value.childMessage !== 'string') throw new Error('Gemini beklenen analiz biçiminde bir yanıt vermedi. Lütfen tekrar dene.');
}
function setBusy(isBusy) { analyzeButton.disabled = isBusy; analyzeButton.innerHTML = isBusy ? 'Analiz ediliyor…' : 'Gemini ile analiz et <span>→</span>'; }
function toBase64(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); }); }
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function escapeHtml(text) { const node = document.createElement('span'); node.textContent = text; return node.innerHTML; }
