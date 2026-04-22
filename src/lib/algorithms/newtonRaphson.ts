import { AlgorithmParams, AlgorithmOutput, IterationResult } from '../../types';
import { evaluate, parseParam, math, numericalDerivative } from './shared';

export const newtonRaphson = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, x0: rawX0, tolerance, maxIterations } = params;
  const x0 = parseParam(rawX0);
  if (isNaN(x0)) return { root: null, iterations: [], converged: false, errorMsg: 'x0 es requerido y debe ser válido' };

  let derivativeFormula = '';
  let useNumerical = false;

  try {
    const d = math.derivative(formula, 'x');
    derivativeFormula = d.toString();
  } catch (e) {
    // Fall back to central-difference numerical derivative
    useNumerical = true;
    derivativeFormula = '[derivada numérica — fórmula no diferenciable simbólicamente]';
  }

  const iterations: IterationResult[] = [];
  let currentX = x0;
  let root = null;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    const fx = evaluate(formula, { x: currentX });
    const dfx = useNumerical
      ? numericalDerivative(formula, currentX)
      : evaluate(derivativeFormula, { x: currentX });

    if (isNaN(fx) || isNaN(dfx)) {
      return { root: null, iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta', derivativeFormula };
    }

    if (Math.abs(dfx) < 1e-14) {
      return { root: null, iterations, converged: false, errorMsg: 'La derivada es demasiado pequeña cerca de este punto (posible inflexión o raíz múltiple)', derivativeFormula };
    }

    const nextX = currentX - fx / dfx;
    const error = Math.abs(nextX - currentX);
    const relativeError = Math.abs(currentX) > 1e-14 ? Math.abs(error / currentX) * 100 : 0;

    iterations.push({
      iteration: i + 1,
      x: currentX,
      f_x: fx,
      df_x: dfx,
      x_next: nextX,
      error,
      relativeError
    });

    if (error < tolerance) {
      root = nextX;
      converged = true;
      break;
    }

    currentX = nextX;

    if (isNaN(currentX) || !isFinite(currentX)) {
      return { root: null, iterations, converged: false, errorMsg: 'Divergencia: Newton-Raphson produjo un valor no finito', derivativeFormula };
    }
  }

  return { root: root ?? currentX, iterations, converged, derivativeFormula };
};

