import { AlgorithmParams, AlgorithmOutput } from '../../types';
import { math, parseParam } from './shared';

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

