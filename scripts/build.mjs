import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const out = join(root, 'dist');
await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'vendor'), { recursive: true });
await cp(join(root, 'src'), out, { recursive: true, force: true });
await cp(join(root, 'node_modules', 'plotly.js-dist-min', 'plotly.min.js'), join(out, 'vendor', 'plotly.min.js'));
await cp(join(root, 'node_modules', 'katex', 'dist', 'katex.min.js'), join(out, 'vendor', 'katex.min.js'));
await cp(join(root, 'node_modules', 'katex', 'dist', 'katex.min.css'), join(out, 'vendor', 'katex.min.css'));
await cp(join(root, 'node_modules', 'katex', 'dist', 'fonts'), join(out, 'vendor', 'fonts'), { recursive: true, force: true });
await mkdir(join(out, 'vendor', 'mathlive'), { recursive: true });
await cp(join(root, 'node_modules', 'mathlive', 'mathlive.min.mjs'), join(out, 'vendor', 'mathlive', 'mathlive.min.js'));
await cp(join(root, 'node_modules', 'mathlive', 'fonts'), join(out, 'vendor', 'mathlive', 'fonts'), { recursive: true, force: true });
await cp(join(root, 'node_modules', '@cortex-js', 'compute-engine', 'dist', 'esm-min'), join(out, 'vendor', 'compute-engine'), { recursive: true, force: true });
console.log('Built dist with local MathLive, Compute Engine, Plotly, and KaTeX assets.');
