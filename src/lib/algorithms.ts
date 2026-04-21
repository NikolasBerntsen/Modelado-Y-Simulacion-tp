import { create, all } from 'mathjs';
import seedrandom from 'seedrandom';

const math = create(all);

// Add ln as an alias for log (natural logarithm) and other common aliases
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
    
    // For differential equations, users often use x instead of t
    if ('t' in scope && !('x' in scope)) fullScope.x = scope.t;
    if ('x' in scope && !('t' in scope)) fullScope.t = scope.x;
    
    // Ensure common variables are available in both cases
    if ('x' in fullScope) fullScope.X = fullScope.x;
    if ('t' in fullScope) fullScope.T = fullScope.t;
    if ('y' in fullScope) fullScope.Y = fullScope.y;
    if ('z' in fullScope) fullScope.Z = fullScope.z;
    
    let result = math.evaluate(formula, fullScope);
    
    // Handle division by zero or undefined points (e.g., sin(x)/x at x=0)
    // by using a small epsilon offset if the result is not finite
    if (typeof result === 'number' && !Number.isFinite(result)) {
      const epsilon = 1e-10;
      const offsetScope = { ...fullScope };
      if ('x' in offsetScope) offsetScope.x += epsilon;
      if ('t' in offsetScope) offsetScope.t += epsilon;
      if ('X' in offsetScope) offsetScope.X += epsilon;
      if ('T' in offsetScope) offsetScope.T += epsilon;
      
      const offsetResult = math.evaluate(formula, offsetScope);
      if (Number.isFinite(offsetResult)) {
        return offsetResult;
      }
    }
    
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Silence common errors that happen while typing or with incomplete formulas
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

export const parseParam = (val: string | number | undefined): number => {
  if (val === undefined || val === null || val === '') return NaN;
  if (typeof val === 'number') return val;
  try {
    // math.evaluate can handle 'pi', '2*pi', etc.
    return math.evaluate(val);
  } catch (e) {
    return NaN;
  }
};

export const bisection = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, tolerance, maxIterations, useFunction } = params;
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

    if (error < tolerance || Math.abs(fMid) < 1e-12) {
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
  const { g_formula, x0: rawX0, tolerance, maxIterations, useFunction } = params;
  const x0 = parseParam(rawX0);
  if (!g_formula || isNaN(x0)) return { root: null, iterations: [], converged: false, errorMsg: 'g(x) y x0 son requeridos y deben ser válidos' };

  const iterations: IterationResult[] = [];
  let currentX = x0;
  let root = null;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    const nextX = evaluate(g_formula, { x: currentX });
    if (isNaN(nextX)) {
      return { root: null, iterations, converged: false, errorMsg: 'Fórmula g(x) inválida o incompleta' };
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
    if (isNaN(currentX) || !isFinite(currentX)) {
      return { root: null, iterations, converged: false, errorMsg: 'Divergence or invalid math operation' };
    }
  }

  return { root: root ?? currentX, iterations, converged };
};

