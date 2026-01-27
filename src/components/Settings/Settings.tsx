import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, Save, Settings as SettingsIcon, Key, Link, Box } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export interface AIConfig {
  id: string;
  name: string; // 配置别名，如 "公司DeepSeek"
  url: string;
  key: string;
  model: string;
}

const STORAGE_KEY_CONFIGS = 'gp_ai_configs';
const STORAGE_KEY_ACTIVE = 'gp_ai_active_id';

// 默认预设
const DEFAULT_CONFIG: AIConfig = {
  id: 'default',
  name: '默认 (Mimo)',
  url: 'https://api.xiaomimimo.com/v1/chat/completions',
  key: '',
  model: 'mimo-v2-flash'
};

export function Settings() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  
  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AIConfig>(DEFAULT_CONFIG);

  // 初始化加载
  useEffect(() => {
    const savedConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS);
    const savedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);

    if (savedConfigs) {
      setConfigs(JSON.parse(savedConfigs));
    } else {
      setConfigs([DEFAULT_CONFIG]);
    }

    if (savedActive) {
      setActiveId(savedActive);
    } else {
      setActiveId(savedConfigs ? JSON.parse(savedConfigs)[0]?.id : DEFAULT_CONFIG.id);
    }
  }, []);

  // 保存到本地
  const persist = (newConfigs: AIConfig[], newActiveId: string) => {
    localStorage.setItem(STORAGE_KEY_CONFIGS, JSON.stringify(newConfigs));
    localStorage.setItem(STORAGE_KEY_ACTIVE, newActiveId);
    setConfigs(newConfigs);
    setActiveId(newActiveId);
  };

  const handleAdd = () => {
    const newConfig: AIConfig = {
      id: uuidv4(),
      name: '新配置',
      url: 'https://api.openai.com/v1/chat/completions',
      key: '',
      model: 'gpt-3.5-turbo'
    };
    const newConfigs = [...configs, newConfig];
    persist(newConfigs, activeId);
    // 自动进入编辑模式
    setEditingId(newConfig.id);
    setEditForm(newConfig);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定删除此配置吗？')) {
      const newConfigs = configs.filter(c => c.id !== id);
      // 如果删除了当前激活的，激活列表第一个
      let newActive = activeId;
      if (id === activeId && newConfigs.length > 0) {
        newActive = newConfigs[0].id;
      }
      persist(newConfigs, newActive);
      if (editingId === id) setEditingId(null);
    }
  };

  const handleEdit = (config: AIConfig) => {
    setEditingId(config.id);
    setEditForm({ ...config });
  };

  const handleSaveForm = () => {
    const newConfigs = configs.map(c => c.id === editingId ? editForm : c);
    persist(newConfigs, activeId);
    setEditingId(null);
  };

  const handleSetActive = (id: string) => {
    persist(configs, id);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto text-slate-200">
      <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <SettingsIcon className="text-emerald-500" size={32} />
        系统设置
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* 左侧：配置列表 */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[500px]">
          <div className="p-4 bg-slate-900/50 border-b border-slate-700 flex justify-between items-center">
            <span className="font-bold text-slate-300">AI 配置列表</span>
            <button onClick={handleAdd} className="p-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white transition-colors" title="新建配置">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {configs.map(config => (
              <div 
                key={config.id}
                onClick={() => handleEdit(config)}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between group ${
                  editingId === config.id 
                    ? 'bg-slate-700 border-emerald-500/50' 
                    : 'bg-slate-800/50 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className={`font-bold text-sm truncate ${config.id === activeId ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {config.name}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate">{config.model}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  {config.id === activeId ? (
                    <span className="text-[10px] bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">当前</span>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleSetActive(config.id); }}
                      className="p-1.5 text-slate-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="设为当前使用"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(config.id); }}
                    className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：编辑表单 */}
        <div className="md:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-6 h-[500px] flex flex-col">
          {editingId ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                 <h3 className="text-lg font-bold text-white">编辑配置</h3>
                 <button onClick={handleSaveForm} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-bold text-sm transition-colors">
                   <Save size={16} /> 保存修改
                 </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1 block">配置名称 (Alias)</label>
                  <input 
                    value={editForm.name} 
                    onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 text-white focus:border-emerald-500 outline-none transition-colors"
                    placeholder="例如：公司 Key"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2"><Link size={12}/> API 地址 (Base URL)</label>
                  <input 
                    value={editForm.url} 
                    onChange={e => setEditForm({...editForm, url: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 text-slate-300 font-mono text-xs focus:border-emerald-500 outline-none transition-colors"
                    placeholder="https://api.openai.com/v1/chat/completions"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">注意：通常以 /v1/chat/completions 结尾，具体视服务商而定。</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2"><Key size={12}/> API Key</label>
                  <input 
                    type="password"
                    value={editForm.key} 
                    onChange={e => setEditForm({...editForm, key: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 text-slate-300 font-mono text-xs focus:border-emerald-500 outline-none transition-colors"
                    placeholder="sk-..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2"><Box size={12}/> 模型名称 (Model Name)</label>
                  <input 
                    value={editForm.model} 
                    onChange={e => setEditForm({...editForm, model: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 text-white focus:border-emerald-500 outline-none transition-colors"
                    placeholder="例如: gpt-4o, claude-3-5-sonnet, deepseek-chat"
                  />
                </div>
              </div>
            </div>
          ) : (
             <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
                <SettingsIcon size={48} className="opacity-20" />
                <p>请在左侧选择一个配置进行编辑，或点击 "+" 新增</p>
             </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-200/70">
        🔒 安全提示：API Key 仅存储在您的本地浏览器 (LocalStorage) 中，不会上传到任何服务器。请勿在公共电脑上保存重要 Key。
      </div>
    </div>
  );
}