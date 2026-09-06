import { Component, type ReactNode } from 'react';

/** Isolates each lab — a crash in one experiment never takes down the app. */
export class ErrorBoundary extends Component<{ children: ReactNode; lab: string }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="lab">
          <h1>Something broke in {this.props.lab}</h1>
          <p className="dataset-line">Other labs are unaffected. Error: {this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
