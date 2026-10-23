// Tek dokunuşla okul etki raporu: A4 yazdırma görünümü oluşturur ve tarayıcının yazdır penceresini açar
// ("PDF olarak kaydet"). Tarayıcının kendi PDF motoru Türkçe karakterleri ve SVG grafikleri doğru basar.
import * as S from './store.js';
import { impactSummary, SCALE } from './metrics.js';
import { forecast } from './forecast.js';
import { weeklyChart, pilotScatter } from './charts.js';
import { getResults, loadManifest, summarizePilot } from './pilot.js';
import { date, dayLabel, dish, kg, num, pct, t } from './i18n.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function printReport() {
  const st = S.getState();
  const s = st.settings;
  const m = impactSummary();
  const dates = st.measurements.map(x => x.date).sort();
  const dishes = S.byDish(st.measurements).slice(0, 6);
  const f = forecast();
  const cal = S.calibration();
  const accepted = st.suggestions.filter(x => x.status === 'accepted');
  const man = await loadManifest().catch(() => null);
  const pilot = summarizePilot(man, getResults('visual'), 'visual');
  const massMan = await loadManifest('mass').catch(() => null);
  const massPilot = summarizePilot(massMan, getResults('mass'), 'mass');
  const pilotPoints = pilot?.n ? pilot.points : [];
  const kpi = (label, value) => `<div class="r-kpi"><b>${value}</b><span>${esc(label)}</span></div>`;

  document.getElementById('print-root').innerHTML = `<article class="report">
    <header class="r-head">
      <div><h1>${t('Okul Etki Raporu')}</h1><p>${esc(s.schoolName)} · ${t('Kırıntı ile tabak artığı ölçümü')}</p></div>
      <div class="r-meta">${dates.length ? `${esc(date(dates[0], { day: 'numeric', month: 'long' }))} – ${esc(date(dates.at(-1), { day: 'numeric', month: 'long', year: 'numeric' }))}` : ''}<br>${t('Oluşturulma')}: ${esc(new Date().toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }))}</div>
    </header>
    ${S.hasSample() ? `<p class="r-warn">${t('Not: Bu rapordaki geçmiş haftalar sentetik örnek pilot verisi içerir; gerçek pilot sonucu değildir.')}</p>` : ''}

    <h2>${t('Özet')}</h2>
    <div class="r-kpis">
      ${kpi(t('Göreli değişim (baseline\'a göre)'), m.relative == null ? '–' : `${m.relative >= 0 ? '−' : '+'}${pct(Math.abs(m.relative))}`)}
      ${kpi(t('Ortalama artık: baseline → müdahale'), `${pct(m.baseline.avgPercent)} → ${pct(m.intervention.avgPercent)}`)}
      ${kpi(t('Hedef'), `−${pct(m.target)}`)}
      ${kpi(t('Ölçülen tabak'), num(st.measurements.length))}
      ${kpi(t('Kurtarılan gıda'), kg(m.saved?.food || 0))}
      ${kpi(t('Önlenen CO₂e'), kg(m.saved?.co2 || 0))}
      ${kpi(t('Korunan su'), `${num(m.saved?.water || 0)} L`)}
      ${kpi(t('Tasarruf'), `${num(m.saved?.tl || 0)} TL`)}
    </div>

    <h2>${t('Haftalık ortalama tabak artığı')}</h2>
    ${weeklyChart(S.weekly(st.measurements), m.baseline, m.target, s.baselineEnd)}
    <p class="r-small">${t('Gri: baseline (geri bildirim yok) · Yeşil: müdahale (geri bildirim + menü) · Kesikli: hedef')}</p>

    <div class="r-cols">
      <section>
        <h2>${t('En çok artık bırakılan yemekler')}</h2>
        <table><thead><tr><th>${t('Yemek')}</th><th>${t('Ort. artık')}</th><th>${t('kg/hafta')}</th><th>${t('En kötü gün')}</th></tr></thead>
        <tbody>${dishes.map(d => `<tr><td>${esc(dish(d.dish))}</td><td>${pct(d.avgLeftover)}</td><td>${num(d.wastedKgPerWeek, 1)}</td><td>${esc(dayLabel(d.worstDay))}</td></tr>`).join('')}</tbody></table>
      </section>
      <section>
        <h2>${t('Besin kaybı (tabak başı, bu hafta)')}</h2>
        ${m.perPlateThisWeek ? `<table><tbody>
          <tr><td>${t('enerji')}</td><td>${num(m.perPlateThisWeek.nutr.kcal)} kcal</td></tr>
          <tr><td>${t('protein')}</td><td>${num(m.perPlateThisWeek.nutr.protein, 1)} g</td></tr>
          <tr><td>${t('lif')}</td><td>${num(m.perPlateThisWeek.nutr.fiber, 1)} g</td></tr>
          <tr><td>${t('demir')}</td><td>${num(m.perPlateThisWeek.nutr.iron, 1)} mg</td></tr></tbody></table>` : `<p class="r-small">${t('Bu hafta ölçüm yok.')}</p>`}
      </section>
    </div>

    <h2>${t('Mutfak kararları')}</h2>
    ${accepted.length ? `<ul>${accepted.map(a => `<li><b>${esc(dish(a.dish))}:</b> ${esc(a.title)}. ${esc(a.action)}</li>`).join('')}</ul>` : `<p class="r-small">${t('Henüz kabul edilmiş menü önerisi yok.')}</p>`}
    ${f.dishes.length ? `<p><b>${t('Yarın ne pişirilmeli?')}</b> ${esc(date(f.date, { weekday: 'long', day: 'numeric', month: 'long' }))}: ${f.dishes.map(d => `${esc(dish(d.dish))} ${num(d.cookKg, 1)} kg`).join(', ')}. ${t('Tahmini tasarruf: {kg}, {tl} TL.', { kg: kg(f.savedKg * 1000), tl: num(f.costTL) })}</p>` : ''}

    <h2>${t('{students} öğrencilik bir okulda 1 eğitim yılı ({days} gün)', SCALE)}</h2>
    <p>${m.year ? t('≈ <strong>{food}</strong> gıda, <strong>{co2}</strong> CO₂e, <strong>{water} L</strong> su ve <strong>{tl} TL</strong> tasarruf', { food: kg(m.year.food), co2: kg(m.year.co2), water: num(m.year.water), tl: num(m.year.tl) }) : t('Müdahale döneminde iyileşme oluştuğunda ölçeklenmiş etki burada görünür.')}</p>

    <h2>${t('Ölçüm güvenilirliği')}</h2>
    <div class="r-cols">
      <section>
        <p>${cal ? t('Tartım kalibrasyonu: {n} tabak, ortalama mutlak sapma {mae} g.', { n: cal.count, mae: cal.maeGrams }) : t('Tartım kalibrasyonu henüz yapılmadı.')}</p>
        <p>${pilot?.n ? t('Doğrulama pilotu: {n} gerçek fotoğrafta Gemini ile insan görsel tahmini arasında ortalama mutlak hata {mae} puan; tahminlerin {w} kadarı ±15 puan içinde (r = {r}).', { n: pilot.n, mae: num(pilot.mae, 1), w: pct(pilot.within15), r: pilot.r == null ? '–' : num(pilot.r, 2) }) : t('Doğrulama pilotu henüz çalıştırılmadı.')}</p>
        <p>${massPilot?.n ? t('Terazi doğrulaması: Nutrition5k veri setinden {n} tartılmış tabakta Gemini\'nin gram tahmini ortalama %{mape} sapıyor; tahminlerin {w} kadarı ±%25 içinde.', { n: massPilot.n, mape: num(massPilot.mape), w: pct(massPilot.within25) }) : t('Terazi doğrulaması henüz çalıştırılmadı.')}</p>
      </section>
      <section>${pilotPoints.length ? pilotScatter(pilotPoints) : ''}</section>
    </div>

    <footer class="r-foot">${t('Yöntem: Gemini, önce/sonra tabak fotoğraflarından yemek bazında kalan miktarı tahmin eder. CO₂e ve su: Poore & Nemecek (2018), Water Footprint Network; besin: USDA FoodData Central, TÜBER 2022 (yaklaşık kategori değerleri). Fotoğraflar saklanmaz; veriler sınıf düzeyinde ve anonimdir.')} · Kırıntı · Climathon 2026</footer>
  </article>`;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  window.print();
}
