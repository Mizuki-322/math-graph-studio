let launcher, panel, variableGrid, keyGrid, targetLabel, tabButtons;
let activeField = null;
let group = 'basic';

const key = (label, insert, name) => ({ label, insert, name });
const basicKeys = [
  key('7','7','数字 7'),key('8','8','数字 8'),key('9','9','数字 9'),key('\\frac{a}{b}','\\frac{#?}{#?}','分数'),key('a^b','#?^{#?}','幂'),
  key('4','4','数字 4'),key('5','5','数字 5'),key('6','6','数字 6'),key('\\sqrt{x}','\\sqrt{#?}','平方根'),key('\\sqrt[n]{x}','\\sqrt[#?]{#?}','n 次根'),
  key('1','1','数字 1'),key('2','2','数字 2'),key('3','3','数字 3'),key('+','+','加号'),key('-','-','减号'),
  key('0','0','数字 0'),key('.','.','小数点'),key('\\pi','\\pi','圆周率'),key('e','e','自然常数'),key('\\left(x\\right)','\\left(#?\\right)','括号')
];
const functionKeys = [
  key('\\sin x','\\sin\\left(#?\\right)','正弦'),key('\\cos x','\\cos\\left(#?\\right)','余弦'),key('\\tan x','\\tan\\left(#?\\right)','正切'),key('\\arcsin x','\\arcsin\\left(#?\\right)','反正弦'),key('\\arccos x','\\arccos\\left(#?\\right)','反余弦'),
  key('\\arctan x','\\arctan\\left(#?\\right)','反正切'),key('\\left|x\\right|','\\left|#?\\right|','绝对值'),key('\\ln x','\\ln\\left(#?\\right)','自然对数'),key('\\log_b x','\\log_{#?}\\left(#?\\right)','对数'),key('\\exp x','\\exp\\left(#?\\right)','指数函数'),
  key('\\lfloor x\\rfloor','\\left\\lfloor#?\\right\\rfloor','向下取整'),key('\\lceil x\\rceil','\\left\\lceil#?\\right\\rceil','向上取整'),key('a_b','#?_{#?}','下标'),key('\\frac{1}{x}','\\frac{1}{#?}','倒数'),key('\\times','\\times','乘号')
];
const calculusKeys = [
  key('\\sum','\\sum_{n=#?}^{#?}{#?}','求和'),key('\\prod','\\prod_{n=#?}^{#?}{#?}','连乘'),key('\\int_a^b','\\int_{#?}^{#?}{#?}\\,dx','定积分'),key('\\int_a^b\\,dt','\\int_{#?}^{#?}{#?}\\,dt','对 t 积分'),key('\\frac{a}{b}','\\frac{#?}{#?}','分数'),
  key('x^n','#?^{#?}','幂'),key('x_n','#?_{#?}','下标'),key('\\sqrt[n]{x}','\\sqrt[#?]{#?}','n 次根'),key('\\pi','\\pi','圆周率'),key('e','e','自然常数')
];
const listKeys = [
  key('7','7','数字 7'),key('8','8','数字 8'),key('9','9','数字 9'),key(', ',',','逗号'),key('\\left[\\right]','\\left[#?\\right]','方括号'),
  key('4','4','数字 4'),key('5','5','数字 5'),key('6','6','数字 6'),key('-','-','减号'),key('\\pi','\\pi','圆周率'),
  key('1','1','数字 1'),key('2','2','数字 2'),key('3','3','数字 3'),key('\\frac{a}{b}','\\frac{#?}{#?}','分数'),key('\\sqrt{x}','\\sqrt{#?}','平方根'),
  key('0','0','数字 0'),key('.','.','小数点'),key('+','+','加号'),key('e','e','自然常数'),key('\\left(x\\right)','\\left(#?\\right)','括号')
];

