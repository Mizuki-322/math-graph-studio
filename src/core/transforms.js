export function sampleContinuous(fn, start, end, count = 401) {
  const dt = (end - start) / (count - 1);
  const t = Array.from({ length: count }, (_, i) => start + i * dt);
  const x = t.map(fn);
  if (x.some(value => value === null)) throw new Error('信号在所选时间范围内有无效或非实数值。请调整表达式或范围。');
  return { t, x, dt };
}

export function continuousTransform(signal, omega, sigma = 0) {
  let real = 0, imag = 0;
  const { t, x, dt } = signal;
  for (let i = 0; i < t.length; i++) {
    const weight = (i === 0 || i === t.length - 1 ? .5 : 1) * dt * x[i] * Math.exp(-sigma * t[i]);
    const angle = omega * t[i];
    real += weight * Math.cos(angle);
    imag -= weight * Math.sin(angle);
  }
  return { real, imag, magnitude: Math.hypot(real, imag), phase: Math.atan2(imag, real) };
}

export function spectrum(signal, omegaMin, omegaMax, count = 301, sigma = 0) {
  const omega = Array.from({ length: count }, (_, i) => omegaMin + (omegaMax - omegaMin) * i / (count - 1));
  const values = omega.map(w => continuousTransform(signal, w, sigma));
  const peak = Math.max(...values.map(value => value.magnitude));
  return { omega, magnitude: values.map(value => value.magnitude), phase: values.map(value => value.magnitude < peak * 1e-3 ? null : value.phase), values };
}

export function laplacePlane(signal, sigmaMin, sigmaMax, omegaMin, omegaMax, size = 61) {
  const sigma = Array.from({ length: size }, (_, i) => sigmaMin + (sigmaMax - sigmaMin) * i / (size - 1));
  const omega = Array.from({ length: size }, (_, i) => omegaMin + (omegaMax - omegaMin) * i / (size - 1));
  const z = omega.map(w => sigma.map(s => Math.log10(1 + continuousTransform(signal, w, s).magnitude)));
  return { sigma, omega, z };
}

export function sequenceFromFormula(fn, count) {
  const sequence = Array.from({ length: count }, (_, n) => fn(n));
  if (sequence.some(value => value === null)) throw new Error('序列公式在某个 n 上没有有效实数值。');
  return sequence;
}

export function sequenceFromList(source) {
  const items = source.trim().split(/[\s,，;；]+/).filter(Boolean);
  if (items.length < 2 || items.length > 64) throw new Error('数值列表需要 2–64 个样本。');
  const sequence = items.map(Number);
  if (sequence.some(value => !Number.isFinite(value))) throw new Error('数值列表只能包含有限实数。');
  return sequence;
}

export function discreteFourier(sequence) {
  const n = sequence.length;
  const rows = [];
  for (let k = 0; k < n; k++) {
    let real = 0, imag = 0;
    for (let index = 0; index < n; index++) {
      const angle = 2 * Math.PI * k * index / n;
      real += sequence[index] * Math.cos(angle);
      imag -= sequence[index] * Math.sin(angle);
    }
    const signed = k <= Math.floor(n / 2) ? k : k - n;
    rows.push({ k, signed, omega: 2 * Math.PI * signed / n, real, imag, magnitude: Math.hypot(real, imag) / n, phase: Math.atan2(imag, real) });
  }
  rows.sort((a, b) => a.signed - b.signed);
  const peak = Math.max(...rows.map(row => row.magnitude));
  return { omega: rows.map(row => row.omega), magnitude: rows.map(row => row.magnitude), phase: rows.map(row => row.magnitude < peak * 1e-3 ? null : row.phase), rows };
}

export function zPlane(sequence, size = 71, limit = 1.6) {
  const axis = Array.from({ length: size }, (_, i) => -limit + 2 * limit * i / (size - 1));
  const values = axis.map(imagZ => axis.map(realZ => {
    const r2 = realZ * realZ + imagZ * imagZ;
    if (r2 < .01) return null;
    const invR = realZ / r2, invI = -imagZ / r2;
    let sumR = sequence[sequence.length - 1], sumI = 0;
    for (let i = sequence.length - 2; i >= 0; i--) {
      const nextR = sumR * invR - sumI * invI + sequence[i];
      sumI = sumR * invI + sumI * invR;
      sumR = nextR;
    }
    const magnitude = Math.hypot(sumR, sumI);
    return Number.isFinite(magnitude) ? Math.min(8, Math.log10(1 + magnitude)) : 8;
  }));
  return { axis, values };
}
