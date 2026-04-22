import { create, all } from 'mathjs';
import seedrandom from 'seedrandom';

const math = create(all);

math.import({
  ln: math.log,
  log10: math.log10,
  log2: math.log2
}, { override: true });
import { AlgorithmParams, AlgorithmOutput, IterationResult, Point } from '../types';

export const evaluate = (formula: string, scope: Record<string, number>): number => {
  if (!formula || !formula.trim()) return NaN;

  try {
    const fullScope: Record<string, number> = { ...scope };

    if ('t' in scope && !('x' in scope)) fullScope.x = scope.t;
    if ('x' in scope && !('t' in scope)) fullScope.t = scope.x;

    if ('x' in fullScope) fullScope.X = fullScope.x;
    if ('t' in fullScope) fullScope.T = fullScope.t;
    if ('y' in fullScope) fullScope.Y = fullScope.y;
    if ('z' in fullScope) fullScope.Z = fullScope.z;

    const result = math.evaluate(formula, fullScope);

    if (typeof result === 'number' && !Number.isFinite(result)) {
      const epsilon = 1e-10;
      const offsetScope = { ...fullScope };
      if ('x' in offsetScope) offsetScope.x += epsilon;
      if ('t' in offsetScope) offsetScope.t += epsilon;
      if ('X' in offsetScope) offsetScope.X += epsilon;
      if ('T' in offsetScope) offsetScope.T += epsilon;

      const offsetResult = math.evaluate(formula, offsetScope);
      if (Number.isFinite(offsetResult)) return offsetResult;
    }

    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes('Unexpected end of expression') &&
        !message.includes('Value expected') &&
        !message.includes('Unexpected operator') &&
        !message.includes('Undefined symbol') &&
        !message.includes('Parenthesis ) expected') &&
        !message.includes('Too few arguments')) {
      console.error('Math evaluation error:', e);
    }
    return NaN;
  }
};

const numericalDerivative = (formula: string, x: number): number => {
  const h = Math.max(1e-7, Math.abs(x) * 1e-7);
  const f_plus = evaluate(formula, { x: x + h });
  const f_minus = evaluate(formula, { x: x - h });
  if (isNaN(f_plus) || isNaN(f_minus)) return NaN;
  return (f_plus - f_minus) / (2 * h);
};

export const parseParam = (val: string | number | undefined): number => {
  if (val === undefined || val === null || val === '') return NaN;
  if (typeof val === 'number') return val;
  try {
    return math.evaluate(val);
  } catch (e) {
    return NaN;
  }
};

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

