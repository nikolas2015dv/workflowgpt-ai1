import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <section className="error-boundary glass-panel" role="alert">
          <h2 className="error-boundary__title">Что-то пошло не так</h2>
          <p className="error-boundary__message">{this.state.message}</p>
          <button type="button" className="btn-primary" onClick={this.handleReset}>
            Начать заново
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
