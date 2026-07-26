import { Component, Suspense, type ReactNode } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';

/** 懒加载模块的统一 loading 占位 */
function ModuleFallback() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg text-content">
      <Loader2 size={26} className="animate-spin text-brand-400" />
      <span className="text-sm text-muted">模块加载中…</span>
    </div>
  );
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
}

/** 懒加载模块的统一错误界面（弱网/更新后旧 chunk 失效等场景），可点击重试 */
class ModuleErrorBoundary extends Component<{ children: ReactNode }, ModuleErrorBoundaryState> {
  state: ModuleErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Module load failed:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-bg text-content">
          <p className="text-sm text-muted">模块加载失败，请检查网络或刷新后重试</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="btn-outline flex items-center gap-2"
          >
            <RefreshCcw size={16} /> 重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** 包裹懒加载模块：Suspense loading + 错误边界，全应用统一 */
export function ModuleBoundary({ children }: { children: ReactNode }) {
  return (
    <ModuleErrorBoundary>
      <Suspense fallback={<ModuleFallback />}>{children}</Suspense>
    </ModuleErrorBoundary>
  );
}
