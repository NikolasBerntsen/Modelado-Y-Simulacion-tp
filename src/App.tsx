/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Menu, 
  History, 
  HelpCircle, 
  ChevronRight, 
  ChevronUp,
  ChevronDown,
  ArrowLeft, 
  Play, 
  Save, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  Info,
  BarChart2,
  Sparkles,
  X,
  Loader2,
  RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
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
import { AlgorithmParams, AlgorithmOutput, IterationResult } from './types';
import { 
  bisection, 
  fixedPoint, 
  aitken, 
  newtonRaphson, 
  secant, 
  regulaFalsi, 
  recommendG,
  lagrange,
  trapezoidal,
  simpson13,
  simpson38,
  midpoint,
  solveODE,
  monteCarlo
} from './lib/algorithms';
import { AlgorithmChart } from './components/AlgorithmChart';
import { MathHelper } from './components/MathHelper';
import { useHistory } from './hooks/useHistory';
import { cn } from './lib/utils';
import { clsx } from 'clsx';
import { InlineMath } from 'react-katex';
import { create, all } from 'mathjs';

const math = create(all);

// Add ln as an alias for log (natural logarithm)
math.import({
  ln: math.log,
  log10: math.log10,
  log2: math.log2
}, { override: true });

type AlgorithmType = 
  | 'bisection' | 'fixedPoint' | 'aitken' | 'newton' | 'secant' | 'regulaFalsi'
  | 'lagrange' | 'trapezoidal' | 'simpson13' | 'simpson38' | 'ode' | 'montecarlo' | 'midpoint';

interface AlgorithmConfig {
  id: AlgorithmType;
  name: string;
  description: string;
  fields: (keyof AlgorithmParams)[];
}

const ALGORITHMS: AlgorithmConfig[] = [
  { 
    id: 'bisection', 
    name: 'Búsqueda Binaria (Bisección)', 
    description: 'Encuentra raíces dividiendo el intervalo a la mitad.',
    fields: ['formula', 'a', 'b', 'tolerance', 'maxIterations']
  },
  { 
    id: 'fixedPoint', 
    name: 'Punto Fijo', 
    description: 'Itera x = g(x) para encontrar un punto donde f(x) = 0.',
    fields: ['formula', 'g_formula', 'x0', 'tolerance', 'maxIterations']
  },
  { 
    id: 'aitken', 
    name: 'Aceleración de Aitken', 
    description: 'Acelera la convergencia de una sucesión linealmente convergente.',
    fields: ['formula', 'g_formula', 'x0', 'tolerance', 'maxIterations']
  },
  { 
    id: 'newton', 
    name: 'Newton-Raphson', 
    description: 'Usa la derivada para encontrar raíces rápidamente.',
    fields: ['formula', 'x0', 'tolerance', 'maxIterations']
  },
  { 
    id: 'secant', 
    name: 'Método de la Secante', 
    description: 'Similar a Newton pero usa una aproximación de la derivada.',
    fields: ['formula', 'x0', 'x1', 'h', 'tolerance', 'maxIterations']
  },
  { 
    id: 'regulaFalsi', 
    name: 'Regula Falsi (Falsa Posición)', 
    description: 'Combina bisección y secante para asegurar convergencia.',
    fields: ['formula', 'a', 'b', 'tolerance', 'maxIterations']
  },
  {
    id: 'lagrange',
    name: 'Interpolación de Lagrange',
    description: 'Construye un polinomio que pasa exactamente por un conjunto de puntos.',
    fields: ['formula', 'points', 'evaluationPoint']
  },
  {
    id: 'trapezoidal',
    name: 'Regla del Trapecio',
    description: 'Aproxima la integral de una función usando trapecios.',
    fields: ['formula', 'a', 'b', 'n']
  },
  {
    id: 'midpoint',
    name: 'Regla del Rectángulo (Punto Medio)',
    description: 'Aproxima la integral usando rectángulos en el punto medio.',
    fields: ['formula', 'a', 'b', 'n']
  },
  {
    id: 'simpson13',
    name: 'Regla de Simpson 1/3 Compuesta',
    description: 'Aproxima la integral usando parábolas.',
    fields: ['formula', 'a', 'b', 'n']
  },
  {
    id: 'simpson38',
    name: 'Regla de Simpson 3/8',
    description: 'Aproxima la integral usando polinomios de tercer grado.',
    fields: ['formula', 'a', 'b', 'n']
  },
  {
    id: 'ode',
    name: 'Ecuaciones Diferenciales (Euler / RK)',
    description: 'Resuelve EDOs de primer orden paso a paso.',
    fields: ['odeMethod', 'rkOrder', 'formula', 'exactFormula', 't0', 'y0', 't_end', 'h']
  },
  {
    id: 'montecarlo',
    name: 'Monte Carlo',
    description: 'Aproxima el valor de Pi o resuelve integrales (1D, 2D, 3D) usando muestreo aleatorio.',
    fields: ['monteCarloMode', 'dimensions', 'formula', 'a', 'b', 'c', 'd', 'e_limit', 'f_limit', 'maxIterations', 'seed', 'confidenceLevel', 'maxError']
  }
];

