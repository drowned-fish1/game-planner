// src/components/UIPrototype/UIManager.tsx
import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UIPage, PageType, CustomAsset } from '../../utils/storage';
import { Plus, Layout, Trash2, Play, Monitor, Smartphone, Tablet, Sidebar, CreditCard, Square } from 'lucide-react';
import { UICanvas } from './UICanvas'; 
import { AssetEditorModal } from './AssetEditorModal';
import { UI_ASSETS as DEFAULT_ASSETS } from './assets';
import { PixelSprite } from './PixelSprite';
import { confirmDialog } from '../../utils/confirm';

interface UIManagerProps {
  data: { pages: UIPage[]; startPageId?: string; assets?: CustomAsset[] }; 
  onUpdate: (data: any) => void;
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
  const [showAssetModal, setShowAssetModal] = useState(false); // 资产弹窗开关

  const [globalVars, setGlobalVars] = useState<Record<string, number>>({ HP: 100, GOLD: 0, KEY: 0 });

  // Esc 关闭新建页面弹窗
  useEffect(() => {
    if (!showCreateModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowCreateModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCreateModal]);

  // === 资产合并逻辑 ===
  // 将内置 assets 和用户自定义 assets 合并显示
  const customAssets: CustomAsset[] = data.assets || [];
  const allAssets = [...DEFAULT_ASSETS, ...customAssets];

  const handleInteraction = (type: string, targetId?: string, param?: string) => {
    if (type === 'navigate' && targetId) { setEditingPageId(targetId); setActiveModalId(null); }
    if (type === 'open_modal' && targetId) setActiveModalId(targetId);
    if (type === 'close_modal') setActiveModalId(null);
    if (type === 'back') { if (activeModalId) setActiveModalId(null); }
    if (type === 'increment' && param) setGlobalVars(p => ({ ...p, [param]: (p[param] || 0) + 1 }));
  };

  const createPage = (preset: typeof PAGE_PRESETS[0]) => {
    const newPage: UIPage = {
      id: uuidv4(), name: `${preset.label} ${data.pages.length + 1}`, type: preset.type,
      width: preset.w, height: preset.h, backgroundColor: preset.type.includes('modal') ? '#2a2a2a' : '#1e1e1e', components: []
    };
    onUpdate({ ...data, pages: [...data.pages, newPage] });
    setShowCreateModal(false);
  };
  
  // === 保存新资产 ===
  const handleSaveAsset = (newAsset: CustomAsset) => {
    const updatedAssets = [...customAssets, newAsset];
    // 更新数据，保存到 storage
    onUpdate({ ...data, assets: updatedAssets });
    setShowAssetModal(false);
  };

  const deletePage = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const ok = await confirmDialog({ title: '确定删除这个页面吗？', confirmText: '删除', danger: true });
      if (!ok) return;
      onUpdate({ ...data, pages: data.pages.filter(p => p.id !== id) });
  };
  const setStartPage = (e: React.MouseEvent, id: string) => { 
      e.stopPropagation(); onUpdate({ ...data, startPageId: id });
  };

  // === 编辑模式 ===
  if (editingPageId) {
    const page = data.pages.find(p => p.id === editingPageId);
    if (!page) { setEditingPageId(null); return null; }
    
    return (
      <div className="flex h-full w-full bg-[#121212] overflow-hidden">
         {/* === 1. 左侧资产栏 (新位置) === */}
         <div className="w-64 bg-bg border-r border-line p-4 flex flex-col gap-4 select-none shrink-0 z-10 h-full">
            <div className="flex justify-between items-center mb-1">
                <h3 className="text-muted text-xs font-bold uppercase">UI 资产库</h3>
                <button onClick={() => setShowAssetModal(true)} className="p-1.5 hover:bg-surface-3 rounded text-brand-500 hover:text-brand-400 transition-colors" title="新建资产" aria-label="新建资产"><Plus size={16}/></button>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3 pb-4">
                {allAssets.map(asset => (
                  <div key={asset.id} 
                       className="flex flex-col items-center gap-2 p-2 bg-surface rounded border border-line hover:border-brand-500 cursor-grab active:cursor-grabbing transition-all group" 
                       draggable 
                       // 拖拽数据结构要匹配 UICanvas 的 handleDrop
                       onDragStart={(e) => { e.dataTransfer.setData('uicomponent', JSON.stringify({ type: 'sprite', ...asset })); }}
                  >
                    <div className="w-full h-16 flex items-center justify-center overflow-hidden bg-bg/50 rounded">
                        <PixelSprite config={asset} scale={1} className="max-w-full max-h-full object-contain" />
                    </div>
                    <span className="text-[10px] text-subtle group-hover:text-content text-center break-all leading-tight w-full truncate">{asset.label}</span>
                  </div>
                ))}
              </div>
            </div>
         </div>

         {/* === 2. 中间画布 (传入所有资产) === */}
         <div className="flex-1 overflow-hidden">
             <UICanvas 
                key={editingPageId} // 强制重置，确保切换页面时状态完全更新
                page={page} 
                allPages={data.pages}
                allAssets={allAssets} // 传递所有资产
                activeModalId={activeModalId}
                globalVars={globalVars}
                onBack={() => { setEditingPageId(null); setActiveModalId(null); }}
                onUpdate={(updatedPage) => {
                  const newPages = data.pages.map(p => p.id === updatedPage.id ? updatedPage : p);
                  onUpdate({ ...data, pages: newPages });
                }}
                onInteraction={handleInteraction}
              />
         </div>

         {/* === 3. 资产编辑器弹窗 === */}
         {showAssetModal && (
            <AssetEditorModal onSave={handleSaveAsset} onClose={() => setShowAssetModal(false)} />
         )}
      </div>
    );
  }

