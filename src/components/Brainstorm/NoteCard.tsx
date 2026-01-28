import { useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import { Sparkles, Loader2, Bot, Play, GripHorizontal } from 'lucide-react';
import { AIConfig } from '../Settings/Settings'; 

// 定义存储键名
const STORAGE_KEY_CONFIGS = 'gp_ai_configs';
const STORAGE_KEY_ACTIVE = 'gp_ai_active_id';

interface NoteCardProps {
  id: string;
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code' | 'ai' | 'note';
  content: string; 
  x: number;
  y: number;
  width?: number;
  height?: number;
  scale: number;
  isSelected?: boolean;
  inputs?: string[]; 
  disabled?: boolean; // 新增 disabled 支持
  onUpdate: (id: string, content: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onDelete: (id: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
  onConnectStart?: (id: string) => void;
  onConnectEnd?: (id: string) => void;
}

const STATUS_TYPES = {
  'used': { label: '已使用', color: 'bg-emerald-500', text: 'text-white' },
  'unused': { label: '未使用', color: 'bg-slate-600', text: 'text-slate-200' },
  'deprecated': { label: '废弃', color: 'bg-red-500', text: 'text-white' },
  'verify': { label: '需要验证', color: 'bg-yellow-500', text: 'text-black' },
  'core': { label: '核心创意', color: 'bg-purple-600', text: 'text-white' },
};

type StatusKey = keyof typeof STATUS_TYPES;

export function NoteCard({ 
  id, type, content, x, y, width, height, scale, isSelected, inputs = [], disabled,
  onUpdate, onResize, onDelete, onDrag, onConnectStart, onConnectEnd 
}: NoteCardProps) {
  const nodeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  // 设置默认尺寸
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

  // === AI 核心逻辑 ===
  const handleAISummarize = async (mode: 'self' | 'inputs') => {
    const savedConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS);
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE);
    
    if (!savedConfigs) {
        alert("请先在左侧【设置】中配置 AI API");
        return;
    }

    const configs: AIConfig[] = JSON.parse(savedConfigs);
    const config = configs.find(c => c.id === activeId) || configs[0];

    if (!config || !config.key || !config.url) {
        alert("AI 配置无效，请检查设置。");
        return;
    }

    setIsLoading(true);

    let prompt = "";
    if (mode === 'self') {
        prompt = `请总结以下内容：\n${content}`;
    } else {
        if (inputs.length === 0) {
            alert("没有连线输入，无法汇总。");
            setIsLoading(false);
            return;
        }
        prompt = `请将以下 ${inputs.length} 条内容进行汇总、分析并总结出核心观点：\n` + inputs.map((t, i) => `${i+1}. ${t}`).join('\n');
    }

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
                    { role: "system", content: "你是一个高效的助手。请直接输出结果。" },
                    { role: "user", content: prompt }
                ],
                stream: false
            })
        });
        
        const data = await res.json();
        const result = data.choices?.[0]?.message?.content || data.result || JSON.stringify(data);
        
        if (mode === 'inputs') {
            onUpdate(id, (content ? content + "\n\n---\n\n" : "") + `🤖 **AI 汇总**:\n` + result);
        } else {
            onUpdate(id, result);
        }
    } catch (e) {
        console.error(e);
        alert("请求失败，请检查网络或 Key。");
    } finally {
        setIsLoading(false);
    }
  };

  // 渲染内容区
  const renderContent = () => {
    // 阻止事件冒泡，防止操作内容时触发画布拖拽
    const stopProp = (e: React.PointerEvent | React.MouseEvent | React.TouchEvent) => e.stopPropagation();

    // AI 磁贴
    if (type === 'ai') {
        return (
            // 修正：移除 bg-slate-900，改用 bg-transparent，否则会遮挡外层边框
            <div className="flex flex-col w-full h-full bg-transparent text-white overflow-hidden" 
                 onPointerDown={stopProp} 
            >
                {/* AI 标题栏 */}
                <div className="h-8 bg-purple-900/50 border-b border-purple-500/30 flex items-center justify-between px-2 shrink-0 select-none">
                    <div className="flex items-center gap-1.5 text-purple-300">
                        <Bot size={14} />
                        <span className="text-[10px] font-bold uppercase">AI Insight</span>
                    </div>
                    {isLoading ? (
                        <Loader2 size={12} className="animate-spin text-purple-400"/>
                    ) : (
                        <button onClick={() => handleAISummarize('self')} className="text-purple-300 hover:text-white p-1">
                            <Play size={12} fill="currentColor" />
                        </button>
                    )}
                </div>
                
                <textarea 
                    className="flex-1 bg-transparent resize-none outline-none text-slate-200 text-xs p-3 placeholder-purple-300/20"
                    placeholder="输入内容点击运行，或连接其他磁贴..." 
                    value={content} 
                    onChange={(e) => onUpdate(id, e.target.value)}
                />
                
                {inputs.length > 0 && (
                    <button 
                        onClick={() => handleAISummarize('inputs')} 
                        disabled={isLoading} 
                        className="h-8 shrink-0 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                        <Sparkles size={14} /> 
                        汇总 {inputs.length} 个来源
                    </button>
                )}
            </div>
        );
    }

    // Status 状态卡
    if (type === 'status') {
      return (
        // 修正：
        // 1. 移除 onPointerDown={stopProp}，允许点击事件冒泡到 Draggable
        // 2. 添加 'drag-handle' 类，使整个区域成为拖拽把手
        <div className="w-full h-full flex items-center justify-center">
           <div 
             onClick={cycleStatus} 
             className={`drag-handle w-full h-full ${currentStatus.color} ${currentStatus.text} rounded-full shadow flex items-center justify-center font-bold text-sm cursor-grab active:cursor-grabbing border border-white/20 select-none active:scale-95 transition-transform`}
           >
             {currentStatus.label}
           </div>
        </div>
      );
    }
    
    // 图片
    if (type === 'image') return <img src={content} className="w-full h-full object-cover pointer-events-none block rounded-lg select-none" alt="" />;
    
    // 默认文本/Note
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

  // 样式计算
  let borderClass = "";
  if (isSelected) borderClass = type === 'ai' ? "ring-2 ring-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]" : "ring-2 ring-emerald-500 shadow-lg";
  else borderClass = "hover:ring-1 hover:ring-white/30";

  let bgClass = "bg-[#fff9c4]"; 
  if (type === 'note') bgClass = "bg-[#fff9c4]";
  if (type === 'text') bgClass = "bg-white"; 
  if (type === 'ai') bgClass = "bg-slate-900 border-2 border-purple-500/50"; // 边框样式在最外层
  else if (type === 'code') bgClass = "bg-[#1e1e1e] border border-slate-700";
  else if (type === 'image' || type === 'status') bgClass = "bg-transparent"; 

  const handleStyle = "w-4 h-4 bg-white border border-slate-400 hover:bg-emerald-500 rounded-full absolute z-[100] shadow-sm flex items-center justify-center";

  return (
    <Draggable 
        nodeRef={nodeRef} 
        position={{ x, y }} 
        scale={scale} 
        disabled={disabled} // 支持禁用拖拽
        onStart={(e) => { e.stopPropagation(); }}
        onDrag={(_, data) => onDrag(id, data.x, data.y)} 
        onStop={() => {}} 
        handle=".drag-handle" 
    >
      <div 
        ref={nodeRef} 
        id={id} 
        // 确保外层有 overflow-hidden (如果是 AI 卡)，且 box-sizing 正确
        className={`absolute group transition-shadow rounded-lg box-border ${borderClass} ${bgClass}`}
        style={{ width: currentW, height: currentH, zIndex: isSelected ? 50 : 10 }}
      >
         <Resizable 
            width={currentW} 
            height={currentH} 
            onResize={(e, { size }) => onResize && onResize(id, size.width, size.height)}
            minConstraints={[100, 50]} 
            maxConstraints={[800, 800]}
            handle={<span className="react-resizable-handle react-resizable-handle-se !w-6 !h-6" />} 
         >
            <div className="w-full h-full relative flex flex-col" style={{ width: currentW, height: currentH }}>
                {/* 顶部拖拽条 */}
                {type !== 'status' && (
                  <div className={`drag-handle h-8 w-full absolute top-0 left-0 z-20 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing hover:bg-black/5 transition-colors rounded-t-lg`}>
                    <GripHorizontal size={16} className="text-slate-400 opacity-50" />
                    <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="text-slate-400 hover:text-red-500 bg-slate-200/50 hover:bg-red-100 rounded-full w-5 h-5 flex items-center justify-center">×</button>
                  </div>
                )}
                
                {/* 内容容器 */}
                <div className={`w-full h-full overflow-hidden rounded-lg ${type !== 'status' ? 'pt-8' : ''}`}>
                    {renderContent()}
                </div>
            </div>
         </Resizable>

         {/* 连线锚点 */}
         <div className={`${handleStyle} -top-2 left-1/2 -translate-x-1/2`} onPointerDown={(e) => { e.stopPropagation(); onConnectStart?.(id); }} onPointerUp={(e) => { e.stopPropagation(); onConnectEnd?.(id); }} />
         <div className={`${handleStyle} -bottom-2 left-1/2 -translate-x-1/2`} onPointerDown={(e) => { e.stopPropagation(); onConnectStart?.(id); }} onPointerUp={(e) => { e.stopPropagation(); onConnectEnd?.(id); }} />
         <div className={`${handleStyle} top-1/2 -left-2 -translate-y-1/2`} onPointerDown={(e) => { e.stopPropagation(); onConnectStart?.(id); }} onPointerUp={(e) => { e.stopPropagation(); onConnectEnd?.(id); }} />
         <div className={`${handleStyle} top-1/2 -right-2 -translate-y-1/2`} onPointerDown={(e) => { e.stopPropagation(); onConnectStart?.(id); }} onPointerUp={(e) => { e.stopPropagation(); onConnectEnd?.(id); }} />
      </div>
    </Draggable>
  );
}