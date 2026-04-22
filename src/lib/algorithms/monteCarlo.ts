import seedrandom from 'seedrandom';
import { AlgorithmParams, AlgorithmOutput, CurveRegion, CurveRegionSegment, Point } from '../../types';
import { evaluate, parseParam } from './shared';

const MAX_RENDER_POINTS = 1200;
const MAX_SNAPSHOTS = 300;

const shouldCheckConvergence = (iteration: number, totalIterations: number): boolean => {
  if (iteration === totalIterations) return true;
  if (iteration <= 10000) return iteration % 250 === 0;
  if (iteration <= 100000) return iteration % 1000 === 0;
  if (iteration <= 1000000) return iteration % 5000 === 0;
  return iteration % 25000 === 0;
};

const shouldStorePoint = (iteration: number, totalIterations: number): boolean => {
  const stride = Math.max(1, Math.ceil(totalIterations / MAX_RENDER_POINTS));
  return iteration === 1 || iteration === totalIterations || iteration % stride === 0;
};

const pushSnapshot = (snapshots: any[], snapshot: any) => {
  if (snapshots.length < MAX_SNAPSHOTS) {
    snapshots.push(snapshot);
    return;
  }

  const thinned = snapshots.filter((_, index) => index % 2 === 0);
  snapshots.splice(0, snapshots.length, ...thinned);
  snapshots.push(snapshot);
};

const estimateFunctionBounds1D = (formula: string, a: number, b: number): { min: number; max: number } | null => {
  const samples = 400;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples;
    const fx = evaluate(formula, { x });
    if (!Number.isFinite(fx)) continue;
    min = Math.min(min, fx);
    max = Math.max(max, fx);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    min -= 1;
    max += 1;
  }

  return { min: Math.min(min, 0), max: Math.max(max, 0) };
};

const classifyHitOrMissSample = (sampleY: number, fx: number): { sampleValue: number; inside: boolean; region: 'inside-positive' | 'inside-negative' | 'outside' } => {
  if (!Number.isFinite(fx)) {
    return { sampleValue: 0, inside: false, region: 'outside' };
  }

  if (fx >= 0 && sampleY >= 0 && sampleY <= fx) {
    return { sampleValue: 1, inside: true, region: 'inside-positive' };
  }

  if (fx < 0 && sampleY <= 0 && sampleY >= fx) {
    return { sampleValue: -1, inside: true, region: 'inside-negative' };
  }

  return { sampleValue: 0, inside: false, region: 'outside' };
};

const mergeCloseValues = (values: number[], tolerance = 1e-4): number[] => {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return [];

  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i] - merged[merged.length - 1]) > tolerance) {
      merged.push(sorted[i]);
    }
  }
  return merged;
};

const bisectIntersection = (curveA: string, curveB: string, left: number, right: number): number | null => {
  let a = left;
  let b = right;
  let fa = evaluate(curveA, { x: a }) - evaluate(curveB, { x: a });
  let fb = evaluate(curveA, { x: b }) - evaluate(curveB, { x: b });

  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (Math.abs(fa) < 1e-10) return a;
  if (Math.abs(fb) < 1e-10) return b;
  if (fa * fb > 0) return null;

  for (let i = 0; i < 60; i++) {
    const mid = (a + b) / 2;
    const fm = evaluate(curveA, { x: mid }) - evaluate(curveB, { x: mid });
    if (!Number.isFinite(fm)) return null;
    if (Math.abs(fm) < 1e-10 || Math.abs(b - a) < 1e-8) return mid;
    if (fa * fm <= 0) {
      b = mid;
      fb = fm;
    } else {
      a = mid;
      fa = fm;
    }
  }

  return (a + b) / 2;
};

