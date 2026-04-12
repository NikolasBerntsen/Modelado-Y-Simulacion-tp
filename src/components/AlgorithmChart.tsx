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
  ReferenceLine,
  ReferenceArea,
  Scatter,
  ScatterChart,
  ComposedChart,
  ZAxis,
  Brush
} from 'recharts';
import { IterationResult, Point } from '../types';
import { evaluate } from '../lib/algorithms';
import { RefreshCcw, Search, ZoomIn, ZoomOut, MousePointer2 } from 'lucide-react';

interface ChartProps {
  formula: string;
  g_formula?: string;
  derivativeFormula?: string;
  showYEqualsX?: boolean;
  iterations: IterationResult[];
  range?: [number, number];
  points?: Point[];
  monteCarloMode?: 'pi' | 'integration';
  dimensions?: 1 | 2 | 3;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length && typeof label === 'number') {
    const iterationPoint = payload.find((p: any) => p.payload.iteration !== undefined);
    
    return (
      <div className="bg-white/95 backdrop-blur-sm p-3 border border-black/10 shadow-xl rounded-xl text-xs min-w-[180px]">
        <p className="font-bold text-gray-900 mb-2 border-b border-black/5 pb-1 flex justify-between items-center">
          <span>x = {label.toFixed(6)}</span>
          {iterationPoint && (
            <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider">
              Iteración {iterationPoint.payload.iteration}
            </span>
          )}
        </p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-600 font-medium">{entry.name}:</span>
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

export const AlgorithmChart: React.FC<ChartProps> = ({ formula, g_formula, derivativeFormula, showYEqualsX, iterations, range, points: resultPoints, monteCarloMode, dimensions }) => {
  const [domainX, setDomainX] = React.useState<[number | string, number | string]>(['auto', 'auto']);
  const [refAreaLeft, setRefAreaLeft] = React.useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = React.useState<number | null>(null);

  const data = React.useMemo(() => {
    if (resultPoints && resultPoints.length > 0) {
      return resultPoints.map(p => {
        const point: any = {};
        for (const key in p) {
          const val = (p as any)[key];
          if (typeof val === 'number' && !isNaN(val)) {
            point[key] = Number(val.toFixed(6));
          } else {
            point[key] = val;
          }
        }
        return point;
      });
    }

    if (!formula && !g_formula) return [];
    
    // Determine range
    let minX = -5;
    let maxX = 5;
    
    if (iterations.length > 0) {
      const xs = iterations.filter(it => typeof it.x === 'number' && !isNaN(it.x)).map(it => it.x);
      if (xs.length > 0) {
        minX = Math.min(...xs, -2);
        maxX = Math.max(...xs, 2);
        const padding = Math.max((maxX - minX) * 0.2, 1);
        minX -= padding;
        maxX += padding;
      }
    }

    const points = [];
    const resolution = 400; // Increased resolution for better zooming
    const step = (maxX - minX) / resolution;
    
    for (let x = minX; x <= maxX; x += step) {
      const point: any = { x: Number(x.toFixed(6)) };
      let hasValue = false;
      
      if (formula) {
        try {
          const y = evaluate(formula, { x });
          if (typeof y === 'number' && isFinite(y)) {
            point.y = Number(y.toFixed(6));
            hasValue = true;
          }
        } catch (e) {}
      }
      
      if (g_formula) {
        try {
          const gy = evaluate(g_formula, { x });
          if (typeof gy === 'number' && isFinite(gy)) {
            point.gy = Number(gy.toFixed(6));
            hasValue = true;
          }
        } catch (e) {}
      }

      if (derivativeFormula) {
        try {
          const dy = evaluate(derivativeFormula, { x });
          if (typeof dy === 'number' && isFinite(dy)) {
            point.dy = Number(dy.toFixed(6));
            hasValue = true;
          }
        } catch (e) {}
      }

      if (showYEqualsX) {
        point.yx = Number(x.toFixed(6));
        hasValue = true;
      }
      
      if (hasValue) {
        points.push(point);
      }
    }
    return points;
  }, [formula, g_formula, derivativeFormula, showYEqualsX, iterations, resultPoints]);

  const iterationPoints = React.useMemo(() => iterations
    .filter(it => typeof it.x === 'number' && !isNaN(it.x) && typeof it.f_x === 'number' && !isNaN(it.f_x))
    .map(it => ({
      x: Number(it.x.toFixed(6)),
      y: Number(it.f_x.toFixed(6)),
      iteration: it.iteration
    })), [iterations]);

  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel) setRefAreaLeft(e.activeLabel);
  };

  const handleMouseMove = (e: any) => {
    if (refAreaLeft !== null && e && e.activeLabel) setRefAreaRight(e.activeLabel);
  };

  const handleMouseUp = () => {
    if (refAreaLeft === null || refAreaRight === null || refAreaLeft === refAreaRight) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    let left = refAreaLeft;
    let right = refAreaRight;
    if (left > right) [left, right] = [right, left];

    setDomainX([left, right]);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const handleReset = () => {
    setDomainX(['auto', 'auto']);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const isMonteCarlo = resultPoints && resultPoints.length > 0 && resultPoints[0].inside !== undefined;
  const isMonteCarloPi = isMonteCarlo && monteCarloMode === 'pi';
  const isMonteCarloIntegration = isMonteCarlo && monteCarloMode === 'integration';

  if (isMonteCarloPi) {
    const insidePoints = resultPoints?.filter(p => p.inside) || [];
    const outsidePoints = resultPoints?.filter(p => !p.inside) || [];

    return (
      <div className="relative h-[500px] w-full bg-white p-6 rounded-2xl border border-black/5 shadow-sm group">
        <div className="absolute top-6 left-6 z-10">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Visualización Monte Carlo</h4>
          <p className="text-xs text-gray-500">Círculo inscrito en cuadrado 1x1</p>
        </div>
        <div className="w-full h-full flex items-center justify-center">
          <div className="aspect-square h-full max-w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" dataKey="x" name="x" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <YAxis type="number" dataKey="y" name="y" domain={[0, 1]} tick={{ fontSize: 10 }} />
                <ZAxis type="number" range={[20, 20]} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Legend verticalAlign="top" height={36} />
                
                <ReferenceArea x1={0} x2={1} y1={0} y2={1} stroke="#000" strokeOpacity={0.1} fill="transparent" />
                
                <Scatter name="Fallidos" data={outsidePoints} fill="#ef4444" opacity={0.6} />
                <Scatter name="Éxitos" data={insidePoints} fill="#10b981" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  if (isMonteCarloIntegration) {
    return (
      <div className="relative h-[500px] w-full bg-white p-6 rounded-2xl border border-black/5 shadow-sm group">
        <div className="absolute top-6 left-6 z-10">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Integración Monte Carlo</h4>
          <p className="text-xs text-gray-500">Método del Promedio ({dimensions || 1}D)</p>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" dataKey="x" name="x" domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
            <YAxis type="number" dataKey="y" name="y" domain={['auto', 'auto']} tick={{ fontSize: 10 }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend verticalAlign="top" height={36} />
            
            {(dimensions || 1) === 1 && (
              <Line type="monotone" dataKey="y" stroke="#3b82f6" strokeWidth={2} dot={false} name="f(x)" />
            )}
            
            <Scatter name="Muestras" data={resultPoints} fill="#10b981" opacity={0.6} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="relative h-[500px] w-full bg-white p-6 rounded-2xl border border-black/5 shadow-sm group">
      <div className="absolute top-6 right-6 flex items-center gap-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1 bg-white/80 backdrop-blur-md border border-black/5 p-1 rounded-lg shadow-sm">
          <button 
            onClick={handleReset}
            className="p-1.5 hover:bg-black/5 rounded-md text-gray-500 transition-colors"
            title="Restablecer Zoom"
          >
            <RefreshCcw size={16} />
          </button>
          <div className="w-px h-4 bg-black/5 mx-1" />
          <div className="flex items-center gap-1 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <Search size={12} />
            Selecciona área para zoom
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          margin={{ top: 10, right: 10, left: 10, bottom: 40 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis 
            dataKey="x" 
            type="number" 
            domain={domainX} 
            allowDataOverflow
            tick={{ fontSize: 10, fill: '#999' }}
            tickFormatter={(val) => val.toFixed(2)}
            label={{ value: 'x', position: 'bottom', offset: 20, fontSize: 12, fontWeight: 600, fill: '#666' }} 
          />
          <YAxis 
            type="number" 
            domain={['auto', 'auto']} 
            tick={{ fontSize: 10, fill: '#999' }}
            tickFormatter={(val) => val.toFixed(2)}
            label={{ 
              value: data.some(d => d.yOriginal !== undefined) ? 'P(x)' : 'f(x)', 
              angle: -90, 
              position: 'insideLeft', 
              offset: 10, 
              fontSize: 12, 
              fontWeight: 600, 
              fill: '#666' 
            }} 
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="top" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: 12, fontWeight: 500, paddingTop: 0 }}
          />
          
          <ReferenceLine y={0} stroke="#000" strokeWidth={1} strokeOpacity={0.2} />
          <ReferenceLine x={0} stroke="#000" strokeWidth={1} strokeOpacity={0.2} />
          
          <Line 
            data={data} 
            type="monotone" 
            dataKey="y" 
            stroke="#10b981" 
            dot={false} 
            strokeWidth={2.5} 
            name={data.some(d => d.yOriginal !== undefined) ? "Polinomio P(x)" : "f(x)"}
            connectNulls
            animationDuration={300}
          />

          {data.some(d => d.yOriginal !== undefined) && (
            <Line 
              data={data} 
              type="monotone" 
              dataKey="yOriginal" 
              stroke="#6366f1" 
              strokeDasharray="5 5"
              dot={false} 
              strokeWidth={2} 
              name="Función f(x)"
              connectNulls
              animationDuration={300}
            />
          )}

          {g_formula && (
            <Line 
              data={data} 
              type="monotone" 
              dataKey="gy" 
              stroke="#6366f1" 
              dot={false} 
              strokeWidth={2.5} 
              name="g(x)"
              connectNulls
              animationDuration={300}
            />
          )}

          {derivativeFormula && (
            <Line 
              data={data} 
              type="monotone" 
              dataKey="dy" 
              stroke="#f59e0b" 
              strokeDasharray="3 3"
              dot={false} 
              strokeWidth={2} 
              name="f'(x)"
              connectNulls
              animationDuration={300}
            />
          )}

          {showYEqualsX && (
            <Line 
              data={data} 
              type="monotone" 
              dataKey="yx" 
              stroke="#94a3b8" 
              strokeDasharray="5 5"
              dot={false} 
              strokeWidth={1.5} 
              name="y = x"
              connectNulls
              animationDuration={300}
            />
          )}
          
          {iterationPoints.length > 0 && (
            <Line 
              data={iterationPoints} 
              dataKey="y" 
              stroke="#ef4444" 
              strokeWidth={0}
              dot={{ r: 5, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7, strokeWidth: 0 }}
              name="Iteraciones"
              animationDuration={300}
            />
          )}

          {refAreaLeft && refAreaRight ? (
            <ReferenceArea 
              {...({ 
                x1: refAreaLeft, 
                x2: refAreaRight, 
                fill: "#10b981", 
                fillOpacity: 0.1 
              } as any)} 
            />
          ) : null}

          <Brush 
            dataKey="x" 
            height={30} 
            stroke="#10b981" 
            fill="#fff"
            travellerWidth={10}
            gap={1}
            startIndex={0}
            endIndex={data.length - 1}
          >
            <LineChart>
              <Line data={data} dataKey="y" stroke="#10b981" dot={false} />
            </LineChart>
          </Brush>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

