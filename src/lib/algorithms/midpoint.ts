import { AlgorithmParams, AlgorithmOutput } from '../../types';
import { evaluate, parseParam, math } from './shared';

export const midpoint = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, n } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  if (isNaN(a) || isNaN(b) || !n || n < 1) return { iterations: [], converged: false, errorMsg: 'A, B y n (≥ 1) son requeridos' };

  const h = (b - a) / n;
  let sum = 0;
  const iterations = [];

  for (let i = 0; i < n; i++) {
    const x_mid = a + (i + 0.5) * h;
    const fx = evaluate(formula, { x: x_mid });
    if (isNaN(fx)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };
    sum += fx;
    iterations.push({ iteration: i, x: x_mid, f_x: fx, error: 0 });
  }

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
    const errorBound = (Math.abs(b - a) / 24) * Math.pow(h, 2) * maxD2;
    errorAnalysis = {
      derivativeOrder: 2,
      derivativeFormula: d2.toString(),
      maxDerivativeValue: maxD2,
      globalError: errorBound,
      gFormula: '',
      gDerivativeFormula: '',
      criticalPoints: [],
      maxGValue: 0,
      theoreticalFormula: '|E_m| \\le \\frac{(b-a)}{24} h^2 \\max|f\'\'(\\xi)|',
      substitutedFormula: `|E_m| \\le \\frac{${Math.abs(b - a).toFixed(4)}}{24} \\cdot (${h.toFixed(4)})^2 \\cdot ${maxD2.toExponential(4)} = ${errorBound.toExponential(4)}`
    };
  } catch (e) {}

  return {
    result: (sum * h).toFixed(10),
    iterations,
    converged: true,
    errorAnalysis
  };
};

