import { MathfieldElement } from './vendor/mathlive/mathlive.min.js';
import { evaluate } from './core/index.js';

MathfieldElement.fontsDirectory = './fonts';
MathfieldElement.soundsDirectory = null;
MathfieldElement.plonkSound = null;

export function initMathInputs() {
  for (const field of document.querySelectorAll('math-field[data-math-input]')) {
    field.mathVirtualKeyboardPolicy = 'manual';
    field.smartFence = true;
    field.addEventListener('input', () => validateMathInput(field));
    validateMathInput(field);
  }
}

export function validateMathInput(field) {
  const error = document.getElementById(`${field.id}Error`);
  if (!error) return true;
  try {
    if (field.dataset.keyboardKind === 'list') evaluate({ command: 'parse-list', latex: field.value });
    else {
      const variables = (field.dataset.keyboardVars || '').split(/\s+/).filter(Boolean);
      evaluate({ command: 'validate-formula', latex: field.value, variables });
    }
    error.textContent = '';
    error.classList.add('hidden');
    field.classList.remove('invalid');
    return true;
  } catch (problem) {
    error.textContent = problem.message || '公式无法解析。';
    error.classList.remove('hidden');
    field.classList.add('invalid');
    return false;
  }
}

export function refreshMathInputs() {
  for (const field of document.querySelectorAll('math-field[data-math-input]')) {
    if (!field.closest('.hidden')) validateMathInput(field);
  }
}
