import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Save, Check, Settings2, Key, Link, MessageSquareQuote, Sparkles, Eye, EyeOff, PlugZap, Loader2, Moon, Sun, Palette, Languages } from 'lucide-react';
import { toast } from '../../utils/toast';
import { confirmDialog } from '../../utils/confirm';
import { testAIConnection } from '../../utils/aiService';
import { getTheme, setTheme, ThemeMode } from '../../utils/theme';
import { useLocale } from '../../i18n/LocaleContext';

export interface AIConfig {
  id: string;
  name: string;
  url: string;
  key: string;
  model: string;
  // 新增：系统提示词字段
  systemPrompt?: string;
}

const STORAGE_KEY_CONFIGS = 'gp_ai_configs';
const STORAGE_KEY_ACTIVE = 'gp_ai_active_id';

const DEFAULT_CONFIG: AIConfig = {
  id: 'default',
  name: '默认 (OpenAI兼容)',
  url: 'https://api.openai.com/v1/chat/completions',
  key: '',
  model: 'gpt-3.5-turbo',
  systemPrompt: '你是一个专业的游戏策划助手。请直接输出结果，无需寒暄。'
};

export function Settings() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>(() => getTheme());
  const { locale, setLocale, t } = useLocale();

  const switchTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    setTheme(mode);
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = () => {
    const savedConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS);
    const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (savedConfigs) {
      setConfigs(JSON.parse(savedConfigs));
    } else {
      setConfigs([DEFAULT_CONFIG]);
      setActiveId(DEFAULT_CONFIG.id);
      setHasChanges(true);
    }
    if (savedActiveId) setActiveId(savedActiveId);
  };

  const saveConfigs = () => {
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(configs));
    if (activeId) localStorage.setItem(STORAGE_KEY_ACTIVE, activeId);
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    toast.success('AI 配置已保存');
  };

  const addConfig = () => {
    const newConfig: AIConfig = { ...DEFAULT_CONFIG, id: uuidv4(), name: '新配置' };
    setConfigs([...configs, newConfig]);
    setActiveId(newConfig.id);
    setHasChanges(true);
  };

  const updateConfig = (id: string, field: keyof AIConfig, value: string) => {
    setConfigs(configs.map(c => c.id === id ? { ...c, [field]: value } : c));
    setHasChanges(true);
  };

  const toggleKeyVisible = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const testConnection = async (config: AIConfig) => {
    if (testingId) return;
    setTestingId(config.id);
    try {
      await testAIConnection(config);
      toast.success(`「${config.name}」连接成功，模型响应正常`);
    } catch (err) {
      toast.error(`「${config.name}」连接失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setTestingId(null);
    }
  };

  const deleteConfig = async (id: string) => {
    if (configs.length <= 1) {
        toast.warning('至少保留一个配置');
        return;
    }
    const ok = await confirmDialog({ title: '确定删除此配置吗？', confirmText: '删除', danger: true });
    if (!ok) return;
    const newConfigs = configs.filter(c => c.id !== id);
    setConfigs(newConfigs);
    if (activeId === id) setActiveId(newConfigs[0].id);
    setHasChanges(true);
  };

  return (
    <div className="flex h-full flex-col bg-bg text-content">
      {/* 顶部标题栏 (适配移动端状态栏) */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-line bg-surface/80 px-4 backdrop-blur-xl md:px-8"
        style={{
            height: 'calc(4rem + env(safe-area-inset-top))',
            paddingTop: 'env(safe-area-inset-top)'
        }}
      >
        <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg border border-brand-500/25 bg-brand-500/10 text-brand-400">
              <Settings2 size={18} />
            </div>
            <h1 className="text-lg font-bold md:text-2xl">{t((m) => m.common.settings)}</h1>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && <span className="flex animate-fade-in items-center gap-1 text-sm text-brand-400"><Check size={16}/> 已保存</span>}
          <button
            onClick={saveConfigs}
            disabled={!hasChanges}
            className={hasChanges ? 'btn-primary' : 'btn cursor-not-allowed bg-surface-3 text-subtle'}
          >
            <Save size={17} /> <span className="hidden md:inline">保存配置</span><span className="md:hidden">保存</span>
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-8">
            {/* 外观板块 */}
            <section>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold"><Palette size={20} className="text-brand-400"/> {t((m) => m.app.paletteAppearance)}</h2>
                <div className="space-y-3">
                  <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
                    <div>
                        <div className="text-sm font-semibold text-content">{t((m) => m.settings.theme)}</div>
                        <div className="mt-0.5 text-xs text-muted">深色为默认；切换立即生效并记住偏好</div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => switchTheme('dark')}
                            className={theme === 'dark' ? 'btn-primary' : 'btn-outline'}
                            aria-pressed={theme === 'dark'}
                        >
                            <Moon size={15} /> {t((m) => m.settings.themeDark)}
                        </button>
                        <button
                            onClick={() => switchTheme('light')}
                            className={theme === 'light' ? 'btn-primary' : 'btn-outline'}
                            aria-pressed={theme === 'light'}
                        >
                            <Sun size={15} /> {t((m) => m.settings.themeLight)}
                        </button>
                    </div>
                  </div>
                  <div className="card flex flex-wrap items-center justify-between gap-4 p-4">
                    <div>
                        <div className="text-sm font-semibold text-content">{t((m) => m.settings.language)}</div>
                        <div className="mt-0.5 text-xs text-muted">默认中文；缺失翻译自动回退中文</div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setLocale('zh-CN')}
                            className={locale === 'zh-CN' ? 'btn-primary' : 'btn-outline'}
                            aria-pressed={locale === 'zh-CN'}
                        >
                            <Languages size={15} /> {t((m) => m.settings.languageZh)}
                        </button>
                        <button
                            onClick={() => setLocale('en-US')}
                            className={locale === 'en-US' ? 'btn-primary' : 'btn-outline'}
                            aria-pressed={locale === 'en-US'}
                        >
                            <Languages size={15} /> {t((m) => m.settings.languageEn)}
                        </button>
                    </div>
                  </div>
                </div>
            </section>

            {/* AI 配置板块 */}
            <section>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="flex items-center gap-2 text-xl font-bold"><Sparkles size={20} className="text-iris-400"/> AI 服务配置</h2>
                    <button onClick={addConfig} className="btn-outline shrink-0 text-sm">
                        <Plus size={16} /> 新增服务
                    </button>
                </div>

                <div className="space-y-5">
                    {configs.map(config => (
                        <div key={config.id} className={`overflow-hidden rounded-2xl border bg-surface transition-all ${config.id === activeId ? 'border-brand-500/60 shadow-glow' : 'border-line shadow-card'}`}>
                            {/* 卡片标题 */}
                            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface-2/40 p-4">
                                <div className="flex min-w-[200px] flex-1 items-center gap-3">
                                    <input type="radio" checked={config.id === activeId} onChange={() => { setActiveId(config.id); setHasChanges(true); }} className="h-5 w-5 cursor-pointer accent-brand-500" />
                                    <input value={config.name} onChange={e => updateConfig(config.id, 'name', e.target.value)} className="flex-1 border-b border-transparent bg-transparent text-lg font-bold text-content outline-none focus:border-line-strong" placeholder="配置名称" />
                                    {config.id === activeId && <span className="chip border-brand-500/30 bg-brand-500/10 text-brand-500">当前使用</span>}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => testConnection(config)}
                                        disabled={testingId !== null}
                                        className="btn-outline text-xs disabled:cursor-not-allowed disabled:opacity-60"
                                        title="用当前填写的配置发一条最小请求验证连通性"
                                    >
                                        {testingId === config.id ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
                                        测试连接
                                    </button>
                                    <button onClick={() => deleteConfig(config.id)} className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/15 hover:text-red-400" title="删除此配置" aria-label="删除此配置"><Trash2 size={18} /></button>
                                </div>
                            </div>

                            {/* 卡片内容 (表单) */}
                            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-xs text-subtle"><Link size={12}/> API Endpoint URL</label>
                                    <input value={config.url} onChange={e => updateConfig(config.id, 'url', e.target.value)} className="input font-mono" placeholder="https://api.openai.com/..." />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-1 text-xs text-subtle"><Key size={12}/> API Key</label>
                                    <div className="relative">
                                        <input
                                            value={config.key}
                                            onChange={e => updateConfig(config.id, 'key', e.target.value)}
                                            type={visibleKeys[config.id] ? 'text' : 'password'}
                                            className="input pr-10 font-mono"
                                            placeholder="sk-..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleKeyVisible(config.id)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-subtle transition-colors hover:text-content"
                                            title={visibleKeys[config.id] ? '隐藏 Key' : '显示 Key'}
                                            aria-label={visibleKeys[config.id] ? '隐藏 Key' : '显示 Key'}
                                        >
                                            {visibleKeys[config.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="flex items-center gap-1 text-xs text-subtle"><Settings2 size={12}/> 模型名称 (Model)</label>
                                    <input value={config.model} onChange={e => updateConfig(config.id, 'model', e.target.value)} className="input font-mono" placeholder="gpt-3.5-turbo, gpt-4..." />
                                </div>
                                {/* 新增：系统提示词配置 */}
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="flex items-center gap-1 text-xs text-subtle"><MessageSquareQuote size={12}/> 系统提示词 (System Prompt) - 定义 AI 的角色和行为</label>
                                    <textarea rows={3} value={config.systemPrompt || ''} onChange={e => updateConfig(config.id, 'systemPrompt', e.target.value)} className="input resize-none" placeholder="你是一个..." />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
      </div>
    </div>
  );
}
