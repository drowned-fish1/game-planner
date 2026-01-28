import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, Save, Check, Settings2, Key, Link, MessageSquareQuote, Sparkles } from 'lucide-react';

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

  const deleteConfig = (id: string) => {
    if (configs.length <= 1) {
        alert("至少保留一个配置");
        return;
    }
    if (!confirm('确定删除此配置吗？')) return;
    const newConfigs = configs.filter(c => c.id !== id);
    setConfigs(newConfigs);
    if (activeId === id) setActiveId(newConfigs[0].id);
    setHasChanges(true);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-200">
      {/* 顶部标题栏 (适配移动端状态栏) */}
      <div 
        className="bg-slate-800 px-4 md:px-8 border-b border-slate-700 flex justify-between items-center shrink-0"
        style={{ 
            height: 'calc(4rem + env(safe-area-inset-top))', 
            paddingTop: 'env(safe-area-inset-top)'
        }}
      >
        <div className="flex items-center gap-3">
            <Settings2 size={24} className="text-emerald-400" />
            <h1 className="text-lg md:text-2xl font-bold">设置</h1>
        </div>
        <div className="flex gap-3">
          {saveSuccess && <span className="flex items-center gap-1 text-emerald-400 text-sm animate-in fade-in"><Check size={16}/> 已保存</span>}
          <button 
            onClick={saveConfigs} 
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded font-bold transition-all ${hasChanges ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}
          >
            <Save size={18} /> <span className="hidden md:inline">保存配置</span><span className="md:hidden">保存</span>
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
            {/* AI 配置板块 */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles size={20} className="text-purple-400"/> AI 服务配置</h2>
                    <button onClick={addConfig} className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors">
                        <Plus size={16} /> 新增服务
                    </button>
                </div>

                <div className="space-y-6">
                    {configs.map(config => (
                        <div key={config.id} className={`bg-slate-800 rounded-xl border overflow-hidden transition-all ${config.id === activeId ? 'border-emerald-500 shadow-md shadow-emerald-500/10' : 'border-slate-700'}`}>
                            {/* 卡片标题 */}
                            <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex justify-between items-center flex-wrap gap-4">
                                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                                    <input type="radio" checked={config.id === activeId} onChange={() => { setActiveId(config.id); setHasChanges(true); }} className="accent-emerald-500 w-5 h-5 cursor-pointer" />
                                    <input value={config.name} onChange={e => updateConfig(config.id, 'name', e.target.value)} className="bg-transparent border-b border-transparent focus:border-slate-500 outline-none font-bold text-lg flex-1 text-white" placeholder="配置名称" />
                                </div>
                                <button onClick={() => deleteConfig(config.id)} className="p-2 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded transition-colors"><Trash2 size={18} /></button>
                            </div>
                            
                            {/* 卡片内容 (表单) */}
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500 flex items-center gap-1"><Link size={12}/> API Endpoint URL</label>
                                    <input value={config.url} onChange={e => updateConfig(config.id, 'url', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none font-mono text-slate-300" placeholder="https://api.openai.com/..." />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs text-slate-500 flex items-center gap-1"><Key size={12}/> API Key</label>
                                    <input value={config.key} onChange={e => updateConfig(config.id, 'key', e.target.value)} type="password" className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none font-mono text-slate-300" placeholder="sk-..." />
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs text-slate-500 flex items-center gap-1"><Settings2 size={12}/> 模型名称 (Model)</label>
                                    <input value={config.model} onChange={e => updateConfig(config.id, 'model', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none font-mono text-slate-300" placeholder="gpt-3.5-turbo, gpt-4..." />
                                </div>
                                {/* 新增：系统提示词配置 */}
                                <div className="space-y-1 md:col-span-2">
                                    <label className="text-xs text-slate-500 flex items-center gap-1"><MessageSquareQuote size={12}/> 系统提示词 (System Prompt) - 定义 AI 的角色和行为</label>
                                    <textarea rows={3} value={config.systemPrompt || ''} onChange={e => updateConfig(config.id, 'systemPrompt', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-emerald-500 outline-none resize-none text-slate-300" placeholder="你是一个..." />
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