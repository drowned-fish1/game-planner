import { useState } from 'react';
import { X, Layers, Zap, MousePointer, EyeOff, Layout } from 'lucide-react'; 
import { UIComponent, UIPage, InteractionType } from '../../utils/storage';

export interface UIEditModalProps {
  component: UIComponent;
  allPages: UIPage[];
  onSave: (updates: Partial<UIComponent>) => void;
  onClose: () => void;
}

export function UIEditModal({ component, allPages, onSave, onClose }: UIEditModalProps) {
  const [activeTab, setActiveTab] = useState<'prop' | 'inter' | 'style'>('prop');

  // 基础属性
  const [name, setName] = useState(component.name);
  const [x, setX] = useState(component.x);
  const [y, setY] = useState(component.y);
  const [w, setW] = useState(component.width);
  const [h, setH] = useState(component.height);
  const [scale, setScale] = useState(component.customScale || 1);

  // 样式属性 (Z-Index, State)
  const [zIndex, setZIndex] = useState(component.zIndex || 1);
  const [isDisabled, setIsDisabled] = useState(component.state?.isDisabled || false);
  const [isActive, setIsActive] = useState(component.state?.isActive || false);
  const [isVisible, setIsVisible] = useState(component.state?.isVisible ?? true);

  // 交互逻辑
  const [interType, setInterType] = useState<InteractionType>(component.interaction?.type || 'none');
  const [targetId, setTargetId] = useState(component.interaction?.targetId || '');
  const [param, setParam] = useState(component.interaction?.param || '');

  const handleSave = () => {
    onSave({
      name,
      x: Number(x), y: Number(y), width: Number(w), height: Number(h),
      zIndex: Number(zIndex),
      customScale: Number(scale),
      state: { isDisabled, isActive, isVisible },
      interaction: {
        type: interType,
        targetId: ['navigate', 'open_modal'].includes(interType) ? targetId : undefined,
        param
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-700 w-[600px] h-[500px] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-700 p-4 bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-purple-600 rounded flex items-center justify-center text-white font-bold text-xs">CFG</div>
             <div>
               <h3 className="text-white font-bold text-base">{name}</h3>
               <p className="text-slate-500 text-[10px] uppercase">ID: {component.id.slice(0,6)}</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-900/30 border-b border-slate-700 px-4 gap-6">
          {[
            { id: 'prop', label: 'Transform', icon: Layout },
            { id: 'inter', label: 'Interaction', icon: MousePointer },
            { id: 'style', label: 'State & Style', icon: Layers },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 text-sm border-b-2 transition-colors ${activeTab === tab.id ? 'border-purple-500 text-purple-400 font-bold' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {/* TAB 1: Transform */}
          {activeTab === 'prop' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1"><label className="text-xs text-slate-500 font-bold">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" /></div>
                 <div className="space-y-1"><label className="text-xs text-emerald-500 font-bold">Scale</label><input type="number" step="0.1" value={scale} onChange={e => setScale(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm" /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                 <div><label className="text-[10px] text-slate-500 font-bold block mb-1">X</label><input type="number" value={x} onChange={e => setX(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" /></div>
                 <div><label className="text-[10px] text-slate-500 font-bold block mb-1">Y</label><input type="number" value={y} onChange={e => setY(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" /></div>
                 <div><label className="text-[10px] text-slate-500 font-bold block mb-1">W</label><input type="number" value={w} onChange={e => setW(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" /></div>
                 <div><label className="text-[10px] text-slate-500 font-bold block mb-1">H</label><input type="number" value={h} onChange={e => setH(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white text-xs" /></div>
              </div>
            </div>
          )}

          {/* TAB 2: Interaction */}
          {activeTab === 'inter' && (
            <div className="space-y-6">
              <div className="bg-slate-700/30 p-4 rounded-lg border border-slate-600">
                <label className="flex items-center gap-2 text-sm text-white font-bold mb-3"><Zap size={16} className="text-yellow-500"/> 点击动作 (On Click)</label>
                <select value={interType} onChange={e => setInterType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 outline-none">
                  <option value="none">无动作 (None)</option>
                  <option value="navigate">跳转页面 (Navigate)</option>
                  <option value="open_modal">打开弹窗 (Open Modal)</option>
                  <option value="close_modal">关闭当前弹窗 (Close Self)</option>
                  <option value="back">返回上一页 (Go Back)</option>
                  <option value="toggle">开关切换 (Toggle State)</option>
                  <option value="increment">数值+1 (Increment)</option>
                  <option value="trigger_cond">条件触发 (Condition)</option>
                </select>
              </div>

              {/* 动态显示的参数配置 */}
              {interType === 'navigate' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                   <label className="text-xs text-blue-400 font-bold block mb-1">目标页面 (Target Screen)</label>
                   <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm">
                     <option value="">-- 选择页面 --</option>
                     {allPages.filter(p => !p.type.includes('modal')).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                </div>
              )}

              {interType === 'open_modal' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                   <label className="text-xs text-yellow-500 font-bold block mb-1">目标弹窗 (Target Modal)</label>
                   <select value={targetId} onChange={e => setTargetId(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm">
                     <option value="">-- 选择弹窗 --</option>
                     {allPages.filter(p => p.type.includes('modal') || p.type.includes('toast')).map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                   </select>
                </div>
              )}

              {['trigger_cond', 'increment'].includes(interType) && (
                <div className="animate-in fade-in slide-in-from-top-2">
                   <label className="text-xs text-slate-400 font-bold block mb-1">参数 / 变量名</label>
                   <input value={param} onChange={e => setParam(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm" placeholder="如: HP, 100, isUnloked..." />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Style & State */}
          {activeTab === 'style' && (
            <div className="space-y-6">
              {/* Z-Index */}
              <div className="flex items-center justify-between bg-slate-700/30 p-3 rounded border border-slate-600">
                 <div className="flex items-center gap-2 text-sm text-slate-300"><Layers size={16}/> 层级 (Z-Index)</div>
                 <div className="flex items-center gap-2">
                   <button onClick={() => setZIndex(z => Math.max(0, z-1))} className="w-6 h-6 bg-slate-800 rounded text-white">-</button>
                   <input type="number" value={zIndex} onChange={e => setZIndex(Number(e.target.value))} className="w-12 bg-slate-900 text-center text-white text-sm rounded border border-slate-600 py-0.5" />
                   <button onClick={() => setZIndex(z => z+1)} className="w-6 h-6 bg-slate-800 rounded text-white">+</button>
                 </div>
              </div>

              {/* States Toggle */}
              <div className="space-y-3">
                <label className="text-xs text-slate-500 font-bold uppercase">初始状态 (Initial State)</label>
                
                <div className="flex items-center justify-between p-2 hover:bg-slate-700/50 rounded cursor-pointer" onClick={() => setIsDisabled(!isDisabled)}>
                   <span className="text-sm text-white flex items-center gap-2"><EyeOff size={14} className={isDisabled ? 'text-red-500' : 'text-slate-600'}/> 禁用 (Disabled)</span>
                   <div className={`w-8 h-4 rounded-full relative transition-colors ${isDisabled ? 'bg-red-600' : 'bg-slate-600'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isDisabled ? 'left-4.5' : 'left-0.5'}`}></div>
                   </div>
                </div>

                <div className="flex items-center justify-between p-2 hover:bg-slate-700/50 rounded cursor-pointer" onClick={() => setIsActive(!isActive)}>
                   <span className="text-sm text-white flex items-center gap-2"><Zap size={14} className={isActive ? 'text-yellow-500' : 'text-slate-600'}/> 激活/高亮 (Active)</span>
                   <div className={`w-8 h-4 rounded-full relative transition-colors ${isActive ? 'bg-yellow-600' : 'bg-slate-600'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isActive ? 'left-4.5' : 'left-0.5'}`}></div>
                   </div>
                </div>

                <div className="flex items-center justify-between p-2 hover:bg-slate-700/50 rounded cursor-pointer" onClick={() => setIsVisible(!isVisible)}>
                   <span className="text-sm text-white flex items-center gap-2">👁️ 可见 (Visible)</span>
                   <div className={`w-8 h-4 rounded-full relative transition-colors ${isVisible ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isVisible ? 'left-4.5' : 'left-0.5'}`}></div>
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex justify-end gap-3 bg-slate-900/50">
           <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
           <button onClick={handleSave} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-sm shadow-lg shadow-purple-900/20">Save Changes</button>
        </div>
      </div>
    </div>
  );
}