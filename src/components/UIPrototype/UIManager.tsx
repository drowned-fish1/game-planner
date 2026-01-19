import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UIPage, PageType } from '../../utils/storage';
import { Plus, Layout, Trash2, Play, Monitor, Smartphone, Tablet, Sidebar, CreditCard, Square, Database } from 'lucide-react';
import { UICanvas } from './UICanvas'; 

interface UIManagerProps {
  data: { pages: UIPage[]; startPageId?: string };
  onUpdate: (data: { pages: UIPage[]; startPageId?: string }) => void;
}

const PAGE_PRESETS: { label: string; type: PageType; w: number; h: number; icon: any; desc: string }[] = [
  { label: 'PC 标准', type: 'screen', w: 1280, h: 720, icon: Monitor, desc: '桌面端游戏标准分辨率' },
  { label: 'iPhone', type: 'screen', w: 390, h: 844, icon: Smartphone, desc: '移动端竖屏布局' },
  { label: 'Tablet', type: 'screen', w: 1024, h: 768, icon: Tablet, desc: '平板/网页布局' },
  { label: '居中弹窗', type: 'modal_center', w: 500, h: 400, icon: CreditCard, desc: '通用的确认框/信息面板' },
  { label: '底部抽屉', type: 'modal_bottom', w: 390, h: 300, icon: Layout, desc: '移动端底部弹出的菜单' },
  { label: '侧边栏', type: 'sidebar_left', w: 300, h: 720, icon: Sidebar, desc: '左侧滑出的功能菜单' },
  { label: '气泡提示', type: 'toast', w: 200, h: 60, icon: Square, desc: '轻量级消息提示' },
];

