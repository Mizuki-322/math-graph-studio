import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, evaluate } from '../src/core/index.js';

const near = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const plot = (overrides = {}) => ({
  command: 'plot', mode: '2d', a: '\\sin x', b: '\\cos x', showB: true,
  xRange: [-10, 10], yRange: [-3, 3], ...overrides
});

test('formula command and variable workspace preserve substitution and calculus', () => {
  const workspace = createWorkspace({ x: 2 });
  assert.deepEqual(evaluate('\\frac{x^2+1}{x-1}', workspace), { type: 'number', value: 5 });
  workspace.set('x', 3);
  assert.deepEqual(evaluate('2x', workspace), { type: 'number', value: 6 });
  assert.deepEqual(workspace.snapshot(), { x: 3 });
  near(evaluate('\\int_{0}^{1}x^2\\,dx').value, 1 / 3, 1e-6);
  assert.equal(evaluate('\\sum_{n=1}^{10}n').value, 55);
  assert.equal(evaluate('\\prod_{n=1}^{4}n').value, 24);
});

test('2D plotting and intersection command preserve crossings and overlap', () => {
  const result = evaluate(plot());
  assert.equal(result.type, 'curve');
  assert.equal(result.value.analysis.samples.length, 1601);
  assert.equal(result.value.analysis.points.length, 6);
  near(result.value.analysis.points[0].x, -8.639379797317087, 1e-8);
  near(result.value.analysis.points[0].y, -0.7071067812253283, 1e-8);
  assert.deepEqual(result.value.analysis.overlaps, []);
  assert.equal(result.value.coordinatesA.x.length, 1601);
  const intersections = evaluate({ ...plot(), command: 'intersections' });
  assert.equal(intersections.type, 'curve-intersections');
  assert.deepEqual(intersections.value.points, result.value.analysis.points);
  const overlap = evaluate({ ...plot({ a: '\\sin x', b: '\\sin x', xRange: [-2, 2] }), command: 'intersections' });
  assert.deepEqual(overlap.value.overlaps, [[-2, 2]]);
});

test('2D plotting retains gaps at poles and outside the domain', () => {
  const pole = evaluate(plot({ a: '\\frac{1}{x}', showB: false, xRange: [-1, 1], yRange: [-5, 5] })).value;
  assert.equal(pole.analysis.samples[800].av, null);
  assert.equal(pole.coordinatesA.y.filter(value => value === null).length, 1);
  const root = evaluate(plot({ a: '\\sqrt{x}', showB: false, xRange: [-1, 1], yRange: [-1, 2] })).value;
  assert.equal(root.analysis.samples[0].av, null);
  assert.equal(root.analysis.samples[800].av, 0);
  near(root.analysis.samples[1600].av, 1);
});

test('3D surface and intersection line retain sampled values', () => {
  const input = plot({ mode: '3d', a: '\\sin\\left(\\sqrt{x^2+y^2}\\right)', b: '0.25x', xRange: [-6, 6], yRange: [-6, 6] });
  const result = evaluate(input);
  assert.equal(result.type, 'surface');
  assert.equal(result.value.analysis.xs.length, 65);
  assert.equal(result.value.analysis.valid, 4225);
  near(result.value.analysis.zA[0][0], 0.8072610908541344);
  assert.equal(result.value.analysis.zA[32][32], 0);
  assert.ok(result.value.analysis.segments > 0);
  const crossings = evaluate({ ...input, command: 'intersections' });
  assert.equal(crossings.type, 'surface-intersections');
  assert.equal(crossings.value.segments, result.value.analysis.segments);
});

test('4D time slice retains its surface values', () => {
  const result = evaluate(plot({ mode: '4d', a: '\\sin\\left(\\sqrt{x^2+y^2}-t\\right)', b: '0.25x', xRange: [-6, 6], yRange: [-6, 6], time: 1 }));
  assert.equal(result.type, 'surface');
  near(result.value.analysis.zA[0][0], 0.9327965641090213);
  near(result.value.analysis.zA[32][32], -0.8414709848078965);
  assert.ok(result.value.analysis.segments > 0);
});

test('Fourier command preserves finite-window spectrum', () => {
  const result = evaluate({ command: 'fourier', latex: 'e^{-\\left|t\\right|}', tRange: [-10, 10], omegaRange: [-12, 12] });
  assert.equal(result.type, 'fourier');
  assert.equal(result.value.signal.t.length, 401);
  near(result.value.signal.dt, 0.05);
  near(result.value.spectrum.magnitude[150], 2.0003258305312137);
  near(result.value.spectrum.magnitude[0], 0.01422106460758666);
  assert.equal(result.value.spectrum.phase[150], 0);
});

test('Laplace command preserves complex-plane heatmap and Fourier slice', () => {
  const result = evaluate({ command: 'laplace', latex: 'e^{-t}\\sin\\left(4t\\right)', tRange: [0, 12], omegaRange: [-12, 12], sigmaRange: [-1, 1] });
  assert.equal(result.type, 'laplace');
  near(result.value.plane.z[30][30], 0.09166529124923704);
  near(result.value.plane.z[0][0], 0.030772847269306385);
  near(result.value.slice.magnitude[150], 0.23499526143204585);
});

test('DFT and z commands preserve formula-sequence results', () => {
  const input = { source: 'formula', latex: '0.8^n\\cos\\left(\\frac{\\pi n}{4}\\right)', count: 32 };
  const dft = evaluate({ command: 'dft', ...input });
  assert.equal(dft.type, 'dft');
  assert.equal(dft.value.sequence.length, 32);
  near(dft.value.sequence[1], 0.565685424949238);
  near(dft.value.spectrum.magnitude[16], 0.02969722640700485);
  near(dft.value.spectrum.phase[16], 0.29319557146126235);
  const z = evaluate({ command: 'z', ...input });
  assert.equal(z.type, 'z');
  near(z.value.plane.values[0][0], 0.2621836248866588);
  assert.deepEqual(z.value.spectrum, dft.value.spectrum);
  assert.equal(z.value.samplePoints.x.length, 32);
});

test('discrete list input retains DFT and z-plane output', () => {
  const input = { command: 'z', source: 'list', latex: '[1,0,-1,0]' };
  const result = evaluate(input);
  assert.deepEqual(result.value.sequence, [1, 0, -1, 0]);
  near(result.value.spectrum.magnitude[2], 0.5);
  near(result.value.spectrum.magnitude[3], 6.123233995736766e-17);
  near(result.value.plane.values[0][0], 0.30511372735607084);
  assert.deepEqual(evaluate({ command: 'parse-list', latex: input.latex }), { type: 'sequence', value: [1, 0, -1, 0] });
});

test('all registered commands return typed values and explain invalid input', () => {
  assert.equal(evaluate({ command: 'validate-formula', latex: 'x^2', variables: ['x'] }).type, 'formula');
  assert.throws(() => evaluate({ command: 'missing' }), /未知命令/);
  assert.throws(() => evaluate({ command: 'plot', a: 'x', xRange: [1, 1], yRange: [-1, 1] }), /范围/);
});
