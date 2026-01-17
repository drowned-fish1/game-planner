import { useState, useRef } from 'react';
import Draggable from 'react-draggable';

interface NoteCardProps {
  id: string;
  type: 'text' | 'image' | 'status' | 'video' | 'audio' | 'link' | 'code';
  content: string; 
  x: number;
  y: number;
  scale: number;
  isSelected?: boolean;
  onUpdate: (id: string, content: string) => void;
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
  id, type, content, x, y, scale, isSelected, 
  onUpdate, onDelete, onDrag, onConnectStart, onConnectEnd 
}: NoteCardProps) {
  const nodeRef = useRef(null);
  const [isEditingUrl, setIsEditingUrl] = useState(!content);

  const statusKey = (content && STATUS_TYPES[content as StatusKey]) ? content as StatusKey : 'unused';
  const currentStatus = STATUS_TYPES[statusKey];

  const cycleStatus = () => {
    const keys = Object.keys(STATUS_TYPES) as StatusKey[];
    const currentIndex = keys.indexOf(statusKey);
    const nextIndex = (currentIndex + 1) % keys.length;
    onUpdate(id, keys[nextIndex]);
  };

  // === 渲染核心内容 ===
  const renderContent = () => {
    // 1. 状态胶囊 (独立结构)
    if (type === 'status') {
      return (
        <div className="relative group">
          <div 
            onClick={cycleStatus} 
            className={`drag-handle w-32 h-10 ${currentStatus.color} ${currentStatus.text} rounded-full shadow-lg flex items-center justify-center font-bold text-sm cursor-pointer border-2 border-white/20 select-none hover:brightness-110 active:scale-95 transition-all z-[60]`}
          >
            {currentStatus.label}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDelete(id); }} className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 text-slate-300 hover:bg-red-500 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs z-[70] border border-slate-500 cursor-pointer pointer-events-auto">×</button>
        </div>
      );
    }

    const stopProp = (e: React.MouseEvent) => e.stopPropagation();
    
    // URL 编辑模式
    if ((type === 'video' || type === 'audio' || type === 'link') && (isEditingUrl || !content)) {
      return (
        <div className="w-full h-32 bg-slate-800 flex flex-col items-center justify-center p-4 gap-3 rounded-lg" onMouseDown={stopProp}>
          <span className="text-slate-400 text-xs uppercase font-bold tracking-wider">{type} URL</span>
          <input 
            className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded border border-slate-600 outline-none focus:border-emerald-500 transition-colors"
            placeholder="粘贴链接回车..."
            autoFocus
            defaultValue={content}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onUpdate(id, e.currentTarget.value);
                setIsEditingUrl(false);
              }
            }}
          />
        </div>
      );
    }

    // === 显示模式 ===
    
    // 2. 图片：纯图片，无多余容器
    if (type === 'image') {
      return <img src={content} className="w-full h-auto object-cover pointer-events-none display-block" />;
    } 
    
    // 3. 视频：黑底容器，高度自适应
    if (type === 'video') {
      return (
        <div className="w-full h-auto bg-black flex items-center justify-center relative group" onMouseDown={stopProp}>
           <video src={content} controls className="w-full h-auto max-h-[300px] object-contain" />
           <button onClick={() => setIsEditingUrl(true)} className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-emerald-600">✏️</button>
        </div>
      );
    }
    
    // 4. 音频：固定高度条
    if (type === 'audio') {
      return (
        <div className="w-full h-20 bg-slate-800 flex items-center justify-center relative group" onMouseDown={stopProp}>
           <audio src={content} controls className="w-11/12 h-8" />
           <button onClick={() => setIsEditingUrl(true)} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100">✏️</button>
        </div>
      );
    }
    
    // 5. 代码块：头部 + 文本域 (高度由 flex 控制，不再强制最小高度)
    if (type === 'code') {
      return (
        <div className="w-full bg-[#1e1e1e] flex flex-col" onMouseDown={stopProp}>
          {/* 头部 */}
          <div className="h-7 bg-[#252526] flex items-center px-3 border-b border-black/40 select-none shrink-0">
             <div className="flex gap-1.5 opacity-60">
               <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
               <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
               <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
             </div>
             <span className="ml-3 text-[10px] text-slate-500 font-mono tracking-tight">SNIPPET</span>
          </div>
          {/* 内容：设置 min-h 但允许撑开 */}
          <textarea
            className="w-full bg-transparent resize-none outline-none text-green-400 font-mono text-xs p-3 leading-relaxed min-h-[120px] block"
            value={content}
            onChange={(e) => onUpdate(id, e.target.value)}
            spellCheck={false}
          />
        </div>
      );
    }

    // 6. 链接：自适应高度
    if (type === 'link') {
      return (
        <div className="w-full h-auto min-h-[80px] bg-slate-900 flex items-center justify-center p-4 relative group" onMouseDown={stopProp}>
          <a href={content} target="_blank" rel="noreferrer" className="text-blue-400 underline text-sm break-all hover:text-blue-300 text-center">
            {content}
          </a>
          <button onClick={() => setIsEditingUrl(true)} className="absolute bottom-2 right-2 p-1.5 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
            ✏️
          </button>
        </div>
      );
    }

    // 7. 默认文本
    return (
      <textarea
        className="w-full h-32 bg-[#fff9c4] resize-none outline-none text-slate-800 placeholder-slate-500/50 font-medium p-3 cursor-text block"
        placeholder="写下灵感..."
        value={content}
        onChange={(e) => onUpdate(id, e.target.value)}
        onMouseDown={stopProp}
      />
    );
  };

  // === 样式计算 ===
  // 关键修复 1：最外层绝不能有 overflow-hidden，否则小圆点会被切掉
  let containerClass = "absolute shadow-sm transition-shadow flex flex-col "; 
  // 关键修复 2：内容的圆角和裁剪交给内部的 wrapper 处理
  let contentWrapperClass = "w-full h-full overflow-hidden "; 

  // 根据类型决定边框和背景 (只负责边框颜色和圆角)
  if (type === 'status') {
    containerClass += "z-[50] "; // 状态标签不需要 wrapper 样式
  } else if (type === 'video' || type === 'code' || type === 'image') {
    containerClass += "w-72 h-auto " + (isSelected ? "z-20 ring-2 ring-emerald-500" : "z-10");
    contentWrapperClass += "rounded-lg border-2 " + (type==='image' ? "border-white bg-white" : "border-slate-700 bg-[#1e1e1e]");
  } else if (type === 'audio' || type === 'link') {
    containerClass += "w-64 h-auto " + (isSelected ? "z-20 ring-2 ring-emerald-500" : "z-10");
    contentWrapperClass += "rounded-lg border border-slate-600 bg-slate-800";
  } else {
    // Text
    containerClass += "w-48 h-auto " + (isSelected ? "z-20 ring-2 ring-emerald-500" : "z-10 hover:ring-1 hover:ring-black/10");
    contentWrapperClass += "rounded-lg border border-transparent bg-[#fff9c4]";
  }

  // === 连接点样式 (原始风格) ===
  const handleStyle = "w-3 h-3 bg-white border border-slate-400 hover:bg-emerald-500 hover:border-emerald-500 rounded-full absolute transition-all cursor-crosshair z-[100] opacity-0 group-hover:opacity-100 shadow-sm";

  return (
    <Draggable
      nodeRef={nodeRef}
      position={{ x, y }}
      scale={scale}
      onStart={() => {}}
      onDrag={(_, data) => onDrag(id, data.x, data.y)}
      onStop={() => {}}
      handle=".drag-handle"
    >
      <div ref={nodeRef} id={id} className={`${containerClass} group cursor-default`}>
        {/* 状态标签直接渲染，不包裹 */}
        {type === 'status' ? renderContent() : (
          <div className={contentWrapperClass}>
            {/* 顶部拖拽条 (Inside Wrapper) */}
            <div className={`drag-handle h-6 shrink-0 flex items-center justify-end px-2 cursor-grab active:cursor-grabbing border-b ${
              type === 'code' || type === 'video' || type === 'audio' || type === 'link' 
                ? 'bg-[#252526] border-black/20' 
                : 'bg-black/5 border-transparent' 
            }`}>
               <button 
                 onClick={(e) => { e.stopPropagation(); onDelete(id); }} 
                 className="text-slate-400 hover:text-red-500 font-bold text-xs"
               >×</button>
            </div>

            {/* 内容区 */}
            {renderContent()}
          </div>
        )}

        {/* 连接点 (Outside Wrapper, Inside Draggable Div) */}
        {/* 这样它们就不会被 overflow-hidden 切掉了！ */}
        <div className={`${handleStyle} -top-1.5 left-1/2 -translate-x-1/2`} onMouseDown={(e) => { e.stopPropagation(); onConnectStart && onConnectStart(id); }} onMouseUp={(e) => { e.stopPropagation(); onConnectEnd && onConnectEnd(id); }} />
        <div className={`${handleStyle} -bottom-1.5 left-1/2 -translate-x-1/2`} onMouseDown={(e) => { e.stopPropagation(); onConnectStart && onConnectStart(id); }} onMouseUp={(e) => { e.stopPropagation(); onConnectEnd && onConnectEnd(id); }} />
        <div className={`${handleStyle} top-1/2 -left-1.5 -translate-y-1/2`} onMouseDown={(e) => { e.stopPropagation(); onConnectStart && onConnectStart(id); }} onMouseUp={(e) => { e.stopPropagation(); onConnectEnd && onConnectEnd(id); }} />
        <div className={`${handleStyle} top-1/2 -right-1.5 -translate-y-1/2`} onMouseDown={(e) => { e.stopPropagation(); onConnectStart && onConnectStart(id); }} onMouseUp={(e) => { e.stopPropagation(); onConnectEnd && onConnectEnd(id); }} />
      </div>
    </Draggable>
  );
}
