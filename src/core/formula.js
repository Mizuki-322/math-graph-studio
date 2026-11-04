import { ComputeEngine } from '@cortex-js/compute-engine';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const CALCULUS = new Set(['Sum', 'Product', 'Integrate']);

function containsCalculus(node) {
  return Array.isArray(node) && (CALCULUS.has(node[0]) || node.slice(1).some(containsCalculus));
}

function missingMessage(node) {
  if (!Array.isArray(node)) return null;
  if (node[0] === 'Integrate') {
    const limits = node.find(part => Array.isArray(part) && part[0] === 'Limits');
    if (!limits || limits[2] === 'Nothing') return '缺少积分下限。';
    if (limits[3] === 'Nothing') return '缺少积分上限。';
    const body = node[1];
    if (JSON.stringify(body).includes('"Nothing"')) return '缺少被积函数。';
  }
  if (node[0] === 'Sum' || node[0] === 'Product') {
    const label = node[0] === 'Sum' ? '求和' : '连乘';
    const limits = node.find(part => Array.isArray(part) && part[0] === 'Limits');
    if (!limits || limits[2] === 'Nothing') return `缺少${label}下限。`;
    if (limits[3] === 'Nothing') return `缺少${label}上限。`;
    if (node[1] === 'Nothing') return `缺少${label}的表达式。`;
  }
  if (node[0] === 'Error') return '公式中有无法识别的符号或结构。';
  if (node[0] === 'Divide' && node[2] === 'Nothing') return '缺少分母。';
  if (node[0] === 'Power' && node[2] === 'Nothing') return '缺少指数。';
  for (const part of node.slice(1)) {
    const message = missingMessage(part);
    if (message) return message;
  }
  return null;
}

function unwrapIntegralBody(node) {
  if (Array.isArray(node) && node[0] === 'Function') return unwrapIntegralBody(node[1]);
  if (Array.isArray(node) && node[0] === 'Block' && node.length === 2) return node[1];
  return node;
}

function simpson(fn, left, right, tolerance = 1e-6) {
  if (left === right) return 0;
  if (left > right) return -simpson(fn, right, left, tolerance);
  let calls = 0;
  const sample = x => {
    if (++calls > 4096) throw new Error('积分计算量过大，请缩小区间。');
    const value = fn(x);
    if (!finite(value)) throw new Error('积分区间内存在无定义的取值。');
    return value;
  };
  const mid = (left + right) / 2;
  const a = sample(left), b = sample(mid), c = sample(right);
  const area = (right - left) * (a + 4 * b + c) / 6;
  function refine(lo, hi, fa, fm, fb, whole, tol, depth) {
    const center = (lo + hi) / 2;
    const fl = sample((lo + center) / 2), fr = sample((center + hi) / 2);
    const l = (center - lo) * (fa + 4 * fl + fm) / 6;
    const r = (hi - center) * (fm + 4 * fr + fb) / 6;
    if (depth === 0 || Math.abs(l + r - whole) <= 15 * tol) return l + r + (l + r - whole) / 15;
    return refine(lo, center, fa, fl, fm, l, tol / 2, depth - 1)
      + refine(center, hi, fm, fr, fb, r, tol / 2, depth - 1);
  }
  return refine(left, right, a, b, c, area, tolerance, 13);
}

