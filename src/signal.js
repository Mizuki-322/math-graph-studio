import { evaluate, createWorkspace } from './core/index.js';
import { initMathKeyboard, refreshMathKeyboard } from './keyboard.js';
import { initMathInputs, refreshMathInputs } from './math-input.js';

const $ = id => document.getElementById(id);
const paper = '#121b2d', grid = '#2a3a53';
const font = { family: 'Inter, Segoe UI, Microsoft YaHei, sans-serif', color: '#aab9d5', size: 11 };
const config = { responsive: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'] };
const modes = {
  fourier: { expr: 'e^{-\\left|t\\right|}', t: [-10, 10], omega: [-12, 12] },
  laplace: { expr: 'e^{-t}\\sin\\left(4t\\right)', t: [0, 12], omega: [-12, 12], sigma: [-1, 1] }
};
const saved = {};
const workspace = createWorkspace();
let mode = 'fourier', view = 'magnitude', cached = null, rendering = false, queued = false, debounce;

function readContinuous() {
  return { expr: $('signalExpr').value, t: [$('tMin').value, $('tMax').value], omega: [$('omegaMin').value, $('omegaMax').value], sigma: [$('sigmaMin').value, $('sigmaMax').value] };
}
function fillContinuous(data) {
  $('signalExpr').value = data.expr;
  $('tMin').value = data.t[0]; $('tMax').value = data.t[1];
  $('omegaMin').value = data.omega[0]; $('omegaMax').value = data.omega[1];
  if (data.sigma) { $('sigmaMin').value = data.sigma[0]; $('sigmaMax').value = data.sigma[1]; }
}
function switchMode(next) {
  if (mode !== 'discrete') saved[mode] = readContinuous();
  mode = next; view = 'magnitude';
  document.querySelectorAll('.transform-mode').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  $('continuousFields').classList.toggle('hidden', mode === 'discrete');
  $('discreteFields').classList.toggle('hidden', mode !== 'discrete');
  $('sigmaFields').classList.toggle('hidden', mode !== 'laplace');
  $('zPanel').classList.toggle('hidden', mode !== 'discrete');
  $('resultSwitch').classList.toggle('hidden', mode === 'laplace');
  $('tMin').disabled = mode === 'laplace';
  if (mode !== 'discrete') fillContinuous(saved[mode] || modes[mode]);
  refreshMathKeyboard();
  refreshMathInputs();
  document.querySelectorAll('#resultSwitch button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  if (mode === 'fourier') {
    $('formulaText').innerHTML = 'F(ω) = ∫ x(t)e<sup>−jωt</sup> dt';
    $('formulaNote').textContent = '对有限时间窗进行梯形积分，因此显示的是窗内信号的近似频谱。';
  } else if (mode === 'laplace') {
    $('formulaText').innerHTML = 'F(s) = ∫₀ᵀ x(t)e<sup>−st</sup> dt，s = σ + jω';
    $('formulaNote').textContent = '热图是截断拉普拉斯积分的结果，不表示真实极点或收敛域。';
  } else {
    $('formulaText').innerHTML = 'X[k] = Σx[n]e<sup>−j2πkn/N</sup>　·　X(z) = Σx[n]z<sup>−n</sup>';
    $('formulaNote').textContent = 'DFT 幅度显示 |X[k]|/N。z 平面的单位圆上可读到相同的离散频率取样。';
  }
  calculate();
}
function baseLayout(xTitle, yTitle, extra = {}) {
  return { paper_bgcolor: paper, plot_bgcolor: paper, font,
    margin: { l: 62, r: 27, t: 25, b: 49 },
    xaxis: { title: xTitle, gridcolor: grid, zerolinecolor: '#61728e' },
    yaxis: { title: yTitle, gridcolor: grid, zerolinecolor: '#61728e' },
    showlegend: false, ...extra };
}
function lineTrace(x, y, color, name, options = {}) {
  return { x, y, type: 'scatter', mode: 'lines', name, line: { color, width: 2.8 }, hovertemplate: '%{x:.3f}<br>%{y:.4f}<extra></extra>', ...options };
}
async function drawSpectrum() {
  if (!cached) return;
  const isPhase = view === 'phase';
  const data = isPhase ? cached.phase : cached.magnitude;
  $('resultTitle').textContent = mode === 'discrete'
    ? (isPhase ? 'DFT 相位 ∠X[k]' : 'DFT 幅度谱 |X[k]| / N')
    : (isPhase ? '傅里叶相位 ∠F(ω)' : '傅里叶幅度谱 |F(ω)|');
  const title = isPhase ? '相位 / rad' : mode === 'discrete' ? '|X[k]| / N' : '|F(ω)|';
  const trace = mode === 'discrete'
    ? { x: cached.omega, y: data, type: 'bar', marker: { color: '#a995f7' }, width: cached.omega.length > 1 ? (cached.omega[1] - cached.omega[0]) * .66 : undefined, hovertemplate: 'ω=%{x:.3f}<br>值=%{y:.4f}<extra></extra>' }
    : lineTrace(cached.omega, data, '#ae99ff', title, { fill: isPhase ? 'none' : 'tozeroy', fillcolor: 'rgba(171,141,255,.13)' });
  const plotLayout = baseLayout('ω / rad·s⁻¹', title, isPhase ? { yaxis: { title, range: [-Math.PI, Math.PI], tickvals: [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI], ticktext: ['−π', '−π/2', '0', 'π/2', 'π'], gridcolor: grid, zerolinecolor: '#61728e' } } : {});
  await window.Plotly.react($('resultPlot'), [trace], plotLayout, config);
}
async function drawFourier(data) {
  const { signal, spectrum: result } = data;
  cached = result;
  $('mainTitle').textContent = '时域信号 x(t)'; $('mainBadge').textContent = `${signal.t.length} 个时间样本`;
  $('resultNote').textContent = `有限时间窗傅里叶积分：T = ${(signal.t.at(-1) - signal.t[0]).toFixed(2)}，N = ${signal.t.length}，Δt = ${signal.dt.toFixed(3)}。双侧角频率单位为 rad/s；窗边界会产生频谱泄漏。`;
  await window.Plotly.react($('mainPlot'), [lineTrace(signal.t, signal.x, '#70b3f7', 'x(t)')], baseLayout('t', 'x(t)'), config);
  await drawSpectrum();
}
async function drawLaplace(data) {
  const { signal, plane, slice } = data;
  cached = null;
  $('mainTitle').textContent = '复频率平面 |F(σ + jω)|'; $('mainBadge').textContent = 'σ + jω';
  $('resultTitle').textContent = 'σ = 0 截面 · 傅里叶幅度';
  $('resultNote').textContent = `单边截断积分：T = ${signal.t.at(-1).toFixed(2)}，N = ${signal.t.length}，Δt = ${signal.dt.toFixed(3)}。σ = 0 是窗内傅里叶截面；截断会掩盖真实极点与收敛域。`;
  const heat = { x: plane.sigma, y: plane.omega, z: plane.z, type: 'heatmap', colorscale: [[0, '#172642'], [.3, '#2f6195'], [.65, '#8b83cf'], [1, '#f2b770']], colorbar: { title: 'log₁₀(1+|F|)', tickfont: { color: '#aab9d5' }, titlefont: { color: '#aab9d5', size: 10 } }, hovertemplate: 'σ=%{x:.2f}<br>ω=%{y:.2f}<br>log 幅值=%{z:.3f}<extra></extra>' };
  await window.Plotly.react($('mainPlot'), [heat], baseLayout('实部 σ', '虚部 ω', { margin: { l: 62, r: 90, t: 20, b: 50 } }), config);
  await window.Plotly.react($('resultPlot'), [lineTrace(slice.omega, slice.magnitude, '#ae99ff', '|F(jω)|', { fill: 'tozeroy', fillcolor: 'rgba(171,141,255,.13)' })], baseLayout('ω / rad·s⁻¹', '|F(jω)|'), config);
}
async function drawDiscrete(data) {
  const { sequence, spectrum: result, plane, indices, unitCircle, samplePoints } = data;
  const n = sequence.length;
  cached = result;
  $('mainTitle').textContent = '离散序列 x[n]'; $('mainBadge').textContent = `N = ${n}`;
  $('resultNote').textContent = '显示双侧频率，间隔 Δω = 2π/N。幅度按 N 归一化；有限采样会带来频谱泄漏与混叠。';
  await window.Plotly.react($('mainPlot'), [{ x: indices, y: sequence, type: 'bar', marker: { color: '#73b6f3' }, width: .62, hovertemplate: 'n=%{x}<br>x[n]=%{y:.4f}<extra></extra>' }], baseLayout('n', 'x[n]'), config);
  await drawSpectrum();
  const heat = { x: plane.axis, y: plane.axis, z: plane.values, type: 'heatmap', colorscale: [[0, '#172642'], [.3, '#35679f'], [.7, '#a47db5'], [1, '#e6a567']], colorbar: { title: 'log₁₀(1+|X|)', tickfont: { color: '#aab9d5' }, titlefont: { color: '#aab9d5', size: 10 } }, hovertemplate: 'Re z=%{x:.2f}<br>Im z=%{y:.2f}<br>log 幅值=%{z:.3f}<extra></extra>' };
  const circle = { ...unitCircle, type: 'scatter', mode: 'lines', line: { color: '#f7d58b', width: 2 }, hoverinfo: 'skip', showlegend: false };
  const samples = { ...samplePoints, type: 'scatter', mode: 'markers', marker: { color: '#f9e5b2', size: 4 }, hovertemplate: 'DFT 取样点<br>Re z=%{x:.2f}<br>Im z=%{y:.2f}<extra></extra>', showlegend: false };
  await window.Plotly.react($('zPlot'), [heat, circle, samples], baseLayout('Re z', 'Im z', { margin: { l: 62, r: 90, t: 20, b: 50 }, xaxis: { title: 'Re z', range: [-1.6, 1.6], gridcolor: grid, scaleanchor: 'y', constrain: 'domain' }, yaxis: { title: 'Im z', range: [-1.6, 1.6], gridcolor: grid } }), config);
}
async function calculate() {
  if (rendering) { queued = true; return; }
  rendering = true; $('signalError').classList.add('hidden');
  try {
    if (!window.Plotly) throw new Error('数学图形库还在加载，请稍候重试。');
    if (mode === 'discrete') {
      const source = $('sequenceMode').value;
      const result = evaluate({ command: 'z', source, latex: source === 'list' ? $('sequenceList').value : $('sequenceExpr').value, count: $('sampleCount').value }, workspace);
      await drawDiscrete(result.value);
    } else {
      const result = evaluate({
        command: mode, latex: $('signalExpr').value,
        tRange: [$('tMin').value, $('tMax').value], omegaRange: [$('omegaMin').value, $('omegaMax').value],
        sigmaRange: [$('sigmaMin').value, $('sigmaMax').value]
      }, workspace);
      if (mode === 'fourier') await drawFourier(result.value);
      else await drawLaplace(result.value);
    }
  } catch (error) { $('signalError').textContent = error.message || '计算失败。'; $('signalError').classList.remove('hidden'); }
  finally { rendering = false; if (queued) { queued = false; calculate(); } }
}
function schedule() { clearTimeout(debounce); debounce = setTimeout(calculate, 500); }
document.querySelectorAll('.transform-mode').forEach(button => button.addEventListener('click', () => switchMode(button.dataset.mode)));
document.querySelectorAll('#resultSwitch button').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; document.querySelectorAll('#resultSwitch button').forEach(item => item.classList.toggle('active', item === button)); drawSpectrum(); }));
['signalExpr', 'tMin', 'tMax', 'omegaMin', 'omegaMax', 'sigmaMin', 'sigmaMax', 'sequenceExpr', 'sequenceList'].forEach(id => $(id).addEventListener('input', schedule));
$('sequenceMode').addEventListener('change', () => { const list = $('sequenceMode').value === 'list'; $('formulaFields').classList.toggle('hidden', list); $('listFields').classList.toggle('hidden', !list); $('sampleCount').disabled = list; refreshMathKeyboard(); refreshMathInputs(); calculate(); });
$('sampleCount').addEventListener('input', () => { $('sampleCountValue').textContent = $('sampleCount').value; schedule(); });
$('calculateBtn').addEventListener('click', calculate);
initMathKeyboard();
initMathInputs();
calculate();
