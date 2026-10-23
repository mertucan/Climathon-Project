// Çok dilli arayüz. Kaynak dil Türkçe: t('Türkçe metin') çağrısı Türkçede metni olduğu gibi,
// diğer dillerde sözlükteki karşılığını döndürür. Yeni dil eklemek için LANGUAGES'a ve DICTS'e eklemek yeterli.
import { EN } from './i18n-en.js';

export const LANGUAGES = {
  tr: { name: 'Türkçe', short: 'TR', locale: 'tr-TR' },
  en: { name: 'English', short: 'EN', locale: 'en-GB' }
};
const DICTS = { tr: null, en: EN };

// Bayraklar SVG olarak çizilir: Windows emoji bayraklarını göstermez (yalnızca "TR" harfleri çıkar).
let flagSeq = 0;
function star(cx, cy, r, rotation) {
  return Array.from({ length: 10 }, (_, i) => {
    const angle = rotation + i * Math.PI / 5;
    const radius = i % 2 ? r * 0.382 : r;
    return `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ');
}
const FLAGS = {
  // Türk bayrağı (Türk Bayrağı Kanunu oranları, G = yükseklik = 20): hilal dış çemberi merkezi 0,5G, çapı 0,5G;
  // iç çember 0,0625G sağda, çapı 0,4G; yıldız çemberi çapı 0,25G, bir ucu hilale bakar.
  tr: () => `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#E30A17"/>
    <circle cx="10" cy="10" r="5" fill="#fff"/><circle cx="11.25" cy="10" r="4" fill="#E30A17"/>
    <polygon points="${star(16.08, 10, 2.5, Math.PI)}" fill="#fff"/></svg>`,
  en: () => {
    const id = `uk${++flagSeq}`;
    return `<svg viewBox="0 0 60 30" aria-hidden="true"><clipPath id="${id}s"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
      <clipPath id="${id}t"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
      <g clip-path="url(#${id}s)"><path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>
      <path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#${id}t)" stroke="#C8102E" stroke-width="4"/>
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></g></svg>`;
  }
};
export const flag = code => `<span class="flag">${(FLAGS[code] || FLAGS.tr)()}</span>`;
const KEY = 'kirinti.lang';

let lang = (() => {
  try {
    const saved = localStorage.getItem(KEY);
    if (LANGUAGES[saved]) return saved;
  } catch {}
  return (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
})();

export const getLang = () => lang;
export function setLang(next) {
  if (!LANGUAGES[next]) return;
  lang = next;
  try { localStorage.setItem(KEY, next); } catch {}
  document.documentElement.lang = next;
}
const locale = () => LANGUAGES[lang].locale;

export function t(text, vars) {
  const dict = DICTS[lang];
  let out = dict ? (dict[text] ?? text) : text;
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return out;
}

export const num = (n, digits = 0) => Number(n || 0).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const pct = n => lang === 'tr' ? `%${Math.round(n)}` : `${Math.round(n)}%`;
export const kg = g => g >= 1000 ? `${num(g / 1000, 1)} kg` : `${Math.round(g)} g`;
export const sec = ms => `${num(ms / 1000, 1)} ${lang === 'tr' ? 'sn' : 's'}`;
export const date = (iso, opts = { day: 'numeric', month: 'short' }) => new Date(`${iso}T12:00:00`).toLocaleDateString(locale(), opts);

const DAYS = {
  tr: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
};
export const dayLabel = index => index == null ? '–' : DAYS[lang][index];

// Örnek veri ve varsayılan menü Türkçe yemek adlarıyla tutulur; İngilizcede ekranda çevrilir.
const DISH_EN = {
  'Mercimek çorbası': 'Lentil soup', 'Tavuk sote': 'Chicken sauté', 'Bulgur pilavı': 'Bulgur pilaf', 'Ayran': 'Ayran (yoghurt drink)',
  'Kuru fasulye': 'White bean stew', 'Pirinç pilavı': 'Rice pilaf', 'Mevsim salatası': 'Seasonal salad', 'Ekmek': 'Bread',
  'Ispanak yemeği': 'Spinach dish', 'Makarna': 'Pasta', 'Yoğurt': 'Yoghurt', 'Elma': 'Apple', 'Izgara köfte': 'Grilled meatballs',
  'Mandalina': 'Tangerine', 'Taze fasulye': 'Green beans', 'Sütlaç': 'Rice pudding', 'Yayla çorbası': 'Yayla (yoghurt) soup',
  'Salata': 'Salad', 'Patates': 'Potatoes', 'Balık': 'Fish', 'Hamburger': 'Burger', 'Patates kızartması': 'Fries',
  'Ciğer': 'Liver', 'Pastırma/jambon': 'Bacon/ham', 'Pastırma': 'Bacon', 'Fasulye': 'Beans', 'Sosis': 'Sausage', 'Et': 'Meat',
  'Bezelye': 'Peas', 'Yumurta': 'Egg', 'Domates': 'Tomato', 'Bezelye/fasulye': 'Peas/beans', 'Yemek izleri': 'Food traces',
  'Tavuk soslu patates': 'Chicken sauce and potatoes', 'Salata/havuç': 'Salad/carrot'
};
export const dish = name => (lang === 'en' && DISH_EN[name]) || name;

export const CATEGORY_LABEL = {
  kirmizi_et: 'Kırmızı et yemeği', tavuk_balik: 'Tavuk / balık', baklagil: 'Baklagil', tahil: 'Pilav / makarna / ekmek',
  sebze: 'Sebze / salata', meyve: 'Meyve', sut_urunu: 'Süt ürünü', corba: 'Çorba', tatli: 'Tatlı', diger: 'Diğer'
};
export const category = key => t(CATEGORY_LABEL[key] || CATEGORY_LABEL.diger);

// index.html'deki sabit metinler: data-i18n (metin), data-i18n-aria (aria-label).
export function translateStatic(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.title = t('Kırıntı: Okul yemeğinde israfı ölç, azalt');
}
