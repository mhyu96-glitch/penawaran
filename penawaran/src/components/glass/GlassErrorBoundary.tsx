import React, { Component, ErrorInfo, ReactNode } from 'react';
import { GlassCard } from './GlassCard';
import { GlassButton } from './GlassButton';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GlassErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Glass component error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-[#060e20] via-[#0b1326] to-[#0a1628] flex items-center justify-center p-6">
          <GlassCard variant="medium" className="p-8 max-w-md text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Oops! Something went wrong
            </h2>
            
            <p className="text-text-secondary mb-6">
              We encountered an error while loading this page. Please try refreshing or contact support if the problem persists.
            </p>
            
            {this.state.error && (
              <div className="glass-light rounded-lg p-4 mb-6 text-left max-h-48 overflow-y-auto">
                <div className="text-xs text-text-tertiary mb-2 font-bold">Detail Error:</div>
                <div className="text-xs font-mono text-red-400 break-all whitespace-pre-wrap">
                  {this.state.error.message}
                </div>
              </div>
            )}
            
            <div className="flex gap-3 justify-center">
              <GlassButton 
                variant="ghost" 
                onClick={() => window.location.reload()}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Refresh Page
              </GlassButton>
              
              <GlassButton 
                variant="primary" 
                onClick={this.handleReset}
              >
                Try Again
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}