export const aitken = (params: AlgorithmParams): AlgorithmOutput => {
  const { g_formula, x0: rawX0, tolerance, maxIterations, useFunction } = params;
  const x0 = parseParam(rawX0);
  if (!g_formula || isNaN(x0)) return { root: null, iterations: [], converged: false, errorMsg: 'g(x) y x0 son requeridos y deben ser válidos' };

  const iterations: IterationResult[] = [];
  let x_n = x0;
  let root = null;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    const x1 = evaluate(g_formula, { x: x_n });
    const x2 = evaluate(g_formula, { x: x1 });

    if (isNaN(x1) || isNaN(x2)) {
      return { root: null, iterations, converged: false, errorMsg: 'Fórmula g(x) inválida o incompleta' };
    }

    const denominator = (x2 - x1) - (x1 - x_n);
    if (Math.abs(denominator) < 1e-15) {
      root = x_n;
      converged = true;
      break;
    }

    const x_aitken = x_n - Math.pow(x1 - x_n, 2) / denominator;
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
  const { formula, x0: rawX0, tolerance, maxIterations, useFunction } = params;
  const x0 = parseParam(rawX0);
  if (isNaN(x0)) return { root: null, iterations: [], converged: false, errorMsg: 'x0 es requerido y debe ser válido' };

  let derivativeFormula = '';
  try {
    const d = math.derivative(formula, 'x');
    derivativeFormula = d.toString();
  } catch (e) {
    return { root: null, iterations: [], converged: false, errorMsg: 'No se pudo calcular la derivada simbólica' };
  }

  const iterations: IterationResult[] = [];
  let currentX = x0;
  let root = null;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    const fx = evaluate(formula, { x: currentX });
    const dfx = evaluate(derivativeFormula, { x: currentX });

    if (isNaN(fx) || isNaN(dfx)) {
      return { root: null, iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta', derivativeFormula };
    }

    if (Math.abs(dfx) < 1e-15) {
      return { root: null, iterations, converged: false, errorMsg: 'La derivada es demasiado pequeña (cerca de cero)', derivativeFormula };
    }

    const nextX = currentX - fx / dfx;
    const error = Math.abs(nextX - currentX);
    const relativeError = currentX !== 0 ? Math.abs(error / currentX) * 100 : 0;

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
    
    if (Math.abs(denominator) < 1e-15) {
      return { root: null, iterations, converged: false, errorMsg: 'El denominador es demasiado pequeño (posible división por cero)' };
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
  }

  return { root: root ?? x_curr, iterations, converged };
};

export const regulaFalsi = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, tolerance, maxIterations, useFunction } = params;
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
    const fA = evaluate(formula, { x: currentA });
    const fB = evaluate(formula, { x: currentB });
    
    // x = b - f(b) * (b - a) / (f(b) - f(a))
    const x = currentB - (fB * (currentB - currentA)) / (fB - fA);
    const fx = evaluate(formula, { x });
    const error = Math.abs(x - (iterations.length > 0 ? iterations[iterations.length - 1].x : currentB));

    iterations.push({
      iteration: i + 1,
      x,
      f_x: fx,
      error,
      a: currentA,
      b: currentB
    });

    if (Math.abs(fx) < tolerance || error < tolerance) {
      root = x;
      converged = true;
      break;
    }

    if (fA * fx < 0) {
      currentB = x;
    } else {
      currentA = x;
    }
  }

  return { root: root ?? iterations[iterations.length - 1]?.x, iterations, converged };
};

// --- NEW ALGORITHMS ---

