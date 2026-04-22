import { monteCarlo } from '../lib/algorithms/monteCarlo';
import type { AlgorithmOutput, AlgorithmParams } from '../types';

type MonteCarloWorkerRequest = {
  id: number;
  params: AlgorithmParams;
};

type MonteCarloWorkerResponse = {
  id: number;
  result?: AlgorithmOutput;
  error?: string;
};

self.onmessage = (event: MessageEvent<MonteCarloWorkerRequest>) => {
  const { id, params } = event.data;

  try {
    const result = monteCarlo(params);
    const response: MonteCarloWorkerResponse = { id, result };
    self.postMessage(response);
  } catch (error) {
    const response: MonteCarloWorkerResponse = {
      id,
      error: error instanceof Error ? error.message : 'Error desconocido en Monte Carlo.'
    };
    self.postMessage(response);
  }
};

export {};
