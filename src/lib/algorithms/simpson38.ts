import { AlgorithmParams, AlgorithmOutput } from '../../types';
import { evaluate, parseParam, math } from './shared';

export const simpson38 = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, n } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  if (isNaN(a) || isNaN(b) || !n) return { iterations: [], converged: false, errorMsg: 'A, B y n son requeridos' };

  // Auto-correct n to nearest multiple of 3
  const nAdj = n % 3 !== 0 ? n + (3 - (n % 3)) : n;

  const h = (b - a) / nAdj;
  const fa = evaluate(formula, { x: a });
  const fb = evaluate(formula, { x: b });
  if (isNaN(fa) || isNaN(fb)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };

  let sum = fa + fb;
  const iterations = [];

  iterations.push({ iteration: 0, x: a, f_x: fa, error: 0 });

  for (let i = 1; i < nAdj; i++) {
    const x = a + i * h;
    const fx = evaluate(formula, { x });
    if (isNaN(fx)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };
    sum += (i % 3 === 0 ? 2 : 3) * fx;
    iterations.push({ iteration: i, x, f_x: fx, error: 0 });
  }

  iterations.push({ iteration: nAdj, x: b, f_x: fb, error: 0 });

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
    const errorBound = (Math.abs(b - a) / 80) * Math.pow(h, 4) * maxD4;
    errorAnalysis = {
      derivativeOrder: 4,
      derivativeFormula: d4.toString(),
      maxDerivativeValue: maxD4,
      globalError: errorBound,
      gFormula: '',
      gDerivativeFormula: '',
      criticalPoints: [],
      maxGValue: 0,
      theoreticalFormula: '|E_t| \\le \\frac{(b-a)}{80} h^4 \\max|f^{(4)}(\\xi)|',
      substitutedFormula: `|E_t| \\le \\frac{${Math.abs(b - a).toFixed(4)}}{80} \\cdot (${h.toFixed(4)})^4 \\cdot ${maxD4.toExponential(4)} = ${errorBound.toExponential(4)}`
    };
  } catch (e) {}

  const autoFixMsg = n % 3 !== 0 ? ` (n ajustado de ${n} a ${nAdj} para ser múltiplo de 3)` : '';
  return {
    result: ((3 * h / 8) * sum).toFixed(10),
    iterations,
    converged: true,
    errorAnalysis,
    ...(autoFixMsg ? { errorMsg: autoFixMsg } : {})
  };
};

