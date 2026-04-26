import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  showDetails?: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const isDevelopment = import.meta.env.DEV;

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] p-4">
          <div className="text-center max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-4">{this.state.error?.message}</p>

            {/* Show detailed error information in development mode */}
            {isDevelopment && this.state.error && (
              <div className="text-left bg-gray-900 rounded-lg p-4 mb-4">
                <button
                  onClick={this.toggleDetails}
                  className="text-blue-400 hover:text-blue-300 mb-2 text-sm"
                >
                  {this.state.showDetails ? 'Hide Details' : 'Show Details'}
                </button>

                {this.state.showDetails && (
                  <div className="space-y-4">
                    {this.state.error.stack && (
                      <div>
                        <h3 className="text-red-400 text-sm font-semibold mb-1">Stack Trace:</h3>
                        <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}

                    {this.state.errorInfo && (
                      <div>
                        <h3 className="text-red-400 text-sm font-semibold mb-1">Component Stack:</h3>
                        <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}