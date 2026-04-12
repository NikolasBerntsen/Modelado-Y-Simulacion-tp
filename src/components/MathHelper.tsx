import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { cn } from '../lib/utils';

interface MathHelperProps {
  onInsert: (text: string) => void;
}

const MATH_BUTTONS = [
  { label: 'x', value: 'x' },
  { label: 't', value: 't' },
  { label: 'y', value: 'y' },
  { label: '+', value: '+' },
  { label: '-', value: '-' },
  { label: '*', value: '*' },
  { label: '/', value: '/' },
  { label: '^', value: '^' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
  { label: 'sin', value: 'sin(' },
  { label: 'cos', value: 'cos(' },
  { label: 'tan', value: 'tan(' },
  { label: 'sqrt', value: 'sqrt(' },
  { label: 'log', value: 'log(' },
  { label: 'exp', value: 'exp(' },
  { label: 'pi', value: 'pi' },
  { label: 'e', value: 'e' },
  { label: 'abs', value: 'abs(' },
  { label: 'asin', value: 'asin(' },
  { label: 'acos', value: 'acos(' },
  { label: 'atan', value: 'atan(' },
];

export const MathHelper: React.FC<MathHelperProps> = ({ onInsert }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors text-slate-700 text-sm font-medium"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-500" />
          <span>Ayuda de Funciones</span>
        </div>
        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isOpen ? "max-h-60 p-3" : "max-h-0"
      )}>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
          {MATH_BUTTONS.map((btn) => (
            <button
              key={btn.label}
              onClick={() => onInsert(btn.value)}
              className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-all active:scale-95 shadow-sm"
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