const findCurveIntersections = (curveA: string, curveB: string, a: number, b: number): number[] => {
  const scanSamples = 800;
  const roots: number[] = [];

  for (let i = 0; i < scanSamples; i++) {
    const x1 = a + ((b - a) * i) / scanSamples;
    const x2 = a + ((b - a) * (i + 1)) / scanSamples;
    const f1 = evaluate(curveA, { x: x1 }) - evaluate(curveB, { x: x1 });
    const f2 = evaluate(curveA, { x: x2 }) - evaluate(curveB, { x: x2 });

    if (!Number.isFinite(f1) || !Number.isFinite(f2)) continue;
    if (Math.abs(f1) < 1e-7) roots.push(x1);
    if (Math.abs(f2) < 1e-7) roots.push(x2);
    if (f1 * f2 < 0) {
      const root = bisectIntersection(curveA, curveB, x1, x2);
      if (root !== null) roots.push(root);
    }
  }

  return mergeCloseValues(roots, 1e-4);
};

const estimateCurveCollectionBounds = (curves: string[], a: number, b: number): { min: number; max: number } | null => {
  const samples = 500;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const x = a + ((b - a) * i) / samples;
    for (const curve of curves) {
      const y = evaluate(curve, { x });
      if (!Number.isFinite(y)) continue;
      min = Math.min(min, y);
      max = Math.max(max, y);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min === max) {
    min -= 1;
    max += 1;
  }

  return { min, max };
};

type CurveRegionCell = CurveRegionSegment & {
  cellId: string;
  intervalIndex: number;
  signatureKey: string;
};

