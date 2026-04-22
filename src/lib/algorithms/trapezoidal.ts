import { AlgorithmParams, AlgorithmOutput } from '../../types';
import { evaluate, parseParam, math } from './shared';

export const trapezoidal = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, n } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  if (isNaN(a) || isNaN(b) || !n || n < 1) return { iterations: [], converged: false, errorMsg: 'A, B y n (≥ 1) son requeridos' };

  const h = (b - a) / n;
  const fa = evaluate(formula, { x: a });
  const fb = evaluate(formula, { x: b });
  if (isNaN(fa) || isNaN(fb)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };

  let sum = (fa + fb) / 2;
  const iterations = [];

  iterations.push({ iteration: 0, x: a, f_x: fa, error: 0 });

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    const fx = evaluate(formula, { x });
    if (isNaN(fx)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };
    sum += fx;
    iterations.push({ iteration: i, x, f_x: fx, error: 0 });
  }

  iterations.push({ iteration: n, x: b, f_x: fb, error: 0 });

  let errorAnalysis = undefined;
  try {
    let d2 = math.derivative(formula, 'x');
    d2 = math.derivative(d2, 'x');
    const samples = 200;
    let maxD2 = 0;
    for (let i = 0; i <= samples; i++) {
      const xVal = a + (b - a) * (i / samples);
      try {
        const val = Math.abs(d2.evaluate({ x: xVal }));
        if (isFinite(val) && val > maxD2) maxD2 = val;
      } catch (e) {}
    }
    const errorBound = (Math.abs(b - a) / 12) * Math.pow(h, 2) * maxD2;
    errorAnalysis = {
      derivativeOrder: 2,
      derivativeFormula: d2.toString(),
      maxDerivativeValue: maxD2,
      globalError: errorBound,
      gFormula: '',
      gDerivativeFormula: '',
      criticalPoints: [],
      maxGValue: 0,
      theoreticalFormula: '|E_t| \\le \\frac{(b-a)}{12} h^2 \\max|f\'\'(\\xi)|',
      substitutedFormula: `|E_t| \\le \\frac{${Math.abs(b - a).toFixed(4)}}{12} \\cdot (${h.toFixed(4)})^2 \\cdot ${maxD2.toExponential(4)} = ${errorBound.toExponential(4)}`
    };
  } catch (e) {}

  return {
    result: (sum * h).toFixed(10),
    iterations,
    converged: true,
    errorAnalysis
  };
};

