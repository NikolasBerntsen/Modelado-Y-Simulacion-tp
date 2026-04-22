import { AlgorithmParams, AlgorithmOutput, Point } from '../../types';
import { evaluate, parseParam } from './shared';

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

