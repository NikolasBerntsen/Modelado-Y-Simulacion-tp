export interface IterationResult {
  iteration: number;
  x: number;
  f_x: number;
  error: number;
  [key: string]: any;
}

export interface Point {
  x: number | string;
  y: number | string;
  inside?: boolean;
}

export interface AlgorithmParams {
  formula: string;
  g_formula?: string;
  a?: number | string;
  b?: number | string;
  x0?: number | string;
  x1?: number | string;
  tolerance: number;
  maxIterations: number;
  // New fields
  points?: Point[];
  n?: number; // subintervals or degree
  h?: number | string; // step size
  t0?: number | string;
  y0?: number | string;
  t_end?: number | string;
  evaluationPoint?: number | string;
  useFunction?: boolean;
  isTrigMode?: boolean;
  seed?: string | number;
  monteCarloMode?: 'pi' | 'integration';
  monteCarloMethod?: 'average' | 'hit-or-miss';
  gaussPts?: number;
  confidenceLevel?: number;
  maxError?: number;
  dimensions?: 1 | 2 | 3;
  c?: number | string;
  d?: number | string;
  e_limit?: number | string;
  f_limit?: number | string;
  exactFormula?: string;
  odeMethod?: 'euler' | 'euler_modificado' | 'rk';
  rkOrder?: 1 | 2 | 3 | 4;
}

export interface AlgorithmOutput {
  root?: number | null;
  result?: number | string | null;
  iterations: IterationResult[];
  converged: boolean;
  errorMsg?: string;
  points?: Point[]; // For interpolation result curve
  derivativeFormula?: string;
  lagrangeBases?: string[];
  lagrangeExpanded?: { y: number; base: string }[];
  lagrangeFinal?: string;
  errorAnalysis?: {
    derivativeOrder: number;
    derivativeFormula: string;
    maxDerivativeValue: number;
    gFormula: string;
    gDerivativeFormula: string;
    criticalPoints: number[];
    maxGValue: number;
    globalError: number;
    localError?: number;
    evaluationPoint?: number;
    theoreticalFormula?: string;
    substitutedFormula?: string;
  };
  stats?: {
    samples: number;
    mean: number;
    stdDev: number;
    stdError: number;
    confidenceInterval: [number, number];
    allSamples?: number[];
  };
}
