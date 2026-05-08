import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches React render crashes.
 * Prevents the entire app from going to a white/black screen.
 * Shows a recovery UI so the cashier can continue working.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleRecover = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 999999,
          direction: 'rtl',
        }}>
          <div style={{
            maxWidth: 480,
            padding: '2.5rem',
            background: '#1e293b',
            borderRadius: '1.25rem',
            border: '1px solid rgba(148,163,184,0.2)',
            textAlign: 'center',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f8fafc' }}>
              حدث خطأ غير متوقع
            </h1>
            <p style={{ fontSize: '0.95rem', color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              لا تقلق — بياناتك آمنة. يمكنك المحاولة مرة أخرى أو إعادة تشغيل التطبيق.
            </p>

            {this.state.error && (
              <details style={{
                marginBottom: '1.5rem',
                textAlign: 'left',
                direction: 'ltr',
                background: '#0f172a',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                fontSize: '0.8rem',
                color: '#f87171',
                border: '1px solid rgba(248,113,113,0.2)',
              }}>
                <summary style={{ cursor: 'pointer', color: '#94a3b8', marginBottom: '0.5rem' }}>
                  Technical Details
                </summary>
                <code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {this.state.error.message}
                </code>
              </details>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleRecover}
                style={{
                  padding: '0.7rem 1.5rem',
                  borderRadius: '0.6rem',
                  border: '1px solid rgba(148,163,184,0.3)',
                  background: 'transparent',
                  color: '#e2e8f0',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                محاولة مرة أخرى
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.7rem 1.5rem',
                  borderRadius: '0.6rem',
                  border: 'none',
                  background: 'linear-gradient(120deg, #22d3ee, #3b82f6)',
                  color: '#fff',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                إعادة تشغيل
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
