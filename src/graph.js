const paper = '#121b2d';
const grid = '#273952';
const font = { family: 'Inter, Segoe UI, Microsoft YaHei, sans-serif', color: '#aab9d5', size: 11 };
const config = { responsive: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'] };

export async function drawCurve(plot, result) {
  const { analysis, coordinatesA: coordsA, coordinatesB, xRange: [xMin, xMax], yRange: [yMin, yMax], showB } = result;
  const rows = analysis.samples;
  const traces = [
    { ...coordsA, type: 'scatter', mode: 'lines', name: '函数 A', line: { color: '#74a8ff', width: 3 }, connectgaps: false, hovertemplate: 'A: x=%{x:.3f}<br>y=%{y:.3f}<extra></extra>' }
  ];
  if (showB) {
    traces.push({ ...coordinatesB, type: 'scatter', mode: 'lines', name: '函数 B', line: { color: '#b990ff', width: 3 }, connectgaps: false, hovertemplate: 'B: x=%{x:.3f}<br>y=%{y:.3f}<extra></extra>' });
    for (const [lo, hi] of analysis.overlaps) {
      const segment = rows.filter(r => r.x >= lo && r.x <= hi);
      traces.push({ x: segment.map(r => r.x), y: segment.map(r => r.av), type: 'scatter', mode: 'lines', name: '重合区间', showlegend: false, line: { color: '#54e1bf', width: 6 }, hovertemplate: '重合: x=%{x:.3f}<br>y=%{y:.3f}<extra></extra>' });
    }
    const visible = analysis.points.filter(p => p.y >= yMin && p.y <= yMax);
    if (visible.length) traces.push({ x: visible.map(p => p.x), y: visible.map(p => p.y), type: 'scatter', mode: 'markers', name: '交点', marker: { color: '#ffcf7d', size: 10, line: { color: '#182338', width: 2 } }, hovertemplate: '交点 (%{x:.4f}, %{y:.4f})<extra></extra>' });
  }
  const layout = {
    paper_bgcolor: paper, plot_bgcolor: paper, font,
    margin: { l: 56, r: 25, t: 28, b: 47 },
    xaxis: { title: 'x', range: [xMin, xMax], zerolinecolor: '#516783', gridcolor: grid, linecolor: grid, tickfont: font },
    yaxis: { title: 'y', range: [yMin, yMax], zerolinecolor: '#516783', gridcolor: grid, linecolor: grid, tickfont: font },
    legend: { orientation: 'h', x: 0, y: 1.13, bgcolor: 'rgba(0,0,0,0)', font: { color: '#becbe0', size: 11 } },
    hovermode: 'closest', uirevision: 'curve'
  };
  await window.Plotly.react(plot, traces, layout, config);
}

export async function drawSurface(plot, result) {
  const { analysis, xRange: [xMin, xMax], yRange: [yMin, yMax], showB } = result;
  const traces = [{
    x: analysis.xs, y: analysis.ys, z: analysis.zA, type: 'surface', name: '函数 A', showscale: false,
    opacity: showB ? .75 : .94, colorscale: [[0, '#235b9e'], [.5, '#448bd6'], [1, '#8cc9f6']], hovertemplate: 'A: x=%{x:.2f}<br>y=%{y:.2f}<br>z=%{z:.3f}<extra></extra>'
  }];
  if (showB && analysis.valid > 0 && analysis.same / analysis.valid <= .98) {
    traces.push({ x: analysis.xs, y: analysis.ys, z: analysis.zB, type: 'surface', name: '函数 B', showscale: false, opacity: .55, colorscale: [[0, '#6b397f'], [.5, '#a164ba'], [1, '#dea9ef']], hovertemplate: 'B: x=%{x:.2f}<br>y=%{y:.2f}<br>z=%{z:.3f}<extra></extra>' });
    if (analysis.line.x.length) traces.push({ x: analysis.line.x, y: analysis.line.y, z: analysis.line.z, type: 'scatter3d', mode: 'lines', name: '相交线', line: { color: '#ffdc86', width: 7 }, hovertemplate: '相交线: (%{x:.2f}, %{y:.2f}, %{z:.2f})<extra></extra>' });
  }
  const layout = {
    paper_bgcolor: paper, font, margin: { l: 0, r: 0, t: 0, b: 0 },
    scene: {
      xaxis: { title: 'x', range: [xMin, xMax], backgroundcolor: '#172238', gridcolor: grid, zerolinecolor: '#516783', color: '#9fb2d1' },
      yaxis: { title: 'y', range: [yMin, yMax], backgroundcolor: '#172238', gridcolor: grid, zerolinecolor: '#516783', color: '#9fb2d1' },
      zaxis: { title: 'z', backgroundcolor: '#172238', gridcolor: grid, zerolinecolor: '#516783', color: '#9fb2d1' },
      bgcolor: paper, aspectmode: 'cube', camera: { eye: { x: 1.45, y: 1.4, z: .9 } }
    },
    showlegend: false, uirevision: 'surface'
  };
  await window.Plotly.react(plot, traces, layout, config);
}