const detectClosedCurveRegions = (curves: string[], a: number, b: number): CurveRegion[] => {
  const allRoots: number[] = [];

  for (let i = 0; i < curves.length; i++) {
    for (let j = i + 1; j < curves.length; j++) {
      const roots = findCurveIntersections(curves[i], curves[j], a, b);
      if (roots.length === 0) continue;
      allRoots.push(...roots);
    }
  }

  const nodes = mergeCloseValues(allRoots, 1e-4);
  if (nodes.length < 2) return [];

  const cells: CurveRegionCell[] = [];
  const cellsByInterval = new Map<number, Map<string, CurveRegionCell>>();

  for (let i = 0; i < nodes.length - 1; i++) {
    const xStart = nodes[i];
    const xEnd = nodes[i + 1];
    if (xEnd - xStart < 1e-5) continue;

    const midX = (xStart + xEnd) / 2;
    const values = curves
      .map((curve, index) => ({ index, formula: curve, y: evaluate(curve, { x: midX }) }))
      .filter((entry) => Number.isFinite(entry.y))
      .sort((left, right) => left.y - right.y);

    const intervalCells = new Map<string, CurveRegionCell>();
    for (let j = 0; j < values.length - 1; j++) {
      const lower = values[j];
      const upper = values[j + 1];
      const signatureKey = values
        .slice(0, j + 1)
        .map((entry) => entry.index)
        .sort((left, right) => left - right)
        .join('|');

      const cell: CurveRegionCell = {
        xStart,
        xEnd,
        lowerCurveIndex: lower.index,
        upperCurveIndex: upper.index,
        lowerFormula: curves[lower.index],
        upperFormula: curves[upper.index],
        intervalIndex: i,
        signatureKey,
        cellId: `${i}:${signatureKey}`
      };

      cells.push(cell);
      intervalCells.set(signatureKey, cell);
    }

    cellsByInterval.set(i, intervalCells);
  }

  if (cells.length === 0) return [];

  const adjacency = new Map<string, Set<string>>();
  for (const cell of cells) {
    adjacency.set(cell.cellId, new Set<string>());
  }

  for (let i = 0; i < nodes.length - 2; i++) {
    const leftCells = cellsByInterval.get(i);
    const rightCells = cellsByInterval.get(i + 1);
    if (!leftCells || !rightCells) continue;

    for (const [signatureKey, leftCell] of leftCells.entries()) {
      const rightCell = rightCells.get(signatureKey);
      if (!rightCell) continue;
      adjacency.get(leftCell.cellId)?.add(rightCell.cellId);
      adjacency.get(rightCell.cellId)?.add(leftCell.cellId);
    }
  }

  const cellsById = new Map(cells.map((cell) => [cell.cellId, cell]));
  const visited = new Set<string>();
  const regions: CurveRegion[] = [];
  const closureTolerance = 1e-3;

  for (const cell of cells) {
    if (visited.has(cell.cellId)) continue;

    const stack = [cell.cellId];
    const component: CurveRegionCell[] = [];
    visited.add(cell.cellId);

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const current = cellsById.get(currentId);
      if (!current) continue;
      component.push(current);

      for (const neighborId of adjacency.get(currentId) || []) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        stack.push(neighborId);
      }
    }

    const segments = component
      .map<CurveRegionSegment>(({ xStart, xEnd, lowerCurveIndex, upperCurveIndex, lowerFormula, upperFormula }) => ({
        xStart,
        xEnd,
        lowerCurveIndex,
        upperCurveIndex,
        lowerFormula,
        upperFormula
      }))
      .sort((left, right) => left.xStart - right.xStart || left.lowerCurveIndex - right.lowerCurveIndex || left.upperCurveIndex - right.upperCurveIndex);

    const curveIndices = Array.from(
      new Set(segments.flatMap((segment) => [segment.lowerCurveIndex, segment.upperCurveIndex]))
    ).sort((left, right) => left - right);

    const regionStart = Math.min(...segments.map((segment) => segment.xStart));
    const regionEnd = Math.max(...segments.map((segment) => segment.xEnd));
    const hasClosedBoundaryAt = (boundaryX: number, side: 'start' | 'end') =>
      segments
        .filter((segment) => Math.abs((side === 'start' ? segment.xStart : segment.xEnd) - boundaryX) < 1e-5)
        .some((segment) => {
          const lower = evaluate(segment.lowerFormula, { x: boundaryX });
          const upper = evaluate(segment.upperFormula, { x: boundaryX });
          return Number.isFinite(lower) && Number.isFinite(upper) && Math.abs(lower - upper) < closureTolerance;
        });

    if (!hasClosedBoundaryAt(regionStart, 'start') || !hasClosedBoundaryAt(regionEnd, 'end')) {
      continue;
    }

    regions.push({
      xStart: regionStart,
      xEnd: regionEnd,
      segments,
      curveIndices,
      curveFormulas: curveIndices.map((index) => curves[index])
    });
  }

  return regions.sort((left, right) => left.xStart - right.xStart || left.xEnd - right.xEnd || left.curveIndices.length - right.curveIndices.length);
};

