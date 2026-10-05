/**
 * Global Toast Stack Component
 * Renders floating toasts at bottom-right with dismiss and links.
 */
import { useToast } from '../../context/ToastContext';
import { Link } from 'react-router-dom';
import './ToastStack.css';

export default function ToastStack() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  const ICONS: Record<string, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <div className="toast-stack-container" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card toast-${toast.type}`}>
          <div className="toast-icon">{ICONS[toast.type] || 'ℹ️'}</div>
          <div className="toast-body">
            {toast.title && <div className="toast-title">{toast.title}</div>}
            <div className="toast-message">{toast.message}</div>
            {toast.link && (
              <Link to={toast.link} className="toast-link" onClick={() => removeToast(toast.id)}>
                View Details →
              </Link>
            )}
          </div>
          <button
            className="toast-close-btn"
            onClick={() => removeToast(toast.id)}
            aria-label="Dismiss Notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
