import { create, all } from 'mathjs';

export const math = create(all);

math.import({
  ln: math.log,
  log10: math.log10,
  log2: math.log2
}, { override: true });

export const evaluate = (formula: string, scope: Record<string, number>): number => {
  if (!formula || !formula.trim()) return NaN;

  try {
    const fullScope: Record<string, number> = { ...scope };

    if ('t' in scope && !('x' in scope)) fullScope.x = scope.t;
    if ('x' in scope && !('t' in scope)) fullScope.t = scope.x;

    if ('x' in fullScope) fullScope.X = fullScope.x;
    if ('t' in fullScope) fullScope.T = fullScope.t;
    if ('y' in fullScope) fullScope.Y = fullScope.y;
    if ('z' in fullScope) fullScope.Z = fullScope.z;

    const result = math.evaluate(formula, fullScope);

    if (typeof result === 'number' && !Number.isFinite(result)) {
      const epsilon = 1e-10;
      const offsetScope = { ...fullScope };
      if ('x' in offsetScope) offsetScope.x += epsilon;
      if ('t' in offsetScope) offsetScope.t += epsilon;
      if ('X' in offsetScope) offsetScope.X += epsilon;
      if ('T' in offsetScope) offsetScope.T += epsilon;

      const offsetResult = math.evaluate(formula, offsetScope);
      if (Number.isFinite(offsetResult)) return offsetResult;
    }

    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes('Unexpected end of expression') &&
        !message.includes('Value expected') &&
        !message.includes('Unexpected operator') &&
        !message.includes('Undefined symbol') &&
        !message.includes('Parenthesis ) expected') &&
        !message.includes('Too few arguments')) {
      console.error('Math evaluation error:', e);
    }
    return NaN;
  }
};

export const numericalDerivative = (formula: string, x: number): number => {
  const h = Math.max(1e-7, Math.abs(x) * 1e-7);
  const f_plus = evaluate(formula, { x: x + h });
  const f_minus = evaluate(formula, { x: x - h });
  if (isNaN(f_plus) || isNaN(f_minus)) return NaN;
  return (f_plus - f_minus) / (2 * h);
};

export const parseParam = (val: string | number | undefined): number => {
  if (val === undefined || val === null || val === '') return NaN;
  if (typeof val === 'number') return val;
  try {
    return math.evaluate(val);
  } catch (e) {
    return NaN;
  }
};
