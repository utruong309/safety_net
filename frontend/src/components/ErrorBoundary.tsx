import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900 rounded-full mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Something went wrong
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                An unexpected error occurred. Please try refreshing the page.
              </p>
              
              {this.state.error && (
                <details className="mb-4 text-left">
                  <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200">
                    Error Details
                  </summary>
                  <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
              
              <div className="flex space-x-3 justify-center">
                <button
                  onClick={this.handleRetry}
                  className="btn-primary flex items-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-secondary"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
