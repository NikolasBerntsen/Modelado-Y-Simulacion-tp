import { useState, useEffect } from 'react';

export function useHistory<T>(key: string) {
  const [history, setHistory] = useState<T[]>(() => {
    const saved = localStorage.getItem(`history_${key}`);
    return saved ? JSON.parse(saved) : [];
  });

  const saveToHistory = (item: T) => {
    const newHistory = [item, ...history.slice(0, 9)]; // Keep last 10
    setHistory(newHistory);
    localStorage.setItem(`history_${key}`, JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(`history_${key}`);
  };

  return { history, saveToHistory, clearHistory };
}
