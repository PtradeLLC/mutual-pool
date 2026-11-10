import React, { Component, ErrorInfo, ReactNode } from 'react';
import { reportError, appContext } from '../lib/telemetry';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reported?: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    const msg = (error?.message || '') + ' ' + (error?.stack || '');
    const lower = msg.toLowerCase();
    if (
      lower.includes('metamask') ||
      lower.includes('ethereum') ||
      lower.includes('extension') ||
      lower.includes('inpage.js') ||
      lower.includes('contentscript') ||
      lower.includes('resetting the streams') ||
      lower.includes('error restoring session') ||
      lower.includes('failed to connect to metamask')
    ) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
    reportError('crash', error?.message || 'App crashed', { stack: `${error?.stack || ''}\nComponent stack:${errorInfo?.componentStack || ''}` });
  }

  private sendReport = async () => {
    try {
      const ctx = appContext();
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'problem', comment: 'The app showed "Application Reload Needed".', lastError: this.state.error?.message, ...ctx }),
      });
      this.setState({ reported: true });
    } catch {
      this.setState({ reported: true });
    }
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] text-[#111827] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl border border-red-200 p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto font-bold text-xl">
              !
            </div>
            <h2 className="text-xl font-extrabold text-[#111827]">Application Reload Needed</h2>
            <p className="text-xs text-[#6B7280]">
              {this.state.error?.message || 'An unexpected error occurred while loading the app.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-5 py-2.5 rounded-xl bg-[#005FB8] hover:bg-[#004C93] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              Reload Application
            </button>
            <button
              onClick={this.sendReport}
              disabled={this.state.reported}
              className="block mx-auto text-xs font-semibold text-[#005FB8] hover:underline disabled:text-emerald-700 disabled:no-underline cursor-pointer"
            >
              {this.state.reported ? 'Thanks, we got your report.' : 'Report this problem'}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
