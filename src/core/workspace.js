export class VariableWorkspace {
  #values = new Map();

  constructor(initial = {}) {
    for (const [name, value] of Object.entries(initial)) this.set(name, value);
  }

  set(name, value) {
    if (typeof name !== 'string' || !name.trim()) throw new Error('变量名不能为空。');
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`变量 ${name} 需要有限实数值。`);
    this.#values.set(name, value);
    return this;
  }

  get(name) { return this.#values.get(name); }
  has(name) { return this.#values.has(name); }
  delete(name) { return this.#values.delete(name); }
  snapshot() { return Object.fromEntries(this.#values); }
  fork(overrides = {}) { return new VariableWorkspace({ ...this.snapshot(), ...overrides }); }
}

export function createWorkspace(initial) { return new VariableWorkspace(initial); }

export function workspaceValues(workspace) {
  if (workspace instanceof VariableWorkspace) return workspace.snapshot();
  if (workspace == null) return {};
  if (typeof workspace !== 'object' || Array.isArray(workspace)) throw new Error('变量工作区需要是对象。');
  return new VariableWorkspace(workspace).snapshot();
}
