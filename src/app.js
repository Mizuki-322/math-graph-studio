import { evaluate, createWorkspace } from './core/index.js';
import { drawCurve, drawSurface } from './graph.js';
import { initMathKeyboard, refreshMathKeyboard } from './keyboard.js';
import { initMathInputs, refreshMathInputs } from './math-input.js';

const $ = id => document.getElementById(id);
const examples = {
  '2d': { a: '\\sin x', b: '\\cos x', x: [-10, 10], y: [-3, 3], hint: '输入 y = f(x)，查看平面中的函数曲线。', title: '二维函数曲线' },
  '3d': { a: '\\sin\\left(\\sqrt{x^2+y^2}\\right)', b: '0.25x', x: [-6, 6], y: [-6, 6], hint: '输入 z = f(x,y)，旋转观察空间曲面。', title: '三维函数曲面' },
  '4d': { a: '\\sin\\left(\\sqrt{x^2+y^2}-t\\right)', b: '0.25x', x: [-6, 6], y: [-6, 6], hint: '输入 z = f(x,y,t)，用时间轴观察曲面变化。', title: '随时间变化的三维曲面' }
};
const memory = {};
const workspace = createWorkspace();
let mode = '2d', debounce, playing = null, rendering = false, queued = false;

function formValues() {
  return { a: $('exprA').value, b: $('exprB').value, x: [$('xMin').value, $('xMax').value], y: [$('yMin').value, $('yMax').value] };
}
function fillForm(data) {
  $('exprA').value = data.a; $('exprB').value = data.b;
  $('xMin').value = data.x[0]; $('xMax').value = data.x[1];
  $('yMin').value = data.y[0]; $('yMax').value = data.y[1];
}
function setMode(next) {
  if (next !== mode) memory[mode] = formValues();
  mode = next;
  fillForm(memory[mode] || examples[mode]);
  document.querySelectorAll('.mode').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  $('modeHint').textContent = examples[mode].hint;
  $('graphTitle').textContent = examples[mode].title;
  $('timeSection').classList.toggle('hidden', mode !== '4d');
  $('evaluatePanel').classList.toggle('hidden', mode !== '2d');
  $('prefixA').textContent = mode === '2d' ? 'y =' : 'z =';
  $('prefixB').textContent = mode === '2d' ? 'y =' : 'z =';
  for (const field of [$('exprA'), $('exprB')]) {
    field.dataset.keyboardVars = mode === '2d' ? 'x' : mode === '3d' ? 'x y' : 'x y t';
  }
  $('yMinLabel').textContent = mode === '2d' ? 'y 最小（视窗）' : 'y 最小';
  $('yMaxLabel').textContent = mode === '2d' ? 'y 最大（视窗）' : 'y 最大';
  stopPlaying();
  refreshMathKeyboard();
  refreshMathInputs();
  render();
}
function fmt(n) { return Math.abs(n) < .00005 ? '0' : Number(n.toFixed(4)).toString(); }
function updateEvaluation() {
  if (mode !== '2d') return;
  const output = $('evalResult');
  try {
    const x = evaluate($('evalX').value).value;
    if (x === null) throw new Error('代入值需要是有限实数。');
    workspace.set('x', x);
    const value = evaluate({ command: 'formula', latex: $('exprA').value, variables: ['x', 'y', 't'] }, workspace).value;
    if (value === null) throw new Error('函数在该点无定义。');
    window.katex.render(`f\\left(${fmt(x)}\\right)=${fmt(value)}`, output, { throwOnError: false, trust: false });
  } catch (error) { output.textContent = error.message || '无法求值。'; }
}
function setResult(badge, content, className = '') {
  $('relationBadge').textContent = badge;
  $('relationBadge').className = `relation-badge ${className}`;
  $('results').innerHTML = content;
}
function renderCurveResults(analysis, yMin, yMax) {
  const points = analysis.points.filter(p => p.y >= yMin && p.y <= yMax);
  const overlaps = analysis.overlaps;
  if (overlaps.length) {
    const ranges = overlaps.map(([lo, hi]) => `<span class="point-pill">x ∈ [${fmt(lo)}, ${fmt(hi)}]</span>`).join('');
    const pointText = points.length ? `；另有 ${points.length} 个独立交点` : '';
    setResult('存在重合', `<p class="result-summary">在当前 x 范围内检测到 ${overlaps.length} 段重合区间${pointText}。绿色线段表示重合部分。</p><div class="point-list">${ranges}</div><div class="note">区间端点由采样估计，局部重合或窄区间可能被漏检。</div>`, 'overlap');
  } else if (points.length) {
    const shown = points.slice(0, 16).map(p => `<span class="point-pill">(${fmt(p.x)}, ${fmt(p.y)})</span>`).join('');
    setResult(`${points.length} 个交点`, `<p class="result-summary">在当前视窗内找到 ${points.length} 个交点，图中以金色圆点标记。</p><div class="point-list">${shown}</div>${points.length > 16 ? '<div class="note">仅列出前 16 个交点。</div>' : ''}<div class="note">数值搜索可能漏掉极近、极窄或不连续处的交点。</div>`);
  } else setResult('未发现交点', '<p class="result-summary">当前观察范围内未检测到交点或重合区间。</p><div class="note">扩大观察范围，或检查函数是否只在不连续点附近接近。</div>', 'none');
}
function renderSurfaceResults(analysis, time) {
  if (analysis.valid === 0) {
    setResult('无法比较', '<p class="result-summary">两个曲面在当前范围内没有共同的有效取值。</p>', 'none'); return;
  }
  const timeText = mode === '4d' ? `、时间 t = ${fmt(time)} 时` : '内';
  if (analysis.same / analysis.valid > .98) {
    setResult('曲面重合', `<p class="result-summary">在当前采样范围${timeText}，两个曲面几乎处处重合。</p><div class="note">这是采样判断；细小差异可能无法显示。</div>`, 'overlap');
  } else if (analysis.segments) {
    setResult('存在相交线', `<p class="result-summary">在当前范围${timeText}检测到曲面相交，金色线段描绘近似交线。</p><div class="note">交线由网格插值生成；缩小范围可查看更多细节。</div>`);
  } else setResult('未发现相交', `<p class="result-summary">当前范围${timeText}未检测到两个曲面的交线。</p><div class="note">细小或仅切触的交线可能被采样漏掉。</div>`, 'none');
}
async function render() {
  if (rendering) { queued = true; return; }
  rendering = true;
  $('error').classList.add('hidden');
  try {
    if (!window.Plotly || !window.katex) throw new Error('图形库尚未加载完成，请稍候重试。');
    const showB = $('showB').checked;
    const time = mode === '4d' ? Number($('timeSlider').value) : 0;
    const result = evaluate({
      command: 'plot', mode, a: $('exprA').value, b: $('exprB').value, showB,
      xRange: [$('xMin').value, $('xMax').value], yRange: [$('yMin').value, $('yMax').value], time
    }, workspace).value;
    const { analysis, xRange: [xMin, xMax], yRange: [yMin, yMax] } = result;
    updateEvaluation();
    $('graphMeta').textContent = mode === '4d' ? `t = ${fmt(time)}` : `x ∈ [${fmt(xMin)}, ${fmt(xMax)}]`;
    if (mode === '2d') {
      await drawCurve($('plot'), result);
      $('pointCount').textContent = `${analysis.samples.length} 个采样点`;
      if (showB) renderCurveResults(analysis, yMin, yMax);
    } else {
      await drawSurface($('plot'), result);
      $('pointCount').textContent = `${analysis.xs.length} × ${analysis.ys.length} 网格`;
      if (showB) renderSurfaceResults(analysis, time);
    }
    if (!showB) setResult('未启用对比', '<p class="result-summary">打开“对比”并输入函数 B，即可查看交点、交线或重合区间。</p>', 'none');
  } catch (error) {
    $('error').textContent = error.message || '生成图像时发生错误。';
    $('error').classList.remove('hidden');
    setResult('等待修正', '<p class="result-summary">请修正左侧输入后重新生成图像。</p>', 'none');
  } finally {
    rendering = false;
    if (queued) { queued = false; render(); }
  }
}
function scheduleRender() { clearTimeout(debounce); debounce = setTimeout(render, 450); }
function stopPlaying() { if (playing) { clearInterval(playing); playing = null; } $('playBtn').textContent = '▶ 播放'; }