export const lagrange = (params: AlgorithmParams): AlgorithmOutput => {
  const { points, isTrigMode, useFunction } = params;
  if (!points || points.length < 2) return { iterations: [], converged: false, errorMsg: 'Se requieren al menos 2 puntos' };

  const formatNum = (n: number) => {
    if (isTrigMode) {
      const pi = Math.PI;
      const ratio = n / pi;
      if (Math.abs(n) < 1e-10) return "0";
      const p2 = n * pi * pi;
      if (Math.abs(p2 - Math.round(p2)) < 1e-6) {
        const k = Math.round(p2);
        if (k === 0) return "0";
        return `${k}/π²`;
      }
      const p1 = n * pi;
      if (Math.abs(p1 - Math.round(p1)) < 1e-6) {
        const k = Math.round(p1);
        if (k === 0) return "0";
        return `${k}/π`;
      }
      const roundedRatio = Math.round(ratio * 10000) / 10000;
      if (Math.abs(roundedRatio - 1) < 1e-6) return "π";
      if (Math.abs(roundedRatio + 1) < 1e-6) return "-π";
      const commonFractions = [
        { v: 0.5, s: "π/2" }, { v: -0.5, s: "-π/2" },
        { v: 1/3, s: "π/3" }, { v: -1/3, s: "-π/3" },
        { v: 0.25, s: "π/4" }, { v: -0.25, s: "-π/4" },
        { v: 2/3, s: "2π/3" }, { v: -2/3, s: "-2π/3" },
        { v: 0.75, s: "3π/4" }, { v: -0.75, s: "-3π/4" },
        { v: 1.5, s: "3π/2" }, { v: -1.5, s: "-3π/2" },
        { v: 2, s: "2π" }, { v: -2, s: "-2π" }
      ];
      for (const f of commonFractions) {
        if (Math.abs(ratio - f.v) < 1e-4) return f.s;
      }
      if (Math.abs(roundedRatio - Math.round(roundedRatio)) < 1e-6) {
        return `${Math.round(roundedRatio)}π`;
      }
    }
    return n.toFixed(6).replace(/\.?0+$/, '');
  };

  const cleanMathString = (s: string) => {
    let cleaned = s;

    if (isTrigMode) {
      cleaned = cleaned.replace(/(?<!\d)3\.14159265\d*(?!\d)/g, 'π');
      cleaned = cleaned.replace(/(?<!\d)6\.28318530\d*(?!\d)/g, '2π');
      cleaned = cleaned.replace(/(?<!\d)1\.57079632\d*(?!\d)/g, 'π/2');

      cleaned = cleaned.replace(/(?<!\d)(\d+\.\d{6,})(?!\d)/g, (match) => {
        const n = parseFloat(match);
        const pi = Math.PI;
        const pi2 = pi * pi;

        const p2 = n * pi2;
        if (Math.abs(p2 - Math.round(p2)) < 1e-7) {
          const k = Math.round(p2);
          if (k === 0) return "0";
          return `${k}/π²`;
        }
        const p1 = n * pi;
        if (Math.abs(p1 - Math.round(p1)) < 1e-7) {
          const k = Math.round(p1);
          if (k === 0) return "0";
          return `${k}/π`;
        }
        const r1 = n / pi;
        if (Math.abs(r1 - Math.round(r1)) < 1e-7) {
          const k = Math.round(r1);
          if (k === 0) return "0";
          if (k === 1) return "π";
          if (k === -1) return "-π";
          return `${k}π`;
        }
        const r2 = n / pi2;
        if (Math.abs(r2 - Math.round(r2)) < 1e-7) {
          const k = Math.round(r2);
          if (k === 0) return "0";
          return `${k}π²`;
        }
        const ratio = n / pi;
        const absRatio = Math.abs(ratio);
        const sign = ratio < 0 ? "-" : "";
        const commonFractions = [
          { v: 0.5, s: "π/2" }, { v: 1/3, s: "π/3" }, { v: 0.25, s: "π/4" },
          { v: 2/3, s: "2π/3" }, { v: 0.75, s: "3π/4" }, { v: 1.5, s: "3π/2" },
          { v: 0.125, s: "π/8" }, { v: 0.375, s: "3π/8" }, { v: 0.625, s: "5π/8" }, { v: 0.875, s: "7π/8" }
        ];
        for (const f of commonFractions) {
          if (Math.abs(absRatio - f.v) < 1e-4) return sign + f.s;
        }
        return match;
      });
    }

    cleaned = cleaned.replace(/(\d+\.\d*?[1-9])0+(?!\d)/g, '$1')
                   .replace(/(\d+)\.0+(?!\d)/g, '$1');

    cleaned = cleaned.replace(/(\d+\.?\d*)e([\+\-]\d+)/g, (match) => {
      const n = parseFloat(match);
      if (Math.abs(n) < 1e-4) {
        return n.toFixed(12).replace(/\.?0+$/, '');
      }
      return match;
    });

    cleaned = cleaned.replace(/\s*([\+\-\*\/\^])\s*/g, '$1');
    cleaned = cleaned.replace(/(\d+)\*x/g, '$1x');
    cleaned = cleaned.replace(/(\d+)\*\(/g, '$1(');
    cleaned = cleaned.replace(/\)\*\(/g, ')(');
    cleaned = cleaned.replace(/(^|[\+\-\(\/])1x/g, '$1x');
    cleaned = cleaned.replace(/\^2/g, '²');
    cleaned = cleaned.replace(/\^3/g, '³');
    cleaned = cleaned.replace(/\^4/g, '⁴');
    cleaned = cleaned.replace(/\^5/g, '⁵');
    cleaned = cleaned.replace(/([^\(])([\+\-])/g, '$1 $2 ');

    return cleaned.trim();
  };

  const n = points.length;
  const parsedPoints = points.map(p => ({
    x: parseParam(p.x),
    y: parseParam(p.y)
  }));

  // Validate parsed points
  for (const p of parsedPoints) {
    if (isNaN(p.x) || isNaN(p.y)) {
      return { iterations: [], converged: false, errorMsg: 'Todos los puntos deben tener coordenadas numéricas válidas' };
    }
  }

  // Check for duplicate x values
  for (let i = 0; i < parsedPoints.length; i++) {
    for (let j = i + 1; j < parsedPoints.length; j++) {
      if (Math.abs(parsedPoints[i].x - parsedPoints[j].x) < 1e-12) {
        return { iterations: [], converged: false, errorMsg: `Puntos duplicados: x[${i}] = x[${j}] = ${parsedPoints[i].x}. Los valores de x deben ser distintos.` };
      }
    }
  }

  const lagrangeBases: string[] = [];
  const lagrangeExpanded: { y: number; base: string }[] = [];
  let fullExpressionRaw = "";

  for (let i = 0; i < n; i++) {
    let numeratorExpr = "1";
    let denominator = 1;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        numeratorExpr = `(${numeratorExpr}) * (x - ${parsedPoints[j].x})`;
        denominator *= (parsedPoints[i].x - parsedPoints[j].x);
      }
    }

    let baseStr = "";
    try {
      const expanded = math.rationalize(numeratorExpr);
      const simplified = math.simplify(expanded);
      const finalBase = math.simplify(`(${simplified.toString()}) / ${denominator}`);
      baseStr = cleanMathString(finalBase.toString());
    } catch (e) {
      baseStr = `(${numeratorExpr}) / ${formatNum(denominator)}`;
    }

    lagrangeBases.push(baseStr);
    lagrangeExpanded.push({ y: parsedPoints[i].y, base: baseStr });

    if (i > 0) fullExpressionRaw += " + ";
    fullExpressionRaw += `(${parsedPoints[i].y}) * ((${numeratorExpr}) / ${denominator})`;
  }

  let lagrangeFinal = "";
  try {
    const expanded = math.rationalize(fullExpressionRaw);
    const simplified = math.simplify(expanded);
    lagrangeFinal = cleanMathString(simplified.toString());
  } catch (e) {
    lagrangeFinal = "No se pudo simplificar automáticamente";
  }

  const L = (x: number, i: number) => {
    let result = 1;
    for (let j = 0; j < parsedPoints.length; j++) {
      if (i !== j) {
        result *= (x - parsedPoints[j].x) / (parsedPoints[i].x - parsedPoints[j].x);
      }
    }
    return result;
  };

  const P = (x: number) => {
    let result = 0;
    for (let i = 0; i < parsedPoints.length; i++) {
      result += parsedPoints[i].y * L(x, i);
    }
    return result;
  };

  let errorAnalysis: any = undefined;
  const { formula, evaluationPoint: rawEvalPoint } = params;
  const evaluationPoint = parseParam(rawEvalPoint);

  if (useFunction !== false && formula && formula.trim()) {
    try {
      const order = n;
      let derivative = math.parse(formula);
      for (let i = 0; i < order; i++) {
        derivative = math.derivative(derivative, 'x');
      }
      const derivativeFormula = cleanMathString(derivative.toString());

      const allX = parsedPoints.map(p => p.x);
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      let maxDerivativeValue = 0;
      const samples = 200;
      for (let i = 0; i <= samples; i++) {
        const xVal = minX + (maxX - minX) * (i / samples);
        try {
          const val = Math.abs(derivative.evaluate({ x: xVal }));
          if (isFinite(val) && val > maxDerivativeValue) maxDerivativeValue = val;
        } catch (e) {}
      }

      let gExpr = "1";
      for (const p of parsedPoints) {
        gExpr = `(${gExpr}) * (x - ${p.x})`;
      }
      const gSimplified = math.simplify(gExpr);
      const gFormula = cleanMathString(gSimplified.toString());

      const gDerivative = math.derivative(gSimplified, 'x');
      // Pre-compute second derivative for Newton refinement (avoid recomputing in loop)
      const gDerivative2 = math.derivative(gDerivative, 'x');
      const gDerivativeFormula = cleanMathString(gDerivative.toString());

      const criticalPoints: number[] = [];
      const gDSamples = 300;
      for (let i = 0; i < gDSamples; i++) {
        const x1 = minX + (maxX - minX) * (i / gDSamples);
        const x2 = minX + (maxX - minX) * ((i + 1) / gDSamples);
        let y1: number, y2: number;
        try {
          y1 = gDerivative.evaluate({ x: x1 });
          y2 = gDerivative.evaluate({ x: x2 });
        } catch (e) { continue; }

        if (y1 * y2 <= 0 && isFinite(y1) && isFinite(y2)) {
          let root = (x1 + x2) / 2;
          // Newton refinement using pre-computed second derivative
          for (let j = 0; j < 8; j++) {
            try {
              const f = gDerivative.evaluate({ x: root });
              const df = gDerivative2.evaluate({ x: root });
              if (Math.abs(df) > 1e-12) {
                root = root - f / df;
                if (root < minX - (maxX - minX) || root > maxX + (maxX - minX)) break;
              } else break;
            } catch (e) { break; }
          }
          if (root >= minX && root <= maxX) {
            if (!criticalPoints.some(p => Math.abs(p - root) < 1e-6)) {
              criticalPoints.push(root);
            }
          }
        }
      }
      criticalPoints.sort((a, b) => a - b);

      let maxGValue = 0;
      // Also check endpoints for g(x)
      const evalPoints = [...criticalPoints, minX, maxX];
      for (const cp of evalPoints) {
        try {
          const val = Math.abs(gSimplified.evaluate({ x: cp }));
          if (isFinite(val) && val > maxGValue) maxGValue = val;
        } catch (e) {}
      }

      const factorial = (num: number): number => {
        if (num <= 1) return 1;
        return num * factorial(num - 1);
      };
      const globalError = (maxDerivativeValue / factorial(order)) * maxGValue;

      let localError: number | undefined = undefined;
      if (!isNaN(evaluationPoint)) {
        try {
          const fVal = evaluate(formula, { x: evaluationPoint });
          const pVal = P(evaluationPoint);
          if (isFinite(fVal) && isFinite(pVal)) {
            localError = Math.abs(fVal - pVal);
          }
        } catch (e) {}
      }

      errorAnalysis = {
        derivativeOrder: order,
        derivativeFormula,
        maxDerivativeValue,
        gFormula,
        gDerivativeFormula,
        criticalPoints,
        maxGValue,
        globalError,
        localError,
        evaluationPoint
      };
    } catch (e) {
      console.error('Error in Lagrange error analysis:', e);
    }
  }

  const allX = parsedPoints.map(p => p.x);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const range = maxX - minX;
  const plotMin = minX - range * 0.2;
  const plotMax = maxX + range * 0.2;
  const step = (plotMax - plotMin) / 150;

  const curvePoints = [];
  const hasOriginalFunction = useFunction !== false && formula && formula.trim();

  for (let x = plotMin; x <= plotMax; x += step) {
    const pVal = P(x);
    if (!isFinite(pVal)) continue;
    const point: any = { x: Number(x.toFixed(8)), y: pVal };
    if (hasOriginalFunction) {
      try {
        const yOrig = evaluate(formula, { x });
        if (isFinite(yOrig)) {
          point.yOriginal = yOrig;
        }
      } catch (e) {}
    }
    curvePoints.push(point);
  }

  // Also include evaluation point result
  const evalPointResult = !isNaN(evaluationPoint) ? P(evaluationPoint) : undefined;

  return {
    result: evalPointResult !== undefined
      ? `P(${formatNum(evaluationPoint)}) = ${evalPointResult.toFixed(8)}`
      : 'Polinomio de Lagrange calculado',
    iterations: parsedPoints.map((p, i) => ({ iteration: i + 1, x: p.x, f_x: p.y, error: 0 })),
    converged: true,
    points: curvePoints,
    lagrangeBases,
    lagrangeExpanded,
    lagrangeFinal,
    errorAnalysis
  };
};

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

export const solveODE = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, exactFormula, odeMethod = 'euler', rkOrder = 4, t0: rawT0, y0: rawY0, t_end: rawTEnd, h: rawH } = params;
  const t0 = parseParam(rawT0);
  const y0 = parseParam(rawY0);
  const t_end = parseParam(rawTEnd);
  const h = parseParam(rawH);
  if (isNaN(t0) || isNaN(y0) || isNaN(t_end) || isNaN(h) || h <= 0)
    return { iterations: [], converged: false, errorMsg: 't0, y0, t_end y h (> 0) son requeridos y deben ser válidos' };

  if (t_end <= t0) {
    return { iterations: [], converged: false, errorMsg: 't_end debe ser mayor que t0' };
  }

  const maxSteps = Math.ceil((t_end - t0) / h) + 2;
  if (maxSteps > 5000) {
    return { iterations: [], converged: false, errorMsg: 'Demasiados pasos: reduce el rango o aumenta h' };
  }

  const iterations = [];
  const points: Point[] = [];
  let t = t0;
  let y = y0;
  let i = 0;

  while (t <= t_end + h / 2) {
    let y_real: number | undefined = undefined;
    let error: number | undefined = undefined;

    if (exactFormula) {
      try {
        y_real = evaluate(exactFormula, { t, x: t });
        if (!isNaN(y_real) && isFinite(y_real)) {
          error = Math.abs(y - y_real);
        }
      } catch (e) {}
    }

    let next_y = y;
    const iterData: any = {
      iteration: i,
      x: t,
      f_x: y,
      y_real,
    };
    if (error !== undefined) {
      iterData.error = error;
    }

    if (odeMethod === 'euler') {
      const fty = evaluate(formula, { t, y });
      if (isNaN(fty)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
      next_y = y + h * fty;
      iterData.fty = fty;
    } else if (odeMethod === 'euler_modificado') {
      const fty1 = evaluate(formula, { t, y });
      if (isNaN(fty1)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
      const y_pred = y + h * fty1;
      const fty2 = evaluate(formula, { t: t + h, y: y_pred });
      if (isNaN(fty2)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
      next_y = y + (h / 2) * (fty1 + fty2);
      iterData.fty1 = fty1;
      iterData.y_pred = y_pred;
      iterData.fty2 = fty2;
    } else {
      // Runge-Kutta
      const k1_val = evaluate(formula, { t, y });
      if (isNaN(k1_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
      const k1 = h * k1_val;
      iterData.k1 = k1;

      if (rkOrder === 1) {
        next_y = y + k1;
      } else if (rkOrder === 2) {
        // Midpoint method (RK2)
        const k2_val = evaluate(formula, { t: t + h / 2, y: y + k1 / 2 });
        if (isNaN(k2_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
        const k2 = h * k2_val;
        iterData.k2 = k2;
        next_y = y + k2;
      } else if (rkOrder === 3) {
        // Kutta's 3rd-order method
        const k2_val = evaluate(formula, { t: t + h / 2, y: y + k1 / 2 });
        if (isNaN(k2_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
        const k2 = h * k2_val;
        iterData.k2 = k2;

        const k3_val = evaluate(formula, { t: t + h, y: y - k1 + 2 * k2 });
        if (isNaN(k3_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
        const k3 = h * k3_val;
        iterData.k3 = k3;

        next_y = y + (k1 + 4 * k2 + k3) / 6;
      } else {
        // Classic RK4
        const k2_val = evaluate(formula, { t: t + h / 2, y: y + k1 / 2 });
        if (isNaN(k2_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
        const k2 = h * k2_val;
        iterData.k2 = k2;

        const k3_val = evaluate(formula, { t: t + h / 2, y: y + k2 / 2 });
        if (isNaN(k3_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
        const k3 = h * k3_val;
        iterData.k3 = k3;

        const k4_val = evaluate(formula, { t: t + h, y: y + k3 });
        if (isNaN(k4_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
        const k4 = h * k4_val;
        iterData.k4 = k4;

        next_y = y + (k1 + 2 * k2 + 2 * k3 + k4) / 6;
      }
    }

    iterData.y_next = next_y;
    iterations.push(iterData);
    points.push({ x: t, y });

    y = next_y;
    t = parseFloat((t + h).toPrecision(14)); // avoid floating-point drift
    i++;
    if (i > 5000) break;
  }

  const methodLabels: Record<string, string> = {
    euler: 'Euler',
    euler_modificado: 'Euler Modificado',
    rk: `Runge-Kutta Orden ${rkOrder}`
  };
  const methodName = methodLabels[odeMethod] || 'ODE';
  const lastY = iterations[iterations.length - 1]?.y_next;
  return {
    result: `${methodName}: y(${t_end}) ≈ ${typeof lastY === 'number' ? lastY.toFixed(8) : '?'}`,
    iterations,
    points,
    converged: true
  };
};

export const monteCarlo = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, c: rawC, d: rawD, e_limit: rawE, f_limit: rawF, maxIterations, seed, monteCarloMode, confidenceLevel = 95, dimensions = 1 } = params;

  const a = parseParam(rawA);
  const b = parseParam(rawB);
  const c = parseParam(rawC);
  const d = parseParam(rawD);
  const e_limit = parseParam(rawE);
  const f_limit = parseParam(rawF);

  const zScores: Record<number, number> = { 90: 1.645, 95: 1.96, 99: 2.576 };
  const z = zScores[confidenceLevel] || 1.96;

  const n = Math.max(1, maxIterations || 10000);
  const iterations = [];
  const points: Point[] = [];

  const rng = seedrandom(seed?.toString() || Math.random().toString());

  if (monteCarloMode === 'pi') {
    let insideCount = 0;
    for (let i = 1; i <= n; i++) {
      const x = rng();
      const y = rng();
      const isInside = (x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5) <= 0.25;
      if (isInside) insideCount++;

      if (i <= 2000) {
        points.push({ x, y, inside: isInside });
      }

      if (i % Math.max(1, Math.floor(n / 20)) === 0 || i === n) {
        const currentPi = (4 * insideCount) / i;
        iterations.push({
          iteration: i,
          x,
          f_x: y,
          error: Math.abs(Math.PI - currentPi),
          estimate: currentPi
        });
      }
    }

    const piEstimate = (4 * insideCount) / n;
    const p = insideCount / n;
    // Standard error of 4*Bernoulli(p)
    const stdDev = 4 * Math.sqrt(p * (1 - p));
    const stdError = stdDev / Math.sqrt(n);
    const ci = z * stdError;

    return {
      result: piEstimate.toFixed(10),
      iterations,
      converged: true,
      points,
      stats: {
        samples: n,
        mean: piEstimate,
        stdDev,
        stdError,
        confidenceInterval: [piEstimate - ci, piEstimate + ci]
      },
      errorAnalysis: {
        globalError: Math.abs(Math.PI - piEstimate),
        theoreticalFormula: `\\pi \\approx 4 \\cdot \\frac{\\text{éxitos}}{n} \\quad \\text{IC}(${confidenceLevel}\\%): \\hat{\\pi} \\pm z \\cdot \\frac{\\hat{\\sigma}}{\\sqrt{n}}`,
        substitutedFormula: `\\hat{\\pi} = ${piEstimate.toFixed(6)},\\; \\text{Éxitos} = ${insideCount}/${n},\\; \\hat{\\sigma} = ${stdDev.toFixed(6)}`,
        derivativeOrder: 0,
        derivativeFormula: '',
        maxDerivativeValue: 0,
        gFormula: '',
        gDerivativeFormula: '',
        criticalPoints: [],
        maxGValue: 0
      }
    };
  } else {
    // Integration — Welford's online algorithm for numerically stable variance
    let volume = 1;
    if (dimensions >= 1 && !isNaN(a) && !isNaN(b)) volume *= (b - a);
    if (dimensions >= 2 && !isNaN(c) && !isNaN(d)) volume *= (d - c);
    if (dimensions >= 3 && !isNaN(e_limit) && !isNaN(f_limit)) volume *= (f_limit - e_limit);

    let count = 0;
    let mean_running = 0;
    let M2 = 0; // Welford accumulator

    for (let i = 1; i <= n; i++) {
      const x = (dimensions >= 1 && !isNaN(a) && !isNaN(b)) ? a + rng() * (b - a) : 0;
      const y = (dimensions >= 2 && !isNaN(c) && !isNaN(d)) ? c + rng() * (d - c) : 0;
      const z_val = (dimensions >= 3 && !isNaN(e_limit) && !isNaN(f_limit)) ? e_limit + rng() * (f_limit - e_limit) : 0;

      let fx = 0;
      try {
        const scope: Record<string, number> = { x };
        if (dimensions >= 2) scope.y = y;
        if (dimensions >= 3) scope.z = z_val;
        fx = evaluate(formula, scope);
      } catch (e) { fx = NaN; }

      if (!isNaN(fx) && isFinite(fx)) {
        count++;
        // Welford's online update
        const delta = fx - mean_running;
        mean_running += delta / count;
        const delta2 = fx - mean_running;
        M2 += delta * delta2;
      }

      if (i <= 2000) {
        if (dimensions === 1) points.push({ x, y: fx, inside: true });
        else points.push({ x, y, inside: true });
      }

      if (i % Math.max(1, Math.floor(n / 20)) === 0 || i === n) {
        const currentEstimate = volume * mean_running;
        iterations.push({
          iteration: i,
          x,
          f_x: fx,
          error: 0,
          estimate: currentEstimate
        });
      }
    }

    const result = volume * mean_running;
    // Population variance of f (unbiased: M2/(count-1) for sample, M2/count for population)
    const variance_f = count > 1 ? M2 / count : 0;
    const stdDev_f = Math.sqrt(Math.max(0, variance_f));
    const stdDev = stdDev_f * volume;
    const stdError = (stdDev_f / Math.sqrt(count)) * volume;
    const ci = z * stdError;

    return {
      result: result.toFixed(10),
      iterations,
      converged: true,
      points,
      stats: {
        samples: n,
        mean: result,
        stdDev,
        stdError,
        confidenceInterval: [result - ci, result + ci]
      },
      errorAnalysis: {
        globalError: ci,
        theoreticalFormula: `I \\approx V \\cdot \\bar{f} \\quad \\text{IC}(${confidenceLevel}\\%): I \\pm z \\cdot \\frac{V \\cdot \\hat{\\sigma}_f}{\\sqrt{n}}`,
        substitutedFormula: `\\hat{I} = ${result.toFixed(6)},\\; V = ${volume.toFixed(4)},\\; \\hat{\\sigma}_f = ${stdDev_f.toFixed(6)},\\; n = ${n}`,
        derivativeOrder: 0,
        derivativeFormula: '',
        maxDerivativeValue: 0,
        gFormula: '',
        gDerivativeFormula: '',
        criticalPoints: [],
        maxGValue: 0
      }
    };
  }
};

export const recommendG = (formula: string): string[] => {
  return [
    `x + (${formula})`,
    `x - (${formula})`,
    `x - (${formula}) / 2`,
  ];
};
