import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors anywhere in the tree and shows a styled
 * fallback instead of a blank white screen — important for a desktop
 * (Electron) app where a crash would otherwise look like a frozen window.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a console trail for debugging in the packaged app.
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-5 bg-bg p-8 text-center text-content">
        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400">
          <AlertOctagon size={30} />
        </div>
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold text-white">应用遇到了一个问题</h1>
          <p className="text-sm leading-relaxed text-muted">
            界面渲染时出现了未预期的错误。你的数据已保存在本地，不会丢失。可以尝试恢复，或重新载入应用。
          </p>
          {this.state.error?.message && (
            <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs text-subtle">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={this.handleReset} className="btn-outline">
            <RotateCcw size={16} />
            尝试恢复
          </button>
          <button onClick={this.handleReload} className="btn-primary">
            重新载入
          </button>
        </div>
      </div>
    );
  }
}
