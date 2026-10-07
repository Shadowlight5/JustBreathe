import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, DEFAULT_PATTERN_ID, getPattern } from '../js/patterns.js';
import { phaseAt, totalMs } from '../js/breathing.js';

test('pattern ids are unique', () => {
  const ids = PATTERNS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('name, timing and why are non-empty strings', () => {
  for (const p of PATTERNS) {
    for (const key of ['name', 'timing', 'why']) {
      assert.equal(typeof p[key], 'string', `${p.id}.${key}`);
      assert.ok(p[key].trim().length > 0, `${p.id}.${key} empty`);
    }
  }
});

test('every pattern has at least two valid phases', () => {
  for (const p of PATTERNS) {
    assert.ok(p.phases.length >= 2, `${p.id} has ${p.phases.length} phases`);
    for (const ph of p.phases) {
      assert.ok(Number.isInteger(ph.seconds) && ph.seconds > 0, `${p.id} ${ph.label} seconds ${ph.seconds}`);
      assert.ok(ph.from >= 0 && ph.from <= 1, `${p.id} ${ph.label} from ${ph.from}`);
      assert.ok(ph.to >= 0 && ph.to <= 1, `${p.id} ${ph.label} to ${ph.to}`);
    }
  }
});

test('circle size is continuous across phases and cycles', () => {
  for (const p of PATTERNS) {
    for (let i = 0; i < p.phases.length - 1; i++) {
      assert.equal(p.phases[i].to, p.phases[i + 1].from, `${p.id} phase ${i} -> ${i + 1}`);
    }
    assert.equal(p.phases.at(-1).to, p.phases[0].from, `${p.id} last -> first`);
  }
});

test('cycle length is between 8 and 20 seconds', () => {
  for (const p of PATTERNS) {
    const ms = totalMs(p);
    assert.ok(ms >= 8000 && ms <= 20000, `${p.id} cycle ${ms}ms`);
  }
});

test('cycles, when present, is a positive integer', () => {
  for (const p of PATTERNS) {
    if (p.cycles !== undefined) assert.ok(Number.isInteger(p.cycles) && p.cycles > 0, `${p.id} cycles ${p.cycles}`);
  }
});

test('default pattern exists and unknown ids fall back to it', () => {
  assert.ok(PATTERNS.some((p) => p.id === DEFAULT_PATTERN_ID));
  assert.equal(getPattern('nope').id, DEFAULT_PATTERN_ID);
  assert.equal(getPattern(null).id, DEFAULT_PATTERN_ID);
  assert.equal(getPattern('box').id, 'box');
});

test('slow exhale timing', () => {
  const p = getPattern('slow-exhale');
  let s = phaseAt(0, p);
  assert.equal(s.label, 'Inhale');
  assert.equal(s.remaining, 4);
  s = phaseAt(3999, p);
  assert.equal(s.label, 'Inhale');
  assert.equal(s.remaining, 1);
  s = phaseAt(4000, p);
  assert.equal(s.label, 'Exhale');
  assert.equal(s.remaining, 6);
  assert.equal(s.size, 1);
  s = phaseAt(9999, p);
  assert.equal(s.label, 'Exhale');
  assert.equal(s.remaining, 1);
  s = phaseAt(10000, p);
  assert.equal(s.label, 'Inhale');
  assert.equal(s.cycle, 1);
});

test('physiological sigh timing', () => {
  const p = getPattern('sigh');
  let s = phaseAt(3000, p);
  assert.equal(s.label, 'Inhale again');
  assert.equal(s.size, 0.75);
  s = phaseAt(4000, p);
  assert.equal(s.label, 'Exhale');
  assert.equal(s.size, 1);
  assert.equal(phaseAt(10000, p).cycle, 1);
});

test('4-7-8 timing', () => {
  const p = getPattern('four-seven-eight');
  const s = phaseAt(11000, p);
  assert.equal(s.label, 'Exhale');
  assert.equal(s.remaining, 8);
  assert.equal(phaseAt(19000, p).cycle, 1);
  assert.equal(phaseAt(76000, p).cycle, 4);
});