  // === 仪表盘模式 (保持不变) ===
  return (
    <div className="flex-1 bg-bg p-8 overflow-y-auto h-full relative">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-iris-500/30 bg-iris-500/10 text-iris-400"><Monitor size={24} /></div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">UI 原型机 <span className="text-iris-400">Pro</span></h2>
            <p className="mt-0.5 text-sm text-muted">共 {data.pages.length} 个界面</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <button onClick={() => setShowCreateModal(true)} className="aspect-video bg-surface/50 border-2 border-dashed border-line hover:border-brand-500 rounded-xl flex flex-col items-center justify-center group"><Plus size={32} className="text-subtle group-hover:text-white"/><span className="text-subtle mt-2">新建页面</span></button>
        {data.pages.map(page => (
            <div key={page.id} onClick={() => setEditingPageId(page.id)} role="button" tabIndex={0} aria-label={`编辑页面 ${page.name}`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditingPageId(page.id); } }} className={`aspect-video bg-surface border-2 rounded-xl relative group cursor-pointer hover:-translate-y-1 transition-all ${data.startPageId === page.id ? 'border-iris-500' : 'border-line'}`}>
                <div className="w-full h-full flex flex-col items-center justify-center text-white font-bold bg-bg/50">
                    {page.name}
                    <span className="text-[10px] text-subtle font-normal uppercase mt-1">{page.type}</span>
                </div>
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => setStartPage(e, page.id)} className="p-1.5 bg-surface-3 rounded text-white hover:bg-iris-600" title="设为启动页" aria-label="设为启动页"><Play size={14}/></button>
                    <button onClick={(e) => deletePage(e, page.id)} className="p-1.5 bg-surface-3 rounded text-white hover:bg-red-600" title="删除页面" aria-label="删除页面"><Trash2 size={14}/></button>
                </div>
                {data.startPageId === page.id && <div className="absolute top-2 left-2 bg-iris-600 text-[10px] px-2 rounded font-bold">HOME</div>}
            </div>
        ))}
      </div>

      {/* 首次使用空状态 */}
      {data.pages.length === 0 && (
        <div className="mt-14 flex flex-col items-center gap-3 text-center animate-fade-in-up">
          <div className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface-2/60 text-subtle"><Layout size={30} /></div>
          <h3 className="text-lg font-semibold text-content">还没有界面原型</h3>
          <p className="max-w-sm text-sm leading-relaxed text-muted">
            点击「新建页面」，从 PC、手机、弹窗等模板快速搭建你的第一个 UI 草图。
          </p>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] backdrop-blur-sm p-4" onClick={() => setShowCreateModal(false)}>
            <div className="bg-surface p-6 rounded-2xl w-full max-w-[800px] border border-line shadow-elevated animate-scale-in" onClick={e => e.stopPropagation()}>
                <h3 className="text-white font-bold mb-4 text-xl">选择界面模板</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {PAGE_PRESETS.map((p, i) => (
                        <div key={i} onClick={() => createPage(p)} role="button" tabIndex={0} aria-label={`使用模板 ${p.label} 创建页面`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); createPage(p); } }} className="bg-surface-3/50 p-4 rounded-lg cursor-pointer hover:bg-brand-600/20 hover:border-brand-500 border border-line-strong text-center flex flex-col items-center justify-center h-32 group transition-all">
                            <p className="text-content group-hover:text-white font-bold mb-1">{p.label}</p>
                            <span className="text-[10px] text-subtle">{p.w}x{p.h}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}