export const lagrange = (params: AlgorithmParams): AlgorithmOutput => {
  const { points, isTrigMode, useFunction } = params;
  if (!points || points.length < 2) return { iterations: [], converged: false, errorMsg: 'At least 2 puntos son requeridos' };

  const formatNum = (n: number) => {
    if (isTrigMode) {
      const pi = Math.PI;
      const pi2 = pi * pi;
      const ratio = n / pi;
      const roundedRatio = Math.round(ratio * 10000) / 10000;
      
      if (Math.abs(n) < 1e-10) return "0";
      
      // Check k/pi^2
      const p2 = n * pi2;
      if (Math.abs(p2 - Math.round(p2)) < 1e-6) {
        const k = Math.round(p2);
        if (k === 0) return "0";
        return `${k}/π²`;
      }

      // Check k/pi
      const p1 = n * pi;
      if (Math.abs(p1 - Math.round(p1)) < 1e-6) {
        const k = Math.round(p1);
        if (k === 0) return "0";
        return `${k}/π`;
      }

      // Check k*pi
      if (Math.abs(roundedRatio - 1) < 1e-6) return "π";
      if (Math.abs(roundedRatio + 1) < 1e-6) return "-π";

      const commonFractions = [
        { v: 0.5, s: "π/2" }, { v: -0.5, s: "-π/2" },
        { v: 0.3333, s: "π/3" }, { v: -0.3333, s: "-π/3" },
        { v: 0.25, s: "π/4" }, { v: -0.25, s: "-π/4" },
        { v: 0.6666, s: "2π/3" }, { v: -0.6666, s: "-2π/3" },
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
    const s = n.toFixed(6);
    return s.replace(/\.?0+$/, '');
  };

  const cleanMathString = (s: string) => {
    let cleaned = s;
    
    if (isTrigMode) {
      // Replace numeric pi with symbol
      // Use a more robust regex to match the full numeric value of pi or common approximations
      // We use lookarounds to ensure we match the whole number and not part of it
      cleaned = cleaned.replace(/(?<!\d)3\.14159265\d*(?!\d)/g, 'π');
      cleaned = cleaned.replace(/(?<!\d)6\.28318530\d*(?!\d)/g, '2π');
      cleaned = cleaned.replace(/(?<!\d)1\.57079632\d*(?!\d)/g, 'π/2');
      
      // More robust replacement for any multiple of pi that might be in the string
      cleaned = cleaned.replace(/(?<!\d)(\d+\.\d{6,})(?!\d)/g, (match) => {
        const n = parseFloat(match);
        const pi = Math.PI;
        const pi2 = pi * pi;
        
        // 1. Check n * pi^2 (k/pi^2) - Prioritize this for cases like 4/pi^2
        const p2 = n * pi2;
        if (Math.abs(p2 - Math.round(p2)) < 1e-7) {
          const k = Math.round(p2);
          if (k === 0) return "0";
          return `${k}/π²`;
        }

        // 2. Check n * pi (k/pi)
        const p1 = n * pi;
        if (Math.abs(p1 - Math.round(p1)) < 1e-7) {
          const k = Math.round(p1);
          if (k === 0) return "0";
          return `${k}/π`;
        }

        // 3. Check n / pi (k*pi)
        const r1 = n / pi;
        if (Math.abs(r1 - Math.round(r1)) < 1e-7) {
          const k = Math.round(r1);
          if (k === 0) return "0";
          if (k === 1) return "π";
          if (k === -1) return "-π";
          return `${k}π`;
        }

        // 4. Check n / pi^2 (k*pi^2)
        const r2 = n / pi2;
        if (Math.abs(r2 - Math.round(r2)) < 1e-7) {
          const k = Math.round(r2);
          if (k === 0) return "0";
          return `${k}π²`;
        }
        
        // 5. Check common fractions of pi
        const ratio = n / pi;
        const absRatio = Math.abs(ratio);
        const sign = ratio < 0 ? "-" : "";
        const commonFractions = [
          { v: 0.5, s: "π/2" }, { v: 0.3333, s: "π/3" }, { v: 0.25, s: "π/4" },
          { v: 0.6666, s: "2π/3" }, { v: 0.75, s: "3π/4" }, { v: 1.5, s: "3π/2" },
          { v: 0.125, s: "π/8" }, { v: 0.375, s: "3π/8" }, { v: 0.625, s: "5π/8" }, { v: 0.875, s: "7π/8" }
        ];
        for (const f of commonFractions) {
          if (Math.abs(absRatio - f.v) < 1e-4) return sign + f.s;
        }

        return match;
      });
    }

    // Remove trailing zeros after decimal point in mathjs output strings
    cleaned = cleaned.replace(/(\d+\.\d*?[1-9])0+(?!\d)/g, '$1')
                   .replace(/(\d+)\.0+(?!\d)/g, '$1');
    
    // Fix scientific notation in strings (e.g., 1.23e-7)
    cleaned = cleaned.replace(/(\d+\.?\d*)e([\+\-]\d+)/g, (match, num, exp) => {
      const n = parseFloat(match);
      if (Math.abs(n) < 1e-4) {
        return n.toFixed(12).replace(/\.?0+$/, '');
      }
      return match;
    });
    
    // Remove unnecessary spaces around operators (including ^)
    cleaned = cleaned.replace(/\s*([\+\-\*\/\^])\s*/g, '$1');
    
    // Format multiplications like 3 * x to 3x
    cleaned = cleaned.replace(/(\d+)\*x/g, '$1x');
    
    // Remove multiplication signs before parentheses
    cleaned = cleaned.replace(/(\d+)\*\(/g, '$1(');
    cleaned = cleaned.replace(/\)\*\(/g, ')(');
    
    // Remove 1*x or 1x to just x
    cleaned = cleaned.replace(/(^|[\+\-\(\/])1x/g, '$1x');
    
    // Replace ^ with superscript for better readability
    cleaned = cleaned.replace(/\^2/g, '²');
    cleaned = cleaned.replace(/\^3/g, '³');
    cleaned = cleaned.replace(/\^4/g, '⁴');
    cleaned = cleaned.replace(/\^5/g, '⁵');
    
    // Add spaces around + and - for readability, but not if they are signs
    cleaned = cleaned.replace(/([^\(])([\+\-])/g, '$1 $2 ');
    
    if (isTrigMode) {
      // Final pass for pi formatting in the string
      // Replace things like 3.14159... with π
      // We can use mathjs to simplify with pi as a symbol
    }

    return cleaned.trim();
  };

  const n = points.length;
  const parsedPoints = points.map(p => ({
    x: parseParam(p.x),
    y: parseParam(p.y)
  }));

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
      // Use rationalize to expand, then simplify to order and clean up
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
    // Fully expand and simplify the final polynomial using the raw expression (no π symbols yet)
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

  // --- Error Analysis ---
  let errorAnalysis: any = undefined;
  const { formula, evaluationPoint: rawEvalPoint } = params;
  const evaluationPoint = parseParam(rawEvalPoint);

  if (useFunction !== false && formula && formula.trim()) {
    try {
      const order = n; // n points means degree n-1, so we need n-th derivative
      let derivative = math.parse(formula);
      for (let i = 0; i < order; i++) {
        derivative = math.derivative(derivative, 'x');
      }
      const derivativeFormula = cleanMathString(derivative.toString());

      // Find max value of derivative in the interval
      const allX = parsedPoints.map(p => p.x);
      const minX = Math.min(...allX);
      const maxX = Math.max(...allX);
      let maxDerivativeValue = 0;
      const samples = 100;
      for (let i = 0; i <= samples; i++) {
        const xVal = minX + (maxX - minX) * (i / samples);
        const val = Math.abs(derivative.evaluate({ x: xVal }));
        if (val > maxDerivativeValue) maxDerivativeValue = val;
      }

      // g(x) = product(x - xi)
      let gExpr = "1";
      for (const p of parsedPoints) {
        gExpr = `(${gExpr}) * (x - ${p.x})`;
      }
      const gSimplified = math.simplify(gExpr);
      const gFormula = cleanMathString(gSimplified.toString());

      // g'(x)
      const gDerivative = math.derivative(gSimplified, 'x');
      const gDerivativeFormula = cleanMathString(gDerivative.toString());

      // Find critical points of g(x) (roots of g'(x))
      // Since g'(x) is a polynomial, we can find roots numerically
      const criticalPoints: number[] = [];
      const gDSamples = 200;
      for (let i = 0; i < gDSamples; i++) {
        const x1 = minX + (maxX - minX) * (i / gDSamples);
        const x2 = minX + (maxX - minX) * ((i + 1) / gDSamples);
        const y1 = gDerivative.evaluate({ x: x1 });
        const y2 = gDerivative.evaluate({ x: x2 });
        
        if (y1 * y2 <= 0) {
          // Root found between x1 and x2
          let root = (x1 + x2) / 2;
          // Simple Newton-Raphson to refine
          for (let j = 0; j < 5; j++) {
            const f = gDerivative.evaluate({ x: root });
            const df = math.derivative(gDerivative, 'x').evaluate({ x: root });
            if (Math.abs(df) > 1e-10) {
              root = root - f / df;
            }
          }
          if (root >= minX && root <= maxX) {
            if (!criticalPoints.some(p => Math.abs(p - root) < 1e-5)) {
              criticalPoints.push(root);
            }
          }
        }
      }
      criticalPoints.sort((a, b) => a - b);

      // Max value of |g(x)| at critical points
      let maxGValue = 0;
      for (const cp of criticalPoints) {
        const val = Math.abs(gSimplified.evaluate({ x: cp }));
        if (val > maxGValue) maxGValue = val;
      }

      // Global error bound
      const factorial = (num: number): number => {
        if (num <= 1) return 1;
        return num * factorial(num - 1);
      };
      const globalError = (maxDerivativeValue / factorial(order)) * maxGValue;

      // Local error at evaluationPoint
      let localError: number | undefined = undefined;
      if (!isNaN(evaluationPoint)) {
        const fVal = math.evaluate(formula, { x: evaluationPoint });
        const pVal = P(evaluationPoint);
        localError = Math.abs(fVal - pVal);
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
  } else if (useFunction !== false) {
    // If useFunction is true but no formula is provided, we can't do error analysis
    // but we don't want to show a generic error if it's just missing
  }

  // Generate curve points for plotting
  const allX = parsedPoints.map(p => p.x);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const range = maxX - minX;
  const plotMin = minX - range * 0.2;
  const plotMax = maxX + range * 0.2;
  const step = (plotMax - plotMin) / 100;
  
  const curvePoints = [];
  const hasOriginalFunction = useFunction !== false && formula && formula.trim();

  for (let x = plotMin; x <= plotMax; x += step) {
    const point: any = { x, y: P(x) };
    if (hasOriginalFunction) {
      try {
        const yOrig = evaluate(formula, { x });
        if (!isNaN(yOrig) && isFinite(yOrig)) {
          point.yOriginal = yOrig;
        }
      } catch (e) {}
    }
    curvePoints.push(point);
  }

  return {
    result: 'Polinomio de Lagrange calculado',
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
  const { formula, a: rawA, b: rawB, n, useFunction } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  if (isNaN(a) || isNaN(b) || !n) return { iterations: [], converged: false, errorMsg: 'A, B y n son requeridos' };

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
    const samples = 100;
    let maxD2 = 0;
    for (let i = 0; i <= samples; i++) {
      const xVal = a + (b - a) * (i / samples);
      const val = Math.abs(d2.evaluate({ x: xVal }));
      if (val > maxD2) maxD2 = val;
    }
    const errorBound = (Math.abs(b - a) / 12) * Math.pow(h, 2) * maxD2;
    errorAnalysis = {
      derivativeOrder: 2,
      derivativeFormula: d2.toString(),
      maxDerivativeValue: maxD2,
      globalError: errorBound,
      theoreticalFormula: '|E_t| \\le \\frac{|b - a|}{12} h^2 \\max|f\'\'(\\xi)|',
      substitutedFormula: `|E_t| \\le \\frac{${Math.abs(b - a).toFixed(4)}}{12} (${h.toFixed(4)})^2 (${maxD2.toExponential(4)})`
    };
  } catch (e) {}

  return {
    result: (sum * h).toFixed(8),
    iterations,
    converged: true,
    errorAnalysis
  };
};

export const simpson13 = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, n, useFunction } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  if (isNaN(a) || isNaN(b) || !n) return { iterations: [], converged: false, errorMsg: 'A, B y n son requeridos' };
  if (n % 2 !== 0) return { iterations: [], converged: false, errorMsg: 'n must be even for Simpson 1/3' };

  const h = (b - a) / n;
  const fa = evaluate(formula, { x: a });
  const fb = evaluate(formula, { x: b });
  if (isNaN(fa) || isNaN(fb)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };

  let sum = fa + fb;
  const iterations = [];
  
  iterations.push({ iteration: 0, x: a, f_x: fa, error: 0 });

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    const fx = evaluate(formula, { x });
    if (isNaN(fx)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };
    sum += (i % 2 === 0 ? 2 : 4) * fx;
    iterations.push({ iteration: i, x, f_x: fx, error: 0 });
  }
  
  iterations.push({ iteration: n, x: b, f_x: fb, error: 0 });

  let errorAnalysis = undefined;
  try {
    let d4 = math.derivative(formula, 'x');
    for (let i = 0; i < 3; i++) d4 = math.derivative(d4, 'x');
    const samples = 100;
    let maxD4 = 0;
    for (let i = 0; i <= samples; i++) {
      const xVal = a + (b - a) * (i / samples);
      const val = Math.abs(d4.evaluate({ x: xVal }));
      if (val > maxD4) maxD4 = val;
    }
    const errorBound = (Math.abs(b - a) / 180) * Math.pow(h, 4) * maxD4;
    errorAnalysis = {
      derivativeOrder: 4,
      derivativeFormula: d4.toString(),
      maxDerivativeValue: maxD4,
      globalError: errorBound,
      theoreticalFormula: '|E_t| \\le \\frac{|b - a|}{180} h^4 \\max|f^{(4)}(\\xi)|',
      substitutedFormula: `|E_t| \\le \\frac{${Math.abs(b - a).toFixed(4)}}{180} (${h.toFixed(4)})^4 (${maxD4.toExponential(4)})`
    };
  } catch (e) {}

  return {
    result: ((h / 3) * sum).toFixed(8),
    iterations,
    converged: true,
    errorAnalysis
  };
};

export const simpson38 = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, n, useFunction } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  if (isNaN(a) || isNaN(b) || !n) return { iterations: [], converged: false, errorMsg: 'A, B y n son requeridos' };
  if (n % 3 !== 0) return { iterations: [], converged: false, errorMsg: 'n must be multiple of 3 for Simpson 3/8' };

  const h = (b - a) / n;
  const fa = evaluate(formula, { x: a });
  const fb = evaluate(formula, { x: b });
  if (isNaN(fa) || isNaN(fb)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };

  let sum = fa + fb;
  const iterations = [];
  
  iterations.push({ iteration: 0, x: a, f_x: fa, error: 0 });

  for (let i = 1; i < n; i++) {
    const x = a + i * h;
    const fx = evaluate(formula, { x });
    if (isNaN(fx)) return { iterations: [], converged: false, errorMsg: 'Fórmula inválida o incompleta' };
    sum += (i % 3 === 0 ? 2 : 3) * fx;
    iterations.push({ iteration: i, x, f_x: fx, error: 0 });
  }
  
  iterations.push({ iteration: n, x: b, f_x: fb, error: 0 });

  let errorAnalysis = undefined;
  try {
    let d4 = math.derivative(formula, 'x');
    for (let i = 0; i < 3; i++) d4 = math.derivative(d4, 'x');
    const samples = 100;
    let maxD4 = 0;
    for (let i = 0; i <= samples; i++) {
      const xVal = a + (b - a) * (i / samples);
      const val = Math.abs(d4.evaluate({ x: xVal }));
      if (val > maxD4) maxD4 = val;
    }
    const errorBound = (Math.abs(b - a) / 80) * Math.pow(h, 4) * maxD4;
    errorAnalysis = {
      derivativeOrder: 4,
      derivativeFormula: d4.toString(),
      maxDerivativeValue: maxD4,
      globalError: errorBound,
      theoreticalFormula: '|E_t| \\le \\frac{|b - a|}{80} h^4 \\max|f^{(4)}(\\xi)|',
      substitutedFormula: `|E_t| \\le \\frac{${Math.abs(b - a).toFixed(4)}}{80} (${h.toFixed(4)})^4 (${maxD4.toExponential(4)})`
    };
  } catch (e) {}

  return {
    result: ((3 * h / 8) * sum).toFixed(8),
    iterations,
    converged: true,
    errorAnalysis
  };
};

export const midpoint = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, n, useFunction } = params;
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  if (isNaN(a) || isNaN(b) || !n) return { iterations: [], converged: false, errorMsg: 'A, B y n son requeridos' };

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
    const samples = 100;
    let maxD2 = 0;
    for (let i = 0; i <= samples; i++) {
      const xVal = a + (b - a) * (i / samples);
      const val = Math.abs(d2.evaluate({ x: xVal }));
      if (val > maxD2) maxD2 = val;
    }
    const errorBound = (Math.abs(b - a) / 24) * Math.pow(h, 2) * maxD2;
    errorAnalysis = {
      derivativeOrder: 2,
      derivativeFormula: d2.toString(),
      maxDerivativeValue: maxD2,
      globalError: errorBound,
      theoreticalFormula: '|E_m| \\le \\frac{|b - a|}{24} h^2 \\max|f\'\'(\\xi)|',
      substitutedFormula: `|E_m| \\le \\frac{${Math.abs(b - a).toFixed(4)}}{24} (${h.toFixed(4)})^2 (${maxD2.toExponential(4)})`
    };
  } catch (e) {}

  return {
    result: (sum * h).toFixed(8),
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
  if (isNaN(t0) || isNaN(y0) || isNaN(t_end) || isNaN(h)) 
    return { iterations: [], converged: false, errorMsg: 't0, y0, t_end y h son requeridos y deben ser válidos' };

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
        if (!isNaN(y_real)) {
          error = Math.abs(y - y_real);
        }
      } catch (e) {}
    }

    let next_y = y;
    let iterData: any = {
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
      // Predictor
      const fty1 = evaluate(formula, { t, y });
      if (isNaN(fty1)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
      const y_pred = y + h * fty1;
      
      // Corrector
      const fty2 = evaluate(formula, { t: t + h, y: y_pred });
      if (isNaN(fty2)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
      
      next_y = y + (h / 2) * (fty1 + fty2);
      
      iterData.fty1 = fty1;
      iterData.y_pred = y_pred;
      iterData.fty2 = fty2;
    } else {
      const k1_val = evaluate(formula, { t, y });
      if (isNaN(k1_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
      const k1 = h * k1_val;
      iterData.k1 = k1;

      if (rkOrder === 1) {
        next_y = y + k1;
      } else if (rkOrder === 2) {
        const k2_val = evaluate(formula, { t: t + h / 2, y: y + k1 / 2 });
        if (isNaN(k2_val)) return { result: 'Error', iterations, converged: false, errorMsg: 'Fórmula inválida o incompleta' };
        const k2 = h * k2_val;
        iterData.k2 = k2;
        next_y = y + k2;
      } else if (rkOrder === 3) {
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
    t = t + h;
    i++;
    if (i > 1000) break; // Safety
  }

  const methodName = odeMethod === 'euler' ? 'Euler' : `RK${rkOrder}`;
  return { result: `${methodName} calculado`, iterations, points, converged: true };
};

export const monteCarlo = (params: AlgorithmParams): AlgorithmOutput => {
  const { formula, a: rawA, b: rawB, c: rawC, d: rawD, e_limit: rawE, f_limit: rawF, maxIterations, seed, monteCarloMode, confidenceLevel = 95, dimensions = 1 } = params;
  
  const a = parseParam(rawA);
  const b = parseParam(rawB);
  const c = parseParam(rawC);
  const d = parseParam(rawD);
  const e_limit = parseParam(rawE);
  const f_limit = parseParam(rawF);
  
  // Z-score for confidence level
  const zScores: Record<number, number> = {
    90: 1.645,
    95: 1.96,
    99: 2.576
  };
  const z = zScores[confidenceLevel] || 1.96;

  let n = maxIterations || 10000;
  const iterations = [];
  const points: Point[] = [];
  
  // Initialize seeded random number generator
  const rng = seedrandom(seed?.toString() || Math.random().toString());

  if (monteCarloMode === 'pi') {
    // Pi calculation: Circle inscribed in 1x1 square
    let insideCount = 0;
    for (let i = 1; i <= n; i++) {
      const x = rng();
      const y = rng();
      
      const isInside = Math.pow(x - 0.5, 2) + Math.pow(y - 0.5, 2) <= 0.25;
      if (isInside) insideCount++;
      
      if (i <= 2000) {
        points.push({ x, y, inside: isInside });
      }

      if (i % Math.floor(n / 10) === 0 || i === n) {
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
    
    const result = (4 * insideCount) / n;
    const p = insideCount / n;
    const stdError = 4 * Math.sqrt((p * (1 - p)) / n);
    const ci = z * stdError;

    return { 
      result: result.toFixed(8), 
      iterations, 
      converged: true, 
      points,
      stats: {
        samples: n,
        mean: result,
        stdDev: Math.sqrt(p * (1 - p)) * 4,
        stdError: stdError,
        confidenceInterval: [result - ci, result + ci]
      },
      errorAnalysis: {
        globalError: Math.abs(Math.PI - result),
        theoreticalFormula: `IC (${confidenceLevel}%): [${(result - ci).toFixed(6)}, ${(result + ci).toFixed(6)}]`,
        substitutedFormula: `Éxitos: ${insideCount}/${n} | Error Est: ${stdError.toFixed(8)}`,
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
    // Integration using Average Value Method (Promedio) for 1D, 2D, 3D
    let sum = 0;
    let sumSq = 0;
    let volume = 1;

    if (dimensions >= 1 && !isNaN(a) && !isNaN(b)) volume *= (b - a);
    if (dimensions >= 2 && !isNaN(c) && !isNaN(d)) volume *= (d - c);
    if (dimensions >= 3 && !isNaN(e_limit) && !isNaN(f_limit)) volume *= (f_limit - e_limit);
    
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
      } catch(e) {}
      
      if (!isNaN(fx)) {
        sum += fx;
        sumSq += fx * fx;
      }
      
      if (i <= 2000) {
        if (dimensions === 1) points.push({ x, y: fx, inside: true });
        else if (dimensions === 2) points.push({ x, y, inside: true });
        else points.push({ x, y, inside: true });
      }

      if (i % Math.floor(n / 10) === 0 || i === n) {
        const currentEstimate = volume * (sum / i);
        iterations.push({ 
          iteration: i, 
          x, 
          f_x: fx, 
          error: 0,
          estimate: currentEstimate
        });
      }
    }
    
    const mean = sum / n;
    const result = volume * mean;
    const variance = (sumSq / n) - (mean * mean);
    const stdDev = Math.sqrt(Math.max(0, variance));
    const stdError = (stdDev / Math.sqrt(n)) * volume;
    const ci = z * stdError;

    return { 
      result: result.toFixed(8), 
      iterations, 
      converged: true, 
      points,
      stats: {
        samples: n,
        mean: result,
        stdDev: stdDev * volume,
        stdError: stdError,
        confidenceInterval: [result - ci, result + ci]
      },
      errorAnalysis: {
        globalError: ci,
        theoreticalFormula: `IC (${confidenceLevel}%): [${(result - ci).toFixed(6)}, ${(result + ci).toFixed(6)}]`,
        substitutedFormula: `Volumen: ${volume.toFixed(4)} | Error Est: ${stdError.toFixed(8)}`,
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
