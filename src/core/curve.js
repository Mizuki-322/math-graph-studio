export function curveCoordinates(rows, name, fn, yMin, yMax) {
  const x = [], y = [], span = yMax - yMin;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i], value = row[name];
    if (i > 0 && fn && value !== null && rows[i - 1][name] !== null) {
      const previous = rows[i - 1], left = previous[name];
      const midpoint = fn((previous.x + row.x) / 2);
      const jump = Math.abs(value - left) > Math.max(span * 1.4, 2)
        && Math.sign(value) !== Math.sign(left);
      const curved = midpoint === null || Math.abs(midpoint - (left + value) / 2) > Math.max(span, Math.abs(value - left) * 2);
      if (jump || curved) { x.push(null); y.push(null); }
    }
    x.push(row.x); y.push(value);
  }
  return { x, y };
}
