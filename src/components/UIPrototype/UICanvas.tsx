import { useState, useRef } from 'react';
import { ArrowLeft, Video, Music, Code, Link, Activity, Type, Move, Lock, MoreHorizontal, Image } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { toPng } from 'html-to-image';
import { UIPage, UIComponent, InteractionType } from '../../utils/storage';
import { PixelSprite } from './PixelSprite';
import { UI_ASSETS } from './assets';
import { UIComponentWrapper } from './UIComponentWrapper';
import { UIEditModal } from './UIEditModal';

interface UICanvasProps {
  page: UIPage;
  allPages: UIPage[];
  activeModalId: string | null;
  globalVars?: Record<string, number>; // 新增：接收全局变量
  onBack: () => void;
  onUpdate: (page: UIPage) => void;
  onInteraction: (type: InteractionType, targetId?: string, param?: string) => void;
}

export function UICanvas({ page, allPages, activeModalId, globalVars, onBack, onUpdate, onInteraction }: UICanvasProps) {
  const [currentPage, setCurrentPage] = useState(page);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingComponentId, setMovingComponentId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, componentId: string } | null>(null);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  
  const captureRef = useRef<HTMLDivElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 查找弹窗页面数据
  const modalPage = activeModalId ? allPages.find(p => p.id === activeModalId) : null;

  const updatePage = (updates: Partial<UIPage>) => {
    const updated = { ...currentPage, ...updates };
    setCurrentPage(updated);
    onUpdate(updated);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('uicomponent');
    if (!data) return;
    const canvasNode = captureRef.current;
    if (!canvasNode) return;
    try {
      const assetConfig = JSON.parse(data);
      const rect = canvasNode.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;
      const defaultScale = 2;
      const newComponent: UIComponent = {
        id: uuidv4(), name: assetConfig.label || '新组件', type: 'sprite', src: assetConfig.id,
        x: relativeX - (assetConfig.w * defaultScale) / 2,
        y: relativeY - (assetConfig.h * defaultScale) / 2,
        width: assetConfig.w * defaultScale, height: assetConfig.h * defaultScale,
        zIndex: currentPage.components.length + 10, customScale: 1,
        state: { isVisible: true, isActive: false, isDisabled: false }, interaction: { type: 'none' } 
      };
      updatePage({ components: [...currentPage.components, newComponent] });
      setSelectedId(newComponent.id);
    } catch (err) { console.error(err); }
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  // 通用添加
  const addItem = (type: UIComponent['type'], defaultContent = '') => {
    const cx = currentPage.width / 2 - 100; const cy = currentPage.height / 2 - 50;
    const isMedia = ['image', 'video', 'audio', 'sprite'].includes(type);
    const newComponent: UIComponent = {
      id: uuidv4(), name: `新${type}`, type,
      src: isMedia ? defaultContent : undefined, text: !isMedia ? defaultContent : undefined,
      x: cx, y: cy, width: type === 'status' ? 128 : 200, height: type === 'status' ? 40 : 150,
      zIndex: 20, customScale: 1, state: { isVisible: true }, interaction: { type: 'none' }
    };
    updatePage({ components: [...currentPage.components, newComponent] });
  };

  const updateComponent = (id: string, updates: Partial<UIComponent>) => {
    const newComponents = currentPage.components.map(c => c.id === id ? { ...c, ...updates } : c);
    updatePage({ components: newComponents });
  };
  const handleContextMenu = (e: React.MouseEvent | MouseEvent, id: string) => {
    const ev = e as any; setContextMenu({ x: ev.clientX, y: ev.clientY, componentId: id });
  };
  const deleteComponent = (id: string) => {
    const newComponents = currentPage.components.filter(c => c.id !== id);
    updatePage({ components: newComponents }); setContextMenu(null);
  };
  const handleBackgroundClick = () => {
    setSelectedId(null); setContextMenu(null); setMovingComponentId(null);
  };
  const exportAsImage = async () => {
    if (!captureRef.current) return;
    try {
        const dataUrl = await toPng(captureRef.current, { pixelRatio: 2 });
        const link = document.createElement('a'); link.download = `${currentPage.name}.png`; link.href = dataUrl; link.click();
    } catch (err) {}
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        let type: any = 'image'; if (file.type.startsWith('video/')) type = 'video'; if (file.type.startsWith('audio/')) type = 'audio';
        addItem(type, ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; 
  };

  // 渲染组件列表的辅助函数
  const renderComponents = (components: UIComponent[], isModal = false) => (
    components.map(comp => (
      <UIComponentWrapper
        key={comp.id}
        component={comp}
        isSelected={selectedId === comp.id}
        isMoving={movingComponentId === comp.id}
        scale={1}
        globalVars={globalVars} // 传递变量
        onUpdate={isModal ? () => {} : updateComponent} 
        onSelect={(e) => { 
            if (isModal) return; 
            setSelectedId(comp.id); setContextMenu(null); 
        }}
        onContextMenu={(e) => { 
            if (isModal) return;
            handleContextMenu(e, comp.id); 
        }}
        onInteraction={onInteraction} 
      />
    ))
  );

  return (
    <div className="flex h-full w-full bg-[#121212] overflow-hidden flex-col" onClick={handleBackgroundClick}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      {/* 顶部栏 */}
      <div className="h-14 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg text-slate-300"><ArrowLeft size={20} /></button>
          <input value={currentPage.name} onChange={(e) => updatePage({ name: e.target.value })} className="bg-transparent text-white font-bold outline-none border-b border-transparent focus:border-purple-500 px-1" />
        </div>
        <div className="flex gap-2">
           {/* 省略工具栏按钮，保持原样 */}
           <button onClick={() => addItem('text')} className="p-2 hover:bg-slate-700 rounded text-slate-300" title="文本"><Type size={18}/></button>
           <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-700 rounded text-slate-300" title="上传"><MoreHorizontal size={18}/></button>
           <button onClick={exportAsImage} className="p-2 hover:bg-blue-600 bg-blue-700 rounded text-white" title="导出"><Image size={18}/></button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧资产库 (保持不变) */}
        <div className="w-64 bg-slate-900 border-r border-slate-700 p-4 flex flex-col gap-4 select-none shrink-0 z-10 h-full">
           <h3 className="text-slate-400 text-xs font-bold uppercase mb-2 shrink-0">UI Assets</h3>
           <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
             <div className="grid grid-cols-2 gap-4 pb-4">
               {UI_ASSETS.map(asset => (
                 <div key={asset.id} className="flex flex-col items-center gap-2 p-2 bg-slate-800 rounded border border-slate-700 hover:border-emerald-500 cursor-grab active:cursor-grabbing transition-colors group" draggable onDragStart={(e) => { e.dataTransfer.setData('uicomponent', JSON.stringify({ type: 'sprite', ...asset })); }}>
                   <div className="w-full h-16 flex items-center justify-center overflow-hidden"><PixelSprite config={asset} scale={1} className="max-w-full max-h-full object-contain" /></div>
                   <span className="text-[10px] text-slate-500 group-hover:text-slate-300 text-center break-all leading-tight">{asset.label}</span>
                 </div>
               ))}
             </div>
           </div>
        </div>

        {/* 画布 */}
        <div className="flex-1 bg-[#0f0f0f] relative overflow-auto flex p-10 custom-scrollbar">
           <div className="min-w-full min-h-full flex items-center justify-center pointer-events-none">
             <div 
               ref={captureRef}
               className="shadow-2xl relative border border-slate-800 transition-all shrink-0 pointer-events-auto"
               style={{ width: currentPage.width, height: currentPage.height, backgroundColor: currentPage.backgroundColor || '#1e1e1e' }}
               onDrop={handleDrop} onDragOver={handleDragOver} onClick={(e) => { e.stopPropagation(); handleBackgroundClick(); }} 
             >
                {/* 1. 渲染当前页面的组件 */}
                {renderComponents(currentPage.components)}

                {/* 2. 如果有弹窗，渲染遮罩和弹窗层 */}
                {modalPage && (
                  <div className="absolute inset-0 bg-black/60 z-[2000] flex items-center justify-center animate-in fade-in">
                     {/* 弹窗容器 */}
                     <div 
                        className="relative shadow-2xl overflow-hidden animate-in zoom-in-95"
                        style={{ 
                          width: modalPage.width, 
                          height: modalPage.height, 
                          backgroundColor: modalPage.backgroundColor || '#2a2a2a',
                          border: '1px solid #444'
                        }}
                     >
                       {/* 渲染弹窗页面的组件 (注意 isModal=true) */}
                       {renderComponents(modalPage.components, true)}
                     </div>
                  </div>
                )}
             </div>
           </div>
        </div>
      </div>

      {/* 保持右键菜单和 EditModal 不变 */}
      {contextMenu && (
        <div className="fixed bg-slate-800 border border-slate-600 rounded shadow-xl py-1 w-36 z-[3000]" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { setMovingComponentId(movingComponentId === contextMenu.componentId ? null : contextMenu.componentId); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-emerald-600 transition-colors flex items-center gap-2">
             {movingComponentId === contextMenu.componentId ? <Lock size={14} /> : <Move size={14} />}
             {movingComponentId === contextMenu.componentId ? '锁定位置' : '移动组件'}
          </button>
          <div className="h-px bg-slate-700 my-1"></div>
          <button onClick={() => { setEditingComponentId(contextMenu.componentId); setContextMenu(null); }} className="w-full text-left px-4 py-2 text-sm text-white hover:bg-purple-600 transition-colors">⚙️ 属性设置</button>
          <div className="h-px bg-slate-700 my-1"></div>
          <button onClick={() => deleteComponent(contextMenu.componentId)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 transition-colors">🗑️ 删除</button>
        </div>
      )}
      {editingComponentId && (
        <UIEditModal component={currentPage.components.find(c => c.id === editingComponentId)!} allPages={allPages} onClose={() => setEditingComponentId(null)} onSave={(updates) => updateComponent(editingComponentId, updates)} />
      )}
    </div>
  );
}