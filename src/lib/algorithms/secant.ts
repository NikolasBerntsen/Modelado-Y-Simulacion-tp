import { AlgorithmParams, AlgorithmOutput, IterationResult } from '../../types';
import { evaluate, parseParam } from './shared';

export const secant = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, x0: rawX0, x1: rawX1, h: rawH, tolerance, maxIterations } = params;
  const x0 = parseParam(rawX0);
  const x1_provided = parseParam(rawX1);
  const h = parseParam(rawH);

  if (isNaN(x0)) return { root: null, iterations: [], converged: false, errorMsg: 'x0 es requerido y debe ser válido' };

  let x_prev: number;
  let x_curr: number;

  if (!isNaN(h) && h !== 0) {
    x_prev = x0;
    x_curr = x0 + h;
  } else if (!isNaN(x1_provided)) {
    x_prev = x0;
    x_curr = x1_provided;
  } else {
    return { root: null, iterations: [], converged: false, errorMsg: 'Se requiere x1 o un tamaño de paso h' };
  }

  const iterations: IterationResult[] = [];
  let root = null;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    const fx_prev = evaluate(formula, { x: x_prev });
    const fx_curr = evaluate(formula, { x: x_curr });

    if (isNaN(fx_prev) || isNaN(fx_curr)) {
      return { root: null, iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
    }

    const numerator = fx_curr * (x_curr - x_prev);
    const denominator = fx_curr - fx_prev;

    if (Math.abs(denominator) < 1e-14) {
      return { root: root ?? x_curr, iterations, converged: Math.abs(fx_curr) < tolerance, errorMsg: Math.abs(fx_curr) < tolerance ? undefined : 'Denominador demasiado pequeño: los valores f(x_n) y f(x_n-1) son casi iguales' };
    }

    const nextX = x_curr - numerator / denominator;
    const error = Math.abs(nextX - x_curr);

    iterations.push({
      iteration: i + 1,
      x: nextX,
      f_x: evaluate(formula, { x: nextX }),
      error,
      x_prev,
      x_curr,
      fx_prev,
      fx_curr,
      numerator,
      denominator
    });

    if (error < tolerance) {
      root = nextX;
      converged = true;
      break;
    }

    x_prev = x_curr;
    x_curr = nextX;

    if (isNaN(x_curr) || !isFinite(x_curr)) {
      return { root: null, iterations, converged: false, errorMsg: 'Divergencia: la secante produjo un valor no finito' };
    }
  }

  return { root: root ?? x_curr, iterations, converged };
};

