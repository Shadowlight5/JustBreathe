// Zero-dependency headless smoke test over the Chrome DevTools Protocol.
// Expects the app to be served at http://127.0.0.1:8000/ (npm start in another terminal).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = resolve(ROOT, process.env.SHOT_DIR || '.claude/scratch/pwa-breathing-app/reports');
const SHOT_PREFIX = process.env.SHOT_PREFIX || 'builder-01';
const URL_UNDER_TEST = 'http://127.0.0.1:8000/';
const CHROME = process.env.CHROME_PATH ||
  '/Users/rickturner/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell';

const results = [];
const consoleEntries = [];
const profile = mkdtempSync(join(tmpdir(), 'just-breathe-smoke-'));
let browser;
let ws;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function record(step, ok, detail = '') {
  results.push({ step, status: ok ? 'PASS' : 'FAIL' });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${step}${detail ? ` — ${detail}` : ''}`);
}

function cleanup() {
  try { ws?.close(); } catch {}
  try { browser?.kill('SIGKILL'); } catch {}
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

function launch(width = 390, height = 844) {
  return new Promise((res, rej) => {
    browser = spawn(CHROME, [
      '--headless', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0',
      `--window-size=${width},${height}`, `--user-data-dir=${profile}`, 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let buf = '';
    const timer = setTimeout(() => rej(new Error('browser did not report a DevTools port')), 15000);
    browser.on('error', (e) => { clearTimeout(timer); rej(e); });
    browser.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on ws:\/\/[^:]+:(\d+)\//);
      if (m) { clearTimeout(timer); res(Number(m[1])); }
    });
  });
}

let nextId = 0;
const pending = new Map();
const waiters = [];

function send(method, params = {}) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pending.set(id, { res, rej, method }));
}

function waitEvent(method, timeoutMs = 15000) {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`timeout waiting for ${method}`)), timeoutMs);
    waiters.push({ method, res: (p) => { clearTimeout(timer); res(p); } });
  });
}

function onMessage(event) {
  const msg = JSON.parse(event.data);
  if (msg.id) {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.rej(new Error(`${p.method}: ${msg.error.message}`));
    else p.res(msg.result);
    return;
  }
  const { method, params } = msg;
  if (method === 'Runtime.exceptionThrown') {
    const d = params.exceptionDetails;
    consoleEntries.push({ level: 'error', text: d.exception?.description || d.text });
  } else if (method === 'Runtime.consoleAPICalled' && (params.type === 'error' || params.type === 'warning')) {
    consoleEntries.push({
      level: params.type === 'error' ? 'error' : 'warning',
      text: params.args.map((a) => a.value ?? a.description ?? '').join(' '),
    });
  } else if (method === 'Log.entryAdded' && (params.entry.level === 'error' || params.entry.level === 'warning')) {
    consoleEntries.push({ level: params.entry.level, text: `${params.entry.text} ${params.entry.url || ''}`.trim() });
  }
  for (let i = waiters.length - 1; i >= 0; i--) {
    if (waiters[i].method === method) waiters.splice(i, 1)[0].res(params);
  }
}

async function evaluate(expression, awaitPromise = false) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}

async function screenshot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(join(SHOTS, name), Buffer.from(data, 'base64'));
}

async function navigateAndLoad(action) {
  const loaded = waitEvent('Page.loadEventFired');
  await action();
  await loaded;
}

const cue = () => evaluate(`({ phase: document.querySelector('.phase').textContent,
  count: document.querySelector('.count').textContent,
  idle: document.querySelector('.app').classList.contains('idle') })`);

async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    record(name, false, e.message);
  }
}

async function connect(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('websocket failed')); });
  ws.onmessage = onMessage;
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Network.enable');
}

async function relaunch({ width, height, reducedMotion = false }) {
  try { ws?.close(); } catch {}
  const exited = new Promise((r) => browser.once('exit', r));
  browser.kill('SIGKILL');
  await exited;
  await connect(await launch(width, height));
  if (reducedMotion) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  }
}

const rects = () => evaluate(`(() => {
  const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect();
    return { x: b.x, y: b.y, width: b.width, height: b.height, top: b.top, bottom: b.bottom }; };
  const range = document.createRange();
  range.selectNodeContents(document.querySelector('.phase'));
  const lines = new Set([...range.getClientRects()].map((b) => Math.round(b.top))).size;
  return { cue: r('.cue'), circle: r('.circle'), lines };
})()`);
const round = (b) => `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`;
const cueFits = (r) => r.cue.width <= 0.80 * r.circle.width && r.cue.height <= 0.60 * r.circle.width;
const rectDetail = (r) => `cue=${round(r.cue)} circle=${round(r.circle)}`;
const hideCue = (hidden) => evaluate(`document.querySelector('.cue').style.visibility = '${hidden ? 'hidden' : ''}'`);

async function main() {
  await connect(await launch());

  await step('1 load page', async () => {
    await navigateAndLoad(() => send('Page.navigate', { url: URL_UNDER_TEST }));
    record('1 load page', (await evaluate('document.title')) === 'Just Breathe');
  });

  await step('2 service worker active', async () => {
    const active = await evaluate(`Promise.race([
      navigator.serviceWorker.ready.then((r) => !!r.active),
      new Promise((r) => setTimeout(() => r(false), 8000))])`, true);
    record('2 service worker active', active === true, `active=${active}`);
  });

  await step('3 idle screenshot', async () => {
    await screenshot(`${SHOT_PREFIX}-idle.png`);
    record('3 idle screenshot', true, `${SHOT_PREFIX}-idle.png`);
  });

  const patternText = () => evaluate(`document.querySelector('.pattern-name').textContent`);
  const sheetOpen = () => evaluate(`document.querySelector('.sheet').open`);

  await step('3a default pattern', async () => {
    const t = await patternText();
    record('3a default pattern', t.includes('Slow exhale'), `text="${t}"`);
  });

  await step('3b open sheet', async () => {
    await evaluate(`document.querySelector('.change').click()`);
    await sleep(300);
    const open = await sheetOpen();
    await screenshot(`${SHOT_PREFIX}-sheet.png`);
    const count = await evaluate(`document.querySelectorAll('.option').length`);
    record('3b open sheet', open === true && count === 5, `open=${open} options=${count} ${SHOT_PREFIX}-sheet.png`);
  });

  await step('3c select box', async () => {
    await evaluate(`document.querySelector('.option[data-id="box"]').click()`);
    const open = await sheetOpen();
    const t = await patternText();
    record('3c select box', open === false && t.includes('Box breathing'), `open=${open} text="${t}"`);
  });

  await step('3d selection persists across reload', async () => {
    await navigateAndLoad(() => send('Page.reload', { ignoreCache: false }));
    const t = await patternText();
    record('3d selection persists across reload', t.includes('Box breathing'), `text="${t}"`);
  });

  await step('3e idle cue fits bubble', async () => {
    const r = await rects();
    await hideCue(true);
    await screenshot(`${SHOT_PREFIX}-idle-bg.png`);
    await hideCue(false);
    record('3e idle cue fits bubble', cueFits(r) && r.lines <= 2,
      `${rectDetail(r)} lines=${r.lines} ${SHOT_PREFIX}-idle-bg.png`);
  });

  await step('4 breathing cycle', async () => {
    await evaluate(`document.querySelector('.control').click()`);
    const clicked = Date.now();
    const at = (ms) => sleep(Math.max(0, clicked + ms - Date.now()));

    await at(1200);
    let c = await cue();
    await screenshot(`${SHOT_PREFIX}-inhale.png`);
    record('4a inhale at 1.2s', c.phase === 'Inhale' && (c.count === '3' || c.count === '4'),
      `phase="${c.phase}" count="${c.count}"`);

    await at(4600);
    c = await cue();
    record('4b hold at 4.6s', c.phase === 'Hold', `phase="${c.phase}" count="${c.count}"`);

    await at(8600);
    c = await cue();
    await screenshot(`${SHOT_PREFIX}-exhale.png`);
    record('4c exhale at 8.6s', c.phase === 'Exhale', `phase="${c.phase}" count="${c.count}"`);

    await evaluate(`document.querySelector('.control').click()`);
    c = await cue();
    record('4d stop returns to idle', c.phase === 'Tap anywhere to begin' && c.idle && c.count === '',
      `phase="${c.phase}" idle=${c.idle}`);
  });

  await step('4e physiological sigh', async () => {
    await evaluate(`document.querySelector('.change').click()`);
    await evaluate(`document.querySelector('.option[data-id="sigh"]').click()`);
    await evaluate(`document.querySelector('.control').click()`);
    const clicked = Date.now();
    const at = (ms) => sleep(Math.max(0, clicked + ms - Date.now()));

    await at(3500);
    let c = await cue();
    record('4e inhale again at 3.5s', c.phase === 'Inhale again', `phase="${c.phase}" count="${c.count}"`);

    await at(4500);
    c = await cue();
    const visibility = await evaluate(`getComputedStyle(document.querySelector('.change')).visibility`);
    record('4f exhale at 4.5s, Change hidden', c.phase === 'Exhale' && visibility === 'hidden',
      `phase="${c.phase}" change visibility=${visibility}`);

    await evaluate(`document.querySelector('.control').click()`);
  });

  const choose = async (id) => {
    await evaluate(`document.querySelector('.change').click()`);
    await evaluate(`document.querySelector('.option[data-id="${id}"]').click()`);
  };
  const segCounts = () => evaluate(`({ track: document.querySelectorAll('.ring .seg-track').length,
    fill: document.querySelectorAll('.ring .seg-fill').length })`);
  const fills = () => evaluate(`[...document.querySelectorAll('.ring .seg-fill')].map((c) => ({
    opacity: c.getAttribute('opacity'),
    dash: parseFloat(c.getAttribute('stroke-dasharray')) }))`);

  await step('4g ring segments match pattern', async () => {
    if (!(await cue()).idle) await evaluate(`document.querySelector('.control').click()`);
    await choose('box');
    const box = await segCounts();
    await choose('sigh');
    const sigh = await segCounts();
    record('4g ring segments match pattern',
      box.track === 4 && box.fill === 4 && sigh.track === 3 && sigh.fill === 3,
      `box=${box.track}/${box.fill} sigh=${sigh.track}/${sigh.fill}`);
  });

  await step('4h cue is inside the stage', async () => {
    const ok = await evaluate(`document.querySelector('.stage .phase') !== null &&
      document.querySelector('.stage .count') !== null`);
    record('4h cue is inside the stage', ok === true);
  });

  await step('4i ring fills during hold', async () => {
    await choose('box');
    await evaluate(`document.querySelector('.control').click()`);
    await sleep(4600);
    const phase = await evaluate(`document.querySelector('.ring').dataset.phase`);
    const f = await fills();
    await screenshot(`${SHOT_PREFIX}-hold.png`);
    const during = phase === '1' && f[0].opacity === '1' && f[0].dash > 60 && f[1].dash > 0 && f[2].opacity === '0';
    await evaluate(`document.querySelector('.control').click()`);
    const after = await fills();
    const cleared = after.every((x) => x.opacity === '0');
    record('4i ring fills during hold', during && cleared,
      `phase=${phase} fills=${JSON.stringify(f)} cleared=${cleared} ${SHOT_PREFIX}-hold.png`);
  });

  await step('4j tap anywhere toggles', async () => {
    if (!(await cue()).idle) await evaluate(`document.querySelector('.control').click()`);
    await choose('slow-exhale');
    const state = () => evaluate(`({ running: document.querySelector('.app').classList.contains('running'),
      idle: document.querySelector('.app').classList.contains('idle'),
      phase: document.querySelector('.phase').textContent,
      count: document.querySelector('.count').textContent })`);
    const failed = [];
    await evaluate(`document.querySelector('.stage').click()`);
    await sleep(4600);
    let s = await state();
    if (!(s.running && s.phase === 'Exhale')) failed.push(`stage tap ${JSON.stringify(s)}`);
    await evaluate(`document.querySelector('.title').click()`);
    await sleep(100);
    s = await state();
    if (!(s.idle && s.phase === 'Tap anywhere to begin' && s.count === '')) failed.push(`title tap ${JSON.stringify(s)}`);
    await evaluate(`document.querySelector('.pattern').click()`);
    await sleep(300);
    s = await state();
    if (!(s.running && s.phase === 'Inhale' && s.count === '4')) failed.push(`pattern tap ${JSON.stringify(s)}`);
    await evaluate(`document.querySelector('.control').click()`);
    s = await state();
    if (!s.idle) failed.push(`control stop ${JSON.stringify(s)}`);
    await evaluate(`document.querySelector('.control').click()`);
    const once = await state();
    await evaluate(`document.querySelector('.control').click()`);
    const twice = await state();
    if (!once.running) failed.push(`control once running=${once.running}`);
    if (!twice.idle) failed.push(`control twice idle=${twice.idle}`);
    record('4j tap anywhere toggles', failed.length === 0, failed.length ? `failed: ${failed.join('; ')}` : '');
  });

  await step('5 no horizontal overflow', async () => {
    const ok = await evaluate('document.documentElement.scrollWidth <= window.innerWidth');
    record('5 no horizontal overflow', ok === true);
  });

  await step('6 offline reload', async () => {
    await send('Network.emulateNetworkConditions', {
      offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
    await navigateAndLoad(() => send('Page.reload', { ignoreCache: false }));
    const r = await evaluate(`({ title: document.title, control: !!document.querySelector('.control') })`);
    record('6 offline reload', r.title === 'Just Breathe' && r.control, `title="${r.title}" control=${r.control}`);
  });

  await step('7 narrow viewport', async () => {
    await relaunch({ width: 320, height: 568 });
    await navigateAndLoad(() => send('Page.navigate', { url: URL_UNDER_TEST }));
    const l = await evaluate(`(() => {
      const b = (sel) => document.querySelector(sel).getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > window.innerWidth,
        controlBottom: b('.control').bottom, innerHeight: window.innerHeight,
        orbTop: b('.orb').top, orbBottom: b('.orb').bottom,
        titleBottom: b('.title').bottom, patternTop: b('.pattern').top };
    })()`);
    const r = await rects();
    await screenshot(`${SHOT_PREFIX}-narrow-idle.png`);
    await hideCue(true);
    await screenshot(`${SHOT_PREFIX}-narrow-idle-bg.png`);
    await hideCue(false);
    const failed = [];
    if (l.overflow) failed.push('horizontal overflow');
    if (!(l.controlBottom <= l.innerHeight)) failed.push(`control bottom ${l.controlBottom} > ${l.innerHeight}`);
    if (!(l.orbTop >= l.titleBottom)) failed.push(`orb top ${l.orbTop} < title bottom ${l.titleBottom}`);
    if (!(l.orbBottom <= l.patternTop)) failed.push(`orb bottom ${l.orbBottom} > pattern top ${l.patternTop}`);
    if (!cueFits(r)) failed.push('idle cue does not fit bubble');
    if (!(r.lines <= 2)) failed.push(`idle label on ${r.lines} lines`);

    await choose('sigh');
    await evaluate(`document.querySelector('.control').click()`);
    await sleep(3500);
    const c = await cue();
    const ri = await rects();
    await screenshot(`${SHOT_PREFIX}-narrow-inhale.png`);
    await evaluate(`document.querySelector('.control').click()`);
    if (c.phase !== 'Inhale again') failed.push(`phase at 3.5s "${c.phase}"`);
    if (!(ri.cue.width <= 0.80 * ri.circle.width)) failed.push('inhale cue wider than bubble');
    record('7 narrow viewport', failed.length === 0,
      `${failed.length ? `failed: ${failed.join('; ')} | ` : ''}idle ${rectDetail(r)} lines=${r.lines} inhale ${rectDetail(ri)} ` +
      `control bottom=${Math.round(l.controlBottom)}/${l.innerHeight}`);
  });

  await step('8 reduced motion', async () => {
    await relaunch({ width: 390, height: 844, reducedMotion: true });
    await navigateAndLoad(() => send('Page.navigate', { url: URL_UNDER_TEST }));
    const idle = await evaluate(`({
      scale: getComputedStyle(document.querySelector('.orb')).getPropertyValue('--scale').trim(),
      before: getComputedStyle(document.body, '::before').opacity })`);
    await evaluate(`document.querySelector('.control').click()`);
    await sleep(1500);
    const run = await evaluate(`({
      glow: getComputedStyle(document.querySelector('.glow')).opacity,
      phase: document.querySelector('.ring').dataset.phase,
      fill: getComputedStyle(document.querySelector('.seg-fill')).opacity })`);
    await screenshot(`${SHOT_PREFIX}-reduced-inhale.png`);
    await evaluate(`document.querySelector('.control').click()`);
    const failed = [];
    if (idle.scale !== '0.85') failed.push(`--scale "${idle.scale}"`);
    if (idle.before !== '0') failed.push(`body::before opacity "${idle.before}"`);
    if (run.glow !== '0.5') failed.push(`glow opacity "${run.glow}"`);
    if (run.phase !== '0') failed.push(`ring phase "${run.phase}"`);
    if (run.fill !== '1') failed.push(`first fill opacity "${run.fill}"`);
    record('8 reduced motion', failed.length === 0,
      `${failed.length ? `failed: ${failed.join('; ')} | ` : ''}${JSON.stringify({ ...idle, ...run })} ${SHOT_PREFIX}-reduced-inhale.png`);
  });

  await step('9 keyboard order', async () => {
    await send('Emulation.setEmulatedMedia', { features: [] });
    await navigateAndLoad(() => send('Page.reload', { ignoreCache: false }));
    const tab = async () => {
      const key = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 };
      await send('Input.dispatchKeyEvent', { type: 'keyDown', ...key });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
      return evaluate('document.activeElement.className');
    };
    const first = await tab();
    const second = await tab();
    record('9 keyboard order', first === 'change' && second === 'control', `first="${first}" second="${second}"`);
  });
}

let exitCode = 0;
try {
  await main();
} catch (e) {
  console.log(`FAIL setup — ${e.message}`);
  exitCode = 1;
} finally {
  cleanup();
}

console.log(`console entries (error/warning): ${consoleEntries.length}`);
for (const e of consoleEntries) console.log(`  [${e.level}] ${e.text}`);
if (results.some((r) => r.status === 'FAIL')) exitCode = 1;
if (consoleEntries.some((e) => e.level === 'error')) exitCode = 1;
console.log(exitCode === 0 ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(exitCode);
