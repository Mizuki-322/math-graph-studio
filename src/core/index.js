import { compileLatex, parseLatexList } from './formula.js';
import { compileExpression, analyzeCurves, analyzeSurfaces } from './numerics.js';
import { curveCoordinates } from './curve.js';
import { sampleContinuous, spectrum, laplacePlane, sequenceFromFormula, discreteFourier, zPlane } from './transforms.js';
import { createWorkspace, workspaceValues } from './workspace.js';

export { createWorkspace } from './workspace.js';

const commands = new Map();

export function registerCommand(name, handler) {
  if (typeof name !== 'string' || !name || typeof handler !== 'function') throw new Error('命令需要名称和处理函数。');
  if (commands.has(name)) throw new Error(`命令 ${name} 已注册。`);
  commands.set(name, handler);
}

export function evaluate(input, workspace = createWorkspace()) {
  const request = typeof input === 'string' ? { command: 'formula', latex: input } : input;
  if (!request || typeof request !== 'object') throw new Error('请输入公式或命令。');
  const handler = commands.get(request.command || 'formula');
  if (!handler) throw new Error(`未知命令 ${request.command}。`);
  const result = handler(request, workspaceValues(workspace));
  if (!result || typeof result.type !== 'string' || !Object.hasOwn(result, 'value')) throw new Error('命令必须返回 {type, value}。');
  return result;
}

function numberRange(range, label, maxSpan) {
  const [lo, hi] = (range || []).map(Number);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) throw new Error(`${label}范围的最小值必须小于最大值。`);
  if (hi - lo > maxSpan) throw new Error(`${label}范围跨度请控制在 ${maxSpan} 以内。`);
  return [lo, hi];
}

function plotRange(range, label) {
  const [lo, hi] = (range || []).map(Number);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo >= hi) throw new Error(`${label}范围需要有效的最小值和最大值。`);
  if (hi - lo > 1000) throw new Error(`${label}范围请控制在 1000 以内，便于看清图像。`);
  return [lo, hi];
}

function plotCalculation(input, values) {
  const mode = input.mode || '2d';
  if (!['2d', '3d', '4d'].includes(mode)) throw new Error(`未知图像维度 ${mode}。`);
  const xRange = plotRange(input.xRange, 'x');
  const yRange = plotRange(input.yRange, 'y');
  const showB = Boolean(input.showB);
  const a = compileExpression(input.a, ['x', 'y', 't'], values);
  const b = showB ? compileExpression(input.b, ['x', 'y', 't'], values) : null;
  const time = mode === '4d' ? Number(input.time ?? 0) : 0;
  if (!Number.isFinite(time)) throw new Error('时间 t 需要有限实数值。');
  const expensive = a.hasCalculus || b?.hasCalculus;
  if (mode === '2d') {
    const analysis = analyzeCurves(a, b || (() => null), ...xRange, expensive ? 240 : 1600);
    return { mode, xRange, yRange, showB, time, analysis, a, b };
  }
  const analysis = analyzeSurfaces(a, b, ...xRange, ...yRange, time, expensive ? 25 : 65);
  return { mode, xRange, yRange, showB, time, analysis, a, b };
}

function signalCalculation(input, values, mode) {
  const tRange = numberRange(input.tRange, '时间', 40);
  const omegaRange = numberRange(input.omegaRange, '角频率', 60);
  if (mode === 'laplace' && tRange[0] !== 0) throw new Error('单边拉普拉斯积分从 t = 0 开始。');
  const formula = compileLatex(input.latex, ['t', ...Object.keys(values)]);
  const signal = sampleContinuous(t => formula.evaluate({ ...values, t }), ...tRange, formula.hasCalculus ? 151 : 401);
  if (Math.max(Math.abs(omegaRange[0]), Math.abs(omegaRange[1])) > Math.PI / signal.dt)
    throw new Error(`角频率超出采样奈奎斯特界限 ${Math.round(Math.PI / signal.dt)} rad/s。请缩小 ω 范围或时间窗。`);
  return { signal, omegaRange, tRange };
}

function discreteSequence(input, values) {
  if (input.source === 'list') return parseLatexList(input.latex);
  const count = Number(input.count);
  if (!Number.isInteger(count) || count < 2 || count > 64) throw new Error('序列长度需要是 2–64 的整数。');
  const formula = compileLatex(input.latex, ['n', ...Object.keys(values)]);
  return sequenceFromFormula(n => formula.evaluate({ ...values, n }), count);
}

registerCommand('formula', (input, values) => {
  const variables = [...new Set([...(input.variables || []), ...Object.keys(values)])];
  return { type: 'number', value: compileLatex(input.latex, variables).evaluate(values) };
});

registerCommand('validate-formula', (input, values) => {
  const variables = [...new Set([...(input.variables || []), ...Object.keys(values)])];
  const parsed = compileLatex(input.latex, variables);
  return { type: 'formula', value: { tree: parsed.tree, hasCalculus: parsed.hasCalculus } };
});

registerCommand('parse-list', input => ({ type: 'sequence', value: parseLatexList(input.latex) }));

registerCommand('intersections', (input, values) => {
  const result = plotCalculation(input, values);
  return { type: result.mode === '2d' ? 'curve-intersections' : 'surface-intersections', value: result.analysis };
});

registerCommand('plot', (input, values) => {
  const result = plotCalculation(input, values);
  const { a, b, ...data } = result;
  const { analysis } = data;
  if (result.mode === '2d') {
    data.coordinatesA = curveCoordinates(analysis.samples, 'av', a, ...result.yRange);
    data.coordinatesB = result.showB ? curveCoordinates(analysis.samples, 'bv', b, ...result.yRange) : null;
  }
  return { type: result.mode === '2d' ? 'curve' : 'surface', value: data };
});

registerCommand('fourier', (input, values) => {
  const data = signalCalculation(input, values, 'fourier');
  return { type: 'fourier', value: { ...data, spectrum: spectrum(data.signal, ...data.omegaRange) } };
});

registerCommand('laplace', (input, values) => {
  const data = signalCalculation(input, values, 'laplace');
  const sigmaRange = numberRange(input.sigmaRange, 'σ', 4);
  if (Math.max(Math.abs(sigmaRange[0]), Math.abs(sigmaRange[1])) * data.tRange[1] > 50)
    throw new Error('当前 σ 与时间范围会使指数项过大，请缩小范围。');
  return { type: 'laplace', value: {
    ...data, sigmaRange,
    plane: laplacePlane(data.signal, ...sigmaRange, ...data.omegaRange),
    slice: spectrum(data.signal, ...data.omegaRange)
  } };
});

registerCommand('dft', (input, values) => {
  const sequence = discreteSequence(input, values);
  return { type: 'dft', value: { sequence, spectrum: discreteFourier(sequence) } };
});

registerCommand('z', (input, values) => {
  const sequence = discreteSequence(input, values);
  const angles = Array.from({ length: 181 }, (_, i) => 2 * Math.PI * i / 180);
  const sampleAngles = Array.from({ length: sequence.length }, (_, i) => 2 * Math.PI * i / sequence.length);
  return { type: 'z', value: {
    sequence, indices: sequence.map((_, i) => i), spectrum: discreteFourier(sequence), plane: zPlane(sequence),
    unitCircle: { x: angles.map(Math.cos), y: angles.map(Math.sin) },
    samplePoints: { x: sampleAngles.map(Math.cos), y: sampleAngles.map(Math.sin) }
  } };
});
