import { AlgorithmParams, AlgorithmOutput } from '../../types';
import { evaluate, parseParam, math } from './shared';

export const simpson13 = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, n } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  if (isNaN(a) || isNaN(b) || !n) return { iterations: [], converged: false, errorMsg: 'A, B y n son requeridos' };

  // Auto-correct n to nearest even number
  const nEven = n % 2 !== 0 ? n + 1 : n;
  if (n % 2 !== 0) {
    params = { ...params, n: nEven };
  }

  const h = (b - a) / nEven;
  const fa = evaluate(formula, { x: a });
  const fb = evaluate(formula, { x: b });
  if (isNaN(fa) || isNaN(fb)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };

  let sum = fa + fb;
  const iterations = [];

  iterations.push({ iteration: 0, x: a, f_x: fa, error: 0 });

  for (let i = 1; i < nEven; i++) {
    const x = a + i * h;
    const fx = evaluate(formula, { x });
    if (isNaN(fx)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };
    sum += (i % 2 === 0 ? 2 : 4) * fx;
    iterations.push({ iteration: i, x, f_x: fx, error: 0 });
  }

  iterations.push({ iteration: nEven, x: b, f_x: fb, error: 0 });

  let errorAnalysis = undefined;
  try {
    let d4 = math.derivative(formula, 'x');
    for (let i = 0; i < 3; i++) d4 = math.derivative(d4, 'x');
    const samples = 200;
    let maxD4 = 0;
    for (let i = 0; i <= samples; i++) {
      const xVal = a + (b - a) * (i / samples);
      try {
        const val = Math.abs(d4.evaluate({ x: xVal }));
        if (isFinite(val) && val > maxD4) maxD4 = val;
      } catch (e) {}
    }
    const errorBound = (Math.abs(b - a) / 180) * Math.pow(h, 4) * maxD4;
    errorAnalysis = {
      derivativeOrder: 4,
      derivativeFormula: d4.toString(),
      maxDerivativeValue: maxD4,
      globalError: errorBound,
      gFormula: '',
      gDerivativeFormula: '',
      criticalPoints: [],
      maxGValue: 0,
      theoreticalFormula: '|E_t| \\le \\frac{(b-a)}{180} h^4 \\max|f^{(4)}(\\xi)|',
      substitutedFormula: `|E_t| \\le \\frac{${Math.abs(b - a).toFixed(4)}}{180} \\cdot (${h.toFixed(4)})^4 \\cdot ${maxD4.toExponential(4)} = ${errorBound.toExponential(4)}`
    };
  } catch (e) {}

  const autoFixMsg = n % 2 !== 0 ? ` (n ajustado de ${n} a ${nEven} para cumplir el requisito de n par)` : '';
  return {
    result: ((h / 3) * sum).toFixed(10),
    iterations,
    converged: true,
    errorAnalysis,
    ...(autoFixMsg ? { errorMsg: autoFixMsg } : {})
  };
};

