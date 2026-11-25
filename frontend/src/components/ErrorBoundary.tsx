import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('WriteUp Pro React Error Boundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBF9F3] dark:bg-[#14110E] text-[#1A1209] dark:text-[#F7F3E9] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white dark:bg-[#1D1814] border-2 border-[#8B1A1A] shadow-[6px_6px_0px_#8B1A1A] p-8 space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b-2 border-[#1A1209]">
              <div className="p-2.5 bg-[#8B1A1A] text-white border border-[#1A1209]">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#8B1A1A] block">
                  SYSTEM EXCEPTION // CRASH PREVENTED
                </span>
                <h2 className="text-lg font-bold tracking-tight text-[#1A1209] dark:text-white">
                  {this.props.fallbackTitle || 'Component Render Interrupted'}
                </h2>
              </div>
            </div>

            <p className="text-xs font-mono text-[#5C4D3C] dark:text-[#B8A99A] leading-relaxed">
              WriteUp Pro safely contained an unexpected interface anomaly. No student manuscript or grade data was lost.
            </p>

            {this.state.error && (
              <div className="p-3 bg-[#FFF5F5] dark:bg-[#2A1515] border border-[#8B1A1A] text-[11px] font-mono text-[#8B1A1A] overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2 font-mono">
              <button
                onClick={this.handleReset}
                className="neo-btn flex-1 py-2.5 px-4 bg-[#B84915] hover:bg-[#A03D0E] text-white text-xs flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Interface
              </button>
              <button
                onClick={this.handleReload}
                className="neo-btn py-2.5 px-4 bg-[#F4EFE6] dark:bg-[#26201B] text-[#1A1209] dark:text-[#F7F3E9] text-xs flex items-center justify-center gap-2"
              >
                <Home className="w-3.5 h-3.5" /> Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
