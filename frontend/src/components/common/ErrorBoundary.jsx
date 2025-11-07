import React from "react";
import PropTypes from "prop-types";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in child component tree and displays fallback UI
 *
 * Usage:
 * <ErrorBoundary fallback={<CustomError />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    this.setState({
      error,
      errorInfo,
    });

    // Log to error reporting service if configured
    if (process.env.NODE_ENV === "production") {
      // Example: logErrorToService(error, errorInfo);
      console.error("Error Boundary caught an error:", error, errorInfo);
    } else {
      // Development: Show detailed error in console
      console.error("Error Boundary caught an error:", error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided by parent
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Card className="border-red-200 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-red-900 dark:text-red-100 mb-1">
                  {this.props.title || "Something went wrong"}
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  {this.props.message ||
                    "This component encountered an error. Please try refreshing or contact support if the problem persists."}
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <details className="mt-4 p-3 bg-red-100/50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <summary className="text-xs font-medium text-red-800 dark:text-red-200 cursor-pointer">
                      Error Details (Development Only)
                    </summary>
                    <pre className="mt-2 text-xs text-red-700 dark:text-red-300 overflow-auto max-h-40">
                      {this.state.error.toString()}
                      {this.state.errorInfo &&
                        this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
                <div className="mt-4 flex space-x-3">
                  <Button
                    onClick={this.handleReset}
                    variant="outline"
                    size="sm"
                    className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                  {this.props.onReset && (
                    <Button
                      onClick={() => {
                        this.handleReset();
                        this.props.onReset();
                      }}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Reset Component
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
  title: PropTypes.string,
  message: PropTypes.string,
  onReset: PropTypes.func,
};

ErrorBoundary.defaultProps = {
  fallback: null,
  title: "Something went wrong",
  message:
    "This component encountered an error. Please try refreshing or contact support if the problem persists.",
  onReset: null,
};

export default ErrorBoundary;