function usable(field) { return field?.matches('math-field[data-math-input]') && !field.disabled && field.getClientRects().length > 0; }
function chooseField() {
  if (usable(activeField)) return activeField;
  activeField = [...document.querySelectorAll('math-field[data-math-input]')].find(usable) || null;
  return activeField;
}
function isList() { return chooseField()?.dataset.keyboardKind === 'list'; }
function withField(action) { const field = chooseField(); if (field) { field.focus({ preventScroll: true }); action(field); } }
function insertMath(latex) { withField(field => field.insert(latex, { selectionMode: 'placeholder' })); }
function makeKey(definition) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'math-key';
  button.setAttribute('aria-label', `插入${definition.name}`); button.title = definition.name;
  window.katex.render(definition.label, button, { throwOnError: false, trust: false, strict: 'ignore' });
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', () => insertMath(definition.insert));
  return button;
}
function renderKeys() {
  const field = chooseField();
  targetLabel.textContent = field ? `当前输入：${field.dataset.keyboardLabel || field.id}` : '请先选择公式';
  const list = isList(); if (list) group = 'basic';
  tabButtons.forEach(button => { button.hidden = list && button.dataset.group !== 'basic'; button.classList.toggle('active', button.dataset.group === group); });
  const definitions = list ? listKeys : group === 'functions' ? functionKeys : group === 'calculus' ? calculusKeys : basicKeys;
  variableGrid.replaceChildren(); keyGrid.replaceChildren();
  if (!list && group === 'basic') {
    const variables = (field?.dataset.keyboardVars ?? 'x').split(/\s+/).filter(Boolean);
    for (const variable of variables) variableGrid.appendChild(makeKey(key(variable, variable, `变量 ${variable}`)));
    variableGrid.appendChild(makeKey(key('\\left|x\\right|','\\left|#?\\right|','绝对值')));
    variableGrid.appendChild(makeKey(key('\\sum','\\sum_{n=#?}^{#?}{#?}','求和')));
    variableGrid.appendChild(makeKey(key('\\int_a^b','\\int_{#?}^{#?}{#?}\\,dx','定积分')));
  }
  definitions.forEach(definition => keyGrid.appendChild(makeKey(definition)));
}
function setOpen(open) { panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open)); launcher.classList.toggle('active', open); if (open) renderKeys(); }
export function refreshMathKeyboard() { if (panel && !panel.hidden) renderKeys(); }
export function initMathKeyboard() {
  if (launcher) return;
  launcher = document.createElement('button'); launcher.type = 'button'; launcher.id = 'mathKeyboardToggle';
  launcher.className = 'math-keyboard-launcher'; launcher.textContent = '⌨ 数学键盘';
  launcher.setAttribute('aria-controls', 'mathKeyboardPanel'); launcher.setAttribute('aria-expanded', 'false');
  launcher.addEventListener('click', () => setOpen(panel.hidden));
  panel = document.createElement('section'); panel.id = 'mathKeyboardPanel'; panel.className = 'math-keyboard-panel'; panel.hidden = true;
  panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', '屏幕数学键盘');
  const header = document.createElement('div'); header.className = 'math-keyboard-header';
  const heading = document.createElement('div'); heading.innerHTML = '<strong>数学键盘</strong><span>点选符号，在公式内直接填写空格</span>';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'math-keyboard-close'; close.textContent = '×'; close.setAttribute('aria-label', '关闭数学键盘'); close.addEventListener('click', () => setOpen(false));
  header.append(heading, close);
  targetLabel = document.createElement('div'); targetLabel.className = 'math-keyboard-target';
  const tabs = document.createElement('div'); tabs.className = 'math-keyboard-tabs';
  tabButtons = [['basic','常用'],['functions','函数'],['calculus','求和与积分']].map(([name,label]) => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.group = name; button.textContent = label;
    button.addEventListener('click', () => { group = name; renderKeys(); }); tabs.appendChild(button); return button;
  });
  variableGrid = document.createElement('div'); variableGrid.className = 'math-keyboard-variable-row';
  keyGrid = document.createElement('div'); keyGrid.className = 'math-keyboard-grid';
  const actions = document.createElement('div'); actions.className = 'math-keyboard-actions';
  for (const [label, action] of [
    ['⌫ 删除', field => field.executeCommand('deleteBackward')],
    ['←', field => field.executeCommand('moveToPreviousChar')],
    ['→', field => field.executeCommand('moveToNextChar')],
    ['清空', field => field.setValue('')],
    ['生成 / 计算 ↗', () => document.querySelector('#drawBtn, #calculateBtn')?.click()]
  ]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('pointerdown', event => event.preventDefault());
    button.addEventListener('click', () => withField(action)); actions.appendChild(button);
  }
  panel.append(header, targetLabel, tabs, variableGrid, keyGrid, actions);
  document.body.append(launcher, panel);
  document.addEventListener('focusin', event => { if (event.target.matches?.('math-field[data-math-input]')) { activeField = event.target; refreshMathKeyboard(); } });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); });
}
