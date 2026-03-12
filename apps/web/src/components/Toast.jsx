import { useApp } from '../context/AppContext.jsx';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export function Toast() {
  const { state, dispatch } = useApp();
  const { toast } = state;

  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium max-w-sm animate-in slide-in-from-bottom-4 duration-200 ${
        isError
          ? 'bg-red-950 border-red-800 text-red-200'
          : 'bg-emerald-950 border-emerald-800 text-emerald-200'
      }`}
    >
      {isError ? (
        <AlertCircle className="w-4 h-4 text-danger shrink-0" />
      ) : (
        <CheckCircle className="w-4 h-4 text-success shrink-0" />
      )}
      <span>{toast.message}</span>
      <button
        onClick={() => dispatch({ type: 'SET_TOAST', payload: null })}
        className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
