import test from 'node:test';
import assert from 'node:assert/strict';
import { ComputeEngine } from '@cortex-js/compute-engine';
import { compileLatex, parseLatexList } from '../src/core/formula.js';
import { curveCoordinates } from '../src/core/curve.js';

const formula = (latex, variables = ['x']) => compileLatex(latex, variables, ComputeEngine);

test('implicit multiplication forms parse and evaluate', () => {
  assert.equal(formula('2x').evaluate({ x: 2 }), 4);
  assert.ok(Math.abs(formula('3\\sin x').evaluate({ x: 1 }) - 3 * Math.sin(1)) < 1e-12);
  assert.equal(formula('xy', ['x', 'y']).evaluate({ x: 2, y: 3 }), 6);
  assert.equal(formula('2(x+1)').evaluate({ x: 2 }), 6);
});

test('sum, product and adaptive Simpson integral', () => {
  assert.equal(formula('\\sum_{n=1}^{10}{n}').evaluate({}), 55);
  assert.equal(formula('\\prod_{n=1}^{4}{n}').evaluate({}), 24);
  assert.ok(Math.abs(formula('\\int_{0}^{1}{x^2}\\,dx').evaluate({}) - 1 / 3) < 1e-6);
});

test('domain and substitution results', () => {
  assert.equal(formula('\\sqrt{x}').evaluate({ x: -1 }), null);
  assert.equal(formula('\\frac{x^2+1}{x-1}').evaluate({ x: 2 }), 5);
  assert.equal(formula('\\frac{1}{x}').evaluate({ x: 0 }), null);
});

test('incomplete integral reports a specific Chinese error', () => {
  assert.throws(() => formula('\\int_{0}^{}{x^2}\\,dx'), /缺少积分上限/);
});

test('finite list parses from formula', () => {
  assert.deepEqual(parseLatexList('\\left[1,0,-1,0\\right]', ComputeEngine), [1, 0, -1, 0]);
});

test('curve trace inserts a gap at an undefined point', () => {
  const fn = x => x === 0 ? null : 1 / x;
  const rows = [-1, 0, 1].map(x => ({ x, av: fn(x) }));
  assert.deepEqual(curveCoordinates(rows, 'av', fn, -3, 3).y, [-1, null, 1]);
});
