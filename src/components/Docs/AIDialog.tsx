import { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, RefreshCw, Check, X, Copy, Wand2 } from 'lucide-react';
import { requestAI } from '../../utils/aiService';

export type AIMode = 'generate' | 'rewrite' | 'expand' | 'summarize' | 'translate';

interface AIDialogProps {
  mode: AIMode;
  selectedText?: string; 
  onInsert: (text: string, mode: 'replace' | 'insert') => void;
  onClose: () => void;
}

const PROMPTS: Record<AIMode, string> = {
  generate: "你是一个专业的游戏策划助手。请根据用户的指令生成一段详细的文档内容。要求逻辑清晰，格式规范（使用Markdown）。",
  rewrite: "你是一个资深编辑。请润色以下文本，使其更加通顺、专业，保留原意的同时提升文采。直接输出润色后的结果。",
  expand: "你是一个创意丰富的作家。请根据以下内容进行扩写，增加细节、背景描述或具体数据，使其更加丰富。直接输出结果。",
  summarize: "请总结以下内容的核心要点，列出关键条目。",
  translate: "请将以下内容翻译成英文（如果是英文则翻译成中文），保持游戏术语的准确性。"
};

export function AIDialog({ mode, selectedText = '', onInsert, onClose }: AIDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode !== 'generate' && selectedText) {
       handleRunAI(selectedText);
    }
  }, []);

  const handleRunAI = async (inputContent: string) => {
    setError('');
    setResult('');
    const system = PROMPTS[mode];
    let user = inputContent;
    if (mode === 'generate') {
       user = `指令：${prompt}`;
    } else {
       user = `原文：\n"${selectedText}"\n\n请执行${mode}操作。`;
    }
    try {
      const text = await requestAI(system, user, setLoading);
      setResult(text);
    } catch (err: any) {
      setError(err.message || '请求失败');
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      {/* 适配宽度: w-full max-w-[700px] */}
      <div className="bg-slate-800 border border-slate-700 w-full max-w-[700px] max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900/50">
          <div className="flex items-center gap-2 text-purple-400">
            <Sparkles size={18} />
            <span className="font-bold text-sm uppercase tracking-wider">AI Assistant - {mode.toUpperCase()}</span>
          </div>
          <button onClick={onClose}><X size={18} className="text-slate-500 hover:text-white" /></button>
        </div>

        {/* Body */}
        <div className="p-4 md:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
          <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 uppercase">
                {mode === 'generate' ? '输入指令 (Prompt)' : '原文内容'}
             </label>
             {mode === 'generate' ? (
               <div className="flex gap-2">
                 <input 
                   value={prompt} 
                   onChange={e => setPrompt(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleRunAI(prompt)}
                   placeholder="例如：设计一把传说级的火焰长剑..."
                   className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm text-white focus:border-purple-500 outline-none"
                   autoFocus
                 />
                 <button 
                   onClick={() => handleRunAI(prompt)}
                   disabled={loading || !prompt.trim()}
                   className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-3 md:px-4 rounded-lg font-bold"
                 >
                   <ArrowRight size={18} />
                 </button>
               </div>
             ) : (
               <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-400 text-sm italic max-h-24 overflow-y-auto">
                 "{selectedText}"
               </div>
             )}
          </div>

          {(loading || result || error) && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
               <div className="flex justify-between items-center">
                 <label className="text-xs font-bold text-emerald-500 uppercase">生成结果</label>
                 {result && (
                   <div className="flex gap-2">
                      <button onClick={() => handleRunAI(mode === 'generate' ? prompt : selectedText)} className="text-slate-500 hover:text-white text-xs flex items-center gap-1"><RefreshCw size={12}/> 重试</button>
                      <button onClick={() => navigator.clipboard.writeText(result)} className="text-slate-500 hover:text-white text-xs flex items-center gap-1"><Copy size={12}/> 复制</button>
                   </div>
                 )}
               </div>

               <div className={`p-3 md:p-4 rounded-lg border min-h-[100px] text-sm leading-relaxed whitespace-pre-wrap ${
                 error ? 'bg-red-900/20 border-red-500/50 text-red-300' : 'bg-slate-900 border-purple-500/30 text-slate-200'
               }`}>
                 {loading ? (
                   <div className="flex items-center gap-2 text-purple-400">
                     <RefreshCw size={16} className="animate-spin" />
                     正在思考中...
                   </div>
                 ) : error ? error : result}
               </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-700 bg-slate-900/50 flex justify-end gap-3">
           <button onClick={onClose} className="px-3 py-2 text-slate-400 hover:text-white text-xs md:text-sm">取消</button>
           {result && (
             <>
               {mode !== 'generate' && (
                 <button onClick={() => onInsert(result, 'replace')} className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-xs md:text-sm font-bold">
                   替换原文
                 </button>
               )}
               <button onClick={() => onInsert(result, 'insert')} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs md:text-sm font-bold shadow-lg">
                 <Check size={16} className="md:mr-2 inline" /><span className="hidden md:inline">确认插入</span><span className="md:hidden">插入</span>
               </button>
             </>
           )}
        </div>
      </div>
    </div>
  );
}