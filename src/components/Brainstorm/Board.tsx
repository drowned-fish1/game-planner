import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Xarrow, { Xwrapper, useXarrow } from 'react-xarrows';
import { toPng } from 'html-to-image'; // 替换 html2canvas
import { NoteCard } from './NoteCard';
import { Image, Type, Video, Code, Link, Music, MoreHorizontal, Activity } from 'lucide-react';

interface BoardItem {
  id: string; 
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code';
  content: string; 
  x: number; 
  y: number;
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
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [connections, setConnections] = useState<Connection[]>(initialConnections);
  
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isPanning = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null); 
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const updateXarrow = useXarrow(); 

  useEffect(() => {
    if (initialItems.length > 0 || initialConnections.length > 0) {
      setItems(initialItems);
      setConnections(initialConnections);
    }
  }, [initialItems, initialConnections]);

  useEffect(() => {
    if (onDataChange) onDataChange(items, connections);
  }, [items, connections, onDataChange]);

  useEffect(() => {
    const timer = setTimeout(() => { updateXarrow(); }, 50);
    return () => clearTimeout(timer);
  }, [scale, offset, items, connections]); 

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;

    const zoomIntensity = 0.001;
    const newScale = Math.min(Math.max(scale - e.deltaY * zoomIntensity, 0.1), 5);
    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;

    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  };

  // === 截图逻辑：html-to-image 重写版 ===
  const exportAsImage = async () => {
    if (!captureRef.current || items.length === 0) return;
    setIsMenuOpen(false);

    const originalScale = scale;
    const originalOffset = offset;

    try {
      // 1. 瞬间归位 (必须为 1:1 才能保证 SVG 箭头位置正确)
      setScale(1);
      setOffset({ x: 0, y: 0 });

      // 2. 等待 React 渲染和箭头重绘
      setTimeout(async () => {
        updateXarrow(); // 强制刷新箭头

        // 3. 使用 html-to-image 生成图片
        // 这个库能完美处理 SVG 和 z-index
        if (captureRef.current) {
          const dataUrl = await toPng(captureRef.current, {
            backgroundColor: '#0f172a',
            pixelRatio: 2, // 高清
            // 过滤掉不需要的元素 (如拖拽手柄，如果有特定class)
            filter: (node) => {
               return !node.classList?.contains('drag-handle-ignored');
            }
          });

          const link = document.createElement('a');
          link.download = `GP_Board_${Date.now()}.png`;
          link.href = dataUrl;
          link.click();
        }

        // 4. 恢复现场
        setScale(originalScale);
        setOffset(originalOffset);
      }, 500); // 给足 500ms 让箭头稳定

    } catch (error) {
      console.error("Export failed:", error);
      alert("截图生成失败");
      setScale(originalScale);
      setOffset(originalOffset);
    }
  };

  const getCenterCoords = () => {
    const containerW = containerRef.current?.clientWidth || window.innerWidth;
    const containerH = containerRef.current?.clientHeight || window.innerHeight;
    const centerX = (containerW / 2 - offset.x) / scale;
    const centerY = (containerH / 2 - offset.y) / scale;
    return { x: centerX - 100, y: centerY - 60 };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const files = Array.from(e.dataTransfer.files);
    const mediaFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/'));
    if (mediaFiles.length === 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = e.clientX - (rect?.left || 0);
    const mouseY = e.clientY - (rect?.top || 0);
    const canvasX = (mouseX - offset.x) / scale;
    const canvasY = (mouseY - offset.y) / scale;

    mediaFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        let type: any = 'image';
        if (file.type.startsWith('video/')) type = 'video';
        if (file.type.startsWith('audio/')) type = 'audio';

        setItems(prev => [...prev, { 
          id: uuidv4(), 
          type, 
          content: ev.target?.result as string, 
          x: canvasX + index * 20 - 100, 
          y: canvasY + index * 20 - 60 
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const addItem = (type: BoardItem['type'], defaultContent = '') => {
    const { x, y } = getCenterCoords();
    setItems(prev => [...prev, { id: uuidv4(), type, content: defaultContent, x, y }]);
    setIsMenuOpen(false);
  };

  const triggerImageUpload = () => { fileInputRef.current?.click(); setIsMenuOpen(false); };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        let type: any = 'image';
        if (file.type.startsWith('video/')) type = 'video';
        if (file.type.startsWith('audio/')) type = 'audio';
        
        const { x, y } = getCenterCoords();
        setItems(prev => [...prev, { id: uuidv4(), type, content: ev.target?.result as string, x, y }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; 
  };
  const deleteConnection = (connId: string) => setConnections(prev => prev.filter(c => c.id !== connId));
  const endConnection = (targetId: string) => {
    if (connectingSourceId && connectingSourceId !== targetId) {
      const exists = connections.find(c => (c.start === connectingSourceId && c.end === targetId) || (c.start === targetId && c.end === connectingSourceId));
      if (!exists) setConnections(prev => [...prev, { id: uuidv4(), start: connectingSourceId, end: targetId }]);
    }
    setConnectingSourceId(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) { 
      isPanning.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    setConnectingSourceId(null);
  };

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 bg-slate-900 overflow-hidden select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*"/>
      
      <div className="absolute top-4 left-4 z-50 text-slate-500 text-sm pointer-events-none bg-slate-900/50 p-2 rounded backdrop-blur-sm border border-slate-700">
        <p>🖱️ 滚轮: 缩放 | 中键: 移动 | 🖼️ 拖入多媒体</p>
        <p className="text-xs mt-1 text-slate-600">Scale: {scale.toFixed(2)}x</p>
      </div>

      <Xwrapper>
        {/* captureRef 必须包含整个可滚动/可缩放区域 */}
        {/* 注意：html-to-image 需要截取的容器必须是有明确宽高的 */}
        <div ref={captureRef} className="absolute inset-0 w-full h-full">
          {/* Layer 1: Items */}
          <div 
            className="absolute inset-0 will-change-transform origin-top-left"
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          >
            <div className="relative w-[5000px] h-[5000px]"> 
               <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
               {items.map(item => (
                  <NoteCard 
                    key={item.id} {...item} scale={scale} isSelected={connectingSourceId === item.id}
                    onUpdate={(id, txt) => setItems(prev => prev.map(n => n.id === id ? {...n, content: txt} : n))}
                    onDelete={(id) => {
                       setItems(prev => prev.filter(n => n.id !== id));
                       setConnections(prev => prev.filter(c => c.start !== id && c.end !== id));
                    }}
                    onDrag={(id, x, y) => {
                       setItems(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
                       updateXarrow();
                    }}
                    onConnectStart={setConnectingSourceId}
                    onConnectEnd={endConnection}
                  />
               ))}
            </div>
          </div>

          {/* Layer 2: Arrows */}
          <div 
             className="absolute inset-0 pointer-events-none"
             style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
          >
             {connections.map(conn => (
                <Xarrow
                  key={conn.id}
                  start={conn.start}
                  end={conn.end}
                  color="#10b981"
                  strokeWidth={3} 
                  headSize={6}
                  path="smooth"
                  zIndex={10} 
                  labels={{
                    middle: (
                      <div 
                        onClick={(e) => { e.stopPropagation(); deleteConnection(conn.id); }}
                        className="pointer-events-auto cursor-pointer p-1 rounded-full bg-slate-800 border border-slate-600 hover:bg-red-500 hover:border-red-500 hover:text-white text-slate-400 transition-colors z-[999]"
                        title="删除连线"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )
                  }}
                />
              ))}
          </div>
        </div>
      </Xwrapper>

      <div className="absolute bottom-8 right-8 flex flex-col items-end gap-4 z-[100]">
        <div className={`flex flex-col gap-3 transition-all duration-300 origin-bottom ${isMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-0 pointer-events-none'}`}>
          <div className="flex gap-2">
            <button onClick={exportAsImage} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg" title="导出"><Image size={18} /></button>
            <button onClick={triggerImageUpload} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg" title="上传"><MoreHorizontal size={18} /></button>
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
          </div>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`w-16 h-16 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full shadow-2xl flex items-center justify-center text-3xl font-bold transition-transform duration-300 ${isMenuOpen ? 'rotate-45' : 'rotate-0'}`}>+</button>
      </div>
    </div>
  );
}
