// Jürinin elinde tabak yokken de gerçek Gemini analizini deneyebilmesi için çizilen örnek tepsi.
export const SAMPLE_MENU = ['Mercimek çorbası', 'Pirinç pilavı', 'Mevsim salatası', 'Yoğurt'];

function rand(seed) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

export function drawSampleTray(phase) {
  const after = phase === 'after';
  const c = document.createElement('canvas');
  c.width = 1000; c.height = 750;
  const g = c.getContext('2d');
  const r = rand(after ? 7 : 3);

  g.fillStyle = '#8c6b4f'; g.fillRect(0, 0, 1000, 750); // masa
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(60,40,25,${0.08 + r() * 0.1})`; g.beginPath(); g.moveTo(0, r() * 750); g.bezierCurveTo(300, r() * 750, 700, r() * 750, 1000, r() * 750); g.stroke(); }

  roundRect(g, 60, 50, 880, 650, 40, '#c9d3d8'); // tepsi
  roundRect(g, 90, 80, 380, 300, 26, '#dfe6ea');
  roundRect(g, 500, 80, 410, 300, 26, '#dfe6ea');
  roundRect(g, 90, 410, 520, 260, 26, '#dfe6ea');
  roundRect(g, 640, 410, 270, 260, 26, '#dfe6ea');

  // Mercimek çorbası (kase): önce dolu, sonra ~%15 kalmış
  bowl(g, 280, 230, 130, after ? 0.32 : 0.92, '#d98a2f', r);
  // Pirinç pilavı: önce dolu, sonra ~%10
  grains(g, 705, 230, 170, 110, after ? 0.1 : 1, r);
  // Mevsim salatası: önce dolu, sonra ~%45 kalmış
  salad(g, 350, 540, 230, 100, after ? 0.45 : 1, r);
  // Yoğurt (kase): önce dolu, sonra ~%10
  bowl(g, 775, 540, 95, after ? 0.25 : 0.9, '#f6f1e4', r);

  if (after) { g.fillStyle = '#b7b7b7'; g.save(); g.translate(560, 330); g.rotate(-0.5); roundRect(g, -10, -130, 20, 230, 10, '#a9aeb2'); g.restore(); }
  return c.toDataURL('image/jpeg', 0.9);
}

function roundRect(g, x, y, w, h, rad, fill) {
  g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); g.fillStyle = fill; g.fill();
}

function bowl(g, x, y, radius, fill, color, r) {
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, radius, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#d7dde0'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#eef1f2'; g.beginPath(); g.arc(x, y, radius * 0.82, 0, Math.PI * 2); g.fill();
  if (fill > 0.3) {
    g.fillStyle = color; g.beginPath(); g.arc(x, y, radius * 0.8 * fill, 0, Math.PI * 2); g.fill();
  } else {
    // dipte kalan ince tabaka
    g.fillStyle = color; g.beginPath(); g.ellipse(x + radius * 0.15, y + radius * 0.35, radius * 0.45, radius * 0.22, 0.2, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 25 * fill; i++) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(x + (r() - 0.5) * radius * fill, y + (r() - 0.5) * radius * fill, 3 + r() * 4, 0, Math.PI * 2); g.fill(); }
}

function grains(g, x, y, w, h, amount, r) {
  const n = Math.round(900 * amount);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    const px = amount < 0.5 ? x - w * 0.5 + r() * w * 0.4 : x + Math.cos(a) * w * d;
    const py = amount < 0.5 ? y + h * 0.5 + r() * h * 0.35 : y + Math.sin(a) * h * d;
    g.fillStyle = `hsl(45, 40%, ${88 + r() * 10}%)`; g.save(); g.translate(px, py); g.rotate(r() * Math.PI);
    g.beginPath(); g.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
}

function salad(g, x, y, w, h, amount, r) {
  const n = Math.round(70 * amount);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * 2 * w * (amount < 1 ? 0.7 : 1), py = y + (r() - 0.5) * 2 * h * (amount < 1 ? 0.8 : 1);
    g.fillStyle = `hsl(${95 + r() * 30}, 55%, ${35 + r() * 20}%)`; g.save(); g.translate(px, py); g.rotate(r() * Math.PI);
    g.beginPath(); g.ellipse(0, 0, 26 + r() * 14, 12 + r() * 6, 0, 0, Math.PI * 2); g.fill(); g.restore();
  }
  for (let i = 0; i < Math.round(12 * amount); i++) { // domates
    const px = x + (r() - 0.5) * 1.6 * w, py = y + (r() - 0.5) * 1.5 * h;
    g.fillStyle = '#d63a2f'; g.beginPath(); g.arc(px, py, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f08a6e'; g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < Math.round(10 * amount); i++) { // salatalık
    const px = x + (r() - 0.5) * 1.6 * w, py = y + (r() - 0.5) * 1.5 * h;
    g.fillStyle = '#3f7d32'; g.beginPath(); g.arc(px, py, 17, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#cfe8a9'; g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fill();
  }
}