document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
['exprA', 'exprB', 'xMin', 'xMax', 'yMin', 'yMax'].forEach(id => $(id).addEventListener('input', scheduleRender));
$('showB').addEventListener('change', () => { $('exprBBox').classList.toggle('disabled', !$('showB').checked); $('exprB').disabled = !$('showB').checked; $('exprBError').classList.toggle('hidden', !$('showB').checked); render(); });
$('drawBtn').addEventListener('click', render);
$('resetBtn').addEventListener('click', () => { fillForm(examples[mode]); refreshMathInputs(); render(); });
$('evalX').addEventListener('input', () => { try { updateEvaluation(); } catch { $('evalResult').textContent = '请先完善函数 A。'; } });
$('timeSlider').addEventListener('input', () => { $('timeValue').textContent = Number($('timeSlider').value).toFixed(2); scheduleRender(); });
$('playBtn').addEventListener('click', () => {
  if (playing) { stopPlaying(); return; }
  $('playBtn').textContent = 'Ⅱ 暂停';
  playing = setInterval(() => {
    const slider = $('timeSlider');
    let next = Number(slider.value) + .24;
    if (next > Number(slider.max)) next = Number(slider.min);
    slider.value = next;
    $('timeValue').textContent = next.toFixed(2);
    render();
  }, 300);
});
window.addEventListener('beforeunload', stopPlaying);
initMathKeyboard();
initMathInputs();
render();
