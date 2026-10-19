import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastContext } from './useToast';
let toastSequence = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  function dismiss(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  const notifications = useMemo(() => Object.fromEntries(['success', 'warning', 'error', 'info'].map((type) => [type, (message) => {
      const id = ++toastSequence;
      setToasts((current) => [...current.slice(-3), { id, type, message }]);
      window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 5500);
    }])), []);

  return <ToastContext.Provider value={notifications}>
    {children}
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions text">
      {toasts.map(({ id, type, message }) => {
        const Icon = type === 'success' ? CheckCircle2 : type === 'warning' || type === 'error' ? AlertCircle : Info;
        return <div className={`toast toast-${type}`} key={id} role={type === 'error' ? 'alert' : 'status'}>
          <Icon size={19} aria-hidden="true" />
          <span>{message}</span>
          <button className="toast-dismiss" onClick={() => dismiss(id)} aria-label="Dismiss notification"><X size={16} /></button>
        </div>;
      })}
    </div>
  </ToastContext.Provider>;
}
