import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleContinuous, continuousTransform, laplacePlane, discreteFourier, zPlane } from '../src/core/transforms.js';

test('finite-window Laplace integral matches exp(-t) at s=0', () => {
  const signal = sampleContinuous(t => Math.exp(-t), 0, 8, 801);
  const result = continuousTransform(signal, 0, 0);
  assert.ok(Math.abs(result.real - (1 - Math.exp(-8))) < 1e-5);
  assert.ok(Math.abs(result.imag) < 1e-12);
});

test('Laplace heatmap uses log10(1+|F|)', () => {
  const signal = sampleContinuous(() => 1, 0, 4, 401);
  const plane = laplacePlane(signal, -1, 1, -2, 2, 5);
  assert.ok(Math.abs(plane.z[2][2] - Math.log10(5)) < 1e-10);
});

test('DFT and finite z-transform agree on the unit circle', () => {
  const sequence = [1, -1];
  const dft = discreteFourier(sequence);
  const nyquist = dft.rows.find(row => row.k === 1);
  assert.ok(Math.abs(nyquist.magnitude - 1) < 1e-12);
  const plane = zPlane(sequence, 5, 1);
  assert.ok(Math.abs(plane.values[2][0] - Math.log10(3)) < 1e-12);
});