export const monteCarlo = (params: AlgorithmParams): AlgorithmOutput => {
  const {
    formula,
    a: rawA,
    b: rawB,
    c: rawC,
    d: rawD,
    curveBoundaryFunctions,
    selectedCurveRegionIndex: rawSelectedCurveRegionIndex,
    e_limit: rawE,
    f_limit: rawF,
    maxIterations,
    seed,
    monteCarloMode,
    confidenceLevel = 95,
    dimensions = 1,
    maxError: rawMaxError
  } = params;

  const a = parseParam(rawA);
  const b = parseParam(rawB);
  const c = parseParam(rawC);
  const d = parseParam(rawD);
  const e_limit = parseParam(rawE);
  const f_limit = parseParam(rawF);
  const maxErrorTarget = parseParam(rawMaxError);
  const hasErrorTarget = !isNaN(maxErrorTarget) && isFinite(maxErrorTarget) && maxErrorTarget > 0;

  const zScores: Record<number, number> = { 90: 1.645, 95: 1.96, 99: 2.576 };
  const z = zScores[confidenceLevel] || 1.96;

  const n = Math.max(1, maxIterations || 10000);
  const iterations = [];
  const points: Point[] = [];

  const rng = seedrandom(seed?.toString() || Math.random().toString());

  if (monteCarloMode === 'pi') {
    let insideCount = 0;
    let usedSamples = 0;

    for (let i = 1; i <= n; i++) {
      usedSamples = i;
      const x = rng();
      const y = rng();
      const isInside = (x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5) <= 0.25;
      if (isInside) insideCount++;

      if (shouldStorePoint(i, n)) {
        points.push({ x, y, inside: isInside });
      }

      if (shouldCheckConvergence(i, n)) {
        const currentPi = (4 * insideCount) / i;
        pushSnapshot(iterations, {
          iteration: i,
          x,
          f_x: y,
          error: Math.abs(Math.PI - currentPi),
          estimate: currentPi
        });
      }
    }

    const piEstimate = (4 * insideCount) / usedSamples;
    const p = insideCount / usedSamples;
    const stdDev = 4 * Math.sqrt(p * (1 - p));
    const stdError = stdDev / Math.sqrt(usedSamples);
    const ci = z * stdError;
    const reachedTarget = hasErrorTarget ? ci <= maxErrorTarget : true;
    const warningMsg = hasErrorTarget
      ? reachedTarget
        ? `Se alcanzo el error objetivo (${maxErrorTarget}) usando exactamente ${usedSamples} muestras.`
        : `No se alcanzo el error maximo objetivo (${maxErrorTarget}) usando exactamente ${usedSamples} muestras.`
      : undefined;

    return {
      result: piEstimate.toFixed(10),
      iterations,
      converged: true,
      ...(warningMsg ? { errorMsg: warningMsg } : {}),
      points,
      stats: {
        samples: usedSamples,
        mean: piEstimate,
        stdDev,
        stdError,
        confidenceInterval: [piEstimate - ci, piEstimate + ci]
      },
      errorAnalysis: {
        globalError: Math.abs(Math.PI - piEstimate),
        theoreticalFormula: `\\pi \\approx 4 \\cdot \\frac{\\text{exitos}}{n} \\quad \\text{IC}(${confidenceLevel}\\%): \\hat{\\pi} \\pm z \\cdot \\frac{\\hat{\\sigma}}{\\sqrt{n}}`,
        substitutedFormula: `\\hat{\\pi} = ${piEstimate.toFixed(6)},\\; \\text{Exitos} = ${insideCount}/${usedSamples},\\; \\hat{\\sigma} = ${stdDev.toFixed(6)}`,
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

  if (monteCarloMode === 'curveRegions') {
    if (isNaN(a) || isNaN(b)) {
      return { iterations: [], converged: false, errorMsg: 'Para regiones entre curvas se requieren limites validos en x: a y b' };
    }
    if (b <= a) {
      return { iterations: [], converged: false, errorMsg: 'Debe cumplirse a < b en el eje x' };
    }

    const curves = (curveBoundaryFunctions || []).map((curve) => curve.trim()).filter(Boolean);
    if (curves.length < 2) {
      return { iterations: [], converged: false, errorMsg: 'Debes ingresar al menos 2 curvas para detectar una region cerrada.' };
    }

    const curveBounds = estimateCurveCollectionBounds(curves, a, b);
    if (!curveBounds) {
      return { iterations: [], converged: false, errorMsg: 'No se pudieron estimar limites validos para las curvas ingresadas.' };
    }

    const curveRegions = detectClosedCurveRegions(curves, a, b);

    const selectedCurveRegionIndex = rawSelectedCurveRegionIndex === undefined || rawSelectedCurveRegionIndex === '' || rawSelectedCurveRegionIndex === 'all'
      ? 'all'
      : Number(rawSelectedCurveRegionIndex);

    const rectangleArea = (b - a) * (curveBounds.max - curveBounds.min);
    let insideCount = 0;
    let usedSamples = 0;

    // Buscamos el mejor split inferior/superior probando todas las C(n, halfN) combinaciones.
    // La ganadora es la que forma la región CERRADA con mayor área en [a, b].
    const halfN = Math.floor(curves.length / 2);

    const getCombinations = (arr: number[], k: number): number[][] => {
      if (k === 0) return [[]];
      if (arr.length === k) return [arr.slice()];
      const [head, ...tail] = arr;
      return [
        ...getCombinations(tail, k - 1).map((c) => [head, ...c]),
        ...getCombinations(tail, k)
      ];
    };

    const evalSplit = (lowerSet: Set<number>): { area: number; closedAtRight: boolean } => {
      const N = 120;
      let area = 0;
      let closedAtRight = false;
      for (let si = 0; si <= N; si++) {
        const xScan = a + ((b - a) * si) / N;
        let lo = -Infinity;
        let hi = Infinity;
        let allOk = true;
        for (let i = 0; i < curves.length; i++) {
          const v = evaluate(curves[i], { x: xScan });
          if (!Number.isFinite(v)) { allOk = false; break; }
          if (lowerSet.has(i)) lo = Math.max(lo, v); else hi = Math.min(hi, v);
        }
        if (!allOk) continue;
        if (lo < hi) area += (hi - lo) * (b - a) / N;
        if (si === N) closedAtRight = lo >= hi;
      }
      return { area, closedAtRight };
    };

    const allIdx = curves.map((_, i) => i);
    const combos = halfN > 0 ? getCombinations(allIdx, halfN) : [[]];
    let lowerIndices = new Set(combos[0]);
    let bestArea = -Infinity;
    for (const combo of combos) {
      const ls = new Set(combo);
      const { area, closedAtRight } = evalSplit(ls);
      if (closedAtRight && area > bestArea) { bestArea = area; lowerIndices = ls; }
    }

    const isPointInsideRegion = (xValue: number, yValue: number): boolean => {
      let lo = -Infinity;
      let hi = Infinity;
      for (let i = 0; i < curves.length; i++) {
        const v = evaluate(curves[i], { x: xValue });
        if (!Number.isFinite(v)) return false;
        if (lowerIndices.has(i)) lo = Math.max(lo, v); else hi = Math.min(hi, v);
      }
      return lo <= hi && yValue >= lo && yValue <= hi;
    };

    for (let i = 1; i <= n; i++) {
      usedSamples = i;
      const x = a + rng() * (b - a);
      const y = curveBounds.min + rng() * (curveBounds.max - curveBounds.min);
      const inside = isPointInsideRegion(x, y);
      if (inside) insideCount++;

      if (shouldStorePoint(i, n)) {
        points.push({ x, y, inside, region: inside ? 'inside-region' : 'outside' });
      }

      if (shouldCheckConvergence(i, n)) {
        const estimate = rectangleArea * (insideCount / i);
        const pHat = insideCount / i;
        const varianceNow = pHat * (1 - pHat);
        const stdErrorNow = Math.sqrt(varianceNow / i) * rectangleArea;
        pushSnapshot(iterations, {
          iteration: i,
          x,
          f_x: y,
          error: z * stdErrorNow,
          estimate
        });
      }
    }

    const pHat = insideCount / usedSamples;
    const result = rectangleArea * pHat;
    const stdDevIndicator = Math.sqrt(pHat * (1 - pHat));
    const stdDev = stdDevIndicator * rectangleArea;
    const stdError = (stdDevIndicator / Math.sqrt(usedSamples)) * rectangleArea;
    const ci = z * stdError;
    const reachedTarget = hasErrorTarget ? ci <= maxErrorTarget : true;
    const warningMsg = hasErrorTarget
      ? reachedTarget
        ? `Se alcanzo el error objetivo (${maxErrorTarget}) usando exactamente ${usedSamples} muestras.`
        : `No se alcanzo el error maximo objetivo (${maxErrorTarget}) usando exactamente ${usedSamples} muestras.`
      : undefined;

    return {
      result: result.toFixed(10),
      iterations,
      converged: true,
      ...(warningMsg ? { errorMsg: warningMsg } : {}),
      points,
      curveRegions,
      curveBoundaryFunctions: curves,
      selectedCurveRegionIndex,
      stats: {
        samples: usedSamples,
        mean: result,
        stdDev,
        stdError,
        confidenceInterval: [result - ci, result + ci]
      },
      errorAnalysis: {
        globalError: ci,
        theoreticalFormula: `A \\approx A_{rect} \\cdot \\frac{\\text{puntos\\ dentro}}{n} \\quad \\text{IC}(${confidenceLevel}\\%): A \\pm z \\cdot \\frac{A_{rect}\\hat{\\sigma}}{\\sqrt{n}}`,
        substitutedFormula: `\\hat{A} = ${result.toFixed(6)},\\; A_{rect} = ${rectangleArea.toFixed(4)},\\; \\text{Dentro} = ${insideCount}/${usedSamples}`,
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

  if (isNaN(a) || isNaN(b)) {
    return { iterations: [], converged: false, errorMsg: 'Para integracion Monte Carlo se requieren limites validos en x: a y b' };
  }
  if (b <= a) {
    return { iterations: [], converged: false, errorMsg: 'Debe cumplirse a < b en el eje x' };
  }
  if (dimensions >= 2) {
    if (isNaN(c) || isNaN(d)) {
      return { iterations: [], converged: false, errorMsg: 'Para integracion 2D se requieren limites validos en y: c y d' };
    }
    if (d <= c) {
      return { iterations: [], converged: false, errorMsg: 'Debe cumplirse c < d en el eje y' };
    }
  }
  if (dimensions >= 3) {
    if (isNaN(e_limit) || isNaN(f_limit)) {
      return { iterations: [], converged: false, errorMsg: 'Para integracion 3D se requieren limites validos en z: e y f' };
    }
    if (f_limit <= e_limit) {
      return { iterations: [], converged: false, errorMsg: 'Debe cumplirse e < f en el eje z' };
    }
  }

  const integrationVizBounds = dimensions === 1 ? estimateFunctionBounds1D(formula, a, b) : null;
  if (dimensions === 1 && !integrationVizBounds) {
    return {
      iterations: [],
      converged: false,
      errorMsg: 'No se pudieron estimar limites validos para la funcion en el intervalo dado.'
    };
  }

  let volume = 1;
  volume *= (b - a);
  if (dimensions >= 2) volume *= (d - c);
  if (dimensions >= 3) volume *= (f_limit - e_limit);

  const rectangleArea1D = dimensions === 1 && integrationVizBounds
    ? (b - a) * (integrationVizBounds.max - integrationVizBounds.min)
    : 0;

  let usedSamples = 0;
  let count = 0;
  let meanRunning = 0;
  let M2 = 0;

  for (let i = 1; i <= n; i++) {
    usedSamples = i;
    const x = a + rng() * (b - a);
    const y = dimensions >= 2 ? c + rng() * (d - c) : 0;
    const zVal = dimensions >= 3 ? e_limit + rng() * (f_limit - e_limit) : 0;

    let fx = 0;
    try {
      const scope: Record<string, number> = { x };
      if (dimensions >= 2) scope.y = y;
      if (dimensions >= 3) scope.z = zVal;
      fx = evaluate(formula, scope);
    } catch {
      fx = NaN;
    }

    const sampleY = dimensions === 1
      ? integrationVizBounds!.min + rng() * (integrationVizBounds!.max - integrationVizBounds!.min)
      : 0;
    const classification = dimensions === 1
      ? classifyHitOrMissSample(sampleY, fx)
      : null;
    const sampleValue = dimensions === 1
      ? classification!.sampleValue
      : fx;

    if (!isNaN(sampleValue) && isFinite(sampleValue)) {
      count++;
      const delta = sampleValue - meanRunning;
      meanRunning += delta / count;
      const delta2 = sampleValue - meanRunning;
      M2 += delta * delta2;
    }

    if (shouldStorePoint(i, n)) {
      if (dimensions === 1) {
        points.push({ x, y: sampleY, inside: classification!.inside, region: classification!.region });
      } else {
        points.push({ x, y, inside: true });
      }
    }

    if (shouldCheckConvergence(i, n)) {
      const currentEstimate = (dimensions === 1 ? rectangleArea1D : volume) * meanRunning;
      const varianceNow = count > 1 ? M2 / (count - 1) : NaN;
      const measure = dimensions === 1 ? rectangleArea1D : volume;
      const stdErrorNow = count > 1 ? (Math.sqrt(Math.max(0, varianceNow)) / Math.sqrt(count)) * measure : NaN;
      const ciNow = count > 1 ? z * stdErrorNow : NaN;
      pushSnapshot(iterations, {
        iteration: i,
        x,
        f_x: fx,
        error: ciNow,
        estimate: currentEstimate
      });
    }
  }

  if (count === 0) {
    return {
      iterations,
      converged: false,
      points,
      errorMsg: 'No se obtuvieron muestras validas: revisa la formula y los limites de integracion.'
    };
  }

  if (count < 2) {
    const measure = dimensions === 1 ? rectangleArea1D : volume;
    return {
      result: (measure * meanRunning).toFixed(10),
      iterations,
      converged: false,
      points,
      errorMsg: 'Muestras validas insuficientes para estimar la incertidumbre (se requieren al menos 2).'
    };
  }

  const measure = dimensions === 1 ? rectangleArea1D : volume;
  const result = measure * meanRunning;
  const varianceF = M2 / (count - 1);
  const stdDevF = Math.sqrt(Math.max(0, varianceF));
  const stdDev = stdDevF * measure;
  const stdError = (stdDevF / Math.sqrt(count)) * measure;
  const ci = z * stdError;
  const reachedTarget = hasErrorTarget ? ci <= maxErrorTarget : true;
  const warningMsg = hasErrorTarget
    ? reachedTarget
      ? `Se alcanzo el error objetivo (${maxErrorTarget}) usando exactamente ${usedSamples} muestras (${count} validas).`
      : `No se alcanzo el error maximo objetivo (${maxErrorTarget}) usando exactamente ${usedSamples} muestras (${count} validas).`
    : undefined;

  return {
    result: result.toFixed(10),
    iterations,
    converged: true,
    ...(warningMsg ? { errorMsg: warningMsg } : {}),
    points,
    stats: {
      samples: usedSamples,
      mean: result,
      stdDev,
      stdError,
      confidenceInterval: [result - ci, result + ci]
    },
    errorAnalysis: {
      globalError: ci,
      theoreticalFormula: dimensions === 1
        ? `I \\approx A_{rect} \\cdot \\overline{H} \\quad \\text{IC}(${confidenceLevel}\\%): I \\pm z \\cdot \\frac{A_{rect} \\cdot \\hat{\\sigma}_H}{\\sqrt{n}}`
        : `I \\approx V \\cdot \\bar{f} \\quad \\text{IC}(${confidenceLevel}\\%): I \\pm z \\cdot \\frac{V \\cdot \\hat{\\sigma}_f}{\\sqrt{n}}`,
      substitutedFormula: dimensions === 1
        ? `\\hat{I} = ${result.toFixed(6)},\\; A_{rect} = ${rectangleArea1D.toFixed(4)},\\; \\hat{\\sigma}_H = ${stdDevF.toFixed(6)},\\; n = ${count}`
        : `\\hat{I} = ${result.toFixed(6)},\\; V = ${volume.toFixed(4)},\\; \\hat{\\sigma}_f = ${stdDevF.toFixed(6)},\\; n_{validas} = ${count}`,
      derivativeOrder: 0,
      derivativeFormula: '',
      maxDerivativeValue: 0,
      gFormula: '',
      gDerivativeFormula: '',
      criticalPoints: [],
      maxGValue: 0
    }
  };
};
