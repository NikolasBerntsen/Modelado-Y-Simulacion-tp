import { AlgorithmParams, AlgorithmOutput, IterationResult } from '../../types';
import { evaluate, parseParam } from './shared';

export const bisection = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, tolerance, maxIterations } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);

  if (isNaN(a) || isNaN(b)) return { root: null, iterations: [], converged: false, errorMsg: 'A y B son requeridos y deben ser válidos' };

  let fa = evaluate(formula, { x: a });
  let fb = evaluate(formula, { x: b });

  if (isNaN(fa) || isNaN(fb)) {
    return { root: null, iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };
  }

  if (fa * fb > 0) {
    return { root: null, iterations: [], converged: false, errorMsg: 'No cumple el teorema de Bolzano: f(a) y f(b) deben tener signos opuestos.' };
  }

  const iterations: IterationResult[] = [];
  let currentA = a;
  let currentB = b;
  let root = null;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (currentA + currentB) / 2;
    const fMid = evaluate(formula, { x: mid });
    const error = Math.abs(currentB - currentA) / 2;

    iterations.push({
      iteration: i + 1,
      x: mid,
      f_x: fMid,
      error,
      a: currentA,
      b: currentB
    });

    if (error < tolerance || Math.abs(fMid) < 1e-14) {
      root = mid;
      converged = true;
      break;
    }

    if (fa * fMid < 0) {
      currentB = mid;
      fb = fMid;
    } else {
      currentA = mid;
      fa = fMid;
    }
  }

  return { root: root ?? (currentA + currentB) / 2, iterations, converged };
};

