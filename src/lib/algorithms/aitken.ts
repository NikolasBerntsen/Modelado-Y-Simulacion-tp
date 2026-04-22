import { AlgorithmParams, AlgorithmOutput, IterationResult } from '../../types';
import { evaluate, parseParam } from './shared';

export const aitken = (params: AlgorithmParams): AlgorithmOutput => {
  const { g_formula, x0: rawX0, tolerance, maxIterations } = params;
  const x0 = parseParam(rawX0);
  if (!g_formula || isNaN(x0)) return { root: null, iterations: [], converged: false, errorMsg: 'g(x) y x0 son requeridos y deben ser válidos' };

  const iterations: IterationResult[] = [];
  let x_n = x0;
  let root = null;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    const x1 = evaluate(g_formula, { x: x_n });
    const x2 = evaluate(g_formula, { x: x1 });

    if (isNaN(x1) || isNaN(x2) || !isFinite(x1) || !isFinite(x2)) {
      return { root: null, iterations, converged: false, errorMsg: 'Divergencia: g(x) produjo un valor no finito' };
    }

    const numerator = Math.pow(x1 - x_n, 2);
    const denominator = (x2 - x1) - (x1 - x_n);

    // Convergence: denominator near zero means sequence is already converged
    const relThreshold = Math.max(1e-12, (Math.abs(x2) + Math.abs(x1) + Math.abs(x_n)) * 1e-12);
    if (Math.abs(denominator) < relThreshold) {
      root = x_n;
      converged = true;
      // Record the iteration anyway
      iterations.push({
        iteration: i + 1,
        x: x_n,
        f_x: evaluate(params.formula, { x: x_n }),
        error: Math.abs(x1 - x_n),
        fixedPoints: [
          { label: 'x_n', value: x_n },
          { label: 'g(x_n)', value: x1 },
          { label: 'g(g(x_n))', value: x2 }
        ]
      });
      break;
    }

    const x_aitken = x_n - numerator / denominator;
    const error = Math.abs(x_aitken - x_n);

    iterations.push({
      iteration: i + 1,
      x: x_aitken,
      f_x: evaluate(params.formula, { x: x_aitken }),
      error,
      fixedPoints: [
        { label: 'x_n', value: x_n },
        { label: 'g(x_n)', value: x1 },
        { label: 'g(g(x_n))', value: x2 }
      ]
    });

    if (error < tolerance) {
      root = x_aitken;
      converged = true;
      break;
    }

    x_n = x_aitken;
    if (isNaN(x_n) || !isFinite(x_n)) {
      return { root: null, iterations, converged: false, errorMsg: 'Divergencia' };
    }
  }

  return { root: root ?? x_n, iterations, converged };
};

