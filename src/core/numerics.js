import { compileLatex } from './formula.js';

export function compileExpression(source, variables = ['x', 'y', 't'], workspaceValues = {}) {
  const allowed = [...new Set([...variables, ...Object.keys(workspaceValues)])];
  const compiled = compileLatex(source, allowed);
  const fn = (x, y = 0, t = 0) => compiled.evaluate({ ...workspaceValues, x, y, t });
  fn.hasCalculus = compiled.hasCalculus;
  return fn;
}

const close = (a, b) => Math.abs(a - b) <= 1e-5 * (1 + Math.abs(a) + Math.abs(b));
const difference = (a, b, x) => {
  const av = a(x), bv = b(x);
  return av === null || bv === null ? null : av - bv;
};

function refineRoot(a, b, left, right) {
  let dl = difference(a, b, left), dr = difference(a, b, right);
  if (dl === null || dr === null || dl * dr > 0) return null;
  for (let i = 0; i < 52; i++) {
    const mid = (left + right) / 2;
    const dm = difference(a, b, mid);
    if (dm === null) return null;
    if (Math.abs(dm) < 1e-10) return mid;
    if (dl * dm <= 0) { right = mid; dr = dm; }
    else { left = mid; dl = dm; }
  }
  const x = (left + right) / 2;
  const av = a(x), bv = b(x);
  return av !== null && bv !== null && close(av, bv) ? x : null;
}

function refineTangent(a, b, left, right) {
  const ratio = (Math.sqrt(5) - 1) / 2;
  const score = x => {
    const d = difference(a, b, x);
    return d === null ? Infinity : Math.abs(d);
  };
  let c = right - ratio * (right - left), d = left + ratio * (right - left);
  for (let i = 0; i < 54; i++) {
    if (score(c) < score(d)) { right = d; d = c; c = right - ratio * (right - left); }
    else { left = c; c = d; d = left + ratio * (right - left); }
  }
  const x = (left + right) / 2;
  return score(x) <= 1e-6 * (1 + Math.abs(a(x) ?? 0) + Math.abs(b(x) ?? 0)) ? x : null;
}

export function analyzeCurves(a, b, xMin, xMax, count = 1600) {
  const step = (xMax - xMin) / count;
  const rows = Array.from({ length: count + 1 }, (_, i) => {
    const x = xMin + i * step, av = a(x), bv = b(x);
    return { x, av, bv, diff: av === null || bv === null ? null : av - bv, same: av !== null && bv !== null && close(av, bv) };
  });
  const overlaps = [];
  let run = null;
  for (let i = 0; i <= count + 1; i++) {
    if (i <= count && rows[i].same) { if (run === null) run = i; }
    else if (run !== null) {
      const end = i - 1;
      if (end - run >= Math.max(5, Math.ceil(count * .01))) overlaps.push([rows[run].x, rows[end].x]);
      run = null;
    }
  }
  const inOverlap = x => overlaps.some(([lo, hi]) => x >= lo - step && x <= hi + step);
  const points = [];
  const add = x => {
    if (x === null || inOverlap(x) || points.some(point => Math.abs(point.x - x) < step * .45)) return;
    const y = a(x);
    if (y !== null && b(x) !== null && close(y, b(x))) points.push({ x, y });
  };
  for (let i = 0; i < count; i++) {
    const p = rows[i], q = rows[i + 1];
    if (p.diff === null || q.diff === null) continue;
    if (Math.abs(p.diff) < 1e-9) add(p.x);
    if (p.diff * q.diff < 0) add(refineRoot(a, b, p.x, q.x));
  }
  for (let i = 1; i < count; i++) {
    const prev = rows[i - 1], cur = rows[i], next = rows[i + 1];
    if (prev.diff === null || cur.diff === null || next.diff === null || inOverlap(cur.x)) continue;
    if (Math.abs(cur.diff) <= Math.abs(prev.diff) && Math.abs(cur.diff) <= Math.abs(next.diff))
      add(refineTangent(a, b, prev.x, next.x));
  }
  points.sort((p, q) => p.x - q.x);
  return { points, overlaps, samples: rows };
}

function interpolate(p, q, a, b, t) {
  let low = 0, high = 1, lowD = p.d;
  for (let i = 0; i < 30; i++) {
    const ratio = (low + high) / 2;
    const x = p.x + ratio * (q.x - p.x), y = p.y + ratio * (q.y - p.y);
    const av = a(x, y, t), bv = b(x, y, t);
    if (av === null || bv === null) return null;
    const d = av - bv;
    if (Math.abs(d) < 1e-10) return { x, y };
    if (lowD * d <= 0) high = ratio;
    else { low = ratio; lowD = d; }
  }
  const ratio = (low + high) / 2;
  return { x: p.x + ratio * (q.x - p.x), y: p.y + ratio * (q.y - p.y) };
}

export function analyzeSurfaces(a, b, xMin, xMax, yMin, yMax, t, size = 65) {
  const xs = Array.from({ length: size }, (_, i) => xMin + i * (xMax - xMin) / (size - 1));
  const ys = Array.from({ length: size }, (_, i) => yMin + i * (yMax - yMin) / (size - 1));
  const zA = [], zB = [], diff = [];
  let valid = 0, same = 0;
  for (const y of ys) {
    const rowA = [], rowB = [], rowD = [];
    for (const x of xs) {
      const av = a(x, y, t), bv = b ? b(x, y, t) : null;
      rowA.push(av); rowB.push(bv); rowD.push(av === null || bv === null ? null : av - bv);
      if (av !== null && bv !== null) { valid++; if (close(av, bv)) same++; }
    }
    zA.push(rowA); zB.push(rowB); diff.push(rowD);
  }
  const line = { x: [], y: [], z: [] };
  if (b && !(valid > 0 && same / valid > .98)) {
    for (let j = 0; j < size - 1; j++) for (let i = 0; i < size - 1; i++) {
      const corners = [
        { x: xs[i], y: ys[j], d: diff[j][i] },
        { x: xs[i + 1], y: ys[j], d: diff[j][i + 1] },
        { x: xs[i + 1], y: ys[j + 1], d: diff[j + 1][i + 1] },
        { x: xs[i], y: ys[j + 1], d: diff[j + 1][i] }
      ];
      if (corners.some(c => c.d === null)) continue;
      const hits = [];
      for (let edge = 0; edge < 4; edge++) {
        const p = corners[edge], q = corners[(edge + 1) % 4];
        if ((p.d <= 0 && q.d >= 0) || (p.d >= 0 && q.d <= 0)) {
          const hit = interpolate(p, q, a, b, t);
          if (hit) hits.push(hit);
        }
      }
      if (hits.length < 2) continue;
      for (let k = 0; k + 1 < hits.length; k += 2) {
        const pair = [hits[k], hits[k + 1]].map(hit => {
          const av = a(hit.x, hit.y, t), bv = b(hit.x, hit.y, t);
          return { ...hit, av, bv };
        });
        if (pair.some(hit => hit.av === null || hit.bv === null || !close(hit.av, hit.bv))) continue;
        for (const hit of pair) {
          line.x.push(hit.x); line.y.push(hit.y); line.z.push((hit.av + hit.bv) / 2);
        }
        line.x.push(null); line.y.push(null); line.z.push(null);
      }
    }
  }
  return { xs, ys, zA, zB, line, valid, same, segments: line.x.length / 3 };
}
