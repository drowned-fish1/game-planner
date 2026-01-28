// src/components/Docs/Docs.tsx
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import BubbleMenuExtension from '@tiptap/extension-bubble-menu';
import { 
  Folder, FileText, ChevronRight, ChevronDown, Plus, Trash2, Hash, 
  Download, FilePlus, Sparkles, Wand2, RefreshCcw, Languages, Expand, 
  Menu, X, Share2 
} from 'lucide-react';
import { DocItem } from '../../utils/storage';
import { AIDialog, AIMode } from './AIDialog';

// === Template Data ===
const TEMPLATES = [
  { id: 'blank', name: '空白文档', content: '' },
  {
    id: 'gdd',
    name: 'GDD 游戏策划案',
    content: `<h1>游戏名称 (Project Name)</h1><h2>1. 游戏概述</h2><p><strong>核心概念：</strong>一句话描述这个游戏。</p><p><strong>游戏类型：</strong>RPG / FPS / RTS...</p>`
  },
  {
    id: 'level',
    name: '关卡设计模版',
    content: `<h1>关卡名称: [Level 1]</h1><h2>1. 关卡目标</h2><p>玩家需要达成什么条件通关？</p>`
  },
  {
    id: 'char',
    name: '角色设定卡',
    content: `<h1>角色名: [Name]</h1><h2>1. 基本信息</h2><ul><li><strong>年龄:</strong> 18</li></ul>`
  }
];

interface HeadingItem {
  level: number;
  text: string;
  id: string;
  pos: number;
}

interface DocsProps {
  initialDocs: DocItem[];
  onUpdate: (docs: DocItem[]) => void;
}

