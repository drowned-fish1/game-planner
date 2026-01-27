// src/components/Brainstorm/NoteCard.tsx
import { useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { Resizable } from 'react-resizable';
import { Sparkles, Loader2, Bot } from 'lucide-react';
// 确保这个路径下有你的 Settings 定义，如果没有，请在下方手动定义 interface AIConfig
import { AIConfig } from '../Settings/Settings'; 

// 定义存储键名
const STORAGE_KEY_CONFIGS = 'gp_ai_configs';
const STORAGE_KEY_ACTIVE = 'gp_ai_active_id';

interface NoteCardProps {
  id: string;
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code' | 'ai';
  content: string; 
  x: number;
  y: number;
  width?: number;
  height?: number;
  scale: number;
  isSelected?: boolean;
  inputs?: string[]; 
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
  id, type, content, x, y, width, height, scale, isSelected, inputs = [],
  onUpdate, onResize, onDelete, onDrag, onConnectStart, onConnectEnd 
}: NoteCardProps) {
  const nodeRef = useRef(null);
  const [isEditingUrl, setIsEditingUrl] = useState(!content);
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

  // === AI 核心逻辑 (动态配置版) ===
  const handleAISummarize = async (mode: 'self' | 'inputs') => {
    // 1. 从 localStorage 读取配置
    const savedConfigs = localStorage.getItem(STORAGE_KEY_CONFIGS);
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE);
    
    if (!savedConfigs) {
        alert("请先在左侧【设置】中配置 AI API");
        return;
    }

    const configs: AIConfig[] = JSON.parse(savedConfigs);
    const config = configs.find(c => c.id === activeId) || configs[0];

    if (!config || !config.key || !config.url) {
        alert("当前的 AI 配置无效或缺少 Key，请检查设置。");
        return;
    }

    setIsLoading(true);

    let prompt = "";
    if (mode === 'self') {
        prompt = `请总结以下内容：\n${content}`;
    } else {
        if (inputs.length === 0) {
            alert("没有其他磁贴指向我，无法进行汇总总结。");
            setIsLoading(false);
            return;
        }
        prompt = `请将以下 ${inputs.length} 条内容进行汇总、分析并总结出核心观点：\n` + inputs.map((t, i) => `${i+1}. ${t}`).join('\n');
    }

    try {
        // 2. 使用配置中的 URL 和 Key
        const res = await fetch(config.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // 兼容 Bearer 验证方式
                "Authorization": `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model, // 使用配置中的模型名
                messages: [
                    { role: "system", content: "你是一个高效的助手，擅长总结和提炼信息。请直接输出总结结果，不要废话。" },
                    { role: "user", content: prompt }
                ],
                stream: false
            })
        });
        
        const data = await res.json();
        if (data.choices && data.choices[0]) {
            const result = data.choices[0].message.content;
            if (mode === 'inputs') {
                onUpdate(id, (content ? content + "\n\n---\n\n" : "") + `🤖 **AI 汇总 (${config.model})**:\n` + result);
            } else {
                onUpdate(id, result);
            }
        } else {
            alert("AI 响应异常: " + JSON.stringify(data));
        }
    } catch (e) {
        console.error(e);
        alert("请求失败，请检查设置中的 URL 和 Key 是否正确，以及网络连接。");
    } finally {
        setIsLoading(false);
    }
  };

  const renderContent = () => {
    const stopProp = (e: React.MouseEvent) => e.stopPropagation();

    // AI 磁贴
    if (type === 'ai') {
        return (
            <div className="flex flex-col w-full h-full bg-slate-900 text-white overflow-hidden" onMouseDown={stopProp}>
                <div className="h-8 bg-purple-900/50 border-b border-purple-500/30 flex items-center justify-between px-2 shrink-0 select-none">
                    <div className="flex items-center gap-1.5 text-purple-300"><Bot size={14} /><span className="text-[10px] font-bold uppercase">AI Insight</span></div>
                    {isLoading && <Loader2 size={12} className="animate-spin text-purple-400"/>}
                </div>
                <textarea className="flex-1 bg-transparent resize-none outline-none text-slate-200 text-xs p-3 custom-scrollbar placeholder-purple-300/20"
                    placeholder="输入或连接其他磁贴..." value={content} onChange={(e) => onUpdate(id, e.target.value)}
                    onContextMenu={(e) => { e.preventDefault(); if (confirm("AI 总结当前内容?")) handleAISummarize('self'); }}
                />
                {inputs.length > 0 && <button onClick={() => handleAISummarize('inputs')} disabled={isLoading} className="h-7 bg-purple-600 hover:bg-purple-500 text-white text-[10px] flex items-center justify-center gap-2"><Sparkles size={12} /> 汇总 {inputs.length} 来源</button>}
            </div>
        );
    }

    // Status (特殊处理：Status 不可调整内容区大小，只调整容器)
    if (type === 'status') {
      return (
        <div className="w-full h-full flex items-center justify-center" onMouseDown={stopProp}>
           <div onClick={cycleStatus} className={`w-full h-full ${currentStatus.color} ${currentStatus.text} rounded-full shadow flex items-center justify-center font-bold text-sm cursor-pointer border border-white/20 select-none hover:brightness-110 active:scale-95`}>
             {currentStatus.label}
           </div>
        </div>
      );
    }
    
    // Image
    if (type === 'image') return <img src={content} className="w-full h-full object-cover pointer-events-none block rounded-lg" />;
    
    // Video/Audio/Link/Code 编辑模式
    if ((type === 'video' || type === 'audio' || type === 'link') && (isEditingUrl || !content)) {
        return <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-4 gap-2" onMouseDown={stopProp}><span className="text-slate-400 text-xs font-bold">{type} URL</span><input className="w-full bg-slate-900 text-white text-xs px-2 py-1 rounded border border-slate-600" autoFocus defaultValue={content} onKeyDown={(e) => { if (e.key === 'Enter') { onUpdate(id, e.currentTarget.value); setIsEditingUrl(false); } }} /></div>;
    }
    if (type === 'video') return (<div className="w-full h-full bg-black flex items-center justify-center relative group" onMouseDown={stopProp}><video src={content} controls className="w-full h-full object-contain" /><button onClick={() => setIsEditingUrl(true)} className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100">✏️</button></div>);
    if (type === 'audio') return (<div className="w-full h-full bg-slate-800 flex items-center justify-center relative group" onMouseDown={stopProp}><audio src={content} controls className="w-11/12" /><button onClick={() => setIsEditingUrl(true)} className="absolute top-2 right-2 p-1 text-white opacity-0 group-hover:opacity-100">✏️</button></div>);
    if (type === 'code') return (<div className="w-full h-full bg-[#1e1e1e] flex flex-col" onMouseDown={stopProp}><div className="h-6 bg-[#252526] flex items-center px-2 border-b border-black/40 shrink-0"><span className="text-[10px] text-slate-500 font-mono">CODE</span></div><textarea className="flex-1 bg-transparent resize-none outline-none text-green-400 font-mono text-xs p-2 custom-scrollbar" value={content} onChange={(e) => onUpdate(id, e.target.value)} spellCheck={false} /></div>);
    if (type === 'link') return (<div className="w-full h-full bg-slate-900 flex items-center justify-center p-4 relative group" onMouseDown={stopProp}><a href={content} target="_blank" rel="noreferrer" className="text-blue-400 underline text-sm break-all hover:text-blue-300 text-center">{content}</a><button onClick={() => setIsEditingUrl(true)} className="absolute bottom-2 right-2 p-1 text-white opacity-0 group-hover:opacity-100">✏️</button></div>);

    // Default Text
    return <textarea className="w-full h-full bg-[#fff9c4] resize-none outline-none text-slate-800 placeholder-slate-500/50 font-medium p-3 cursor-text block" placeholder="Type..." value={content} onChange={(e) => onUpdate(id, e.target.value)} onMouseDown={stopProp} />;
  };

  // 动态样式
  let borderClass = "";
  if (isSelected) borderClass = type === 'ai' ? "ring-2 ring-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)]" : "ring-2 ring-emerald-500 shadow-lg";
  else borderClass = "hover:ring-1 hover:ring-white/30";

  // 背景样式
  let bgClass = "bg-[#fff9c4]"; // default
  if (type === 'ai') bgClass = "bg-slate-900 border-2 border-purple-500/50";
  else if (type === 'code') bgClass = "bg-[#1e1e1e] border border-slate-700";
  else if (type === 'image') bgClass = "bg-transparent";
  else if (type === 'status') bgClass = "bg-transparent"; 
  else if (type === 'video' || type === 'audio') bgClass = "bg-black";
  else if (type === 'link') bgClass = "bg-slate-900 border border-slate-700";

  const handleStyle = "w-3 h-3 bg-white border border-slate-400 hover:bg-emerald-500 hover:border-emerald-500 rounded-full absolute transition-all cursor-crosshair z-[100] opacity-0 group-hover:opacity-100 shadow-sm";

  return (
    <Draggable nodeRef={nodeRef} position={{ x, y }} scale={scale} onStart={() => {}} onDrag={(_, data) => onDrag(id, data.x, data.y)} onStop={() => {}} handle=".drag-handle">
      <div 
        ref={nodeRef} 
        id={id} 
        className={`absolute group cursor-default transition-shadow rounded-lg ${borderClass} ${bgClass}`}
        style={{ width: currentW, height: currentH, zIndex: isSelected ? 50 : 10 }}
      >
         {/* Resizable 包裹内容区 */}
         <Resizable 
            width={currentW} 
            height={currentH} 
            onResize={(e, { size }) => onResize && onResize(id, size.width, size.height)}
            // 限制最小尺寸
            minConstraints={[100, 50]} 
            maxConstraints={[1000, 1000]}
            // 右下角把手
            handle={<span className="react-resizable-handle react-resizable-handle-se" />}
         >
            <div className="w-full h-full relative" style={{ width: currentW, height: currentH }}>
                {/* 顶部拖拽条 (Status除外，Status整体可拖) */}
                {type !== 'status' && (
                  <div className={`drag-handle h-6 w-full absolute top-0 left-0 z-20 flex items-center justify-end px-2 cursor-grab active:cursor-grabbing hover:bg-black/10 transition-colors ${
                    type === 'ai' ? 'bg-transparent' : 'bg-transparent'
                  }`}>
                    {/* 删除按钮 */}
                    <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="text-slate-400 hover:text-red-500 font-bold text-xs bg-slate-800/80 rounded-full w-4 h-4 flex items-center justify-center ml-auto">×</button>
                  </div>
                )}
                
                {/* 实际内容渲染 */}
                <div className="w-full h-full overflow-hidden rounded-lg">
                    {renderContent()}
                </div>
            </div>
         </Resizable>

         {/* 连线锚点 */}
         <div className={`${handleStyle} -top-1.5 left-1/2 -translate-x-1/2`} onMouseDown={(e) => { e.stopPropagation(); onConnectStart && onConnectStart(id); }} onMouseUp={(e) => { e.stopPropagation(); onConnectEnd && onConnectEnd(id); }} />
         <div className={`${handleStyle} -bottom-1.5 left-1/2 -translate-x-1/2`} onMouseDown={(e) => { e.stopPropagation(); onConnectStart && onConnectStart(id); }} onMouseUp={(e) => { e.stopPropagation(); onConnectEnd && onConnectEnd(id); }} />
         <div className={`${handleStyle} top-1/2 -left-1.5 -translate-y-1/2`} onMouseDown={(e) => { e.stopPropagation(); onConnectStart && onConnectStart(id); }} onMouseUp={(e) => { e.stopPropagation(); onConnectEnd && onConnectEnd(id); }} />
         <div className={`${handleStyle} top-1/2 -right-1.5 -translate-y-1/2`} onMouseDown={(e) => { e.stopPropagation(); onConnectStart && onConnectStart(id); }} onMouseUp={(e) => { e.stopPropagation(); onConnectEnd && onConnectEnd(id); }} />
      </div>
    </Draggable>
  );
}