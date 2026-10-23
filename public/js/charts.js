// SVG grafikler: uygulama ekranları ve PDF raporu aynı fonksiyonları kullanır.
import { date, pct, t } from './i18n.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Haftalık ortalama artık: baseline haftaları nötr gri, müdahale haftaları marka yeşili, hedef kesikli çizgi.
export function weeklyChart(weeks, baseline, target, baselineEnd) {
  if (!weeks.length) return `<p class="small-muted">${t('Henüz ölçüm yok.')}</p>`;
  const w = 340, h = 190, pad = { l: 34, r: 8, t: 16, b: 30 };
  const maxY = Math.max(10, Math.ceil(Math.max(...weeks.map(x => x.avgPercent), baseline.avgPercent) / 5) * 5 + 5);
  const y = v => pad.t + (h - pad.t - pad.b) * (1 - v / maxY);
  const slot = (w - pad.l - pad.r) / weeks.length;
  const bw = Math.min(46, slot * 0.6);
  const targetValue = baseline.plates ? baseline.avgPercent * (1 - target / 100) : null;
  const ticks = [0, maxY / 2, maxY].map(v => Math.round(v));
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="${esc(t('Haftalık ortalama tabak artığı grafiği'))}">
    ${ticks.map(v => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${pct(v)}</text>`).join('')}
    ${weeks.map((wk, i) => {
      const x = pad.l + slot * i + (slot - bw) / 2;
      const top = y(wk.avgPercent), isBase = wk.week <= baselineEnd;
      const label = date(wk.week);
      return `<g class="bar-g" tabindex="0"><title>${esc(t('{week} haftası: ortalama {pct} artık, {n} tabak', { week: label, pct: pct(wk.avgPercent), n: wk.plates }))}</title>
        <rect x="${x - 4}" y="${pad.t}" width="${bw + 8}" height="${h - pad.t - pad.b}" fill="transparent"/>
        <path d="M${x} ${y(0)} V${top + 4} q0 -4 4 -4 h${bw - 8} q4 0 4 4 V${y(0)}Z" class="${isBase ? 'base' : 'int'}"/>
        <text x="${x + bw / 2}" y="${top - 5}" text-anchor="middle" class="val">${pct(wk.avgPercent)}</text>
        <text x="${x + bw / 2}" y="${h - 10}" text-anchor="middle" class="axis">${esc(label)}</text></g>`;
    }).join('')}
    ${targetValue != null ? `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(targetValue)}" y2="${y(targetValue)}" class="target"><title>${esc(t('Hedef'))}: ${pct(targetValue)}</title></line>` : ''}
  </svg></div>`;
}

// Doğrulama grafiği: x = referans, y = Gemini. Köşegen = tam uyum.
//  Yüzde ölçeği (varsayılan): gölgeli bant ±15 puan.  Gram ölçeği (unit: 'g'): gölgeli bant ±%25.
export function pilotScatter(points, { unit = '%', xLabel = 'İnsan görsel tahmini' } = {}) {
  const grams = unit === 'g';
  const max = grams ? Math.max(200, Math.ceil(Math.max(...points.flatMap(p => [p.ref, p.ai]), 0) / 100) * 100) : 100;
  const s = 240, pad = 40, inner = s - pad - 18; // sol pay: "%100" etiketi + döndürülmüş eksen adı
  const p = v => pad + inner * Math.min(v, max) / max;
  const yv = v => 10 + inner * (1 - Math.min(v, max) / max);
  const fmt = v => grams ? `${Math.round(v)} g` : pct(v);
  const ticks = [0, max / 2, max];
  const band = grams
    ? `${p(0)},${yv(0)} ${p(max / 1.25)},${yv(max)} ${p(max)},${yv(max)} ${p(max)},${yv(max * 0.75)}`
    : `${p(0)},${yv(15)} ${p(85)},${yv(100)} ${p(100)},${yv(100)} ${p(100)},${yv(85)} ${p(15)},${yv(0)} ${p(0)},${yv(0)}`;
  return `<div class="chart-wrap"><svg viewBox="0 0 ${s} ${s}" class="chart scatter" role="img" aria-label="${esc(t('Referans ve Gemini tahmini karşılaştırma grafiği'))}">
    <polygon points="${band}" class="band"/>
    ${ticks.map(v => `<line x1="${pad}" x2="${p(max)}" y1="${yv(v)}" y2="${yv(v)}" class="grid"/><text x="${pad - 5}" y="${yv(v) + 3}" class="axis" text-anchor="end">${fmt(v)}</text>
      <text x="${p(v)}" y="${s - 12}" class="axis" text-anchor="middle">${fmt(v)}</text>`).join('')}
    <line x1="${p(0)}" y1="${yv(0)}" x2="${p(max)}" y2="${yv(max)}" class="diag"/>
    ${points.map(pt => `<g class="dot-g" tabindex="0"><title>${esc(pt.label)}: ${esc(t('referans'))} ${fmt(pt.ref)}, Gemini ${fmt(pt.ai)}</title>
      <circle cx="${p(pt.ref)}" cy="${yv(pt.ai)}" r="11" fill="transparent"/><circle cx="${p(pt.ref)}" cy="${yv(pt.ai)}" r="5" class="dot"/></g>`).join('')}
    <text x="${p(max / 2)}" y="${s - 1}" class="axis" text-anchor="middle">${esc(t(xLabel))}</text>
    <text x="8" y="${yv(max / 2)}" class="axis" text-anchor="middle" transform="rotate(-90 8 ${yv(max / 2)})">Gemini</text>
  </svg></div>`;
}

// Yatay karşılaştırma çubukları (tek seri; vurgulanan satır marka renginde, diğerleri nötr).
// rows: [{ label, value, display, note, highlight, refHtml }] — refHtml: çağıranın ürettiği kaynak düğmesi
export function compareBars(rows, max) {
  const top = max || Math.max(...rows.map(r => r.value)) * 1.1;
  return `<ul class="bars compare">${rows.map(r => `
    <li class="${r.highlight ? 'top' : ''}" title="${esc(r.note || '')}">
      <span class="bar-label">${esc(r.label)}${r.refHtml ? ` ${r.refHtml}` : ''}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, r.value / top * 100)}%"></span></span>
      <span class="bar-value">${esc(r.display)}</span></li>`).join('')}</ul>`;
}

// İki seri yan yana (ör. literatür ve Kırıntı). Gri = literatür, yeşil = Kırıntı; lejant çağıran tarafta.
export function pairedBars(rows, max) {
  const top = max || Math.max(...rows.flatMap(r => [r.a, r.b ?? 0])) * 1.1;
  return `<ul class="bars paired">${rows.map(r => `
    <li><span class="bar-label">${esc(r.label)}</span>
      <span class="pair">
        <span class="bar-track"><span class="bar-fill lit" style="width:${Math.max(2, r.a / top * 100)}%"></span></span>
        <span class="bar-track"><span class="bar-fill" style="width:${r.b == null ? 0 : Math.max(2, r.b / top * 100)}%"></span></span>
      </span>
      <span class="bar-value"><span class="muted-val">${esc(r.aText)}</span><br>${esc(r.bText ?? '–')}</span></li>`).join('')}</ul>`;
}
