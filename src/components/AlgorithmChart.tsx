import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { CurveRegion, IterationResult, Point } from '../types';
import { evaluate } from '../lib/algorithms';
import { RefreshCcw, Search, MousePointer2, Plus, Minus } from 'lucide-react';

interface ChartProps {
  formula: string;
  g_formula?: string;
  yLowerFormula?: string;
  yUpperFormula?: string;
  curveBoundaryFunctions?: string[];
  curveRegions?: CurveRegion[];
  chartKind?: 'line' | 'montecarlo-pi' | 'montecarlo-integration' | 'montecarlo-curve-regions';
  derivativeFormula?: string;
  showYEqualsX?: boolean;
  iterations: IterationResult[];
  range?: [number, number];
  points?: Point[];
  monteCarloMode?: 'pi' | 'integration' | 'curveRegions';
  dimensions?: 1 | 2 | 3;
  exactFormula?: string;
  evaluationPoint?: number;
}

type NumericDomain = [number | string, number | string];
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const normalizeBounds = (bounds: Bounds): Bounds => {
  let { minX, maxX, minY, maxY } = bounds;

  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  return { minX, maxX, minY, maxY };
};

const padBounds = (bounds: Bounds, paddingRatio = 0.08): Bounds => {
  const normalized = normalizeBounds(bounds);
  const padX = (normalized.maxX - normalized.minX) * paddingRatio;
  const padY = (normalized.maxY - normalized.minY) * paddingRatio;

  return {
    minX: normalized.minX - padX,
    maxX: normalized.maxX + padX,
    minY: normalized.minY - padY,
    maxY: normalized.maxY + padY
  };
};

const boundsToDomains = (bounds: Bounds): { x: NumericDomain; y: NumericDomain } => ({
  x: [bounds.minX, bounds.maxX],
  y: [bounds.minY, bounds.maxY]
});

const domainsToBounds = (domainX: NumericDomain, domainY: NumericDomain, fallback: Bounds): Bounds => {
  const [minX, maxX] = resolveDomain(domainX, [fallback.minX, fallback.maxX]);
  const [minY, maxY] = resolveDomain(domainY, [fallback.minY, fallback.maxY]);
  return normalizeBounds({ minX, maxX, minY, maxY });
};

const clampSpan = (span: number, baseSpan: number) => {
  const safeBase = Math.max(Math.abs(baseSpan), 1e-6);
  return Math.min(Math.max(span, safeBase / 5000), safeBase * 5000);
};

const zoomBoundsAtPoint = (current: Bounds, base: Bounds, anchorXRatio: number, anchorYRatio: number, factor: number): Bounds => {
  const currentSpanX = current.maxX - current.minX;
  const currentSpanY = current.maxY - current.minY;
  const baseSpanX = base.maxX - base.minX;
  const baseSpanY = base.maxY - base.minY;

  const nextSpanX = clampSpan(currentSpanX * factor, baseSpanX);
  const nextSpanY = clampSpan(currentSpanY * factor, baseSpanY);

  const worldX = current.minX + currentSpanX * anchorXRatio;
  const worldY = current.maxY - currentSpanY * anchorYRatio;

  const nextMinX = worldX - nextSpanX * anchorXRatio;
  const nextMaxX = nextMinX + nextSpanX;
  const nextMaxY = worldY + nextSpanY * anchorYRatio;
  const nextMinY = nextMaxY - nextSpanY;

  return normalizeBounds({
    minX: nextMinX,
    maxX: nextMaxX,
    minY: nextMinY,
    maxY: nextMaxY
  });
};

const panBounds = (current: Bounds, deltaXPx: number, deltaYPx: number, width: number, height: number): Bounds => {
  const spanX = current.maxX - current.minX;
  const spanY = current.maxY - current.minY;
  const shiftX = -(deltaXPx / Math.max(1, width)) * spanX;
  const shiftY = (deltaYPx / Math.max(1, height)) * spanY;

  return {
    minX: current.minX + shiftX,
    maxX: current.maxX + shiftX,
    minY: current.minY + shiftY,
    maxY: current.maxY + shiftY
  };
};

