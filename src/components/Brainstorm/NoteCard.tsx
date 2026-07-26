import { useState, useRef, useEffect } from 'react';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import { Sparkles, Loader2, Bot, Play, GripHorizontal } from 'lucide-react';
import { AIConfig } from '../Settings/Settings';
import { toast } from '../../utils/toast';

const STORAGE_KEY_CONFIGS = 'gp_ai_configs';
const STORAGE_KEY_ACTIVE = 'gp_ai_active_id';

export type ConnectorHandle = 'top' | 'right' | 'bottom' | 'left';

interface NoteCardProps {
  id: string;
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code' | 'ai' | 'note' | 'drawing';
  content: string; 
  x: number;
  y: number;
  width?: number;
  height?: number;
  scale: number;
  isSelected?: boolean;
  inputs?: string[];
  // 1. 新增：接收 disabled 属性
  disabled?: boolean; 
  isDesktop?: boolean;
  showConnectionHandles?: boolean;
  activeConnectHandle?: ConnectorHandle | null;
  onUpdate: (id: string, content: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
  onConnectHandleClick?: (id: string, handle: ConnectorHandle) => void;
}

const STATUS_TYPES = {
  'used': { label: '已使用', color: 'bg-brand-500', text: 'text-white' },
  'unused': { label: '未使用', color: 'bg-surface-3', text: 'text-muted' },
  'deprecated': { label: '废弃', color: 'bg-red-500', text: 'text-white' },
  'verify': { label: '需要验证', color: 'bg-yellow-500', text: 'text-black' },
  'core': { label: '核心创意', color: 'bg-iris-600', text: 'text-white' },
};

type StatusKey = keyof typeof STATUS_TYPES;

const DRAWING_BACKGROUND = '#ffffff';
const DRAWING_COLOR = '#0f172a';
const DRAWING_SIZES = [
  { label: '\u7ec6', value: 2 },
  { label: '\u4e2d', value: 4 },
  { label: '\u7c97', value: 8 },
];

interface DrawingCardContentProps {
  content: string;
  width: number;
  height: number;
  onChange: (next: string) => void;
}

function DrawingCardContent({ content, width, height, onChange }: DrawingCardContentProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [surfaceSize, setSurfaceSize] = useState({ width: Math.max(width, 120), height: Math.max(height - 44, 120) });
  const [brushSize, setBrushSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const updateSize = () => {
      const nextWidth = Math.max(Math.floor(wrapper.clientWidth), 1);
      const nextHeight = Math.max(Math.floor(wrapper.clientHeight), 1);
      setSurfaceSize(prev => (
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(Math.floor(surfaceSize.width * dpr), 1);
    canvas.height = Math.max(Math.floor(surfaceSize.height * dpr), 1);
    canvas.style.width = `${surfaceSize.width}px`;
    canvas.style.height = `${surfaceSize.height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, surfaceSize.width, surfaceSize.height);
    ctx.fillStyle = DRAWING_BACKGROUND;
    ctx.fillRect(0, 0, surfaceSize.width, surfaceSize.height);

    if (!content) return;

    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      ctx.drawImage(image, 0, 0, surfaceSize.width, surfaceSize.height);
    };
    image.src = content;

    return () => {
      disposed = true;
    };
  }, [content, surfaceSize]);

  const stopProp = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => e.stopPropagation();

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = rect.width ? surfaceSize.width / rect.width : 1;
    const scaleY = rect.height ? surfaceSize.height / rect.height : 1;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const drawSegment = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const strokeColor = isEraser ? DRAWING_BACKGROUND : DRAWING_COLOR;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    if (from.x === to.x && from.y === to.y) {
      ctx.beginPath();
      ctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const commitDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    stopProp(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    isDrawingRef.current = true;
    lastPointRef.current = point;
    drawSegment(point, point);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    stopProp(event);
    if (!isDrawingRef.current || !lastPointRef.current) return;

    const nextPoint = getPoint(event);
    drawSegment(lastPointRef.current, nextPoint);
    lastPointRef.current = nextPoint;
  };

  const finishDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    stopProp(event);
    if (!isDrawingRef.current) return;

    isDrawingRef.current = false;
    lastPointRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    commitDrawing();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, surfaceSize.width, surfaceSize.height);
    ctx.fillStyle = DRAWING_BACKGROUND;
    ctx.fillRect(0, 0, surfaceSize.width, surfaceSize.height);
    ctx.restore();
    commitDrawing();
  };

  return (
    <div className="flex h-full flex-col bg-slate-100" onPointerDown={stopProp}>
      <div className="flex items-center gap-1 border-b border-slate-200 bg-white/95 px-2 py-1.5">
        {DRAWING_SIZES.map(size => (
          <button
            key={size.value}
            type="button"
            onClick={() => {
              setBrushSize(size.value);
              setIsEraser(false);
            }}
            className={`min-w-8 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              !isEraser && brushSize === size.value
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
          >
            {size.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setIsEraser(prev => !prev)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            isEraser
              ? 'bg-rose-500 text-white'
              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
          }`}
        >
          {'\u6a61\u76ae'}
        </button>
        <button
          type="button"
          onClick={clearCanvas}
          className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900"
        >
          {'\u6e05\u7a7a'}
        </button>
      </div>
      <div ref={wrapperRef} className="relative min-h-0 flex-1 bg-white">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none cursor-crosshair bg-white"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
          onPointerLeave={finishDrawing}
        />
      </div>
    </div>
  );
}

export function NoteCard({
  id,
  type,
  content,
  x,
  y,
  width,
  height,
  scale,
  isSelected,
  inputs = [],
  disabled,
  isDesktop = false,
  showConnectionHandles = true,
  activeConnectHandle = null,
  onUpdate,
  onResize,
  onDelete,
  onDrag,
  onConnectHandleClick,
}: NoteCardProps) {
  const nodeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentW = width || 250;
  const currentH = height || (type === 'status' ? 50 : 160);

  const statusKey = (content && STATUS_TYPES[content as StatusKey]) ? content as StatusKey : 'unused';
  const currentStatus = STATUS_TYPES[statusKey];

  const cycleStatus = () => {
    const keys = Object.keys(STATUS_TYPES) as StatusKey[];
    const currentIndex = keys.indexOf(statusKey);
    const nextIndex = (currentIndex + 1) % keys.length;
    onUpdate(id, keys[nextIndex]);
  };

  const handleAISummarize = async (mode: 'self' | 'inputs') => {
    const savedConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS);
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE);
    
    if (!savedConfigs) {
        toast.warning("请先在左侧【设置】中配置 AI API");
        return;
    }

    const configs: AIConfig[] = JSON.parse(savedConfigs);
    const config = configs.find(c => c.id === activeId) || configs[0];

    if (!config || !config.key || !config.url) {
        toast.error("AI 配置无效，请检查设置。");
        return;
    }

    setIsLoading(true);

    let prompt = "";
    if (mode === 'self') {
        prompt = `请处理以下内容：\n${content}`;
    } else {
        if (inputs.length === 0) {
            toast.warning("没有连线输入，无法处理。");
            setIsLoading(false);
            return;
        }
        prompt = `请结合以下 ${inputs.length} 条输入内容进行处理：\n` + inputs.map((t, i) => `${i+1}. ${t}`).join('\n');
    }

    const systemPrompt = config.systemPrompt || "你是一个高效的游戏策划助手。请根据用户的输入直接输出结果，无需寒暄。";

    try {
        const res = await fetch(config.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                stream: false
            })
        });
        
        const data = await res.json();
        const result = data.choices?.[0]?.message?.content || data.result || JSON.stringify(data);
        
        if (mode === 'inputs') {
            onUpdate(id, (content ? content + "\n\n---\n\n" : "") + `🤖 **AI 结果**:\n` + result);
        } else {
            onUpdate(id, result);
        }
    } catch (e) {
        console.error(e);
        toast.error("请求失败，请检查网络或 Key。");
    } finally {
        setIsLoading(false);
    }
  };

  const renderContent = () => {
    const stopProp = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => e.stopPropagation();

    if (type === 'ai') {
        return (
            <div className="flex flex-col w-full h-full bg-surface text-content overflow-hidden" onPointerDown={stopProp}>
                <div className="h-8 bg-iris-700/40 border-b border-iris-500/30 flex items-center justify-between px-2 shrink-0 select-none">
                    <div className="flex items-center gap-1.5 text-iris-300">
                        <Bot size={14} />
                        <span className="text-[10px] font-bold uppercase">AI Processor</span>
                    </div>
                    {isLoading ? (
                        <Loader2 size={12} className="animate-spin text-iris-400"/>
                    ) : (
                        <button onClick={() => handleAISummarize('self')} className="text-iris-300 hover:text-white p-1" title="运行 AI 处理" aria-label="运行 AI 处理">
                            <Play size={12} fill="currentColor" />
                        </button>
                    )}
                </div>
                <textarea
                    className="flex-1 bg-transparent resize-none outline-none text-content text-xs p-3 placeholder-iris-300/20"
                    placeholder="输入内容点击运行，或连接其他磁贴..."
                    value={content}
                    onChange={(e) => onUpdate(id, e.target.value)}
                />
                {inputs.length > 0 && (
                    <button
                        onClick={() => handleAISummarize('inputs')}
                        disabled={isLoading}
                        className="h-8 shrink-0 bg-iris-600 hover:bg-iris-500 active:bg-iris-700 text-white text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                        <Sparkles size={14} /> 
                        处理 {inputs.length} 个来源
                    </button>
                )}
            </div>
        );
    }

    if (type === 'status') {
      return (
        <div className="w-full h-full flex items-center justify-center" onPointerDown={stopProp}>
           <div onClick={cycleStatus} role="button" tabIndex={0} title="点击切换状态" aria-label="切换状态" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cycleStatus(); } }} className={`w-full h-full ${currentStatus.color} ${currentStatus.text} rounded-full shadow flex items-center justify-center font-bold text-sm cursor-pointer border border-white/20 select-none active:scale-95 transition-transform`}>
             {currentStatus.label}
           </div>
        </div>
      );
    }
    
    if (type === 'image') return <img src={content} className="w-full h-full object-cover pointer-events-none block rounded-lg select-none" alt="" />;

    if (type === 'video') {
      return (
        <video
          src={content}
          className="w-full h-full object-contain block rounded-lg bg-black"
          controls
          onPointerDown={stopProp}
        />
      );
    }

    if (type === 'audio') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black/60 rounded-lg" onPointerDown={stopProp}>
          <audio src={content} controls className="w-[90%]" />
        </div>
      );
    }

    if (type === 'drawing') {
      return (
        <DrawingCardContent
          content={content}
          width={currentW}
          height={currentH}
          onChange={(next) => onUpdate(id, next)}
        />
      );
    }
    
    return (
        <textarea 
            className="w-full h-full bg-transparent resize-none outline-none text-slate-800 placeholder-slate-500/50 font-medium p-3 cursor-text block" 
            placeholder="输入灵感..." 
            value={content} 
            onChange={(e) => onUpdate(id, e.target.value)} 
            onPointerDown={stopProp} 
        />
    );
  };

  let borderClass = "";
  if (isSelected) borderClass = type === 'ai' ? "ring-2 ring-iris-500 shadow-[0_0_15px_rgba(139,124,246,0.5)]" : "ring-2 ring-brand-500 shadow-lg";
  else borderClass = "hover:ring-1 hover:ring-white/30";

  let bgClass = "bg-[#fff9c4]";
  if (type === 'note' || type === 'text') bgClass = type === 'text' ? "bg-white" : "bg-[#fff9c4]";
  if (type === 'ai') bgClass = "bg-surface border-2 border-iris-500/50";
  else if (type === 'code') bgClass = "bg-[#1e1e1e] border border-line-strong";
  else if (type === 'image' || type === 'status') bgClass = "bg-transparent";
  else if (type === 'video' || type === 'audio') bgClass = "bg-surface border border-line";
  else if (type === 'drawing') bgClass = "bg-slate-100 border border-slate-300";

  const handleBaseClass = `absolute z-[100] flex h-6 w-6 items-center justify-center rounded-full border shadow-lg touch-none transition-all duration-200 ${
    isDesktop
      ? showConnectionHandles
        ? 'scale-100 opacity-100 pointer-events-auto'
        : 'scale-75 opacity-0 pointer-events-none group-hover:scale-100 group-hover:opacity-100 group-hover:pointer-events-auto'
      : 'scale-100 opacity-100 pointer-events-auto'
  }`;

  const renderConnectHandle = (handle: ConnectorHandle, positionClass: string) => {
    const isActive = activeConnectHandle === handle;

    return (
      <button
        type="button"
        key={handle}
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onConnectHandleClick?.(id, handle);
        }}
        className={`${handleBaseClass} ${positionClass} ${
          isActive
            ? 'border-brand-200 bg-brand-500 shadow-[0_0_18px_rgba(16,185,129,0.65)]'
            : 'border-line-strong bg-surface/90 hover:border-brand-300 hover:bg-brand-500/90'
        }`}
        title={'\u8fde\u63a5\u78c1\u8d34'}
        aria-label={'\u8fde\u63a5\u78c1\u8d34'}
      >
        <span className={`block rounded-full ${isActive ? 'h-2.5 w-2.5 bg-white' : 'h-2 w-2 bg-brand-300'}`} />
      </button>
    );
  };

  return (
    <Draggable 
        nodeRef={nodeRef} 
        position={{ x, y }} 
        scale={scale} 
        // 3. 将 disabled 属性传递给 Draggable
        disabled={disabled}
        onStart={(e) => e.stopPropagation()}
        onDrag={(_, data) => onDrag(id, data.x, data.y)} 
        onStop={() => {}} 
        handle=".drag-handle" 
    >
      <div 
        ref={nodeRef} 
        id={id} 
        className={`absolute group transition-shadow rounded-lg ${borderClass} ${bgClass}`}
        style={{ width: currentW, height: currentH, zIndex: isSelected ? 50 : 10 }}
      >
         <Resizable 
            width={currentW} 
            height={currentH} 
            onResize={(e, { size }) => onResize && onResize(id, size.width, size.height)}
            minConstraints={type === 'drawing' ? [220, 180] : [100, 50]} 
            maxConstraints={[800, 800]}
            handle={<span className="react-resizable-handle react-resizable-handle-se !w-8 !h-8 touch-none" />}
          >
            <div className="w-full h-full relative" style={{ width: currentW, height: currentH }}>
                {/* 状态磁贴较矮：拖拽栏改为覆盖式，不挤压内容 */}
                <div className={`drag-handle w-full absolute top-0 left-0 z-20 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing hover:bg-black/5 transition-colors rounded-t-lg touch-none ${type === 'status' ? 'h-6' : 'h-8'}`}>
                    <GripHorizontal size={16} className="text-slate-400 opacity-50" />
                    <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="text-slate-400 hover:text-red-500 bg-slate-200/50 hover:bg-red-100 rounded-full w-5 h-5 flex items-center justify-center" title="删除磁贴" aria-label="删除磁贴">×</button>
                </div>
                <div className={`w-full h-full overflow-hidden rounded-lg ${type === 'status' ? '' : 'pt-8'}`}>
                    {renderContent()}
                </div>
            </div>
         </Resizable>

         {/* 连线锚点 */}
         {renderConnectHandle('top', '-top-3 left-1/2 -translate-x-1/2')}
         {renderConnectHandle('bottom', '-bottom-3 left-1/2 -translate-x-1/2')}
         {renderConnectHandle('left', 'top-1/2 -left-3 -translate-y-1/2')}
         {renderConnectHandle('right', 'top-1/2 -right-3 -translate-y-1/2')}
      </div>
    </Draggable>
  );
}