export default function App() {
  const [activeAlgo, setActiveAlgo] = useState<AlgorithmType | null>(null);
  const [isTrigMode, setIsTrigMode] = useState(false);
  const [lastFocusedInput, setLastFocusedInput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  React.useEffect(() => {
    if (activeAlgo) {
      window.scrollTo(0, 0);
      if (activeAlgo !== 'lagrange') {
        setParams(prev => ({ ...prev, useFunction: true }));
      }
    }
  }, [activeAlgo]);

  const [params, setParams] = useState<AlgorithmParams>({
    formula: 'x^2 - 2',
    g_formula: 'sqrt(2)',
    a: 0,
    b: 2,
    x0: 1,
    x1: 2,
    tolerance: 0.0001,
    maxIterations: 50,
    points: [{ x: 1, y: 1 }, { x: 2, y: 4 }, { x: 3, y: 9 }],
    odeMethod: 'euler',
    rkOrder: 4,
    h: 0.1,
    t0: 0,
    y0: 1,
    t_end: 1,
    useFunction: true,
    seed: '12345',
    monteCarloMode: 'pi',
    dimensions: 1,
    c: 0,
    d: 1,
    e_limit: 0,
    f_limit: 1,
    confidenceLevel: 95,
    maxError: 0.01,
    gaussPts: 5
  });
  const [output, setOutput] = useState<AlgorithmOutput | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonCategory, setComparisonCategory] = useState<'roots' | 'integration' | 'ode'>('roots');
  const [comparisonResults, setComparisonResults] = useState<any[]>([]);
  const [fromComparison, setFromComparison] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [showConvergenceModal, setShowConvergenceModal] = useState(false);
  const [expandedAitkenRows, setExpandedAitkenRows] = useState<number[]>([]);
  const [expandedSecantRows, setExpandedSecantRows] = useState<number[]>([]);
  const [showFunctionHelper, setShowFunctionHelper] = useState(false);
  
  const { history, saveToHistory, clearHistory } = useHistory<AlgorithmParams & { algo: AlgorithmType }>(activeAlgo || 'global');

  // Auto-run algorithm if coming from comparison
  React.useEffect(() => {
    if (activeAlgo && fromComparison) {
      runAlgorithm();
    }
  }, [activeAlgo, fromComparison]);

  const runComparison = () => {
    setExpandedAitkenRows([]);
    setExpandedSecantRows([]);
    
    let methodsToRun: { id: AlgorithmType; name: string; run: (p: AlgorithmParams) => AlgorithmOutput; customParams?: Partial<AlgorithmParams> }[] = [];

    if (comparisonCategory === 'roots') {
      methodsToRun = [
        { id: 'bisection', name: 'Bisección', run: bisection },
        { id: 'fixedPoint', name: 'Punto Fijo', run: fixedPoint },
        { id: 'aitken', name: 'Aitken', run: aitken },
        { id: 'newton', name: 'Newton-Raphson', run: newtonRaphson },
        { id: 'secant', name: 'Secante', run: secant },
        { id: 'regulaFalsi', name: 'Regula Falsi', run: regulaFalsi },
      ];
    } else if (comparisonCategory === 'integration') {
      methodsToRun = [
        { id: 'trapezoidal', name: 'Trapecio', run: trapezoidal },
        { id: 'simpson13', name: 'Simpson 1/3', run: simpson13 },
        { id: 'simpson38', name: 'Simpson 3/8', run: simpson38 },
        { id: 'midpoint', name: 'Rectángulos (Medio)', run: midpoint },
        { id: 'montecarlo', name: 'Monte Carlo (1D)', run: monteCarlo, customParams: { dimensions: 1, monteCarloMode: 'integration' } },
      ];
    } else if (comparisonCategory === 'ode') {
      methodsToRun = [
        { id: 'ode', name: 'Euler', run: solveODE, customParams: { odeMethod: 'euler' } },
        { id: 'ode', name: 'Euler Modificado', run: solveODE, customParams: { odeMethod: 'euler_modificado' } },
        { id: 'ode', name: 'Runge-Kutta (Orden 1)', run: solveODE, customParams: { odeMethod: 'rk', rkOrder: 1 } },
        { id: 'ode', name: 'Runge-Kutta (Orden 2)', run: solveODE, customParams: { odeMethod: 'rk', rkOrder: 2 } },
        { id: 'ode', name: 'Runge-Kutta (Orden 3)', run: solveODE, customParams: { odeMethod: 'rk', rkOrder: 3 } },
        { id: 'ode', name: 'Runge-Kutta (Orden 4)', run: solveODE, customParams: { odeMethod: 'rk', rkOrder: 4 } },
      ];
    }

    const results = methodsToRun.map(m => {
      const p = { ...params, ...m.customParams };
      return {
        id: m.id,
        name: m.name,
        ...m.run(p)
      };
    });

    setComparisonResults(results);
  };

  const runAlgorithm = () => {
    setLoading(true);
    setExpandedAitkenRows([]);
    setExpandedSecantRows([]);
    
    // Use setTimeout to allow UI to show loading state
    setTimeout(() => {
      let result: AlgorithmOutput;
      const currentParams = { ...params, isTrigMode, useFunction: params.useFunction ?? true };
      switch (activeAlgo) {
        case 'bisection': result = bisection(currentParams); break;
        case 'fixedPoint': result = fixedPoint(currentParams); break;
        case 'aitken': result = aitken(currentParams); break;
        case 'newton': result = newtonRaphson(currentParams); break;
        case 'secant': result = secant(currentParams); break;
        case 'regulaFalsi': result = regulaFalsi(currentParams); break;
        case 'lagrange': result = lagrange(currentParams); break;
        case 'trapezoidal': result = trapezoidal(currentParams); break;
        case 'simpson13': result = simpson13(currentParams); break;
        case 'simpson38': result = simpson38(currentParams); break;
        case 'midpoint': result = midpoint(currentParams); break;
        case 'ode': result = solveODE(currentParams); break;
        case 'montecarlo': result = monteCarlo(currentParams); break;
        default: setLoading(false); return;
      }
      setOutput(result);
      saveToHistory({ ...currentParams, algo: activeAlgo! });
      setLoading(false);
    }, 300);
  };

  const handleInsertMath = (text: string) => {
    if (!lastFocusedInput) return;
    
    const field = lastFocusedInput as keyof AlgorithmParams;
    if (field === 'points') return; // Points are handled differently
    
    handleFieldChange(field, (params[field] || '') + text);
  };

  const handleFieldChange = (field: keyof AlgorithmParams, value: any) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const handlePointChange = (index: number, field: 'x' | 'y', value: number | string) => {
    const newPoints = [...(params.points || [])];
    newPoints[index] = { ...newPoints[index], [field]: value };
    setParams(prev => ({ ...prev, points: newPoints }));
  };

  const addPoint = () => {
    setParams(prev => ({ ...prev, points: [...(prev.points || []), { x: '', y: '' }] }));
  };

  const removePoint = (index: number) => {
    setParams(prev => ({ ...prev, points: (prev.points || []).filter((_, i) => i !== index) }));
  };

  const loadFromHistory = (item: AlgorithmParams) => {
    setParams(item);
    setShowHistory(false);
  };

  const currentAlgoConfig = ALGORITHMS.find(a => a.id === activeAlgo);

  const formatDisplayValue = (n: number | undefined) => {
    if (n === undefined || isNaN(n)) return '-';
    
    // Check if it's an integer (or very close to one)
    if (Math.abs(n - Math.round(n)) < 1e-10) {
      return Math.round(n).toString();
    }

    if (!isTrigMode) return n.toFixed(8).replace(/\.?0+$/, '');
    
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

    return n.toFixed(6).replace(/\.?0+$/, '');
  };

  const formatErrorValue = (n: number | undefined) => {
    if (n === undefined || isNaN(n)) return '-';
    if (Math.abs(n) < 1e-15) return "0";
    // Avoid scientific notation by using a large precision and trimming
    const s = n.toFixed(12);
    return s.replace(/\.?0+$/, '');
  };

  return (
    <div className="min-h-screen bg-[#f5f5f4] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => {
            setActiveAlgo(null);
            setShowComparison(false);
            setFromComparison(false);
            setOutput(null);
          }}
        >
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 group-hover:scale-105 transition-transform">
            <Calculator size={24} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight group-hover:text-emerald-600 transition-colors">Métodos Numéricos</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setShowComparison(true);
              setActiveAlgo(null);
              setFromComparison(false);
            }}
            className="p-2 hover:bg-black/5 rounded-full transition-colors text-emerald-600"
            title="Comparar Métodos"
          >
            <BarChart2 size={20} />
          </button>
          <button 
            onClick={() => setShowHelp(true)}
            className="p-2 hover:bg-black/5 rounded-full transition-colors text-gray-500"
            title="Ayuda de nomenclatura"
          >
            <HelpCircle size={20} />
          </button>
          {activeAlgo && (
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-black/5 rounded-full transition-colors text-gray-500"
              title="Memoria de parámetros"
            >
              <History size={20} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {!activeAlgo ? (
            /* Main Menu */
            <motion.div 
              key="menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {ALGORITHMS.map((algo) => (
                <button
                  key={algo.id}
                  onClick={() => {
                    setActiveAlgo(algo.id);
                    setOutput(null);
                  }}
                  className="group p-6 bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-xl hover:border-emerald-500/20 transition-all text-left flex flex-col justify-between h-48"
                >
                  <div>
                    <h3 className="text-lg font-semibold group-hover:text-emerald-600 transition-colors">{algo.name}</h3>
                    <p className="text-sm text-gray-500 mt-2 leading-relaxed line-clamp-2">{algo.description}</p>
                  </div>
                  <div className="flex items-center text-emerald-500 font-medium text-sm gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Explorar <ChevronRight size={16} />
                  </div>
                </button>
              ))}
            </motion.div>
          ) : (
            /* Algorithm View */
            <motion.div 
              key="algo-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <button 
                onClick={() => {
                  if (fromComparison) {
                    setShowComparison(true);
                    setFromComparison(false);
                  }
                  setActiveAlgo(null);
                  setOutput(null);
                }}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
              >
                <ArrowLeft size={16} /> {fromComparison ? 'Volver a la comparativa' : 'Volver al menú'}
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Inputs Column */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Calculator size={18} className="text-emerald-500" />
                        Parámetros: {currentAlgoConfig?.name}
                      </h2>
                      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-black/5">
                        <button 
                          onClick={() => setIsTrigMode(false)}
                          className={clsx(
                            "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                            !isTrigMode ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                          )}
                        >
                          NORMAL
                        </button>
                        <button 
                          onClick={() => setIsTrigMode(true)}
                          className={clsx(
                            "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                            isTrigMode ? "bg-white text-emerald-600 shadow-sm" : "text-gray-400 hover:text-gray-600"
                          )}
                        >
                          TRIG (π)
                        </button>
                      </div>
                    </div>
                    
                    {currentAlgoConfig?.fields.includes('monteCarloMode') && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Modo Monte Carlo</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleFieldChange('monteCarloMode', 'pi')}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-xl border transition-all text-sm font-medium",
                              params.monteCarloMode === 'pi' ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200" : "bg-gray-50 text-gray-500 border-black/5 hover:bg-gray-100"
                            )}
                          >
                            Aproximación de Pi
                          </button>
                          <button 
                            onClick={() => handleFieldChange('monteCarloMode', 'integration')}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-xl border transition-all text-sm font-medium",
                              params.monteCarloMode === 'integration' ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200" : "bg-gray-50 text-gray-500 border-black/5 hover:bg-gray-100"
                            )}
                          >
                            Integración
                          </button>
                        </div>
                      </div>
                    )}

                      {currentAlgoConfig?.fields.includes('dimensions') && params.monteCarloMode === 'integration' && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dimensiones de Integración</label>
                          <div className="flex gap-2">
                            {[1, 2, 3].map((dim) => (
                              <button
                                key={dim}
                                onClick={() => handleFieldChange('dimensions', dim)}
                                className={clsx(
                                  "flex-1 px-4 py-2 rounded-xl border transition-all text-xs font-medium",
                                  params.dimensions === dim ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200" : "bg-gray-50 text-gray-500 border-black/5 hover:bg-gray-100"
                                )}
                              >
                                {dim}D
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    {currentAlgoConfig?.fields.includes('odeMethod') && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Método de Resolución</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleFieldChange('odeMethod', 'euler')}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase",
                              params.odeMethod === 'euler' ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200" : "bg-gray-50 text-gray-500 border-black/5 hover:bg-gray-100"
                            )}
                          >
                            Euler
                          </button>
                          <button 
                            onClick={() => handleFieldChange('odeMethod', 'euler_modificado')}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase",
                              params.odeMethod === 'euler_modificado' ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200" : "bg-gray-50 text-gray-500 border-black/5 hover:bg-gray-100"
                            )}
                          >
                            Euler Modif
                          </button>
                          <button 
                            onClick={() => handleFieldChange('odeMethod', 'rk')}
                            className={clsx(
                              "flex-1 px-4 py-2 rounded-xl border transition-all text-[10px] font-bold uppercase",
                              params.odeMethod === 'rk' ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200" : "bg-gray-50 text-gray-500 border-black/5 hover:bg-gray-100"
                            )}
                          >
                            Runge-Kutta
                          </button>
                        </div>
                      </div>
                    )}

                    {currentAlgoConfig?.fields.includes('rkOrder') && params.odeMethod === 'rk' && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Orden de Runge-Kutta</label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4].map((order) => (
                            <button 
                              key={order}
                              onClick={() => handleFieldChange('rkOrder', order)}
                              className={clsx(
                                "flex-1 px-4 py-2 rounded-xl border transition-all text-xs font-medium",
                                params.rkOrder === order ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200" : "bg-gray-50 text-gray-500 border-black/5 hover:bg-gray-100"
                              )}
                            >
                              Orden {order}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentAlgoConfig?.fields.includes('exactFormula') && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Curva Real / Solución Exacta (Opcional)</label>
                        <input 
                          type="text" 
                          value={params.exactFormula || ''}
                          onFocus={() => setLastFocusedInput('exactFormula')}
                          onChange={(e) => handleFieldChange('exactFormula', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                          placeholder="e.g. exp(t)"
                        />
                      </div>
                    )}
                    {currentAlgoConfig?.fields.includes('formula') && (activeAlgo !== 'montecarlo' || params.monteCarloMode === 'integration') && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            {['ode'].includes(activeAlgo) ? 'EDO dy/dt = f(t, y)' : 'Función f(x)'}
                          </label>
                          {activeAlgo === 'lagrange' && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-gray-400">USAR F(X)</span>
                              <button 
                                onClick={() => handleFieldChange('useFunction', !params.useFunction)}
                                className={clsx(
                                  "w-8 h-4 rounded-full transition-all relative",
                                  params.useFunction !== false ? "bg-emerald-500" : "bg-gray-300"
                                )}
                              >
                                <div className={clsx(
                                  "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                                  params.useFunction !== false ? "left-4.5" : "left-0.5"
                                )} />
                              </button>
                            </div>
                          )}
                        </div>
                        {params.useFunction !== false && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <input 
                                  type="text" 
                                  value={params.formula}
                                  onFocus={() => setLastFocusedInput('formula')}
                                  onChange={(e) => handleFieldChange('formula', e.target.value)}
                                  className="flex-1 px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                                  placeholder={['ode'].includes(activeAlgo) ? 'y + t^2' : 'x^2 - 2'}
                                />
                                <button
                                  onClick={() => setShowFunctionHelper(!showFunctionHelper)}
                                  className={cn(
                                    "ml-2 p-2 rounded-xl border border-black/5 transition-all",
                                    showFunctionHelper ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-gray-50 text-gray-400 hover:text-gray-600"
                                  )}
                                  title="Ayuda de funciones"
                                >
                                  <ChevronDown className={cn("w-5 h-5 transition-transform", showFunctionHelper && "rotate-180")} />
                                </button>
                              </div>
                              {showFunctionHelper && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex flex-wrap gap-1.5 p-3 bg-gray-50/50 rounded-xl border border-black/5 shadow-inner"
                                >
                                  {[
                                    { label: 'sin', value: 'sin(' },
                                    { label: 'cos', value: 'cos(' },
                                    { label: 'tan', value: 'tan(' },
                                    { label: 'log', value: 'log(' },
                                    { label: 'exp', value: 'exp(' },
                                    { label: 'sqrt', value: 'sqrt(' },
                                    { label: '^', value: '^' },
                                    { label: 'π', value: 'pi' },
                                    { label: 'e', value: 'e' },
                                    { label: '(', value: '(' },
                                    { label: ')', value: ')' },
                                  ].map((btn) => (
                                    <button
                                      key={btn.label}
                                      onClick={() => handleFieldChange('formula', (params.formula || '') + btn.value)}
                                      className="px-2 py-1 bg-white border border-black/5 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
                                    >
                                      {btn.label}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                              {params.formula && (
                                <div className="mt-2 p-3 bg-emerald-50/30 rounded-xl border border-emerald-500/10 flex items-center justify-center min-h-[50px] shadow-inner">
                                  {(() => {
                                    try {
                                      const tex = math.parse(params.formula).toTex();
                                      return <div className="text-emerald-700 text-lg"><InlineMath math={tex} /></div>;
                                    } catch (e) {
                                      return <span className="text-[10px] text-gray-400 italic">Escribiendo fórmula...</span>;
                                    }
                                  })()}
                                </div>
                              )}
                            </div>
                        )}
                      </div>
                    )}

                    {currentAlgoConfig?.fields.includes('points') && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Puntos (x, y)</label>
                          <button onClick={addPoint} className="text-[10px] text-emerald-600 hover:underline">+ Añadir Punto</button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                          {params.points?.map((p, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  value={p.x}
                                  onChange={(e) => handlePointChange(i, 'x', e.target.value)}
                                  className="w-full px-3 py-1 bg-gray-50 border border-black/5 rounded-lg text-sm"
                                  placeholder={isTrigMode ? "pi/2" : "x"}
                                />
                                {isTrigMode && (
                                  <button 
                                    onClick={() => handlePointChange(i, 'x', (p.x || '') + 'pi')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold text-xs hover:scale-110 transition-transform"
                                  >
                                    π
                                  </button>
                                )}
                              </div>
                              <div className="relative flex-1">
                                <input 
                                  type="text" 
                                  value={p.y}
                                  onChange={(e) => handlePointChange(i, 'y', e.target.value)}
                                  className="w-full px-3 py-1 bg-gray-50 border border-black/5 rounded-lg text-sm"
                                  placeholder={isTrigMode ? "pi" : "y"}
                                />
                                {isTrigMode && (
                                  <button 
                                    onClick={() => handlePointChange(i, 'y', (p.y || '') + 'pi')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold text-xs hover:scale-110 transition-transform"
                                  >
                                    π
                                  </button>
                                )}
                              </div>
                              <button onClick={() => removePoint(i)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentAlgoConfig?.fields.includes('g_formula') && (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Función g(x)</label>
                          <button 
                            onClick={() => {
                              const recs = recommendG(params.formula);
                              handleFieldChange('g_formula', recs[0]);
                            }}
                            className="text-[10px] text-emerald-600 hover:underline"
                          >
                            Recomendar g(x)
                          </button>
                        </div>
                        <input 
                          type="text" 
                          value={params.g_formula}
                          onFocus={() => setLastFocusedInput('g_formula')}
                          onChange={(e) => handleFieldChange('g_formula', e.target.value)}
                          className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                          placeholder="sqrt(2)"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      {currentAlgoConfig?.fields.includes('a') && (activeAlgo !== 'montecarlo' || params.monteCarloMode === 'integration') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Límite a (x)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.a === undefined ? '' : params.a}
                              onFocus={() => setLastFocusedInput('a')}
                              onChange={(e) => handleFieldChange('a', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                              placeholder={isTrigMode ? "pi/2" : "0"}
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('a', (params.a || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('b') && (activeAlgo !== 'montecarlo' || params.monteCarloMode === 'integration') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Límite b (x)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.b === undefined ? '' : params.b}
                              onFocus={() => setLastFocusedInput('b')}
                              onChange={(e) => handleFieldChange('b', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                              placeholder={isTrigMode ? "pi" : "1"}
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('b', (params.b || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {currentAlgoConfig?.fields.includes('c') && params.monteCarloMode === 'integration' && (params.dimensions || 1) >= 2 && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Límite c (y)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.c === undefined ? '' : params.c}
                              onFocus={() => setLastFocusedInput('c')}
                              onChange={(e) => handleFieldChange('c', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            />
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('d') && params.monteCarloMode === 'integration' && (params.dimensions || 1) >= 2 && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Límite d (y)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.d === undefined ? '' : params.d}
                              onFocus={() => setLastFocusedInput('d')}
                              onChange={(e) => handleFieldChange('d', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            />
                          </div>
                        </div>
                      )}
                      
                      {currentAlgoConfig?.fields.includes('e_limit') && params.monteCarloMode === 'integration' && (params.dimensions || 1) >= 3 && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Límite e (z)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.e_limit === undefined ? '' : params.e_limit}
                              onFocus={() => setLastFocusedInput('e_limit')}
                              onChange={(e) => handleFieldChange('e_limit', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            />
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('f_limit') && params.monteCarloMode === 'integration' && (params.dimensions || 1) >= 3 && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Límite f (z)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.f_limit === undefined ? '' : params.f_limit}
                              onFocus={() => setLastFocusedInput('f_limit')}
                              onChange={(e) => handleFieldChange('f_limit', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            />
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('x0') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">x0 (Inicial)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.x0 === undefined ? '' : params.x0}
                              onFocus={() => setLastFocusedInput('x0')}
                              onChange={(e) => handleFieldChange('x0', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                              placeholder={isTrigMode ? "pi/4" : "0"}
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('x0', (params.x0 || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('x1') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">x1 (Inicial)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.x1 === undefined ? '' : params.x1}
                              onFocus={() => setLastFocusedInput('x1')}
                              onChange={(e) => handleFieldChange('x1', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                              placeholder={isTrigMode ? "pi/2" : "1"}
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('x1', (params.x1 || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('t0') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">t0</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.t0 === undefined ? '' : params.t0}
                              onFocus={() => setLastFocusedInput('t0')}
                              onChange={(e) => handleFieldChange('t0', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('t0', (params.t0 || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('y0') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">y0</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.y0 === undefined ? '' : params.y0}
                              onFocus={() => setLastFocusedInput('y0')}
                              onChange={(e) => handleFieldChange('y0', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('y0', (params.y0 || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {currentAlgoConfig?.fields.includes('tolerance') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tolerancia (10^-k)</label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-gray-400">10^-</span>
                            <input 
                              type="number" 
                              min="1"
                              max="15"
                              value={Math.round(-Math.log10(params.tolerance || 1e-5))}
                              onChange={(e) => {
                                const k = parseInt(e.target.value);
                                if (!isNaN(k) && k >= 1) {
                                  handleFieldChange('tolerance', Math.pow(10, -k));
                                }
                              }}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono">Valor: {(params.tolerance || 1e-5).toFixed(Math.min(20, Math.round(-Math.log10(params.tolerance || 1e-5))))}</p>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('seed') && (
                        <div className="space-y-1 col-span-2">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Semilla (Seed)</label>
                          <input 
                            type="text" 
                            value={params.seed}
                            onChange={(e) => handleFieldChange('seed', e.target.value)}
                            className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            placeholder="Cualquier texto o número"
                          />
                        </div>
                      )}

                      {currentAlgoConfig?.fields.includes('gaussPts') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Gauss Pts</label>
                          <input 
                            type="number" 
                            value={params.gaussPts}
                            onChange={(e) => handleFieldChange('gaussPts', parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            placeholder="5"
                          />
                        </div>
                      )}

                      {currentAlgoConfig?.fields.includes('confidenceLevel') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Nivel de Confianza (%)</label>
                          <select 
                            value={params.confidenceLevel || 95}
                            onChange={(e) => handleFieldChange('confidenceLevel', parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          >
                            <option value={90}>90%</option>
                            <option value={95}>95%</option>
                            <option value={99}>99%</option>
                          </select>
                        </div>
                      )}

                      {currentAlgoConfig?.fields.includes('maxError') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Error Máx. Permitido</label>
                          <input 
                            type="number" 
                            step="0.0001"
                            value={params.maxError === undefined ? '' : params.maxError}
                            onChange={(e) => handleFieldChange('maxError', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                            className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            placeholder="Ej: 0.001"
                          />
                        </div>
                      )}

                      {currentAlgoConfig?.fields.includes('maxIterations') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Máx Iteraciones</label>
                          <input 
                            type="number" 
                            value={isNaN(params.maxIterations as number) ? '' : params.maxIterations}
                            onChange={(e) => handleFieldChange('maxIterations', parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('n') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">n (Subint.)</label>
                          <input 
                            type="number" 
                            value={isNaN(params.n as number) ? '' : params.n}
                            onChange={(e) => handleFieldChange('n', parseInt(e.target.value))}
                            className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('h') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">h (Paso)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.h === undefined ? '' : params.h}
                              onFocus={() => setLastFocusedInput('h')}
                              onChange={(e) => handleFieldChange('h', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                              placeholder="0.1"
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('h', (params.h || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('t_end') && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">t_end</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.t_end === undefined ? '' : params.t_end}
                              onFocus={() => setLastFocusedInput('t_end')}
                              onChange={(e) => handleFieldChange('t_end', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('t_end', (params.t_end || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {currentAlgoConfig?.fields.includes('evaluationPoint') && params.useFunction !== false && (
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Punto a Evaluar (x)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={params.evaluationPoint === undefined ? '' : params.evaluationPoint}
                              onFocus={() => setLastFocusedInput('evaluationPoint')}
                              onChange={(e) => handleFieldChange('evaluationPoint', e.target.value)}
                              className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-mono"
                              placeholder={isTrigMode ? "pi/2" : "1.5"}
                            />
                            {isTrigMode && (
                              <button 
                                onClick={() => handleFieldChange('evaluationPoint', (params.evaluationPoint || '') + 'pi')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-600 font-serif font-bold hover:scale-110 transition-transform"
                              >
                                π
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <MathHelper onInsert={handleInsertMath} />
                    </div>

                    <button 
                      onClick={runAlgorithm}
                      disabled={loading}
                      className={clsx(
                        "w-full py-3 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center gap-2 mt-4",
                        loading ? "bg-emerald-400 cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200"
                      )}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> Calculando...
                        </>
                      ) : (
                        <>
                          <Play size={18} fill="currentColor" /> Calcular
                        </>
                      )}
                    </button>
                  </div>

                  {output && (
                    <div className={cn(
                      "p-6 rounded-2xl border shadow-sm",
                      output.converged ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
                    )}>
                      <div className="flex items-center gap-3 mb-2">
                        {output.converged ? (
                          <CheckCircle2 className="text-emerald-600" size={24} />
                        ) : (
                          <AlertCircle className="text-red-600" size={24} />
                        )}
                        <h3 className={cn("font-bold text-lg", output.converged ? "text-emerald-900" : "text-red-900")}>
                          {output.converged ? "Cálculo Exitoso" : "Error de Cálculo"}
                        </h3>
                        {output.converged && (
                          <div className="ml-auto flex gap-2">
                            {output.stats && (
                              <>
                                <button 
                                  onClick={() => setShowConvergenceModal(true)}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                >
                                  <RefreshCcw size={14} />
                                  Convergencia
                                </button>
                                <button 
                                  onClick={() => setShowStatsModal(true)}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                  <BarChart2 size={14} />
                                  Estadísticas
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {output.errorMsg && (
                        <p className={`text-sm mb-2 ${output.converged ? 'text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200' : 'text-red-700'}`}>
                          {output.converged ? '⚠ ' : ''}{output.errorMsg}
                        </p>
                      )}
                      {output.root !== undefined && output.root !== null && !isNaN(output.root) && (
                        <div className="mt-4 flex flex-wrap gap-8">
                          <div>
                            <p className="text-xs uppercase font-bold text-emerald-800/50 tracking-widest">Raíz Aproximada</p>
                            <p className="text-3xl font-mono font-bold text-emerald-900">{formatDisplayValue(output.root)}</p>
                          </div>
                          {output.iterations.length > 0 && (
                            <div>
                              <p className="text-xs uppercase font-bold text-emerald-800/50 tracking-widest">Error Final</p>
                              <p className="text-3xl font-mono font-bold text-emerald-900">{formatErrorValue(output.iterations[output.iterations.length - 1].error)}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {output.result !== undefined && output.result !== null && (
                        <div className="mt-4">
                          <p className="text-xs uppercase font-bold text-emerald-800/50 tracking-widest">
                            {activeAlgo === 'lagrange' ? 'Evaluación del Polinomio' : activeAlgo === 'ode' ? 'Solución Final' : 'Resultado'}
                          </p>
                          <p className={`font-mono font-bold text-emerald-900 ${String(output.result).length > 30 ? 'text-base mt-1' : 'text-3xl'}`}>{output.result}</p>
                          {activeAlgo === 'montecarlo' && params.monteCarloMode === 'pi' && (
                            <p className="text-xs text-emerald-700/60 mt-1">Error vs π real: {Math.abs(Math.PI - parseFloat(String(output.result))).toExponential(4)}</p>
                          )}
                        </div>
                      )}

                      {output.errorAnalysis && (
                        <div className="mt-6 p-5 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm">
                          <h4 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-600" />
                            Análisis de Error de Truncamiento
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="space-y-2">
                              {output.errorAnalysis.derivativeOrder > 0 && (
                                <>
                                  <p className="text-blue-700 font-semibold flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">f<sup>({output.errorAnalysis.derivativeOrder})</sup></span>
                                    Derivada de orden {output.errorAnalysis.derivativeOrder}
                                  </p>
                                  <div className="p-3 bg-white/80 rounded-xl border border-blue-100 font-mono text-xs overflow-x-auto shadow-inner flex items-center justify-center min-h-[44px]">
                                    {(() => {
                                      try {
                                        const tex = math.parse(output.errorAnalysis.derivativeFormula).toTex();
                                        return <InlineMath math={tex} />;
                                      } catch (e) {
                                        return <span>{output.errorAnalysis.derivativeFormula}</span>;
                                      }
                                    })()}
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="flex flex-col justify-center space-y-4">
                              {output.errorAnalysis.theoreticalFormula && (
                                <div className="space-y-1">
                                  <p className="text-[10px] uppercase font-bold text-blue-400">Fórmula Teórica</p>
                                  <div className="p-3 bg-blue-900/5 rounded-lg border border-blue-100 text-blue-800 flex items-center justify-center min-h-[44px] overflow-x-auto">
                                    {(() => {
                                      try {
                                        return <InlineMath math={output.errorAnalysis.theoreticalFormula} />;
                                      } catch (e) {
                                        return <span className="font-mono text-[10px] italic">{output.errorAnalysis.theoreticalFormula}</span>;
                                      }
                                    })()}
                                  </div>
                                </div>
                              )}
                              {output.errorAnalysis.substitutedFormula && (
                                <div className="space-y-1">
                                  <p className="text-[10px] uppercase font-bold text-blue-400">Fórmula Sustituida</p>
                                  <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-800 flex items-center justify-center min-h-[44px] overflow-x-auto">
                                    {(() => {
                                      try {
                                        return <InlineMath math={output.errorAnalysis.substitutedFormula} />;
                                      } catch (e) {
                                        return <span className="font-mono text-[10px]">{output.errorAnalysis.substitutedFormula}</span>;
                                      }
                                    })()}
                                  </div>
                                </div>
                              )}
                              {output.errorAnalysis.derivativeOrder > 0 && (
                                <div className="flex justify-between items-center p-3 bg-white/40 rounded-lg border border-blue-50">
                                  <span className="text-blue-600 font-medium text-sm">Máx |f<sup>({output.errorAnalysis.derivativeOrder})</sup>(ξ)|:</span>
                                  <span className="font-mono font-bold text-blue-900">{output.errorAnalysis.maxDerivativeValue.toExponential(4)}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center p-4 bg-blue-600 rounded-xl shadow-md shadow-blue-200">
                                <span className="text-white font-bold">{output.errorAnalysis.derivativeOrder === 0 ? 'Semi-amplitud IC:' : 'Error Global Estimado:'}</span>
                                <span className="font-mono font-black text-white text-lg">{output.errorAnalysis.globalError.toExponential(6)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Visualization Column */}
                <div className="lg:col-span-8 space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      Visualización Gráfica
                    </h3>
                    <AlgorithmChart
                      formula={params.formula}
                      exactFormula={activeAlgo === 'ode' ? params.exactFormula : undefined}
                      g_formula={['fixedPoint', 'aitken'].includes(activeAlgo || '') ? params.g_formula : undefined}
                      derivativeFormula={activeAlgo === 'newton' ? output?.derivativeFormula : undefined}
                      showYEqualsX={['fixedPoint', 'aitken'].includes(activeAlgo || '')}
                      iterations={output?.iterations || []}
                      points={output?.points as any}
                      monteCarloMode={activeAlgo === 'montecarlo' ? params.monteCarloMode : undefined}
                      dimensions={activeAlgo === 'montecarlo' ? params.dimensions : undefined}
                      evaluationPoint={(() => {
                        if (activeAlgo !== 'lagrange' || params.useFunction === false || !params.evaluationPoint) return undefined;
                        try {
                          const v = typeof params.evaluationPoint === 'number'
                            ? params.evaluationPoint
                            : math.evaluate(String(params.evaluationPoint));
                          return typeof v === 'number' && isFinite(v) ? v : undefined;
                        } catch { return undefined; }
                      })()}
                    />
                  </div>

                  {activeAlgo === 'newton' && output && output.derivativeFormula && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl mb-6 flex items-center gap-4">
                      <div>
                        <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-2">Derivada Calculada f'(x)</p>
                        <div className="flex items-center justify-center min-h-[36px]">
                          {(() => {
                            if (output.derivativeFormula.startsWith('[derivada')) {
                              return <span className="font-mono text-amber-700 text-sm italic">{output.derivativeFormula}</span>;
                            }
                            try {
                              const tex = math.parse(output.derivativeFormula).toTex();
                              return <div className="text-emerald-900 text-xl"><InlineMath math={tex} /></div>;
                            } catch (e) {
                              return <span className="font-mono text-emerald-900 font-bold">{output.derivativeFormula}</span>;
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeAlgo === 'aitken' && output && output.iterations.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tabla de Resultados (Aceleración de Aitken)</h3>
                      <p className="text-xs text-gray-500 italic">Haz clic en una fila para ver los puntos fijos intermedios.</p>
                      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-black/5">
                              <tr>
                                <th className="px-6 py-4 font-semibold text-gray-600">Iteración</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">x_acelerado</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">f(x_acelerado)</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">Error</th>
                                <th className="px-6 py-4 font-semibold text-gray-600 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {output.iterations.map((it) => {
                                const isExpanded = expandedAitkenRows.includes(it.iteration);
                                return (
                                  <React.Fragment key={it.iteration}>
                                    <tr 
                                      className="hover:bg-emerald-50/30 cursor-pointer transition-colors"
                                      onClick={() => {
                                        setExpandedAitkenRows(prev => 
                                          prev.includes(it.iteration) 
                                            ? prev.filter(id => id !== it.iteration)
                                            : [...prev, it.iteration]
                                        );
                                      }}
                                    >
                                      <td className="px-6 py-4 font-mono text-gray-400">{it.iteration}</td>
                                      <td className="px-6 py-4 font-mono font-medium text-emerald-600">{formatDisplayValue(it.x)}</td>
                                      <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.f_x)}</td>
                                      <td className="px-6 py-4 font-mono text-emerald-600">{formatErrorValue(it.error)}</td>
                                      <td className="px-6 py-4 text-gray-400">
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </td>
                                    </tr>
                                    {isExpanded && it.fixedPoints && (
                                      <tr className="bg-gray-50/50">
                                        <td colSpan={5} className="px-12 py-4">
                                          <div className="bg-white rounded-xl border border-black/5 p-4 shadow-inner">
                                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3">Puntos Fijos Intermedios</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                              {it.fixedPoints.map((fp: any, idx: number) => (
                                                <div key={idx} className="space-y-1">
                                                  <span className="text-[10px] text-gray-400 font-mono">{fp.label}</span>
                                                  <div className="font-mono text-xs font-medium">{formatDisplayValue(fp.value)}</div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeAlgo === 'secant' && output && output.iterations.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tabla de Resultados (Secante)</h3>
                      <p className="text-xs text-gray-500 italic">Haz clic en una fila para ver el detalle del cálculo.</p>
                      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-black/5">
                              <tr>
                                <th className="px-6 py-4 font-semibold text-gray-600">Iteración</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">x_n+1</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">f(x_n+1)</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">Error</th>
                                <th className="px-6 py-4 font-semibold text-gray-600 w-10"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {output.iterations.map((it) => {
                                const isExpanded = expandedSecantRows.includes(it.iteration);
                                return (
                                  <React.Fragment key={it.iteration}>
                                    <tr 
                                      className="hover:bg-emerald-50/30 cursor-pointer transition-colors"
                                      onClick={() => {
                                        setExpandedSecantRows(prev => 
                                          prev.includes(it.iteration) 
                                            ? prev.filter(id => id !== it.iteration)
                                            : [...prev, it.iteration]
                                        );
                                      }}
                                    >
                                      <td className="px-6 py-4 font-mono text-gray-400">{it.iteration}</td>
                                      <td className="px-6 py-4 font-mono font-medium text-emerald-600">{formatDisplayValue(it.x)}</td>
                                      <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.f_x)}</td>
                                      <td className="px-6 py-4 font-mono text-emerald-600">{formatErrorValue(it.error)}</td>
                                      <td className="px-6 py-4 text-gray-400">
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr className="bg-gray-50/50">
                                        <td colSpan={5} className="px-12 py-4">
                                          <div className="bg-white rounded-xl border border-black/5 p-6 shadow-inner space-y-4">
                                            <h4 className="text-[10px] font-bold text-gray-400 uppercase mb-3">Detalle del Cálculo</h4>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                              <div className="space-y-1">
                                                <span className="text-[10px] text-gray-400 font-mono uppercase">x_n-1</span>
                                                <div className="font-mono text-xs font-medium">{formatDisplayValue(it.x_prev)}</div>
                                              </div>
                                              <div className="space-y-1">
                                                <span className="text-[10px] text-gray-400 font-mono uppercase">x_n</span>
                                                <div className="font-mono text-xs font-medium">{formatDisplayValue(it.x_curr)}</div>
                                              </div>
                                              <div className="space-y-1">
                                                <span className="text-[10px] text-gray-400 font-mono uppercase">f(x_n-1)</span>
                                                <div className="font-mono text-xs font-medium">{formatDisplayValue(it.fx_prev)}</div>
                                              </div>
                                              <div className="space-y-1">
                                                <span className="text-[10px] text-gray-400 font-mono uppercase">f(x_n)</span>
                                                <div className="font-mono text-xs font-medium">{formatDisplayValue(it.fx_curr)}</div>
                                              </div>
                                              <div className="space-y-1">
                                                <span className="text-[10px] text-gray-400 font-mono uppercase">Numerador</span>
                                                <div className="font-mono text-xs font-medium">{formatDisplayValue(it.numerator)}</div>
                                              </div>
                                              <div className="space-y-1">
                                                <span className="text-[10px] text-gray-400 font-mono uppercase">Denominador</span>
                                                <div className="font-mono text-xs font-medium">{formatDisplayValue(it.denominator)}</div>
                                              </div>
                                            </div>
                                            <div className="pt-4 border-t border-black/5">
                                              <p className="text-[10px] text-gray-400 font-mono italic">
                                                Fórmula: x_n+1 = x_n - [f(x_n) * (x_n - x_n-1)] / [f(x_n) - f(x_n-1)]
                                              </p>
                                            </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeAlgo === 'newton' && output && output.iterations.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tabla de Resultados (Newton-Raphson)</h3>
                      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-black/5">
                              <tr>
                                <th className="px-6 py-4 font-semibold text-gray-600">n</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">Xn</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">f(Xn)</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">f'(Xn)</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">Xn+1</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">Error</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">Error Rel. (%)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {output.iterations.map((it) => (
                                <tr key={it.iteration} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 font-mono text-gray-400">{it.iteration}</td>
                                  <td className="px-6 py-4 font-mono font-medium">{formatDisplayValue(it.x)}</td>
                                  <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.f_x)}</td>
                                  <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.df_x)}</td>
                                  <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.x_next)}</td>
                                  <td className="px-6 py-4 font-mono text-emerald-600">{formatErrorValue(it.error)}</td>
                                  <td className="px-6 py-4 font-mono text-emerald-600">{typeof it.relativeError === 'number' ? it.relativeError.toFixed(4) + '%' : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeAlgo === 'lagrange' && output && (
                    <div className="space-y-6">
                      <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Bases de Lagrange (L_i(x))</h3>
                        <div className="space-y-2">
                          {output.lagrangeBases?.map((base, i) => (
                            <div key={i} className="p-3 bg-gray-50 rounded-lg font-mono text-sm">
                              <span className="text-emerald-600 font-bold">L_{i}(x)</span> = {base}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Productiva Desarrollada (P(x))</h3>
                        <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm leading-relaxed overflow-x-auto">
                          <div className="flex flex-col gap-4">
                            {output.lagrangeExpanded?.map((term, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 mt-1">
                                  {i + 1}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 bg-white px-4 py-3 rounded-xl border border-black/5 shadow-sm w-full">
                                  {i > 0 && <span className="text-gray-300 font-bold mr-2">+</span>}
                                  <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 uppercase font-bold mb-1">y_{i} * L_{i}(x)</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">({formatDisplayValue(term.y)})</span>
                                      <span className="text-gray-400">×</span>
                                      <span className="text-emerald-600 font-medium leading-relaxed">[{term.base}]</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Polinomio de Lagrange Final</h3>
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center min-h-[60px]">
                          {(() => {
                            try {
                              const tex = math.parse(output.lagrangeFinal).toTex();
                              return <div className="text-emerald-900 text-xl font-bold"><InlineMath math={tex} /></div>;
                            } catch (e) {
                              return <p className="font-mono text-emerald-900 font-bold text-lg">{output.lagrangeFinal}</p>;
                            }
                          })()}
                        </div>
                      </div>

                      {output.errorAnalysis && (
                        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-6">
                          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Análisis de Error</h3>
                          
                          {output.errorAnalysis.localError !== undefined && (
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl mb-6">
                              <h4 className="text-sm font-bold text-blue-900 mb-1">Error Local en x = {formatDisplayValue(output.errorAnalysis.evaluationPoint)}</h4>
                              <p className="font-mono text-blue-700 text-lg font-bold">|f(x) - P(x)| = {formatErrorValue(output.errorAnalysis.localError)}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Derivada f^({output.errorAnalysis.derivativeOrder})(x)</h4>
                                <div className="p-3 bg-gray-50 rounded-lg text-sm break-all flex items-center justify-center min-h-[50px]">
                                  {(() => {
                                    try {
                                      const tex = math.parse(output.errorAnalysis.derivativeFormula).toTex();
                                      return <InlineMath math={tex} />;
                                    } catch (e) {
                                      return <span className="font-mono">{output.errorAnalysis.derivativeFormula}</span>;
                                    }
                                  })()}
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Valor Máximo de la Derivada (M)</h4>
                                <div className="p-3 bg-blue-50 text-blue-700 rounded-lg font-mono text-sm font-bold">
                                  {output.errorAnalysis.maxDerivativeValue.toFixed(8)}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {output.errorAnalysis.theoreticalFormula ? (
                                <>
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Fórmula Teórica</h4>
                                    <div className="p-3 bg-gray-50 rounded-lg text-sm break-all text-gray-600 flex items-center justify-center min-h-[50px]">
                                      <InlineMath math={output.errorAnalysis.theoreticalFormula} />
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Fórmula Sustituida</h4>
                                    <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm break-all font-medium flex items-center justify-center min-h-[50px]">
                                      <InlineMath math={output.errorAnalysis.substitutedFormula} />
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Función g(x) = Π(x - xi)</h4>
                                    <div className="p-3 bg-gray-50 rounded-lg text-sm break-all flex items-center justify-center min-h-[50px]">
                                      {(() => {
                                        try {
                                          const tex = math.parse(output.errorAnalysis.gFormula).toTex();
                                          return <InlineMath math={tex} />;
                                        } catch (e) {
                                          return <span className="font-mono">{output.errorAnalysis.gFormula}</span>;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Derivada g'(x)</h4>
                                    <div className="p-3 bg-gray-50 rounded-lg text-sm break-all flex items-center justify-center min-h-[50px]">
                                      {(() => {
                                        try {
                                          const tex = math.parse(output.errorAnalysis.gDerivativeFormula).toTex();
                                          return <InlineMath math={tex} />;
                                        } catch (e) {
                                          return <span className="font-mono">{output.errorAnalysis.gDerivativeFormula}</span>;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>

                          {output.errorAnalysis.criticalPoints && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Puntos Críticos de g(x)</h4>
                                <div className="flex flex-wrap gap-2">
                                  {output.errorAnalysis.criticalPoints.map((cp: number, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                      x = {formatDisplayValue(cp)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Máximo de |g(x)|</h4>
                                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg font-mono text-sm font-bold">
                                  {output.errorAnalysis.maxGValue.toFixed(8)}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="pt-4 border-t border-black/5">
                            <h4 className="text-sm font-bold text-gray-600 mb-2">Error Global Máximo Estimado</h4>
                            <div className="p-4 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200">
                              {output.errorAnalysis.theoreticalFormula ? (
                                <p className="text-xs opacity-80 mb-1">Cota del Error Global (|E_t|)</p>
                              ) : (
                                <p className="text-xs opacity-80 mb-1">E(x) ≤ (M / {output.errorAnalysis.derivativeOrder}!) * max|g(x)|</p>
                              )}
                              <p className="text-2xl font-mono font-bold">{formatErrorValue(output.errorAnalysis.globalError)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeAlgo === 'ode' && output && output.iterations.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tabla de Resultados EDO</h3>
                      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-black/5">
                              <tr>
                                <th className="px-6 py-4 font-semibold text-gray-600">N</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">X_n (t)</th>
                                <th className="px-6 py-4 font-semibold text-gray-600">Y_n</th>
                                {params.odeMethod === 'euler' && <th className="px-6 py-4 font-semibold text-gray-600">f(t, y)</th>}
                                {params.odeMethod === 'euler_modificado' && (
                                  <>
                                    <th className="px-6 py-4 font-semibold text-gray-600">f(t_n, y_n)</th>
                                    <th className="px-6 py-4 font-semibold text-gray-600">Y_pred</th>
                                    <th className="px-6 py-4 font-semibold text-gray-600">f(t_n+1, Y_pred)</th>
                                  </>
                                )}
                                {params.odeMethod === 'rk' && (params.rkOrder === 1 || params.rkOrder === 2 || params.rkOrder === 3 || params.rkOrder === 4) && <th className="px-6 py-4 font-semibold text-gray-600">k1</th>}
                                {params.odeMethod === 'rk' && (params.rkOrder === 2 || params.rkOrder === 3 || params.rkOrder === 4) && <th className="px-6 py-4 font-semibold text-gray-600">k2</th>}
                                {params.odeMethod === 'rk' && (params.rkOrder === 3 || params.rkOrder === 4) && <th className="px-6 py-4 font-semibold text-gray-600">k3</th>}
                                {params.odeMethod === 'rk' && params.rkOrder === 4 && <th className="px-6 py-4 font-semibold text-gray-600">k4</th>}
                                <th className="px-6 py-4 font-semibold text-gray-600">Y_n+1</th>
                                {params.exactFormula && (
                                  <>
                                    <th className="px-6 py-4 font-semibold text-gray-600">Y_real</th>
                                    <th className="px-6 py-4 font-semibold text-gray-600">Error</th>
                                  </>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {output.iterations.map((it, i) => (
                                <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="px-6 py-4 font-mono text-gray-500">{it.iteration}</td>
                                  <td className="px-6 py-4 font-mono font-medium">{formatDisplayValue(it.x)}</td>
                                  <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.f_x)}</td>
                                  {params.odeMethod === 'euler' && <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.fty)}</td>}
                                  {params.odeMethod === 'euler_modificado' && (
                                    <>
                                      <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.fty1)}</td>
                                      <td className="px-6 py-4 font-mono text-amber-600">{formatDisplayValue(it.y_pred)}</td>
                                      <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.fty2)}</td>
                                    </>
                                  )}
                                  {params.odeMethod === 'rk' && (params.rkOrder === 1 || params.rkOrder === 2 || params.rkOrder === 3 || params.rkOrder === 4) && <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.k1)}</td>}
                                  {params.odeMethod === 'rk' && (params.rkOrder === 2 || params.rkOrder === 3 || params.rkOrder === 4) && <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.k2)}</td>}
                                  {params.odeMethod === 'rk' && (params.rkOrder === 3 || params.rkOrder === 4) && <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.k3)}</td>}
                                  {params.odeMethod === 'rk' && params.rkOrder === 4 && <td className="px-6 py-4 font-mono text-gray-500">{formatDisplayValue(it.k4)}</td>}
                                  <td className="px-6 py-4 font-mono font-bold text-emerald-600">{formatDisplayValue(it.y_next)}</td>
                                  {params.exactFormula && (
                                    <>
                                      <td className="px-6 py-4 font-mono text-blue-600">{formatDisplayValue(it.y_real)}</td>
                                      <td className="px-6 py-4 font-mono text-red-500">{formatErrorValue(it.error)}</td>
                                    </>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeAlgo !== 'aitken' && activeAlgo !== 'newton' && activeAlgo !== 'lagrange' && activeAlgo !== 'ode' && output && output.iterations.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tabla de Resultados</h3>
                        {['trapezoidal','simpson13','simpson38','midpoint'].includes(activeAlgo||'') && (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">{output.iterations.length} nodos</span>
                        )}
                      </div>
                      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-black/5">
                              {(() => {
                                const isIntegration = ['trapezoidal','simpson13','simpson38','midpoint'].includes(activeAlgo||'');
                                return (
                                  <tr>
                                    <th className="px-6 py-4 font-semibold text-gray-600">{isIntegration ? 'Nodo' : 'Iter / Paso'}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-600">{isIntegration ? 'x_i' : 'x / t'}</th>
                                    <th className="px-6 py-4 font-semibold text-gray-600">{isIntegration ? 'f(x_i)' : 'f(x) / y'}</th>
                                    {!isIntegration && <th className="px-6 py-4 font-semibold text-gray-600">Error</th>}
                                  </tr>
                                );
                              })()}
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {output.iterations.map((it, idx) => {
                                const isIntegration = ['trapezoidal', 'simpson13', 'simpson38', 'midpoint'].includes(activeAlgo || '');
                                let rowClass = "hover:bg-gray-50 transition-colors";
                                let label = "";
                                
                                if (isIntegration) {
                                  const n = output.iterations.length - 1;
                                  if (activeAlgo === 'midpoint') {
                                    rowClass = "bg-teal-50/30 hover:bg-teal-100/30 text-teal-900";
                                    label = "Punto Medio (w=1)";
                                  } else if (it.iteration === 0) {
                                    rowClass = "bg-blue-50/50 hover:bg-blue-100/50 font-bold text-blue-900";
                                    label = "f(a) (w=1)";
                                  } else if (it.iteration === n) {
                                    rowClass = "bg-blue-50/50 hover:bg-blue-100/50 font-bold text-blue-900";
                                    label = "f(b) (w=1)";
                                  } else if (activeAlgo === 'trapezoidal') {
                                    rowClass = "bg-amber-50/30 hover:bg-amber-100/30 text-amber-900";
                                    label = "Intermedio (w=2)";
                                  } else if (activeAlgo === 'simpson13') {
                                    if (it.iteration % 2 === 0) {
                                      rowClass = "bg-emerald-50/30 hover:bg-emerald-100/30 text-emerald-900";
                                      label = "Par (w=2)";
                                    } else {
                                      rowClass = "bg-orange-50/30 hover:bg-orange-100/30 text-orange-900";
                                      label = "Impar (w=4)";
                                    }
                                  } else if (activeAlgo === 'simpson38') {
                                    if (it.iteration % 3 === 0) {
                                      rowClass = "bg-purple-50/30 hover:bg-purple-100/30 text-purple-900";
                                      label = "Mult 3 (w=2)";
                                    } else {
                                      rowClass = "bg-rose-50/30 hover:bg-rose-100/30 text-rose-900";
                                      label = "Otro (w=3)";
                                    }
                                  }
                                }

                                return (
                                  <tr key={`${it.iteration}-${idx}`} className={rowClass}>
                                    <td className="px-6 py-4 font-mono">
                                      <div className="flex flex-col">
                                        <span className="text-gray-400">{it.iteration}</span>
                                        {label && <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">{label}</span>}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono font-medium">{formatDisplayValue(it.x)}</td>
                                    <td className="px-6 py-4 font-mono">{formatDisplayValue(it.f_x)}</td>
                                    {!isIntegration && <td className="px-6 py-4 font-mono text-emerald-600">{formatErrorValue(it.error)}</td>}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Convergence Modal */}
      <AnimatePresence>
        {showConvergenceModal && output && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConvergenceModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-3xl rounded-3xl shadow-2xl p-8 space-y-6 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-4">
                <div className="flex items-center gap-3 text-indigo-600">
                  <RefreshCcw size={24} />
                  <h3 className="text-xl font-bold">Gráfico de Convergencia</h3>
                </div>
                <button 
                  onClick={() => setShowConvergenceModal(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={output.iterations} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="iteration" label={{ value: 'Iteraciones', position: 'insideBottom', offset: -10 }} />
                    <YAxis label={{ value: 'Estimación', angle: -90, position: 'insideLeft' }} domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} />
                    <Line 
                      type="monotone" 
                      dataKey="estimate" 
                      stroke="#4f46e5" 
                      strokeWidth={2} 
                      dot={false} 
                      name="Valor Estimado" 
                    />
                    {activeAlgo === 'montecarlo' && params.monteCarloMode === 'pi' && (
                      <ReferenceLine y={Math.PI} stroke="red" strokeDasharray="3 3" label="π" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-4 border-t border-black/5 text-center">
                <p className="text-xs text-gray-500 italic">
                  Muestra cómo la estimación se estabiliza a medida que aumenta el número de muestras.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Statistics Modal */}
      <AnimatePresence>
        {showStatsModal && output?.stats && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStatsModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-8 space-y-6 overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-black/5 pb-4">
                <div className="flex items-center gap-3 text-blue-600">
                  <BarChart2 size={24} />
                  <h3 className="text-xl font-bold">Análisis Estadístico</h3>
                </div>
                <button 
                  onClick={() => setShowStatsModal(false)}
                  className="p-2 hover:bg-black/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Muestras</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">{output.stats.samples}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Media</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">{output.stats.mean.toFixed(6)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Desv. Estándar</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">{output.stats.stdDev.toFixed(6)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Error Estándar</p>
                  <p className="text-2xl font-mono font-bold text-gray-900">{output.stats.stdError.toFixed(6)}</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[10px] uppercase font-bold text-blue-400 tracking-widest mb-2">
                  Intervalo de Confianza {params.confidenceLevel || 95}%
                </p>
                <p className="text-lg font-mono font-bold text-blue-900">
                  [{output.stats.confidenceInterval[0].toFixed(6)}, {output.stats.confidenceInterval[1].toFixed(6)}]
                </p>
                {params.maxError !== undefined && (
                  <div className="mt-3 pt-3 border-t border-blue-200/50 flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-blue-400 tracking-widest">Error Máx. Permitido</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-blue-900">{params.maxError.toFixed(6)}</span>
                      {Math.abs(output.stats.confidenceInterval[1] - output.stats.mean) <= params.maxError ? (
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 size={14} />
                          <span className="text-[10px] font-bold">CUMPLE</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertCircle size={14} />
                          <span className="text-[10px] font-bold">NO CUMPLE</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {params.maxError !== undefined && Math.abs(output.stats.confidenceInterval[1] - output.stats.mean) > params.maxError && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                  <Info size={18} className="text-amber-500 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-900">Sugerencia de Convergencia</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Para alcanzar un error de {params.maxError}, se recomienda aumentar el número de iteraciones a aproximadamente{' '}
                      <span className="font-bold">
                        {Math.ceil(Math.pow(((params.confidenceLevel === 99 ? 2.576 : params.confidenceLevel === 90 ? 1.645 : 1.96) * output.stats.stdDev) / params.maxError, 2)).toLocaleString()}
                      </span>.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-black/5">
                <p className="text-xs text-gray-500 leading-relaxed italic">
                  * El análisis estadístico proporciona una medida de la precisión de la estimación basada en la varianza de las muestras.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comparison Modal */}
      <AnimatePresence>
        {showComparison && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComparison(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-8 space-y-6 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-emerald-600">
                  <BarChart2 size={24} />
                  <h3 className="text-xl font-bold">Comparativa de Métodos</h3>
                </div>
                <button onClick={() => setShowComparison(false)} className="text-gray-400 hover:text-black">
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                {[
                  { id: 'roots', label: 'Raíces' },
                  { id: 'integration', label: 'Integración' },
                  { id: 'ode', label: 'Ecuaciones Diferenciales' }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setComparisonCategory(cat.id as any);
                      setComparisonResults([]);
                    }}
                    className={clsx(
                      "flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all",
                      comparisonCategory === cat.id ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:bg-gray-200"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-2xl border border-black/5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fórmula {comparisonCategory === 'ode' ? 'f(t, y)' : 'f(x)'}</label>
                  <input 
                    type="text" 
                    value={params.formula}
                    onChange={(e) => handleFieldChange('formula', e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none font-mono text-sm"
                  />
                </div>

                {comparisonCategory === 'roots' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Intervalo [a, b]</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          value={isNaN(params.a as number) ? '' : params.a}
                          onChange={(e) => handleFieldChange('a', parseFloat(e.target.value))}
                          className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                          placeholder="a"
                        />
                        <input 
                          type="number" 
                          value={isNaN(params.b as number) ? '' : params.b}
                          onChange={(e) => handleFieldChange('b', parseFloat(e.target.value))}
                          className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                          placeholder="b"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Punto Inicial x0</label>
                      <input 
                        type="number" 
                        value={isNaN(params.x0 as number) ? '' : params.x0}
                        onChange={(e) => handleFieldChange('x0', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Función g(x)</label>
                        <button 
                          onClick={() => {
                            const recs = recommendG(params.formula);
                            handleFieldChange('g_formula', recs[0]);
                          }}
                          className="text-[9px] text-emerald-600 hover:underline"
                        >
                          Recomendar
                        </button>
                      </div>
                      <input 
                        type="text" 
                        value={params.g_formula}
                        onChange={(e) => handleFieldChange('g_formula', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm font-mono"
                        placeholder="g(x)"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tolerancia (10^-k)</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">10^-</span>
                        <input 
                          type="number" 
                          min="1"
                          max="15"
                          value={Math.round(-Math.log10(params.tolerance || 1e-5))}
                          onChange={(e) => {
                            const k = parseInt(e.target.value);
                            if (!isNaN(k) && k >= 1) {
                              handleFieldChange('tolerance', Math.pow(10, -k));
                            }
                          }}
                          className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm font-mono"
                        />
                      </div>
                    </div>
                  </>
                )}

                {comparisonCategory === 'integration' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Intervalo [a, b]</label>
                      <div className="flex gap-2">
                        <input 
                          type="number" 
                          value={isNaN(params.a as number) ? '' : params.a}
                          onChange={(e) => handleFieldChange('a', parseFloat(e.target.value))}
                          className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                          placeholder="a"
                        />
                        <input 
                          type="number" 
                          value={isNaN(params.b as number) ? '' : params.b}
                          onChange={(e) => handleFieldChange('b', parseFloat(e.target.value))}
                          className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                          placeholder="b"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subintervalos (n)</label>
                      <input 
                        type="number" 
                        value={isNaN(params.n as number) ? '' : params.n}
                        onChange={(e) => handleFieldChange('n', parseInt(e.target.value))}
                        className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                      />
                    </div>
                  </>
                )}

                {comparisonCategory === 'ode' && (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">t0</label>
                      <input 
                        type="number" 
                        value={isNaN(params.t0 as number) ? '' : params.t0}
                        onChange={(e) => handleFieldChange('t0', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">y0</label>
                      <input 
                        type="number" 
                        value={isNaN(params.y0 as number) ? '' : params.y0}
                        onChange={(e) => handleFieldChange('y0', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">t final</label>
                      <input 
                        type="number" 
                        value={isNaN(params.t_end as number) ? '' : params.t_end}
                        onChange={(e) => handleFieldChange('t_end', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paso (h)</label>
                      <input 
                        type="number" 
                        value={isNaN(params.h as number) ? '' : params.h}
                        onChange={(e) => handleFieldChange('h', parseFloat(e.target.value))}
                        className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Solución Exacta (Opcional)</label>
                      <input 
                        type="text" 
                        value={params.exactFormula || ''}
                        onChange={(e) => handleFieldChange('exactFormula', e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-black/5 rounded-xl text-sm font-mono"
                        placeholder="e.g. exp(t)"
                      />
                    </div>
                  </>
                )}
              </div>

              <button 
                onClick={runComparison}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                <Play size={18} fill="currentColor" /> Ejecutar Comparativa
              </button>

              {comparisonResults.length > 0 && (
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-black/5">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-gray-600">Método</th>
                        <th className="px-6 py-4 font-semibold text-gray-600">Estado</th>
                        <th className="px-6 py-4 font-semibold text-gray-600">
                          {comparisonCategory === 'roots' ? 'Raíz' : comparisonCategory === 'integration' ? 'Resultado' : 'Y final'}
                        </th>
                        <th className="px-6 py-4 font-semibold text-gray-600">
                          {comparisonCategory === 'roots' ? 'Iteraciones' : comparisonCategory === 'integration' ? 'Subintervalos/Muestras' : 'Pasos'}
                        </th>
                        <th className="px-6 py-4 font-semibold text-gray-600">
                          {comparisonCategory === 'ode' && !params.exactFormula ? '-' : 'Error Final'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {comparisonResults.map((res, idx) => {
                        let resultValue: string | number = '-';
                        if (comparisonCategory === 'roots' && res.root !== null && res.root !== undefined && !isNaN(res.root)) {
                          resultValue = Number(res.root).toFixed(8);
                        } else if (comparisonCategory === 'integration' && res.result !== null && res.result !== undefined) {
                          resultValue = typeof res.result === 'number' ? res.result.toFixed(8) : res.result;
                        } else if (comparisonCategory === 'ode' && res.iterations.length > 0) {
                          resultValue = Number(res.iterations[res.iterations.length - 1].f_x).toFixed(8);
                        }

                        let errorValue: string | number = '-';
                        if (res.iterations.length > 0) {
                          const lastIter = res.iterations[res.iterations.length - 1];
                          if (comparisonCategory === 'ode') {
                            if (params.exactFormula && lastIter.error !== undefined && !isNaN(lastIter.error)) {
                              errorValue = Number(lastIter.error).toExponential(4);
                            }
                          } else if (typeof lastIter.error === 'number') {
                            errorValue = Number(lastIter.error).toExponential(4);
                          }
                        }
                        if (comparisonCategory === 'integration' && res.errorAnalysis?.globalError) {
                          errorValue = Number(res.errorAnalysis.globalError).toExponential(4);
                        }

                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td 
                              className="px-6 py-4 font-bold text-gray-700 cursor-pointer hover:text-emerald-600 transition-colors flex items-center gap-2"
                              onClick={() => {
                                setFromComparison(true);
                                setActiveAlgo(res.id);
                                if (comparisonCategory === 'ode') {
                                  // For ODE, we need to set the specific method and order
                                  const isEuler = res.name === 'Euler';
                                  const isEulerMod = res.name === 'Euler Modificado';
                                  handleFieldChange('odeMethod', isEuler ? 'euler' : isEulerMod ? 'euler_modificado' : 'rk');
                                  if (!isEuler && !isEulerMod) {
                                    const orderMatch = res.name.match(/Orden (\d)/);
                                    if (orderMatch) handleFieldChange('rkOrder', parseInt(orderMatch[1]));
                                  }
                                }
                                setShowComparison(false);
                              }}
                            >
                              {res.name} <ChevronRight size={14} className="text-gray-300" />
                            </td>
                            <td className="px-6 py-4">
                              {res.converged ? (
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase">Convergente</span>
                              ) : (
                                <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase">Divergente / Error</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-mono">
                              {resultValue}
                            </td>
                            <td className="px-6 py-4 font-mono">{res.iterations.length}</td>
                            <td className="px-6 py-4 font-mono text-emerald-600">
                              {errorValue}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHelp(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 space-y-6"
            >
              <div className="flex items-center gap-3 text-emerald-600">
                <Info size={24} />
                <h3 className="text-xl font-bold">Nomenclatura Matemática</h3>
              </div>
              <div className="space-y-4 text-gray-600">
                <p>Utiliza los siguientes operadores para introducir tus fórmulas:</p>
                <ul className="space-y-2 font-mono text-sm bg-gray-50 p-4 rounded-xl border border-black/5">
                  <li className="flex justify-between"><span>Potencia:</span> <span className="text-emerald-600">x^2</span></li>
                  <li className="flex justify-between"><span>Multiplicación:</span> <span className="text-emerald-600">2*x</span></li>
                  <li className="flex justify-between"><span>Raíz Cuadrada:</span> <span className="text-emerald-600">sqrt(x)</span></li>
                  <li className="flex justify-between"><span>Exponencial:</span> <span className="text-emerald-600">exp(x) o e^x</span></li>
                  <li className="flex justify-between"><span>Logaritmo Nat:</span> <span className="text-emerald-600">log(x)</span></li>
                  <li className="flex justify-between"><span>Seno/Coseno:</span> <span className="text-emerald-600">sin(x), cos(x)</span></li>
                  <li className="flex justify-between"><span>Pi:</span> <span className="text-emerald-600">PI</span></li>
                </ul>
              </div>
              <button 
                onClick={() => setShowHelp(false)}
                className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
              >
                Entendido
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-sm bg-white h-full shadow-2xl p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <History size={20} className="text-emerald-500" /> Memoria
                </h3>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {history.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No hay registros guardados</p>
                  </div>
                ) : (
                  history.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => loadFromHistory(item)}
                      className="w-full p-4 bg-gray-50 border border-black/5 rounded-2xl text-left hover:border-emerald-500/30 hover:bg-emerald-50/30 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                          {ALGORITHMS.find(a => a.id === item.algo)?.name}
                        </span>
                      </div>
                      <p className="text-sm font-mono font-medium truncate">{item.formula}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-gray-400">
                        <span>Tol: {item.tolerance}</span>
                        <span>Iter: {item.maxIterations}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {history.length > 0 && (
                <button 
                  onClick={clearHistory}
                  className="mt-6 w-full py-3 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors text-sm font-semibold"
                >
                  <Trash2 size={16} /> Borrar Historial
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