export function compileLatex(source, variables, Engine = ComputeEngine) {
  const latex = String(source || '').trim();
  if (!latex) throw new Error('请输入公式。');
  if (/\\frac\{\\placeholder\{\}\}/.test(latex)) throw new Error('缺少分子，请填写分数上方的空格。');
  if (/\\frac\{[^}]+\}\{\\placeholder\{\}\}/.test(latex)) throw new Error('缺少分母，请填写分数下方的空格。');
  if (/\\sqrt(?:\[[^\]]*\])?\{\\placeholder\{\}\}/.test(latex)) throw new Error('缺少根号内的表达式。');
  const ce = new Engine();
  const expression = ce.parse(latex);
  const tree = expression.json;
  const specific = missingMessage(tree);
  if (specific) throw new Error(specific);
  if (latex.includes('\\placeholder') || JSON.stringify(tree).includes('"Nothing"')) throw new Error('请填完公式中的空格。');
  if (!expression.isValid || expression.errors?.length) throw new Error('公式无法解析，请检查括号、运算符和函数参数。');
  const unknowns = expression.unknowns || [];
  const invalid = unknowns.filter(name => !variables.includes(name));
  if (invalid.length) throw new Error(`未知变量 ${invalid.join('、')}；当前可使用 ${variables.join('、') || '常数'}。`);

  const cache = new Map();
  const hasCalculus = containsCalculus(tree);
  function createEvaluator(node) {
    if (!containsCalculus(node)) {
      const numericEngine = new Engine();
      const boxed = numericEngine.expr(node);
      return scope => {
        for (const [name, value] of Object.entries(scope)) numericEngine.assign(name, value);
        const result = boxed.N().valueOf();
        return finite(result) ? result : null;
      };
    }
    const [head, ...args] = node;
    if (head === 'Sum' || head === 'Product') {
      const limits = args.find(part => Array.isArray(part) && part[0] === 'Limits');
      const index = limits?.[1];
      if (typeof index !== 'string') throw new Error('求和或连乘的下标必须是变量。');
      const body = createEvaluator(args[0]);
      const lower = createEvaluator(limits[2]);
      const upper = createEvaluator(limits[3]);
      return scope => {
        const lo = lower(scope), hi = upper(scope);
        if (!finite(lo) || !finite(hi) || !Number.isInteger(lo) || !Number.isInteger(hi)) throw new Error('求和与连乘的上下限必须是整数。');
        if (hi - lo > 2000) throw new Error('求和或连乘最多支持 2001 项。');
        if (hi < lo) return head === 'Sum' ? 0 : 1;
        let result = head === 'Sum' ? 0 : 1;
        for (let n = lo; n <= hi; n++) {
          const term = body({ ...scope, [index]: n });
          if (term === null) return null;
          result = head === 'Sum' ? result + term : result * term;
          if (!finite(result)) return null;
        }
        return result;
      };
    }
    if (head === 'Integrate') {
      const limits = args.find(part => Array.isArray(part) && part[0] === 'Limits');
      const variable = limits?.[1];
      if (typeof variable !== 'string') throw new Error('积分需要明确微分变量，例如 dx。');
      const body = createEvaluator(unwrapIntegralBody(args[0]));
      const lower = createEvaluator(limits[2]);
      const upper = createEvaluator(limits[3]);
      return scope => {
        const lo = lower(scope), hi = upper(scope);
        if (!finite(lo) || !finite(hi)) return null;
        if (Math.abs(hi - lo) > 1000) throw new Error('积分区间过大，请缩小范围。');
        return simpson(value => body({ ...scope, [variable]: value }), lo, hi);
      };
    }
    const parts = args.map(createEvaluator);
    return scope => {
      const values = parts.map(part => part(scope));
      if (values.some(value => value === null)) return null;
      const result = ce.expr([head, ...values]).N().valueOf();
      return finite(result) ? result : null;
    };
  }
  const evaluateTree = createEvaluator(tree);
  return {
    tree, hasCalculus,
    evaluate(scope = {}) {
      const cacheKey = hasCalculus ? JSON.stringify(unknowns.map(name => scope[name] ?? 0)) : null;
      if (cacheKey !== null && cache.has(cacheKey)) return cache.get(cacheKey);
      const values = Object.fromEntries(variables.map(name => [name, scope[name] ?? 0]));
      const value = evaluateTree(values);
      if (cacheKey !== null) {
        if (cache.size >= 10000) cache.clear();
        cache.set(cacheKey, value);
      }
      return value;
    }
  };
}

export function parseLatexList(source, Engine = ComputeEngine) {
  const ce = new Engine();
  const expr = ce.parse(String(source || ''));
  const tree = expr.json;
  if (!Array.isArray(tree) || tree[0] !== 'List') throw new Error('请用方括号输入数值列表，例如 [1, 0, −1, 0]。');
  if (tree.length < 3 || tree.length > 65) throw new Error('数值列表需要 2–64 个样本。');
  return tree.slice(1).map(item => {
    const value = ce.expr(item).N().valueOf();
    if (!finite(value)) throw new Error('数值列表只能包含有限实数。');
    return value;
  });
}
