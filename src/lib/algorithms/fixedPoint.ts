import { AlgorithmParams, AlgorithmOutput, IterationResult } from '../../types';
import { evaluate, parseParam } from './shared';

export const fixedPoint = (params: AlgorithmParams): AlgorithmOutput => {
  const { g_formula, x0: rawX0, tolerance, maxIterations } = params;
  const x0 = parseParam(rawX0);
  if (!g_formula || isNaN(x0)) return { root: null, iterations: [], converged: false, errorMsg: 'g(x) y x0 son requeridos y deben ser válidos' };

  const iterations: IterationResult[] = [];
  let currentX = x0;
  let root = null;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    const nextX = evaluate(g_formula, { x: currentX });
    if (isNaN(nextX) || !isFinite(nextX)) {
      return { root: null, iterations, converged: false, errorMsg: 'Divergencia: g(x) produjo un valor no finito' };
    }
    const error = Math.abs(nextX - currentX);

    iterations.push({
      iteration: i + 1,
      x: nextX,
      f_x: evaluate(params.formula, { x: nextX }),
      error
    });

    if (error < tolerance) {
      root = nextX;
      converged = true;
      break;
    }

    currentX = nextX;
  }

  return { root: root ?? currentX, iterations, converged };
};

