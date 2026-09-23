/**
 * ErrorBoundary — catches uncaught React render errors and shows them
 * instead of a blank page.
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[HVRA ErrorBoundary]', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '2rem',
          maxWidth: '800px',
          margin: '2rem auto',
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
        }}>
          <h1 style={{ color: '#b91c1c', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            ❌ Application Error
          </h1>
          <p style={{ color: '#374151', marginBottom: '1rem' }}>
            The HVRA Tool encountered an unexpected error. Check the browser console for details.
          </p>
          <pre style={{
            background: '#1e293b',
            color: '#f8fafc',
            padding: '1rem',
            borderRadius: '8px',
            overflow: 'auto',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1.25rem',
              background: '#1e40af',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
