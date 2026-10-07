import { phaseAt, isComplete, phaseFractions, phaseFills } from './breathing.js';
import { PATTERNS, getPattern } from './patterns.js';
import { createWakeLock } from './wakelock.js';

const app = document.querySelector('.app');
const orb = document.querySelector('.orb');
const ring = document.querySelector('.ring');
const phaseEl = document.querySelector('.phase');
const countEl = document.querySelector('.count');
const button = document.querySelector('.control');
const patternName = document.querySelector('.pattern-name');
const changeButton = document.querySelector('.change');
const sheet = document.querySelector('.sheet');
const list = document.querySelector('.patterns');

const IDLE_TEXT = 'Ready when you are';
const STORAGE_KEY = 'just-breathe.pattern';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const SVG_NS = 'http://www.w3.org/2000/svg';
const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;
const RING_GAP = 4;

let running = false;
let startTime = 0;
let frame = 0;
let lastLabel = '';
let lastRemaining = 0;
let segLengths = [];
let segFills = [];
const lock = createWakeLock(navigator);

function loadId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveId(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {}
}

let pattern = getPattern(loadId());

function minScale() {
  return reducedMotion.matches ? 0.85 : 0.55;
}

function renderRing(p) {
  ring.replaceChildren();
  segLengths = [];
  segFills = [];
  let before = 0;
  phaseFractions(p).forEach((f, i) => {
    const length = f * RING_C - RING_GAP;
    const offset = String(-(before * RING_C + RING_GAP / 2));
    before += f;
    const track = document.createElementNS(SVG_NS, 'circle');
    const fill = document.createElementNS(SVG_NS, 'circle');
    segLengths.push(length);
    segFills.push(fill);
    for (const [el, cls] of [[track, 'seg-track'], [fill, 'seg-fill']]) {
      el.setAttribute('class', cls);
      el.setAttribute('cx', '50');
      el.setAttribute('cy', '50');
      el.setAttribute('r', String(RING_R));
      el.setAttribute('stroke-dashoffset', offset);
      el.dataset.index = String(i);
    }
    track.setAttribute('stroke-dasharray', `${length} ${RING_C}`);
    fill.setAttribute('stroke-dasharray', `0 ${RING_C}`);
    fill.setAttribute('opacity', '0');
    ring.append(track, fill);
  });
  ring.dataset.phase = '';
}

function setRingFills(fills) {
  segFills.forEach((el, i) => {
    el.setAttribute('stroke-dasharray', `${segLengths[i] * fills[i]} ${RING_C}`);
    el.setAttribute('opacity', fills[i] > 0 ? '1' : '0');
  });
}

function tick() {
  const s = phaseAt(performance.now() - startTime, pattern);
  if (isComplete(s, pattern)) {
    stop('Well done. Rest here.');
    return;
  }
  const min = minScale();
  orb.style.setProperty('--scale', min + s.size * (1 - min));
  document.documentElement.style.setProperty('--breath', s.size);
  setRingFills(phaseFills(s, pattern));
  ring.dataset.phase = String(s.index);
  if (s.label !== lastLabel) {
    phaseEl.textContent = s.label;
    lastLabel = s.label;
    phaseEl.animate && phaseEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  }
  if (s.remaining !== lastRemaining) {
    countEl.textContent = String(s.remaining);
    lastRemaining = s.remaining;
  }
  frame = requestAnimationFrame(tick);
}

function start() {
  running = true;
  startTime = performance.now();
  lastLabel = '';
  lastRemaining = 0;
  app.classList.remove('idle');
  app.classList.add('running');
  button.textContent = 'Stop';
  lock.acquire();
  frame = requestAnimationFrame(tick);
}

function stop(message = IDLE_TEXT) {
  running = false;
  cancelAnimationFrame(frame);
  app.classList.remove('running');
  app.classList.add('idle');
  button.textContent = 'Start';
  phaseEl.textContent = message;
  countEl.textContent = '';
  orb.style.setProperty('--scale', minScale());
  document.documentElement.style.setProperty('--breath', 0);
  setRingFills(pattern.phases.map(() => 0));
  ring.dataset.phase = '';
  lock.release();
}

function renderOptions() {
  for (const p of PATTERNS) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'option';
    option.dataset.id = p.id;
    option.setAttribute('aria-pressed', 'false');
    const name = document.createElement('span');
    name.className = 'option-name';
    name.textContent = p.name;
    option.append(name);
    if (p.tag) {
      const tag = document.createElement('span');
      tag.className = 'option-tag';
      tag.textContent = p.tag;
      option.append(tag);
    }
    const timing = document.createElement('span');
    timing.className = 'option-timing';
    timing.textContent = p.timing;
    const why = document.createElement('span');
    why.className = 'option-why';
    why.textContent = p.why;
    option.append(timing, why);
    const item = document.createElement('li');
    item.append(option);
    list.append(item);
  }
}

function selectPattern(id) {
  pattern = getPattern(id);
  saveId(pattern.id);
  patternName.textContent = `${pattern.name}, ${pattern.timing}`;
  renderRing(pattern);
  for (const option of list.querySelectorAll('.option')) {
    option.setAttribute('aria-pressed', String(option.dataset.id === pattern.id));
  }
}

function openSheet() {
  if (sheet.showModal) sheet.showModal();
  else sheet.setAttribute('open', '');
  list.querySelector('.option[aria-pressed="true"]')?.focus();
}

function closeSheet() {
  if (sheet.close) sheet.close();
  else sheet.removeAttribute('open');
}

button.addEventListener('click', () => (running ? stop() : start()));

changeButton.addEventListener('click', () => {
  if (!running) openSheet();
});

sheet.addEventListener('click', (event) => {
  if (event.target === sheet) closeSheet();
});

list.addEventListener('click', (event) => {
  const option = event.target.closest('.option');
  if (!option) return;
  selectPattern(option.dataset.id);
  closeSheet();
});

document.addEventListener('visibilitychange', () => {
  if (running && document.visibilityState === 'visible') lock.acquire();
});

renderOptions();
selectPattern(pattern.id);
orb.style.setProperty('--scale', minScale());
document.documentElement.style.setProperty('--breath', 0);

if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