const wheelZoomFactor = (deltaY: number) => Math.min(1.35, Math.max(0.7, Math.exp(deltaY * 0.0015)));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length && typeof label === 'number') {
    const iterationPoint = payload.find((p: any) => p.payload.iteration !== undefined);

    return (
      <div className="min-w-[180px] rounded-xl border border-black/10 bg-white/95 p-3 text-xs shadow-xl backdrop-blur-sm">
        <p className="mb-2 flex items-center justify-between border-b border-black/5 pb-1 font-bold text-gray-900">
          <span>x = {label.toFixed(6)}</span>
          {iterationPoint && (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-emerald-700">
              Iteracion {iterationPoint.payload.iteration}
            </span>
          )}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="font-medium text-gray-600">{entry.name}:</span>
              </span>
              <span className="font-mono font-bold text-gray-900">
                {typeof entry.value === 'number' ? entry.value.toFixed(6) : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const getBoundsFromPoints = (points: Array<Record<string, any>>, yKey = 'y'): Bounds | null => {
  const xs = points.map((point) => Number(point.x)).filter(Number.isFinite);
  const ys = points.map((point) => Number(point[yKey])).filter(Number.isFinite);
  if (xs.length === 0 || ys.length === 0) return null;

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  if (minX === maxX) {
    minX -= 1;
    maxX += 1;
  }
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  return { minX, maxX, minY, maxY };
};

const resolveDomain = (domain: NumericDomain, fallback: [number, number]): [number, number] => [
  domain[0] === 'auto' ? fallback[0] : Number(domain[0]),
  domain[1] === 'auto' ? fallback[1] : Number(domain[1])
];

const estimateFormulaBounds1D = (formula: string, minX: number, maxX: number): [number, number] | null => {
  const samples = 400;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const x = minX + ((maxX - minX) * i) / samples;
    const y = evaluate(formula, { x });
    if (!Number.isFinite(y)) continue;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null;
  return [Math.min(minY, 0), Math.max(maxY, 0)];
};

const estimateRegionBounds2D = (lowerFormula: string, upperFormula: string, minX: number, maxX: number): [number, number] | null => {
  const samples = 400;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const x = minX + ((maxX - minX) * i) / samples;
    const lower = evaluate(lowerFormula, { x });
    const upper = evaluate(upperFormula, { x });
    if (!Number.isFinite(lower) || !Number.isFinite(upper)) continue;
    minY = Math.min(minY, lower, upper);
    maxY = Math.max(maxY, lower, upper);
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null;
  return [minY, maxY];
};

const estimateCurveCollectionBounds = (curves: string[], minX: number, maxX: number): [number, number] | null => {
  const samples = 400;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const x = minX + ((maxX - minX) * i) / samples;
    for (const curve of curves) {
      const y = evaluate(curve, { x });
      if (!Number.isFinite(y)) continue;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }

  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) return null;
  return [minY, maxY];
};

const buildMonteCarloBaseBounds = ({
  mode,
  dimensions = 1,
  points,
  formula,
  yLowerFormula,
  yUpperFormula,
  curveBoundaryFunctions
}: {
  mode?: 'pi' | 'integration' | 'curveRegions';
  dimensions?: 1 | 2 | 3;
  points?: Point[];
  formula?: string;
  yLowerFormula?: string;
  yUpperFormula?: string;
  curveBoundaryFunctions?: string[];
}): Bounds | null => {
  if (mode === 'pi') {
    return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
  }

  // For curveRegions with no points yet, derive bounds directly from curves on [0,1]
  if (mode === 'curveRegions' && curveBoundaryFunctions && curveBoundaryFunctions.length > 1 && (!points || points.length === 0)) {
    const curveBounds = estimateCurveCollectionBounds(curveBoundaryFunctions, 0, 1);
    if (curveBounds) {
      return padBounds({ minX: 0, maxX: 1, minY: curveBounds[0], maxY: curveBounds[1] }, 0.06);
    }
  }

  if (!points || points.length === 0) return null;

  const pointBounds = getBoundsFromPoints(points as any);
  if (!pointBounds) return null;

  let nextBounds = pointBounds;

  if (curveBoundaryFunctions && curveBoundaryFunctions.length > 1) {
    const curveBounds = estimateCurveCollectionBounds(curveBoundaryFunctions, pointBounds.minX, pointBounds.maxX);
    if (curveBounds) {
      nextBounds = {
        ...nextBounds,
        minY: Math.min(nextBounds.minY, curveBounds[0]),
        maxY: Math.max(nextBounds.maxY, curveBounds[1])
      };
    }
  } else if (dimensions === 1 && formula) {
    const formulaBounds = estimateFormulaBounds1D(formula, pointBounds.minX, pointBounds.maxX);
    if (formulaBounds) {
      nextBounds = {
        ...nextBounds,
        minY: Math.min(nextBounds.minY, formulaBounds[0]),
        maxY: Math.max(nextBounds.maxY, formulaBounds[1])
      };
    }
  } else if (dimensions === 2 && yLowerFormula && yUpperFormula) {
    const regionBounds = estimateRegionBounds2D(yLowerFormula, yUpperFormula, pointBounds.minX, pointBounds.maxX);
    if (regionBounds) {
      nextBounds = {
        ...nextBounds,
        minY: Math.min(nextBounds.minY, regionBounds[0]),
        maxY: Math.max(nextBounds.maxY, regionBounds[1])
      };
    }
  }

  return padBounds(nextBounds, 0.06);
};

const zoomDomain = (domain: NumericDomain, bounds: [number, number], factor: number): [number, number] => {
  const [currentMin, currentMax] = resolveDomain(domain, bounds);
  const center = (currentMin + currentMax) / 2;
  const nextHalf = Math.max(((currentMax - currentMin) * factor) / 2, (bounds[1] - bounds[0]) / 500);

  let nextMin = center - nextHalf;
  let nextMax = center + nextHalf;

  if (nextMin < bounds[0]) {
    nextMin = bounds[0];
    nextMax = Math.min(bounds[1], nextMin + nextHalf * 2);
  }
  if (nextMax > bounds[1]) {
    nextMax = bounds[1];
    nextMin = Math.max(bounds[0], nextMax - nextHalf * 2);
  }

  return [nextMin, nextMax];
};

const MonteCarloCanvas: React.FC<{
  points: Point[];
  mode: 'pi' | 'integration';
  dimensions?: 1 | 2 | 3;
  formula?: string;
  yLowerFormula?: string;
  yUpperFormula?: string;
  curveBoundaryFunctions?: string[];
  curveRegions?: CurveRegion[];
  domainX?: NumericDomain;
  domainY?: NumericDomain;
}> = ({ points, mode, dimensions = 1, formula, yLowerFormula, yUpperFormula, curveBoundaryFunctions, curveRegions, domainX = ['auto', 'auto'], domainY = ['auto', 'auto'] }) => {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = React.useState({ width: 640, height: 640 });

  React.useEffect(() => {
    if (!wrapperRef.current) return;

    const updateSize = () => {
      if (!wrapperRef.current) return;
      setSize({
        width: Math.max(320, Math.floor(wrapperRef.current.clientWidth)),
        height: Math.max(320, Math.floor(wrapperRef.current.clientHeight))
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size.width, size.height);

    const padding = 28;

    let fallbackX: [number, number] = [0, 1];
    let fallbackY: [number, number] = [0, 1];
    if (mode === 'integration') {
      if (points.length > 0) {
        const xs = points.map((point) => Number(point.x)).filter(Number.isFinite);
        const ys = points.map((point) => Number(point.y)).filter(Number.isFinite);
        if (xs.length > 0 && ys.length > 0) {
          fallbackX = [Math.min(...xs), Math.max(...xs)];
          fallbackY = [Math.min(...ys), Math.max(...ys)];
        }
      }

      if (curveBoundaryFunctions && curveBoundaryFunctions.length > 1) {
        const regionBounds = estimateCurveCollectionBounds(curveBoundaryFunctions, fallbackX[0], fallbackX[1]);
        if (regionBounds) {
          fallbackY = [
            Math.min(fallbackY[0], regionBounds[0]),
            Math.max(fallbackY[1], regionBounds[1])
          ];
        }
      } else if (dimensions === 1 && formula) {
        const formulaBounds = estimateFormulaBounds1D(formula, fallbackX[0], fallbackX[1]);
        if (formulaBounds) {
          fallbackY = [
            Math.min(fallbackY[0], formulaBounds[0]),
            Math.max(fallbackY[1], formulaBounds[1])
          ];
        }
      } else if (dimensions === 2 && yLowerFormula && yUpperFormula) {
        const regionBounds = estimateRegionBounds2D(yLowerFormula, yUpperFormula, fallbackX[0], fallbackX[1]);
        if (regionBounds) {
          fallbackY = [
            Math.min(fallbackY[0], regionBounds[0]),
            Math.max(fallbackY[1], regionBounds[1])
          ];
        }
      }
    }

    const [minX, maxX] = resolveDomain(domainX, fallbackX);
    const [minY, maxY] = resolveDomain(domainY, fallbackY);

    let plotX = padding;
    let plotY = padding;
    let plotWidth = size.width - padding * 2;
    let plotHeight = size.height - padding * 2;

    if (mode === 'pi') {
      const side = Math.min(plotWidth, plotHeight);
      plotWidth = side;
      plotHeight = side;
      plotX = (size.width - side) / 2;
      plotY = (size.height - side) / 2;
    }

    ctx.strokeStyle = '#e7e5e4';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = plotY + (plotHeight / 4) * i;
      const x = plotX + (plotWidth / 4) * i;
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotWidth, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, plotY);
      ctx.lineTo(x, plotY + plotHeight);
      ctx.stroke();
    }

    const spanX = Math.max(maxX - minX, 1e-9);
    const spanY = Math.max(maxY - minY, 1e-9);
    const projectX = (value: number) => plotX + ((value - minX) / spanX) * plotWidth;
    const projectY = (value: number) => plotY + plotHeight - ((value - minY) / spanY) * plotHeight;

    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 1;
    ctx.strokeRect(plotX, plotY, plotWidth, plotHeight);

    if (mode === 'pi') {
      const radius = plotWidth / 2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(plotX + plotWidth / 2, plotY + plotHeight / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (mode === 'integration' && dimensions === 3) {
      ctx.fillStyle = '#78716c';
      ctx.font = '12px sans-serif';
      ctx.fillText('Vista proyectada x-y', plotX + 8, plotY + 18);
    }

    if (mode === 'integration' && dimensions === 1 && formula && !(curveBoundaryFunctions && curveBoundaryFunctions.length > 1)) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
      let startedFill = false;
      const fillSamples = Math.max(300, Math.floor(plotWidth));
      for (let i = 0; i <= fillSamples; i++) {
        const x = minX + (spanX * i) / fillSamples;
        const y = evaluate(formula, { x });
        if (!Number.isFinite(y)) continue;
        const px = projectX(x);
        const py = projectY(y);
        if (!startedFill) {
          ctx.moveTo(px, projectY(0));
          ctx.lineTo(px, py);
          startedFill = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      if (startedFill) {
        ctx.lineTo(projectX(maxX), projectY(0));
        ctx.closePath();
        ctx.fill();
      }

      const pointRadius = 1.6;
      for (const point of points) {
        const rawX = Number(point.x);
        const rawY = Number(point.y);
        if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;
        if (rawX < minX || rawX > maxX || rawY < minY || rawY > maxY) continue;

        ctx.beginPath();
        ctx.fillStyle = point.region === 'inside-positive'
          ? 'rgba(16, 185, 129, 0.82)'
          : point.region === 'inside-negative'
            ? 'rgba(249, 115, 22, 0.82)'
            : 'rgba(37, 99, 235, 0.82)';
        ctx.arc(projectX(rawX), projectY(rawY), pointRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.4;
      let started = false;
      const samples = Math.max(300, Math.floor(plotWidth));
      for (let i = 0; i <= samples; i++) {
        const x = minX + (spanX * i) / samples;
        const y = evaluate(formula, { x });
        if (!Number.isFinite(y)) {
          started = false;
          continue;
        }

        const px = projectX(x);
        const py = projectY(y);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    } else {
      if (mode === 'integration' && curveBoundaryFunctions && curveBoundaryFunctions.length > 1) {
        const samples = Math.max(300, Math.floor(plotWidth));
        const palette = ['#2563eb', '#7c3aed', '#dc2626', '#0f766e', '#ca8a04', '#db2777'];

        const nCurves = curveBoundaryFunctions.length;
        const halfNCurves = Math.floor(nCurves / 2);

        const getCombinationsCanvas = (arr: number[], k: number): number[][] => {
          if (k === 0) return [[]];
          if (arr.length === k) return [arr.slice()];
          const [head, ...tail] = arr;
          return [
            ...getCombinationsCanvas(tail, k - 1).map((c) => [head, ...c]),
            ...getCombinationsCanvas(tail, k)
          ];
        };

        const evalSplitCanvas = (lowerSet: Set<number>): { area: number; closedAtRight: boolean } => {
          const N = 120;
          let area = 0;
          let closedAtRight = false;
          for (let si = 0; si <= N; si++) {
            const xScan = minX + ((maxX - minX) * si) / N;
            let lo = -Infinity;
            let hi = Infinity;
            let allOk = true;
            for (let i = 0; i < curveBoundaryFunctions.length; i++) {
              const v = evaluate(curveBoundaryFunctions[i], { x: xScan });
              if (!Number.isFinite(v)) { allOk = false; break; }
              if (lowerSet.has(i)) lo = Math.max(lo, v); else hi = Math.min(hi, v);
            }
            if (!allOk) continue;
            if (lo < hi) area += (hi - lo) * (maxX - minX) / N;
            if (si === N) closedAtRight = lo >= hi;
          }
          return { area, closedAtRight };
        };

        const allIdxCanvas = curveBoundaryFunctions.map((_, i) => i);
        const combosCanvas = halfNCurves > 0 ? getCombinationsCanvas(allIdxCanvas, halfNCurves) : [[]];
        let lowerIdxSet = new Set<number>(combosCanvas[0]);
        let bestAreaCanvas = -Infinity;
        for (const combo of combosCanvas) {
          const ls = new Set(combo);
          const { area, closedAtRight } = evalSplitCanvas(ls);
          if (closedAtRight && area > bestAreaCanvas) { bestAreaCanvas = area; lowerIdxSet = ls; }
        }

        const getRegionBounds = (x: number): { lo: number; hi: number } | null => {
          let lo = -Infinity;
          let hi = Infinity;
          for (let i = 0; i < curveBoundaryFunctions.length; i++) {
            const v = evaluate(curveBoundaryFunctions[i], { x });
            if (!Number.isFinite(v)) return null;
            if (lowerIdxSet.has(i)) lo = Math.max(lo, v);
            else hi = Math.min(hi, v);
          }
          return lo <= hi ? { lo, hi } : null;
        };

        if (nCurves >= 2) {
          ctx.beginPath();
          ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
          let startedFill = false;
          const upperPoints: Array<{ px: number; py: number }> = [];

          for (let i = 0; i <= samples; i++) {
            const x = minX + (spanX * i) / samples;
            const bounds = getRegionBounds(x);
            if (!bounds) { startedFill = false; continue; }
            const px = projectX(x);
            if (!startedFill) {
              ctx.moveTo(px, projectY(bounds.lo));
              startedFill = true;
            } else {
              ctx.lineTo(px, projectY(bounds.lo));
            }
            upperPoints.push({ px, py: projectY(bounds.hi) });
          }
          for (let i = upperPoints.length - 1; i >= 0; i--) {
            ctx.lineTo(upperPoints[i].px, upperPoints[i].py);
          }
          if (startedFill) {
            ctx.closePath();
            ctx.fill();
          }
        }

        const drawCurve = (curveFormula: string, strokeStyle: string) => {
          ctx.beginPath();
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 2.1;
          let started = false;
          for (let i = 0; i <= samples; i++) {
            const x = minX + (spanX * i) / samples;
            const y = evaluate(curveFormula, { x });
            if (!Number.isFinite(y)) {
              started = false;
              continue;
            }
            const px = projectX(x);
            const py = projectY(y);
            if (!started) {
              ctx.moveTo(px, py);
              started = true;
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.stroke();
        };

        curveBoundaryFunctions.forEach((curve, index) => {
          drawCurve(curve, palette[index % palette.length]);
        });
      } else if (mode === 'integration' && dimensions === 2 && yLowerFormula && yUpperFormula) {
        const samples = Math.max(300, Math.floor(plotWidth));

        ctx.beginPath();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.14)';
        let startedFill = false;
        for (let i = 0; i <= samples; i++) {
          const x = minX + (spanX * i) / samples;
          const upper = evaluate(yUpperFormula, { x });
          if (!Number.isFinite(upper)) continue;
          const px = projectX(x);
          const py = projectY(upper);
          if (!startedFill) {
            ctx.moveTo(px, py);
            startedFill = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        for (let i = samples; i >= 0; i--) {
          const x = minX + (spanX * i) / samples;
          const lower = evaluate(yLowerFormula, { x });
          if (!Number.isFinite(lower)) continue;
          ctx.lineTo(projectX(x), projectY(lower));
        }
        if (startedFill) {
          ctx.closePath();
          ctx.fill();
        }

        const drawCurve = (curveFormula: string, strokeStyle: string) => {
          ctx.beginPath();
          ctx.strokeStyle = strokeStyle;
          ctx.lineWidth = 2.2;
          let started = false;
          for (let i = 0; i <= samples; i++) {
            const x = minX + (spanX * i) / samples;
            const y = evaluate(curveFormula, { x });
            if (!Number.isFinite(y)) {
              started = false;
              continue;
            }
            const px = projectX(x);
            const py = projectY(y);
            if (!started) {
              ctx.moveTo(px, py);
              started = true;
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.stroke();
        };

        drawCurve(yLowerFormula, '#2563eb');
        drawCurve(yUpperFormula, '#7c3aed');
      }

      const pointRadius = mode === 'pi' ? 2.2 : 2.4;
      for (const point of points) {
        const rawX = Number(point.x);
        const rawY = Number(point.y);
        if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) continue;
        if (rawX < minX || rawX > maxX || rawY < minY || rawY > maxY) continue;

        ctx.beginPath();
        ctx.fillStyle = mode === 'pi'
          ? point.inside ? 'rgba(16, 185, 129, 0.78)' : 'rgba(239, 68, 68, 0.72)'
          : curveBoundaryFunctions && curveBoundaryFunctions.length > 1
            ? point.inside ? 'rgba(16, 185, 129, 0.72)' : 'rgba(37, 99, 235, 0.46)'
          : dimensions === 2 && yLowerFormula && yUpperFormula
            ? point.inside ? 'rgba(16, 185, 129, 0.74)' : 'rgba(37, 99, 235, 0.5)'
          : 'rgba(16, 185, 129, 0.72)';
        ctx.arc(projectX(rawX), projectY(rawY), pointRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [curveBoundaryFunctions, curveRegions, dimensions, domainX, domainY, formula, mode, points, size, yLowerFormula, yUpperFormula]);

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <canvas ref={canvasRef} className="block h-full w-full rounded-xl" />
    </div>
  );
};

export const AlgorithmChart: React.FC<ChartProps> = ({
  formula,
  exactFormula,
  g_formula,
  yLowerFormula,
  yUpperFormula,
  curveBoundaryFunctions,
  curveRegions,
  chartKind,
  derivativeFormula,
  showYEqualsX,
  iterations,
  points: resultPoints,
  monteCarloMode,
  dimensions,
  evaluationPoint
}) => {
  const lineWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const monteCarloWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{
    target: 'line' | 'mc';
    startX: number;
    startY: number;
    startBounds: Bounds;
    rect: DOMRect;
  } | null>(null);
  const [domainX, setDomainX] = React.useState<NumericDomain>(['auto', 'auto']);
  const [domainY, setDomainY] = React.useState<NumericDomain>(['auto', 'auto']);
  const [mcDomainX, setMcDomainX] = React.useState<NumericDomain>(['auto', 'auto']);
  const [mcDomainY, setMcDomainY] = React.useState<NumericDomain>(['auto', 'auto']);
  const [hiddenSeries, setHiddenSeries] = React.useState<Record<string, boolean>>({});
  const [panTarget, setPanTarget] = React.useState<'line' | 'mc' | null>(null);

  const isMonteCarloData = Boolean(resultPoints && resultPoints.length > 0 && resultPoints[0].inside !== undefined);
  const resolvedChartKind = chartKind || (
    isMonteCarloData
      ? monteCarloMode === 'pi'
        ? 'montecarlo-pi'
        : monteCarloMode === 'curveRegions'
          ? 'montecarlo-curve-regions'
          : monteCarloMode === 'integration'
            ? 'montecarlo-integration'
            : 'line'
      : 'line'
  );
  const isMonteCarlo = resolvedChartKind !== 'line';
  const isMonteCarloPi = resolvedChartKind === 'montecarlo-pi';
  const isMonteCarloIntegration = resolvedChartKind === 'montecarlo-integration' || resolvedChartKind === 'montecarlo-curve-regions';
  const isMonteCarloCurveRegions = resolvedChartKind === 'montecarlo-curve-regions';

  const sampledResultPoints = React.useMemo(() => {
    if (!resultPoints || resultPoints.length === 0) return [];
    if (!isMonteCarlo) return resultPoints;

    const maxVisible = isMonteCarloPi ? 900 : isMonteCarloCurveRegions ? 750 : (dimensions || 1) === 1 ? 700 : 600;
    if (resultPoints.length <= maxVisible) return resultPoints;

    const stride = resultPoints.length / maxVisible;
    const sampled: Point[] = [];
    for (let i = 0; i < maxVisible; i++) {
      sampled.push(resultPoints[Math.floor(i * stride)]);
    }
    sampled[sampled.length - 1] = resultPoints[resultPoints.length - 1];
    return sampled;
  }, [dimensions, isMonteCarlo, isMonteCarloCurveRegions, isMonteCarloPi, resultPoints]);

  const handleLegendClick = (e: any) => {
    const seriesName = e.value || e.dataKey;
    if (!seriesName) return;

    setHiddenSeries((prev) => ({
      ...prev,
      [seriesName]: !prev[seriesName]
    }));
  };

  const data = React.useMemo(() => {
    if (resultPoints && resultPoints.length > 0) {
      const pointsToRender = isMonteCarlo ? sampledResultPoints : resultPoints;
      return pointsToRender.map((point) => {
        const formatted: any = {};
        for (const key in point) {
          const value = (point as any)[key];
          formatted[key] = typeof value === 'number' && !isNaN(value) ? Number(value.toFixed(6)) : value;
        }
        return formatted;
      });
    }

    if (!formula && !g_formula) return [];

    let minX = -5;
    let maxX = 5;

    if (iterations.length > 0) {
      const xs = iterations.filter((it) => typeof it.x === 'number' && !isNaN(it.x)).map((it) => it.x);
      if (xs.length > 0) {
        minX = Math.min(...xs, -2);
        maxX = Math.max(...xs, 2);
        const padding = Math.max((maxX - minX) * 0.2, 1);
        minX -= padding;
        maxX += padding;
      }
    }

    const computed = [];
    const resolution = 400;
    const step = (maxX - minX) / resolution;

    for (let x = minX; x <= maxX; x += step) {
      const point: any = { x: Number(x.toFixed(6)) };
      let hasValue = false;

      if (formula) {
        const y = evaluate(formula, { x });
        if (typeof y === 'number' && isFinite(y)) {
          point.y = Number(y.toFixed(6));
          hasValue = true;
        }
      }

      if (exactFormula) {
        const yReal = evaluate(exactFormula, { t: x, x });
        if (typeof yReal === 'number' && isFinite(yReal)) {
          point.y_real = Number(yReal.toFixed(6));
          hasValue = true;
        }
      }

      if (g_formula) {
        const gy = evaluate(g_formula, { x });
        if (typeof gy === 'number' && isFinite(gy)) {
          point.gy = Number(gy.toFixed(6));
          hasValue = true;
        }
      }

      if (derivativeFormula) {
        const dy = evaluate(derivativeFormula, { x });
        if (typeof dy === 'number' && isFinite(dy)) {
          point.dy = Number(dy.toFixed(6));
          hasValue = true;
        }
      }

      if (showYEqualsX) {
        point.yx = Number(x.toFixed(6));
        hasValue = true;
      }

      if (hasValue) computed.push(point);
    }

    return computed;
  }, [derivativeFormula, exactFormula, formula, g_formula, isMonteCarlo, iterations, resultPoints, sampledResultPoints, showYEqualsX]);

  const dataBounds = React.useMemo(() => getBoundsFromPoints(data), [data]);
  const lineBaseBounds = React.useMemo(() => (dataBounds ? padBounds(dataBounds, 0.08) : null), [dataBounds]);
  const mcBaseBounds = React.useMemo(
    () => buildMonteCarloBaseBounds({
      mode: monteCarloMode,
      dimensions,
      points: sampledResultPoints,
      formula,
      yLowerFormula,
      yUpperFormula,
      curveBoundaryFunctions
    }),
    [curveBoundaryFunctions, dimensions, formula, monteCarloMode, sampledResultPoints, yLowerFormula, yUpperFormula]
  );

  const iterationPoints = React.useMemo(
    () =>
      iterations
        .filter((it) => typeof it.x === 'number' && !isNaN(it.x) && typeof it.f_x === 'number' && !isNaN(it.f_x))
        .map((it) => ({
          x: Number(it.x.toFixed(6)),
          iter_y: Number(it.f_x.toFixed(6)),
          iteration: it.iteration
        })),
    [iterations]
  );

  React.useEffect(() => {
    if (!lineBaseBounds) return;
    const next = boundsToDomains(lineBaseBounds);
    setDomainX(next.x);
    setDomainY(next.y);
  }, [lineBaseBounds]);

  React.useEffect(() => {
    if (!mcBaseBounds) return;
    const next = boundsToDomains(mcBaseBounds);
    setMcDomainX(next.x);
    setMcDomainY(next.y);
  }, [mcBaseBounds]);

  React.useEffect(() => {
    const handleWindowMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current) return;

      const nextBounds = panBounds(
        dragStateRef.current.startBounds,
        event.clientX - dragStateRef.current.startX,
        event.clientY - dragStateRef.current.startY,
        dragStateRef.current.rect.width,
        dragStateRef.current.rect.height
      );

      if (dragStateRef.current.target === 'line') {
        const next = boundsToDomains(nextBounds);
        setDomainX(next.x);
        setDomainY(next.y);
      } else {
        const next = boundsToDomains(nextBounds);
        setMcDomainX(next.x);
        setMcDomainY(next.y);
      }
    };

    const handleWindowMouseUp = () => {
      dragStateRef.current = null;
      setPanTarget(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  const handleReset = () => {
    if (!lineBaseBounds) return;
    const next = boundsToDomains(lineBaseBounds);
    setDomainX(next.x);
    setDomainY(next.y);
  };

  const handleZoomLine = (factor: number) => {
    if (!lineBaseBounds) return;
    const current = domainsToBounds(domainX, domainY, lineBaseBounds);
    const next = zoomBoundsAtPoint(current, lineBaseBounds, 0.5, 0.5, factor);
    const nextDomains = boundsToDomains(next);
    setDomainX(nextDomains.x);
    setDomainY(nextDomains.y);
  };

  const handleResetMonteCarlo = () => {
    if (!mcBaseBounds) return;
    const next = boundsToDomains(mcBaseBounds);
    setMcDomainX(next.x);
    setMcDomainY(next.y);
  };

  const handleZoomMonteCarlo = (factor: number) => {
    if (!mcBaseBounds) return;
    const current = domainsToBounds(mcDomainX, mcDomainY, mcBaseBounds);
    const next = zoomBoundsAtPoint(current, mcBaseBounds, 0.5, 0.5, factor);
    const nextDomains = boundsToDomains(next);
    setMcDomainX(nextDomains.x);
    setMcDomainY(nextDomains.y);
  };

  const startPan = (
    target: 'line' | 'mc',
    event: React.MouseEvent<HTMLDivElement>,
    wrapper: HTMLDivElement | null,
    fallback: Bounds | null,
    currentX: NumericDomain,
    currentY: NumericDomain
  ) => {
    if (event.button !== 0 || !wrapper || !fallback) return;
    if (event.target instanceof Element && (event.target.closest('.recharts-legend-wrapper') || event.target.closest('button'))) {
      return;
    }

    dragStateRef.current = {
      target,
      startX: event.clientX,
      startY: event.clientY,
      startBounds: domainsToBounds(currentX, currentY, fallback),
      rect: wrapper.getBoundingClientRect()
    };
    setPanTarget(target);
    event.preventDefault();
  };

  const handleWheelZoom = (
    target: 'line' | 'mc',
    event: React.WheelEvent<HTMLDivElement>,
    wrapper: HTMLDivElement | null,
    fallback: Bounds | null,
    currentX: NumericDomain,
    currentY: NumericDomain
  ) => {
    if (!wrapper || !fallback) return;

    event.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const anchorX = clamp01((event.clientX - rect.left) / Math.max(1, rect.width));
    const anchorY = clamp01((event.clientY - rect.top) / Math.max(1, rect.height));
    const current = domainsToBounds(currentX, currentY, fallback);
    const next = zoomBoundsAtPoint(current, fallback, anchorX, anchorY, wheelZoomFactor(event.deltaY));
    const nextDomains = boundsToDomains(next);

    if (target === 'line') {
      setDomainX(nextDomains.x);
      setDomainY(nextDomains.y);
    } else {
      setMcDomainX(nextDomains.x);
      setMcDomainY(nextDomains.y);
    }
  };

  const ChartZoomControls = ({ onZoomIn, onZoomOut, onReset }: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void }) => (
    <div className="flex items-center gap-1 rounded-lg border border-black/5 bg-white/85 p-1 shadow-sm backdrop-blur-md">
      <button onClick={onZoomIn} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-black/5" title="Zoom +">
        <Plus size={16} />
      </button>
      <button onClick={onZoomOut} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-black/5" title="Zoom -">
        <Minus size={16} />
      </button>
      <button onClick={onReset} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-black/5" title="Restablecer Zoom">
        <RefreshCcw size={16} />
      </button>
    </div>
  );

  if (isMonteCarloPi) {
    return (
      <div className="group relative h-[500px] w-full rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="absolute left-6 top-6 z-10">
          <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Visualizacion Monte Carlo</h4>
          <p className="text-xs text-gray-500">Circulo inscrito en cuadrado 1x1</p>
          {resultPoints && sampledResultPoints.length < resultPoints.length && (
            <p className="mt-1 text-[10px] text-amber-600">Mostrando {sampledResultPoints.length} de {resultPoints.length} puntos</p>
          )}
        </div>
        <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
          <ChartZoomControls onZoomIn={() => handleZoomMonteCarlo(0.7)} onZoomOut={() => handleZoomMonteCarlo(1.35)} onReset={handleResetMonteCarlo} />
          <div className="flex items-center gap-3 rounded-lg border border-black/5 bg-white/90 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 shadow-sm backdrop-blur-md">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Exitos</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Fallidos</span>
          </div>
        </div>
        <div className="flex h-full w-full items-center justify-center">
          <div
            ref={monteCarloWrapperRef}
            className={`h-full w-full pt-10 ${panTarget === 'mc' ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={(event) => startPan('mc', event, monteCarloWrapperRef.current, mcBaseBounds, mcDomainX, mcDomainY)}
            onWheel={(event) => handleWheelZoom('mc', event, monteCarloWrapperRef.current, mcBaseBounds, mcDomainX, mcDomainY)}
          >
            <MonteCarloCanvas points={sampledResultPoints} mode="pi" domainX={mcDomainX} domainY={mcDomainY} />
          </div>
        </div>
      </div>
    );
  }

  if (isMonteCarloIntegration) {
    return (
      <div className="group relative h-[500px] w-full rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="absolute left-6 top-6 z-10">
          <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            {isMonteCarloCurveRegions ? 'Regiones Cerradas Monte Carlo' : 'Integracion Monte Carlo'}
          </h4>
          <p className="text-xs text-gray-500">
            {isMonteCarloCurveRegions ? 'Area detectada entre multiples curvas' : `Metodo del promedio (${dimensions || 1}D)`}
          </p>
          {resultPoints && sampledResultPoints.length < resultPoints.length && (
            <p className="mt-1 text-[10px] text-amber-600">Mostrando {sampledResultPoints.length} de {resultPoints.length} puntos</p>
          )}
        </div>
        <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
          <ChartZoomControls onZoomIn={() => handleZoomMonteCarlo(0.7)} onZoomOut={() => handleZoomMonteCarlo(1.35)} onReset={handleResetMonteCarlo} />
          <div className="flex items-center gap-1 rounded-lg border border-black/5 bg-white/80 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 shadow-sm backdrop-blur-md">
            {dimensions === 1 ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                Area positiva/negativa + fuera
              </>
            ) : isMonteCarloCurveRegions ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                Regiones cerradas
              </>
            ) : dimensions === 2 && yLowerFormula && yUpperFormula ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="h-2 w-2 rounded-full bg-blue-600" />
                <span className="h-2 w-2 rounded-full bg-violet-600" />
                Region entre curvas
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Muestras
              </>
            )}
          </div>
        </div>
        <div
          ref={monteCarloWrapperRef}
          className={`h-full w-full pt-12 ${panTarget === 'mc' ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={(event) => startPan('mc', event, monteCarloWrapperRef.current, mcBaseBounds, mcDomainX, mcDomainY)}
          onWheel={(event) => handleWheelZoom('mc', event, monteCarloWrapperRef.current, mcBaseBounds, mcDomainX, mcDomainY)}
        >
          <MonteCarloCanvas
            points={sampledResultPoints}
            mode="integration"
            dimensions={dimensions}
            formula={(dimensions || 1) === 1 ? formula : undefined}
            yLowerFormula={dimensions === 2 ? yLowerFormula : undefined}
            yUpperFormula={dimensions === 2 ? yUpperFormula : undefined}
            curveBoundaryFunctions={curveBoundaryFunctions}
            curveRegions={curveRegions}
            domainX={mcDomainX}
            domainY={mcDomainY}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="group relative h-[500px] w-full rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
      <div className="absolute right-6 top-6 z-10 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
        <ChartZoomControls onZoomIn={() => handleZoomLine(0.7)} onZoomOut={() => handleZoomLine(1.35)} onReset={handleReset} />
        <div className="flex items-center gap-1 rounded-lg border border-black/5 bg-white/80 p-1 shadow-sm backdrop-blur-md">
          <div className="mx-1 h-4 w-px bg-black/5" />
          <div className="flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <Search size={12} />
            Rueda: zoom
          </div>
          <div className="mx-1 h-4 w-px bg-black/5" />
          <div className="flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <MousePointer2 size={12} />
            Arrastra: mover
          </div>
          <div className="mx-1 h-4 w-px bg-black/5" />
          <div className="flex items-center gap-1 px-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <MousePointer2 size={12} />
            Leyenda: ocultar
          </div>
        </div>
      </div>

      <div
        ref={lineWrapperRef}
        className={`h-full w-full ${panTarget === 'line' ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={(event) => startPan('line', event, lineWrapperRef.current, lineBaseBounds, domainX, domainY)}
        onWheel={(event) => handleWheelZoom('line', event, lineWrapperRef.current, lineBaseBounds, domainX, domainY)}
      >
        <ResponsiveContainer width="100%" height="100%">
        <LineChart margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
          <CartesianGrid stroke="#f0f0f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            allowDataOverflow
            dataKey="x"
            domain={domainX}
            label={{ value: 'x', position: 'bottom', offset: 20, fontSize: 12, fontWeight: 600, fill: '#666' }}
            tick={{ fontSize: 10, fill: '#999' }}
            tickFormatter={(value) => value.toFixed(2)}
            type="number"
          />
          <YAxis
            allowDataOverflow
            domain={domainY}
            label={{
              value: data.some((d) => d.yOriginal !== undefined) ? 'P(x)' : 'f(x)',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fontSize: 12,
              fontWeight: 600,
              fill: '#666'
            }}
            tick={{ fontSize: 10, fill: '#999' }}
            tickFormatter={(value) => value.toFixed(2)}
            type="number"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            height={36}
            iconType="circle"
            onClick={handleLegendClick}
            verticalAlign="top"
            wrapperStyle={{ fontSize: 12, fontWeight: 500, paddingTop: 0, cursor: 'pointer' }}
          />

          <ReferenceLine stroke="#000" strokeOpacity={0.2} strokeWidth={1} x={0} />
          <ReferenceLine stroke="#000" strokeOpacity={0.2} strokeWidth={1} y={0} />
          {evaluationPoint !== undefined && !isNaN(evaluationPoint) && (
            <ReferenceLine
              label={{ value: `x=${evaluationPoint.toFixed(4)}`, position: 'top', fontSize: 10, fill: '#b45309', fontWeight: 700 }}
              stroke="#f59e0b"
              strokeDasharray="6 3"
              strokeWidth={2}
              x={evaluationPoint}
            />
          )}

          <Line
            animationDuration={300}
            connectNulls
            data={data}
            dataKey="y"
            dot={false}
            hide={hiddenSeries[data.some((d) => d.yOriginal !== undefined) ? 'Polinomio P(x)' : 'f(x)']}
            name={data.some((d) => d.yOriginal !== undefined) ? 'Polinomio P(x)' : 'f(x)'}
            stroke="#10b981"
            strokeWidth={2.5}
            type="monotone"
          />

          {data.some((d) => d.yOriginal !== undefined) && (
            <Line
              animationDuration={300}
              connectNulls
              data={data}
              dataKey="yOriginal"
              dot={false}
              hide={hiddenSeries['Funcion F(x) Original']}
              name="Funcion F(x) Original"
              stroke="#6366f1"
              strokeDasharray="5 5"
              strokeWidth={2}
              type="monotone"
            />
          )}

          {exactFormula && (
            <Line
              animationDuration={300}
              connectNulls
              data={data}
              dataKey="y_real"
              dot={false}
              hide={hiddenSeries['Solucion Exacta']}
              name="Solucion Exacta"
              stroke="#8b5cf6"
              strokeDasharray="5 5"
              strokeWidth={2}
              type="monotone"
            />
          )}

          {g_formula && (
            <Line
              animationDuration={300}
              connectNulls
              data={data}
              dataKey="gy"
              dot={false}
              hide={hiddenSeries['g(x)']}
              name="g(x)"
              stroke="#6366f1"
              strokeWidth={2.5}
              type="monotone"
            />
          )}

          {derivativeFormula && (
            <Line
              animationDuration={300}
              connectNulls
              data={data}
              dataKey="dy"
              dot={false}
              hide={hiddenSeries["f'(x)"]}
              name="f'(x)"
              stroke="#f59e0b"
              strokeDasharray="3 3"
              strokeWidth={2}
              type="monotone"
            />
          )}

          {showYEqualsX && (
            <Line
              animationDuration={300}
              connectNulls
              data={data}
              dataKey="yx"
              dot={false}
              hide={hiddenSeries['y = x']}
              name="y = x"
              stroke="#94a3b8"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              type="monotone"
            />
          )}

          {iterationPoints.length > 0 && (
            <Line
              activeDot={{ r: 7, strokeWidth: 0 }}
              animationDuration={300}
              data={iterationPoints}
              dataKey="iter_y"
              dot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
              hide={hiddenSeries['Iteraciones']}
              name="Iteraciones"
              stroke="#ef4444"
              strokeWidth={0}
            />
          )}

        </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
