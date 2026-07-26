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

// 核心修改：修改 Prompt，强制要求输出 HTML 标签，而非 Markdown
const PROMPTS: Record<AIMode, string> = {
  generate: "你是一个专业的游戏策划助手。请根据用户的指令生成一段详细的文档内容。**请务必使用HTML标签格式输出**（使用 <h1>, <h2>, <h3> 表示标题，<p> 表示段落，<ul><li> 表示列表，<strong> 表示加粗）。**严禁使用 Markdown 语法（如 #, ##, - 等）**。",
  rewrite: "你是一个资深编辑。请润色以下文本，使其更加通顺、专业。**请直接输出润色后的 HTML 内容**，保留原意的同时提升文采。",
  expand: "你是一个创意丰富的作家。请根据以下内容进行扩写，增加细节。**请直接输出 HTML 格式的结果**。",
  summarize: "请总结以下内容的核心要点。**请使用 HTML 无序列表 (<ul><li>) 输出关键条目**。",
  translate: "请将以下内容翻译成英文（如果是英文则翻译成中文），保持游戏术语的准确性。**保持原有的 HTML 结构或输出 HTML 格式**。"
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
      <div className="bg-surface border border-line w-full max-w-[700px] max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-line bg-bg/50">
          <div className="flex items-center gap-2 text-iris-400">
            <Sparkles size={18} />
            <span className="font-bold text-sm uppercase tracking-wider">AI Assistant - {mode.toUpperCase()}</span>
          </div>
          <button onClick={onClose}><X size={18} className="text-subtle hover:text-white" /></button>
        </div>

        {/* Body */}
        <div className="p-4 md:p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
          <div className="space-y-2">
             <label className="text-xs font-bold text-subtle uppercase">
                {mode === 'generate' ? '输入指令 (Prompt)' : '原文内容'}
             </label>
             {mode === 'generate' ? (
               <div className="flex gap-2">
                 <input 
                   value={prompt} 
                   onChange={e => setPrompt(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleRunAI(prompt)}
                   placeholder="例如：设计一把传说级的火焰长剑..."
                   className="flex-1 bg-bg border border-line-strong rounded-lg px-3 py-2 md:px-4 md:py-3 text-sm text-white focus:border-iris-500 outline-none"
                   autoFocus
                 />
                 <button 
                   onClick={() => handleRunAI(prompt)}
                   disabled={loading || !prompt.trim()}
                   className="bg-iris-600 hover:bg-iris-500 disabled:opacity-50 text-white px-3 md:px-4 rounded-lg font-bold"
                 >
                   <ArrowRight size={18} />
                 </button>
               </div>
             ) : (
               <div className="p-3 bg-bg/50 border border-line rounded-lg text-muted text-sm italic max-h-24 overflow-y-auto">
                 "{selectedText}"
               </div>
             )}
          </div>

          {(loading || result || error) && (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
               <div className="flex justify-between items-center">
                 <label className="text-xs font-bold text-brand-500 uppercase">生成结果</label>
                 {result && (
                   <div className="flex gap-2">
                      <button onClick={() => handleRunAI(mode === 'generate' ? prompt : selectedText)} className="text-subtle hover:text-white text-xs flex items-center gap-1"><RefreshCw size={12}/> 重试</button>
                      <button onClick={() => navigator.clipboard.writeText(result)} className="text-subtle hover:text-white text-xs flex items-center gap-1"><Copy size={12}/> 复制</button>
                   </div>
                 )}
               </div>

               {/* 预览区域：虽然我们要求 HTML，但这里还是当文本显示，插入时再解析 */}
               <div className={`p-3 md:p-4 rounded-lg border min-h-[100px] text-sm leading-relaxed whitespace-pre-wrap ${
                 error ? 'bg-red-900/20 border-red-500/50 text-red-300' : 'bg-bg border-iris-500/30 text-content'
               }`}>
                 {loading ? (
                   <div className="flex items-center gap-2 text-iris-400">
                     <RefreshCw size={16} className="animate-spin" />
                     正在思考中...
                   </div>
                 ) : error ? error : result}
               </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line bg-bg/50 flex justify-end gap-3">
           <button onClick={onClose} className="px-3 py-2 text-muted hover:text-white text-xs md:text-sm">取消</button>
           {result && (
             <>
               {mode !== 'generate' && (
                 <button onClick={() => onInsert(result, 'replace')} className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg text-xs md:text-sm font-bold">
                   替换原文
                 </button>
               )}
               <button onClick={() => onInsert(result, 'insert')} className="px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs md:text-sm font-bold shadow-lg">
                 <Check size={16} className="md:mr-2 inline" /><span className="hidden md:inline">确认插入</span><span className="md:hidden">插入</span>
               </button>
             </>
           )}
        </div>
      </div>
    </div>
  );
}