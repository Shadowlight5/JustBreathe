import { test } from 'node:test';
import assert from 'node:assert/strict';
import { phaseAt, totalMs, easeInOut, isComplete, phaseFractions, phaseFills } from '../js/breathing.js';
import { getPattern } from '../js/patterns.js';

const BOX = getPattern('box');
const SIGH = getPattern('sigh');

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('totalMs of box pattern is 16000', () => {
  assert.equal(totalMs(BOX), 16000);
});

test('easeInOut endpoints and midpoint', () => {
  assert.equal(easeInOut(0), 0);
  assert.ok(near(easeInOut(1), 1));
  assert.equal(easeInOut(0.5), 0.5);
});

test('t=0 starts inhale', () => {
  const s = phaseAt(0, BOX);
  assert.equal(s.index, 0);
  assert.equal(s.label, 'Inhale');
  assert.equal(s.remaining, 4);
  assert.equal(s.progress, 0);
  assert.equal(s.size, 0);
  assert.equal(s.cycle, 0);
});

test('t=2000 is half size', () => {
  assert.ok(near(phaseAt(2000, BOX).size, 0.5));
});

test('t=3999 inhale with 1 remaining', () => {
  const s = phaseAt(3999, BOX);
  assert.equal(s.label, 'Inhale');
  assert.equal(s.remaining, 1);
});

test('t=4000 first hold, full size', () => {
  const s = phaseAt(4000, BOX);
  assert.equal(s.index, 1);
  assert.equal(s.label, 'Hold');
  assert.equal(s.remaining, 4);
  assert.equal(s.size, 1);
});

test('t=8000 exhale starts at full size', () => {
  const s = phaseAt(8000, BOX);
  assert.equal(s.label, 'Exhale');
  assert.equal(s.index, 2);
  assert.equal(s.size, 1);
});

test('t=11999 exhale nearly empty', () => {
  const s = phaseAt(11999, BOX);
  assert.equal(s.label, 'Exhale');
  assert.equal(s.remaining, 1);
  assert.ok(near(s.size, 0, 1e-6));
});

test('t=12000 second hold, empty', () => {
  const s = phaseAt(12000, BOX);
  assert.equal(s.index, 3);
  assert.equal(s.label, 'Hold');
  assert.equal(s.size, 0);
});

test('t=16000 next cycle inhale', () => {
  const s = phaseAt(16000, BOX);
  assert.equal(s.index, 0);
  assert.equal(s.label, 'Inhale');
  assert.equal(s.cycle, 1);
  assert.equal(s.remaining, 4);
});

test('negative elapsed is treated as 0', () => {
  assert.deepEqual(phaseAt(-500, BOX), phaseAt(0, BOX));
});

test('labels across one cycle', () => {
  assert.deepEqual(
    [500, 4500, 8500, 12500].map((t) => phaseAt(t, BOX).label),
    ['Inhale', 'Hold', 'Exhale', 'Hold']
  );
});

test('size rises during inhale and falls during exhale', () => {
  let prev = -Infinity;
  for (let t = 0; t <= 4000; t += 100) {
    const { size } = phaseAt(t, BOX);
    assert.ok(size >= prev, `inhale size dropped at ${t}`);
    prev = size;
  }
  prev = Infinity;
  for (let t = 8000; t <= 12000; t += 100) {
    const { size } = phaseAt(t, BOX);
    assert.ok(size <= prev, `exhale size rose at ${t}`);
    prev = size;
  }
});

test('remaining stays within 1..4 and progress/size in range', () => {
  for (let t = 0; t <= 16000; t += 50) {
    const s = phaseAt(t, BOX);
    assert.ok(s.remaining >= 1 && s.remaining <= 4, `remaining ${s.remaining} at ${t}`);
    assert.ok(s.progress >= 0 && s.progress < 1, `progress ${s.progress} at ${t}`);
    assert.ok(s.size >= 0 && s.size <= 1, `size ${s.size} at ${t}`);
  }
});

test('isComplete is false before the cycle limit', () => {
  assert.equal(isComplete({ cycle: 3 }, { phases: [], cycles: 4 }), false);
});

test('isComplete is true at the cycle limit', () => {
  assert.equal(isComplete({ cycle: 4 }, { phases: [], cycles: 4 }), true);
});

test('isComplete is false for a pattern without cycles', () => {
  assert.equal(isComplete({ cycle: 100 }, { phases: [] }), false);
});

test('phaseFractions of box is four quarters', () => {
  assert.deepEqual(phaseFractions(BOX), [0.25, 0.25, 0.25, 0.25]);
});

test('phaseFractions of sigh follows its seconds', () => {
  const f = phaseFractions(SIGH);
  assert.equal(f.length, 3);
  [0.3, 0.1, 0.6].forEach((x, i) => assert.ok(near(f[i], x), `fraction ${i} is ${f[i]}`));
  assert.ok(near(f.reduce((a, b) => a + b, 0), 1));
});

test('phaseFills at t=0 is all empty', () => {
  assert.deepEqual(phaseFills(phaseAt(0, BOX), BOX), [0, 0, 0, 0]);
});

test('phaseFills at t=6000 fills inhale and half the hold', () => {
  assert.deepEqual(phaseFills(phaseAt(6000, BOX), BOX), [1, 0.5, 0, 0]);
});

test('phaseFills at t=15999 is nearly full, then empties on wrap', () => {
  const end = phaseFills(phaseAt(15999, BOX), BOX);
  assert.deepEqual(end.slice(0, 3), [1, 1, 1]);
  assert.ok(near(end[3], 1, 1e-3), `last fill ${end[3]}`);
  assert.deepEqual(phaseFills(phaseAt(16000, BOX), BOX), [0, 0, 0, 0]);
});