export function UIManager({ data, onUpdate }: UIManagerProps) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeModalId, setActiveModalId] = useState<string | null>(null);

  // === 全局变量模拟 (Global Variables) ===
  // 这里的变量用于条件判断，例如 { HP: 100, HAS_KEY: 1 }
  const [globalVars, setGlobalVars] = useState<Record<string, number>>({
    HP: 100,
    GOLD: 0,
    KEY: 0,
    LEVEL: 1
  });

  // 处理交互事件 (核心中枢)
  const handleInteraction = (type: string, targetId?: string, param?: string) => {
    console.log('Interaction:', type, targetId, param); // 调试日志

    if (type === 'navigate' && targetId) {
       setEditingPageId(targetId);
       setActiveModalId(null);
    }
    if (type === 'open_modal' && targetId) {
       setActiveModalId(targetId);
    }
    if (type === 'close_modal') {
       setActiveModalId(null);
    }
    if (type === 'back') {
       if (activeModalId) setActiveModalId(null);
       // 真正的返回上一页需要历史栈，这里暂时简化为关闭弹窗
    }
    
    // === 变量修改逻辑 ===
    if (type === 'increment' && param) {
       // param 是变量名，如 "HP"
       setGlobalVars(prev => ({
         ...prev,
         [param]: (prev[param] || 0) + 1
       }));
    }
  };

  const createPage = (preset: typeof PAGE_PRESETS[0]) => {
    const newPage: UIPage = {
      id: uuidv4(),
      name: `${preset.label} ${data.pages.length + 1}`,
      type: preset.type,
      width: preset.w,
      height: preset.h,
      backgroundColor: preset.type.includes('modal') ? '#2a2a2a' : '#1e1e1e',
      components: []
    };
    onUpdate({ ...data, pages: [...data.pages, newPage] });
    setShowCreateModal(false);
  };

  const deletePage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('确定删除这个页面吗？')) return;
    onUpdate({ ...data, pages: data.pages.filter(p => p.id !== id) });
  };

  const setStartPage = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onUpdate({ ...data, startPageId: id });
  };

  if (editingPageId) {
    const page = data.pages.find(p => p.id === editingPageId);
    if (!page) { setEditingPageId(null); return null; }
    return (
      <UICanvas 
        page={page} 
        allPages={data.pages}
        activeModalId={activeModalId}
        // 传入全局变量供条件判断使用
        globalVars={globalVars}
        onBack={() => { setEditingPageId(null); setActiveModalId(null); }}
        onUpdate={(updatedPage) => {
          const newPages = data.pages.map(p => p.id === updatedPage.id ? updatedPage : p);
          onUpdate({ ...data, pages: newPages });
        }}
        onInteraction={handleInteraction}
      />
    );
  }

  return (
    <div className="flex-1 bg-slate-900 p-8 overflow-y-auto h-full relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Monitor size={32} className="text-purple-500" />
            UI 原型机 Pro
          </h2>
          <p className="text-slate-400 mt-1">可视化配置 | 变量调试: HP={globalVars.HP}, KEY={globalVars.KEY}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <button 
          onClick={() => setShowCreateModal(true)}
          className="aspect-video bg-slate-800/50 border-2 border-dashed border-slate-700 hover:border-emerald-500 hover:bg-slate-800 rounded-xl flex flex-col items-center justify-center group transition-all"
        >
          <div className="w-12 h-12 rounded-full bg-slate-700 group-hover:bg-emerald-600 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
            <Plus size={24} />
          </div>
          <span className="mt-3 text-slate-400 group-hover:text-white font-medium">新建界面</span>
        </button>

        {data.pages.map(page => {
          const pType = page.type || 'screen';
          return (
            <div 
              key={page.id}
              onClick={() => setEditingPageId(page.id)}
              className={`aspect-video bg-slate-800 border-2 rounded-xl relative group cursor-pointer hover:-translate-y-1 transition-all overflow-hidden ${data.startPageId === page.id ? 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'border-slate-700 hover:border-blue-500'}`}
            >
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/50">
                 {pType.includes('mobile') ? <Smartphone size={32} className="text-slate-600" /> : 
                  pType.includes('modal') ? <CreditCard size={32} className="text-yellow-600" /> :
                  <Layout size={32} className="text-blue-600" />}
                 <div className="mt-2 text-white font-bold text-sm drop-shadow-md px-2 text-center truncate w-full">{page.name}</div>
                 <span className="text-[10px] text-slate-500 uppercase">{pType.replace('_', ' ')}</span>
              </div>
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => setStartPage(e, page.id)} className={`p-1.5 rounded-lg text-white shadow-lg ${data.startPageId === page.id ? 'bg-purple-600' : 'bg-slate-600 hover:bg-purple-500'}`} title="设为入口"><Play size={14} /></button>
                <button onClick={(e) => deletePage(e, page.id)} className="p-1.5 bg-slate-600 hover:bg-red-500 text-white rounded-lg shadow-lg"><Trash2 size={14} /></button>
              </div>
              {data.startPageId === page.id && <div className="absolute top-2 left-2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded font-bold">HOME</div>}
            </div>
          );
        })}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm" onClick={() => setShowCreateModal(false)}>
          <div className="bg-slate-800 p-6 rounded-xl w-[800px] shadow-2xl border border-slate-700" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">选择界面模板</h3>
            <div className="grid grid-cols-4 gap-4">
              {PAGE_PRESETS.map((preset, idx) => (
                <div key={idx} onClick={() => createPage(preset)} className="bg-slate-700/50 hover:bg-emerald-600/20 border border-slate-600 hover:border-emerald-500 p-4 rounded-lg cursor-pointer transition-all group flex flex-col items-center text-center h-32 justify-center">
                  <preset.icon size={28} className="text-slate-400 group-hover:text-emerald-400 mb-2" />
                  <div className="font-bold text-slate-200 text-sm">{preset.label}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{preset.w}x{preset.h}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowCreateModal(false)} className="mt-6 w-full py-2 text-slate-500 hover:text-white">取消</button>
          </div>
        </div>
      )}
    </div>
  );
}