export function Docs({ initialDocs, onUpdate }: DocsProps) {
  const [docs, setDocs] = useState<DocItem[]>(initialDocs || []);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const editorRef = useRef<any>(null);

  // UI States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);
  
  // AI States
  const [aiMode, setAiMode] = useState<AIMode | null>(null);
  const [aiSelectedText, setAiSelectedText] = useState('');

  // Initialization
  useEffect(() => {
    if (initialDocs && initialDocs.length > 0) {
        setDocs(initialDocs);
        if (!activeDocId || !initialDocs.find(d => d.id === activeDocId)) {
             setActiveDocId(initialDocs[0].id);
        }
    } else if (initialDocs && initialDocs.length === 0 && docs.length === 0) {
        // Create default doc if empty
        createDocFromTemplate('gdd', null);
    }
  }, [initialDocs]);

  // === Core Logic ===
  const updateDocContent = (id: string, content: string) => {
    const newDocs = docs.map(d => d.id === id ? { ...d, content } : d);
    setDocs(newDocs);
    onUpdate(newDocs);
  };

  const updateDocTitle = (id: string, title: string) => {
    const newDocs = docs.map(d => d.id === id ? { ...d, title } : d);
    setDocs(newDocs);
    onUpdate(newDocs);
  };

  const createDocFromTemplate = (templateId: string, parentId: string | null) => {
    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
    const newDoc: DocItem = {
      id: uuidv4(),
      title: template.id === 'blank' ? '未命名文档' : template.name,
      content: template.content,
      parentId: parentId,
      expanded: true
    };
    let newDocs = [...docs, newDoc];
    if (parentId) newDocs = newDocs.map(d => d.id === parentId ? { ...d, expanded: true } : d);
    setDocs(newDocs);
    onUpdate(newDocs);
    setActiveDocId(newDoc.id);
    setIsTemplateModalOpen(false);
    setIsMobileMenuOpen(false);
  };

  const handleCreateClick = (parentId: string | null) => {
    setTargetParentId(parentId);
    setIsTemplateModalOpen(true);
  };

  const deleteDoc = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('确定删除此文档及其子文档吗？')) return;
    const idsToDelete = new Set<string>();
    const collectIds = (currentId: string) => {
      idsToDelete.add(currentId);
      docs.filter(d => d.parentId === currentId).forEach(child => collectIds(child.id));
    };
    collectIds(id);
    const newDocs = docs.filter(d => !idsToDelete.has(d.id));
    setDocs(newDocs);
    onUpdate(newDocs);
    if (activeDocId && idsToDelete.has(activeDocId)) setActiveDocId(null);
  };

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDocs(docs.map(d => d.id === id ? { ...d, expanded: !d.expanded } : d));
  };

  // Export Handler
  const handleExport = async () => {
    const activeDoc = docs.find(d => d.id === activeDocId);
    if (!activeDoc) return;
    
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activeDoc.title}</title><style>body { font-family: sans-serif; padding: 20px; line-height: 1.6; max-width: 800px; margin: 0 auto; } img { max-width: 100%; }</style></head><body><h1>${activeDoc.title}</h1>${activeDoc.content}</body></html>`;
    const file = new File([htmlContent], `${activeDoc.title}.html`, { type: 'text/html' });

    // Try Native Share (Mobile)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                files: [file],
                title: activeDoc.title,
                text: 'Designed by Game Planner Pro'
            });
            return;
        } catch (e) {
            // Share cancelled or failed, fallback to download
        }
    }

    // Fallback: Traditional Download
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scrollToHeading = (pos: number) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    editor.commands.setTextSelection(pos);
    const dom = editor.view.nodeDOM(pos);
    if (dom && dom instanceof HTMLElement) dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else {
      const domPos = editor.view.domAtPos(pos + 1);
      if (domPos.node instanceof HTMLElement) domPos.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (window.innerWidth < 768) setIsMobileMenuOpen(false);
  };

  // === AI Smart Insert (Fixes formatting issues) ===
  const handleAIInsert = (text: string, mode: 'replace' | 'insert') => {
    const editor = editorRef.current;
    if (!editor) return;

    // Smart conversion: If content looks like Markdown, manually parse structure
    // This solves the issue where changing one # makes the whole screen huge
    let contentToInsert = text;
    
    if (!text.trim().startsWith('<')) { 
        // Assume Markdown/Plain Text
        contentToInsert = text
            // Handle Headings
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            // Handle Bold
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            // Handle Newlines (wrap in P if not already HTML tag)
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
                if (line.trim().startsWith('<')) return line;
                return `<p>${line}</p>`;
            })
            .join('');
    }

    if (mode === 'replace') {
      editor.chain().focus().deleteSelection().insertContent(contentToInsert).run();
    } else {
      // Insert mode
      if (aiMode === 'generate') {
         editor.chain().focus().insertContent(contentToInsert).run();
      } else {
         // Insert below, ensure line break
         editor.chain().focus().insertContent(`<br>${contentToInsert}`).run();
      }
    }
    setAiMode(null);
  };

  const handleSelectDoc = (id: string) => {
      setActiveDocId(id);
      setIsMobileMenuOpen(false);
  };

  // === Recursive Tree Renderer ===
  const renderTree = (parentId: string | null, depth = 0) => {
    const items = docs.filter(d => (d.parentId || null) === parentId);
    if (items.length === 0) return null;

    return items.map(doc => {
      const hasChildren = docs.some(d => d.parentId === doc.id);
      const isActive = activeDocId === doc.id;

      return (
        <div key={doc.id}>
          <div 
            className={`flex items-center gap-2 py-3 md:py-1 px-2 rounded cursor-pointer group select-none transition-colors ${isActive ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => handleSelectDoc(doc.id)}
          >
            <span className={`p-1 rounded hover:bg-slate-700/50 ${hasChildren ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => { e.stopPropagation(); hasChildren && toggleExpand(e, doc.id); }}>
              {doc.expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            </span>
            {hasChildren ? <Folder size={16} className="text-yellow-500/80"/> : <FileText size={16} className="text-blue-400/80"/>}
            <span className="flex-1 truncate text-sm">{doc.title}</span>
            <div className="flex gap-2 md:gap-1 md:opacity-0 group-hover:opacity-100">
              <button onClick={(e) => { e.stopPropagation(); handleCreateClick(doc.id); }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"><Plus size={16} /></button>
              <button onClick={(e) => deleteDoc(e, doc.id)} className="p-1 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400"><Trash2 size={16} /></button>
            </div>
          </div>
          {isActive && headings.length > 0 && (
             <div className="flex flex-col mb-1 animate-in slide-in-from-left-2 duration-200 border-l border-slate-700/50 ml-4 my-1">
                {headings.map((h, idx) => (
                   <div key={idx} onClick={(e) => { e.stopPropagation(); scrollToHeading(h.pos); }} className="flex items-center gap-2 py-2 md:py-1 pr-2 rounded cursor-pointer hover:bg-slate-800 text-slate-500 hover:text-emerald-300 text-xs transition-colors" style={{ paddingLeft: `${depth * 12 + 24 + (h.level - 1) * 8}px` }}>
                     <Hash size={10} className="opacity-50 shrink-0" /><span className="truncate">{h.text}</span>
                   </div>
                ))}
             </div>
          )}
          {hasChildren && doc.expanded && renderTree(doc.id, depth + 1)}
        </div>
      );
    });
  };

  const activeDoc = docs.find(d => d.id === activeDocId);

  return (
    <div className="flex h-full w-full bg-slate-900 overflow-hidden relative">
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* === Sidebar === */}
      <div className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-700 flex flex-col shrink-0 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
          md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header with Safe Area handling */}
        <div 
            className="p-4 border-b border-slate-700 flex justify-between items-end md:items-center"
            style={{ 
                height: 'calc(3.5rem + env(safe-area-inset-top))', 
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: '0.75rem'
            }}
        >
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Documents</span>
          <div className="flex gap-2">
              <button onClick={() => handleCreateClick(null)} className="p-1 hover:bg-emerald-600/20 rounded text-slate-400 hover:text-emerald-400"><Plus size={18} /></button>
              <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-1 text-slate-400"><X size={18}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin pb-20 md:pb-2">
            {renderTree(null)}
        </div>
      </div>

      {/* === Main Editor Area === */}
      <div className="flex-1 flex flex-col bg-slate-900 min-w-0 w-full transition-all">
        {activeDoc ? (
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full h-full relative">
            <div className="flex items-center justify-between px-4 md:px-8 pt-4 md:pt-8 pb-4 mx-0 md:mx-8 border-b border-slate-800 gap-2">
              <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-white"><Menu size={20} /></button>
              <input value={activeDoc.title} onChange={(e) => updateDocTitle(activeDoc.id, e.target.value)} className="bg-transparent text-xl md:text-4xl font-bold text-white outline-none flex-1 min-w-0 placeholder-slate-700 truncate" placeholder="无标题"/>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setAiSelectedText(''); setAiMode('generate'); }} className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors text-xs md:text-sm font-bold shadow-lg shadow-purple-900/20"><Sparkles size={14} /> <span className="hidden md:inline">AI 写作</span><span className="md:hidden">AI</span></button>
                <button onClick={handleExport} className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 rounded transition-colors text-xs md:text-sm font-medium"><Share2 size={14} /><span className="hidden md:inline">导出</span></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 md:px-16 py-4 md:py-8">
              <TiptapEditor 
                docId={activeDoc.id} 
                initialContent={activeDoc.content} 
                onChange={(html: string) => updateDocContent(activeDoc.id, html)} 
                onHeadingsUpdate={setHeadings} 
                setEditorRef={(editor: any) => editorRef.current = editor} 
                onAIRequest={(mode: AIMode, text: string) => { setAiSelectedText(text); setAiMode(mode); }} 
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
             <div className="text-center">
                <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden mb-4 p-4 bg-slate-800 rounded-full animate-pulse"><Folder size={32} className="text-emerald-500" /></button>
                <FilePlus size={48} className="mx-auto mb-4 opacity-20 hidden md:block" />
                <p className="hidden md:block">选择一个文档，或者点击左侧 + 号创建</p>
                <p className="md:hidden text-sm">点击左上角图标打开文档列表</p>
             </div>
          </div>
        )}
      </div>

      {/* Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center backdrop-blur-sm px-4" onClick={() => setIsTemplateModalOpen(false)}>
           <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl w-full max-w-[500px]" onClick={e=>e.stopPropagation()}>
              <h3 className="text-white mb-4">选择模板</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{TEMPLATES.map(t=>(<div key={t.id} onClick={()=>createDocFromTemplate(t.id, targetParentId)} className="p-4 bg-slate-700 hover:bg-emerald-600 cursor-pointer rounded text-white text-center md:text-left">{t.name}</div>))}</div>
              <button onClick={() => setIsTemplateModalOpen(false)} className="mt-6 w-full py-2 text-slate-500 hover:text-slate-300 text-sm">取消</button>
           </div>
        </div>
      )}
      {/* AI Dialog */}
      {aiMode && <AIDialog mode={aiMode} selectedText={aiSelectedText} onInsert={handleAIInsert} onClose={() => setAiMode(null)} />}
    </div>
  );
}

// === Editor Component ===
function TiptapEditor({ docId, initialContent, onChange, setEditorRef, onAIRequest, onHeadingsUpdate }: any) {
  const onChangeRef = useRef(onChange);
  const prevHeadingsRef = useRef<string>(""); 

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // Extract headings for the outline view
  const extractHeadings = (editor: any) => {
    if (!onHeadingsUpdate) return;
    const headings: HeadingItem[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') headings.push({ level: node.attrs.level, text: node.textContent, id: `heading-${pos}`, pos: pos });
    });
    const headingsStr = JSON.stringify(headings.map(h => h.id + h.text));
    if (headingsStr !== prevHeadingsRef.current) { prevHeadingsRef.current = headingsStr; onHeadingsUpdate(headings); }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure headings to ensure Markdown shortcuts work and Outline extracts correctly
        heading: { levels: [1, 2, 3] }
      }),
      Placeholder.configure({ placeholder: '输入内容 (# 标题)...' }), 
      BubbleMenuExtension.configure({ pluginKey: 'bubbleMenu' })
    ],
    onUpdate: ({ editor }: { editor: any }) => { onChangeRef.current(editor.getHTML()); extractHeadings(editor); },
    onCreate: ({ editor }: { editor: any }) => { setEditorRef(editor); if (initialContent) editor.commands.setContent(initialContent); setTimeout(() => extractHeadings(editor), 100); },
    editorProps: { attributes: { class: 'prose prose-invert prose-lg max-w-none focus:outline-none min-h-[500px] text-base md:text-lg' } },
  }, []);

  const previousDocIdRef = useRef(docId);
  useEffect(() => {
    if (editor && docId !== previousDocIdRef.current) { editor.commands.setContent(initialContent || ''); previousDocIdRef.current = docId; setTimeout(() => extractHeadings(editor), 50); }
  }, [docId, editor, initialContent]);

  if (!editor) return null;

  return (
    <>
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }} className="flex gap-1 bg-slate-800 border border-slate-600 p-1 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 flex-wrap max-w-[90vw]">
          <button onClick={() => onAIRequest('rewrite', editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to))} className="flex items-center gap-1 px-2 py-1 text-xs text-slate-200 hover:bg-purple-600 hover:text-white rounded transition-colors"><Wand2 size={12} /> 润色</button>
          <button onClick={() => onAIRequest('expand', editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to))} className="flex items-center gap-1 px-2 py-1 text-xs text-slate-200 hover:bg-emerald-600 hover:text-white rounded transition-colors"><Expand size={12} /> 扩写</button>
          <button onClick={() => onAIRequest('summarize', editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to))} className="flex items-center gap-1 px-2 py-1 text-xs text-slate-200 hover:bg-blue-600 hover:text-white rounded transition-colors"><RefreshCcw size={12} /> 总结</button>
          <button onClick={() => onAIRequest('translate', editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to))} className="flex items-center gap-1 px-2 py-1 text-xs text-slate-200 hover:bg-orange-600 hover:text-white rounded transition-colors"><Languages size={12} /> 翻译</button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  );
}