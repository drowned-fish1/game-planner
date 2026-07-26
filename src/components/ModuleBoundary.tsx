import { Component, Suspense, type ReactNode } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';

/** 懒加载模块的统一 loading 占位 */
function ModuleFallback() {
  const { t } = useLocale();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-bg text-content">
      <Loader2 size={26} className="animate-spin text-brand-400" />
      <span className="text-sm text-muted">{t((m) => m.app.moduleLoading)}</span>
    </div>
  );
}

function ModuleLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLocale();
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-bg text-content">
      <p className="text-sm text-muted">{t((m) => m.app.moduleLoadFailed)}</p>
      <button onClick={onRetry} className="btn-outline flex items-center gap-2">
        <RefreshCcw size={16} /> {t((m) => m.common.retry)}
      </button>
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
      return <ModuleLoadError onRetry={() => this.setState({ hasError: false })} />;
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
