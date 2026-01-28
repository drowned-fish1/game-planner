// src/components/Brainstorm/Board.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Xarrow, { Xwrapper, useXarrow } from 'react-xarrows';
import { toPng } from 'html-to-image';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { NoteCard } from './NoteCard';
import { 
  Image, Type, Video, Code, Link, Music, MoreHorizontal, Activity, Bot, 
  Plus, Move, MousePointer2, X 
} from 'lucide-react';

// === 接口定义 ===
interface BoardItem {
  id: string; 
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code' | 'ai';
  content: string; 
  x: number; 
  y: number;
  width?: number; 
  height?: number; 
}

interface Connection {
  id: string; start: string; end: string;
}

interface BrainstormBoardProps {
  initialItems?: BoardItem[];
  initialConnections?: Connection[];
  onDataChange?: (items: BoardItem[], connections: Connection[]) => void;
}

export function BrainstormBoard({ initialItems = [], initialConnections = [], onDataChange }: BrainstormBoardProps) {
  // === 状态管理 ===
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  
  // UI 状态
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mode, setMode] = useState<'pan' | 'edit'>('pan'); // 'pan' = 浏览/缩放, 'edit' = 编辑/拖拽
  
  // Refs
  const transformComponentRef = useRef<ReactZoomPanPinchContentRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLDivElement>(null); 
  const hasInitialized = useRef(false);
  
  const updateXarrow = useXarrow(); 

  // === 初始化与同步 ===
  useEffect(() => {
    if (!hasInitialized.current) {
      if (initialItems.length > 0) setItems(initialItems);
      if (initialConnections.length > 0) setConnections(initialConnections);
      hasInitialized.current = true;
    }
  }, [initialItems, initialConnections]);

  useEffect(() => {
    if (onDataChange) onDataChange(items, connections);
  }, [items, connections, onDataChange]);

  // 当缩放或移动时更新连线 (使用 useCallback 避免不必要的重渲染)
  const handleTransform = useCallback(() => {
     updateXarrow();
  }, [updateXarrow]);

  // === 逻辑功能 ===

  // 1. 修复 TS 报错：使用 instance.transformState 获取当前视图状态
  const getCenterCoords = () => {
    if (transformComponentRef.current) {
        const { transformState } = transformComponentRef.current.instance;
        // 计算逻辑：(屏幕中心 - 画布偏移) / 缩放比例
        const centerX = (window.innerWidth / 2 - transformState.positionX) / transformState.scale;
        const centerY = (window.innerHeight / 2 - transformState.positionY) / transformState.scale;
        return { x: centerX - 100, y: centerY - 60 };
    }
    return { x: 100, y: 100 };
  };

  const addItem = (type: BoardItem['type'], defaultContent = '') => {
    const { x, y } = getCenterCoords();
    let defaultW = 250;
    let defaultH = 160;

    // 默认尺寸预设
    switch(type) {
        case 'text': defaultW = 200; defaultH = 150; break;
        case 'ai': defaultW = 300; defaultH = 400; break;
        case 'code': defaultW = 400; defaultH = 300; break;
        case 'image': defaultW = 300; defaultH = 200; break;
        case 'status': defaultW = 160; defaultH = 50; break;
    }

    setItems(prev => [...prev, { id: uuidv4(), type, content: defaultContent, x, y, width: defaultW, height: defaultH }]);
    setIsMenuOpen(false);
    setMode('edit'); // 添加物品后自动切换到编辑模式
  };

  // 2. 修复 TS 报错：使用 instance.transformState 处理拖拽坐标计算
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/'));
    
    if (mediaFiles.length === 0) return;
    
    let canvasX = 0, canvasY = 0;
    if (transformComponentRef.current) {
        const { transformState } = transformComponentRef.current.instance;
        canvasX = (e.clientX - transformState.positionX) / transformState.scale;
        canvasY = (e.clientY - transformState.positionY) / transformState.scale;
    }

    mediaFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        let type: any = 'image'; if (file.type.startsWith('video/')) type = 'video'; if (file.type.startsWith('audio/')) type = 'audio';
        setItems(prev => [...prev, { 
            id: uuidv4(), type, content: ev.target?.result as string, 
            x: canvasX + index * 20 - 150, y: canvasY + index * 20 - 100,
            width: 300, height: 'auto' as any 
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        let type: any = 'image'; if (file.type.startsWith('video/')) type = 'video'; if (file.type.startsWith('audio/')) type = 'audio';
        const { x, y } = getCenterCoords();
        setItems(prev => [...prev, { id: uuidv4(), type, content: ev.target?.result as string, x, y, width: 300, height: 200 }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; 
  };

  // 3. 修复 TS 报错：使用 instance 处理导出时的视图重置
  const exportAsImage = async () => {
    if (!captureRef.current || !transformComponentRef.current) return;
    setIsMenuOpen(false);
    
    const { instance } = transformComponentRef.current;
    const { setTransform } = transformComponentRef.current;
    
    const originalX = instance.transformState.positionX;
    const originalY = instance.transformState.positionY;
    const originalScale = instance.transformState.scale;

    try {
      setTransform(0, 0, 1, 0); // 重置为 1:1 以截取全图
      
      setTimeout(async () => {
        updateXarrow(); // 强制刷新箭头位置
        if (captureRef.current) {
          const dataUrl = await toPng(captureRef.current, { 
              backgroundColor: '#0f172a', 
              pixelRatio: 2, 
              filter: (node) => !node.classList?.contains('drag-handle-ignored') 
          });
          const link = document.createElement('a'); 
          link.download = `GP_Board_${Date.now()}.png`; 
          link.href = dataUrl; 
          link.click();
        }
        // 恢复用户之前的视图
        setTransform(originalX, originalY, originalScale, 0);
      }, 500);
    } catch (error) { 
        console.error("Export failed:", error); 
        setTransform(originalX, originalY, originalScale, 0);
    }
  };

  // 连线管理
  const deleteConnection = (connId: string) => setConnections(prev => prev.filter(c => c.id !== connId));
  const endConnection = (targetId: string) => {
    if (connectingSourceId && connectingSourceId !== targetId) {
      const exists = connections.find(c => (c.start === connectingSourceId && c.end === targetId) || (c.start === targetId && c.end === connectingSourceId));
      if (!exists) setConnections(prev => [...prev, { id: uuidv4(), start: connectingSourceId, end: targetId }]);
    }
    setConnectingSourceId(null);
    setMode('edit'); 
  };

  const getAIInputs = (aiId: string) => {
    const incomingConns = connections.filter(c => c.end === aiId);
    const sourceItems = incomingConns.map(c => items.find(i => i.id === c.start)).filter(Boolean) as BoardItem[];
    return sourceItems
        .filter(i => (i.type === 'text' || i.type === 'code' || i.type === 'ai') && i.content.trim().length > 0)
        .map(i => i.content);
  };

  return (
    <div className="absolute inset-0 bg-slate-900 overflow-hidden select-none">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*"/>

      {/* === 顶部工具栏 (模式切换) === */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 backdrop-blur border border-slate-700 rounded-full px-2 py-1 flex gap-2 shadow-xl">
         <button 
           onClick={() => setMode('pan')} 
           className={`p-2 rounded-full transition-colors ${mode === 'pan' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
           title="浏览模式 (拖拽画布)"
         >
           <Move size={20} />
         </button>
         <div className="w-px h-6 bg-slate-600 self-center opacity-50"></div>
         <button 
           onClick={() => setMode('edit')} 
           className={`p-2 rounded-full transition-colors ${mode === 'edit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
           title="编辑模式 (操作元素)"
         >
           <MousePointer2 size={20} />
         </button>
      </div>

      <TransformWrapper
        ref={transformComponentRef}
        initialScale={1}
        minScale={0.1}
        maxScale={5}
        centerOnInit
        disabled={mode !== 'pan'} // 关键：只有 pan 模式下允许画布交互
        limitToBounds={false}
        onTransformed={handleTransform} // 视图变化时刷新箭头
        doubleClick={{ disabled: true }} 
      >
        {({ state }) => ( // 注意：虽然这里解构了 state 供内部使用（如果有），但上面的函数已修正引用方式
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
            <div 
                ref={captureRef}
                className="relative w-[4000px] h-[4000px] bg-slate-900" 
                style={{ 
                   backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', 
                   backgroundSize: '40px 40px' 
                }}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
            >
              <Xwrapper>
                 {items.map(item => (
                    // ⚠️ 必做修正：防止位移错乱
                    // 外层 div 必须定位在 0,0，因为 NoteCard 内部的 React-Draggable 会使用 transform 来处理实际的 x,y
                    <div 
                        key={item.id} 
                        style={{ position: 'absolute', left: 0, top: 0 }} 
                        // 点击事件处理（用于连线）
                        onClick={(e) => { 
                            if(mode === 'edit') {
                                e.stopPropagation(); 
                                // 如果正在连线中，点击目标完成连线
                                if (connectingSourceId) endConnection(item.id);
                            }
                        }}
                    >
                      <NoteCard 
                        {...item}
                        // 传递 scale 用于修正拖拽速度
                        scale={transformComponentRef.current?.instance.transformState.scale || 1}
                        // 在 Pan 模式下禁用元素交互
                        disabled={mode === 'pan'} 
                        isSelected={connectingSourceId === item.id}
                        inputs={item.type === 'ai' ? getAIInputs(item.id) : undefined}
                        onUpdate={(id, txt) => setItems(prev => prev.map(n => n.id === id ? {...n, content: txt} : n))}
                        onResize={(id, w, h) => {
                            setItems(prev => prev.map(n => n.id === id ? { ...n, width: w, height: h } : n));
                            updateXarrow();
                        }}
                        onDelete={(id) => { setItems(prev => prev.filter(n => n.id !== id)); setConnections(prev => prev.filter(c => c.start !== id && c.end !== id)); }}
                        onDrag={(id, x, y) => { 
                            setItems(prev => prev.map(n => n.id === id ? { ...n, x, y } : n)); 
                            updateXarrow(); 
                        }}
                        onConnectStart={setConnectingSourceId}
                        onConnectEnd={endConnection}
                      />
                    </div>
                 ))}

                 {connections.map(conn => (
                    <Xarrow
                      key={conn.id} start={conn.start} end={conn.end} color="#10b981" strokeWidth={3} headSize={6} path="smooth" zIndex={10} 
                      labels={{ middle: ( 
                         <div 
                           onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }} 
                           className={`pointer-events-auto cursor-pointer p-1 rounded-full bg-slate-800 border border-slate-600 hover:bg-red-500 hover:border-red-500 hover:text-white text-slate-400 transition-colors z-[999] ${mode === 'pan' ? 'hidden' : ''}`} 
                           title="删除连线"
                         >
                            <X size={12} />
                         </div> 
                      ) }}
                    />
                  ))}
              </Xwrapper>
            </div>
          </TransformComponent>
        )}
      </TransformWrapper>

      {/* === 右下角悬浮菜单 === */}
      <div className="absolute bottom-20 md:bottom-8 right-4 md:right-8 flex flex-col items-end gap-4 z-[100]">
        <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom ${isMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}>
          <div className="flex gap-2">
            <button onClick={exportAsImage} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg" title="导出"><Image size={18} /></button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg" title="上传"><MoreHorizontal size={18} /></button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addItem('video')} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-lg" title="视频"><Video size={18} /></button>
            <button onClick={() => addItem('audio')} className="flex items-center gap-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-full shadow-lg" title="音频"><Music size={18} /></button>
          </div>
          <div className="flex gap-2">
             <button onClick={() => addItem('code')} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full shadow-lg" title="代码"><Code size={18} /></button>
             <button onClick={() => addItem('link')} className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-lg" title="网页"><Link size={18} /></button>
          </div>
          <div className="flex gap-2">
             <button onClick={() => addItem('status', 'unused')} className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-full shadow-lg" title="状态"><Activity size={18} /></button>
             <button onClick={() => addItem('text')} className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-white rounded-full shadow-lg" title="贴纸"><Type size={18} /></button>
             <button onClick={() => addItem('ai')} className="flex items-center gap-2 px-4 py-2 bg-purple-800 hover:bg-purple-700 text-white rounded-full shadow-lg border border-purple-500" title="AI 助手"><Bot size={18} /></button>
          </div>
        </div>
        <button 
           onClick={() => setIsMenuOpen(!isMenuOpen)} 
           className={`w-14 h-14 md:w-16 md:h-16 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-2xl flex items-center justify-center transition-transform duration-300 ${isMenuOpen ? 'rotate-45' : 'rotate-0'}`}
        >
            <Plus size={32} />
        </button>
      </div>
      
      {/* 底部提示信息 */}
      <div className="absolute bottom-4 left-4 text-slate-500 text-xs pointer-events-none opacity-50 hidden md:block">
         {mode === 'pan' ? '当前: 浏览模式 (可拖拽/缩放画布)' : '当前: 编辑模式 (可操作元素)'}
      </div>
    </div>
  );
}