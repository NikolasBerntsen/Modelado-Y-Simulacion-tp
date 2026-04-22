import { AlgorithmParams, AlgorithmOutput, IterationResult } from '../../types';
import { evaluate, parseParam } from './shared';

export const regulaFalsi = (params: AlgorithmParams): AlgorithmOutput => {
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
  let prevX: number | null = null;

  for (let i = 0; i < maxIterations; i++) {
    const fA = evaluate(formula, { x: currentA });
    const fB = evaluate(formula, { x: currentB });

    const denom = fB - fA;
    if (Math.abs(denom) < 1e-14) {
      break;
    }

    const x = currentB - (fB * (currentB - currentA)) / denom;
    const fx = evaluate(formula, { x });
    // Error: distance from previous approximation (or |f(x)| for first iteration)
    const error = prevX !== null ? Math.abs(x - prevX) : Math.abs(fx);

    iterations.push({
      iteration: i + 1,
      x,
      f_x: fx,
      error,
      a: currentA,
      b: currentB
    });

    if (Math.abs(fx) < 1e-14 || (prevX !== null && Math.abs(x - prevX) < tolerance)) {
      root = x;
      converged = true;
      break;
    }

    prevX = x;

    if (fA * fx < 0) {
      currentB = x;
    } else {
      currentA = x;
    }
  }

  return { root: root ?? iterations[iterations.length - 1]?.x, iterations, converged };
};

