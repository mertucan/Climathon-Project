// Rehberli jüri turu: her adımda ilgili sekmeye geçer, öğeyi vurgular, kısa açıklama gösterir;
// "Benim için yap" düğmesi adımın işlemini (örnek tepsi, analiz, öneri) jürinin yerine çalıştırır.
import { t } from './i18n.js';

let state = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const wait = ms => new Promise(r => setTimeout(r, ms));

function ensureDom() {
  let root = document.getElementById('tour');
  if (root) return root;
  root = document.createElement('div');
  root.id = 'tour';
  root.innerHTML = `<div class="tour-blocker"></div><div class="tour-spot"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div class="tour-meta"><span data-step></span><button class="icon-btn" data-tour="close" aria-label="">✕</button></div>
      <h3 id="tour-title" data-title></h3><p data-body></p>
      <div class="tour-actions"><button class="btn small ghost" data-tour="prev"></button><button class="btn small" data-tour="action" hidden></button><button class="btn small primary" data-tour="next"></button></div>
    </div>`;
  document.body.append(root);
  root.addEventListener('click', async event => {
    const button = event.target.closest('[data-tour]');
    if (!button || !state || state.busy) return;
    const kind = button.dataset.tour;
    if (kind === 'close') return endTour();
    if (kind === 'prev') return go(state.index - 1);
    if (kind === 'next') return state.index === state.steps.length - 1 ? endTour() : go(state.index + 1);
    if (kind === 'action') return runAction();
  });
  addEventListener('resize', place);
  addEventListener('scroll', place, { passive: true });
  addEventListener('keydown', event => {
    if (!state) return;
    if (event.key === 'Escape') endTour();
    if (event.key === 'ArrowRight' && !state.busy) go(state.index + 1);
    if (event.key === 'ArrowLeft' && !state.busy) go(state.index - 1);
  });
  return root;
}

const target = () => {
  const step = state?.steps[state.index];
  return step ? document.querySelector(typeof step.target === 'function' ? step.target() : step.target) : null;
};

function place() {
  if (!state) return;
  const root = document.getElementById('tour');
  const spot = root.querySelector('.tour-spot');
  const card = root.querySelector('.tour-card');
  const el = target();
  if (!el) { spot.hidden = true; card.dataset.pos = 'bottom'; return; }
  const r = el.getBoundingClientRect();
  const padding = 6;
  Object.assign(spot.style, { top: `${r.top - padding}px`, left: `${r.left - padding}px`, width: `${r.width + padding * 2}px`, height: `${r.height + padding * 2}px` });
  spot.hidden = false;
  // Kart, vurgulanan öğenin üstünü kapatmasın: öğe ekranın üst yarısındaysa kart altta durur.
  card.dataset.pos = r.top + r.height / 2 < innerHeight * 0.5 ? 'bottom' : 'top';
}

async function go(index) {
  if (!state || index < 0 || index >= state.steps.length) return;
  state.index = index;
  const step = state.steps[index];
  const root = ensureDom();
  root.querySelector('.tour-spot').hidden = true;
  if (step.enter) await step.enter();
  await wait(60);
  target()?.scrollIntoView({ block: 'center', behavior: 'instant' });
  await wait(250);
  render();
  place();
}

function render() {
  const root = document.getElementById('tour');
  const step = state.steps[state.index];
  root.querySelector('[data-step]').textContent = t('{n} / {total}', { n: state.index + 1, total: state.steps.length });
  root.querySelector('[data-title]').textContent = step.title;
  root.querySelector('[data-body]').innerHTML = esc(step.body);
  root.querySelector('[data-tour=close]').setAttribute('aria-label', t('Turu kapat'));
  const prev = root.querySelector('[data-tour=prev]');
  prev.textContent = t('Geri');
  prev.disabled = state.index === 0 || state.busy;
  const next = root.querySelector('[data-tour=next]');
  next.textContent = state.index === state.steps.length - 1 ? t('Turu bitir') : t('İleri');
  next.disabled = state.busy;
  const action = root.querySelector('[data-tour=action]');
  action.hidden = !step.action;
  if (!step.action) action.textContent = '';
  if (step.action) {
    action.disabled = state.busy;
    action.innerHTML = state.busy ? `<span class="spinner"></span> ${esc(t('Çalışıyor…'))}` : esc(step.action.label);
  }
}

async function runAction() {
  const step = state.steps[state.index];
  state.busy = true;
  render();
  try { await step.action.run(); } catch (error) { console.warn('tour action', error); }
  if (!state) return;
  state.busy = false;
  if (step.action.advance) return go(state.index + 1);
  target()?.scrollIntoView({ block: 'center', behavior: 'instant' });
  render();
  place();
}

export function startTour(steps, { onEnd } = {}) {
  ensureDom().hidden = false;
  document.body.classList.add('touring');
  state = { steps, index: 0, busy: false, onEnd };
  go(0);
}

export function endTour() {
  if (!state) return;
  const { onEnd } = state;
  state = null;
  document.getElementById('tour').hidden = true;
  document.body.classList.remove('touring');
  onEnd?.();
}

export const isTouring = () => Boolean(state);
// Tur sırasında içerik değişirse (ör. analiz sonucu geldi) vurguyu yeniden konumlar.
export const refreshTour = () => { if (state) { render(); place(); } };
