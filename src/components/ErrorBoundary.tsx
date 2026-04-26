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

      // Sanitize error message to prevent XSS and only show safe information
      const getSafeErrorMessage = (error: Error | undefined): string => {
        if (!error) return 'An unknown error occurred';
        // Show error message but strip any potentially dangerous content
        const message = error.message || 'Unknown error';
        // Limit message length to prevent UI issues
        return message.length > 500 ? message.substring(0, 500) + '...' : message;
      };

      // Get error type for better categorization
      const getErrorType = (error: Error | undefined): string => {
        if (!error) return 'Unknown Error';
        if (error.name) return error.name;
        // Infer type from message patterns
        if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
          return 'Network Error';
        }
        if (error.message.includes('TypeError') || error.message.includes('undefined')) {
          return 'Type Error';
        }
        if (error.message.includes('SyntaxError')) {
          return 'Syntax Error';
        }
        return 'Application Error';
      };

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] p-4">
          <div className="text-center max-w-2xl w-full">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>

            {/* Always show error type and message for debugging */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 mb-4">
              <p className="text-red-300 font-semibold mb-2">{getErrorType(this.state.error)}</p>
              <p className="text-gray-300 text-sm mb-2">{getSafeErrorMessage(this.state.error)}</p>
            </div>

            {/* Show detailed error information in development mode */}
            {(isDevelopment || this.state.showDetails) && this.state.error && (
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
                        <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}

                    {this.state.errorInfo && (
                      <div>
                        <h3 className="text-red-400 text-sm font-semibold mb-1">Component Stack:</h3>
                        <pre className="text-xs text-gray-400 overflow-x-auto whitespace-pre-wrap font-mono">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    {/* Include error.toString() for additional context */}
                    <div>
                      <h3 className="text-yellow-400 text-sm font-semibold mb-1">Full Error:</h3>
                      <code className="text-xs text-gray-400 break-all">
                        {this.state.error.toString()}
                      </code>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!this.state.showDetails && (
              <button
                onClick={this.toggleDetails}
                className="text-blue-400 hover:text-blue-300 mb-4 text-sm"
              >
                Show Error Details
              </button>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined, errorInfo: undefined });
                }}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Try Again
              </button>
            </div>

            {/* Show error ID for support if error persists */}
            <p className="text-gray-500 text-xs mt-4">
              If this problem persists, please contact support with the error details above.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}