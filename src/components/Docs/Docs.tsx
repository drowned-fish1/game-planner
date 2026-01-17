import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Folder, FileText, ChevronRight, ChevronDown, Plus, Trash2, Hash, Download, FilePlus } from 'lucide-react';
import { DocItem } from '../../utils/storage';

// === 模板数据 ===
const TEMPLATES = [
  {
    id: 'blank',
    name: '空白文档',
    content: ''
  },
  {
    id: 'gdd',
    name: 'GDD 游戏策划案',
    content: `
      <h1>游戏名称 (Project Name)</h1>
      <h2>1. 游戏概述</h2>
      <p><strong>核心概念：</strong>一句话描述这个游戏。</p>
      <p><strong>游戏类型：</strong>RPG / FPS / RTS...</p>
      <p><strong>目标用户：</strong>...</p>
      <h2>2. 游戏机制</h2>
      <h3>核心循环</h3>
      <p>玩家在游戏中主要做什么？</p>
      <h3>控制方式</h3>
      <p>键盘/手柄操作说明。</p>
      <h2>3. 故事背景</h2>
      <p>世界观与剧情大纲。</p>
      <h2>4. 角色与物品</h2>
      <p>主角、敌人、道具列表。</p>
    `
  },
  {
    id: 'level',
    name: '关卡设计模版',
    content: `
      <h1>关卡名称: [Level 1]</h1>
      <h2>1. 关卡目标</h2>
      <p>玩家需要达成什么条件通关？</p>
      <h2>2. 地图布局</h2>
      <p>这里可以插入地图草图。</p>
      <h2>3. 敌人配置</h2>
      <ul>
        <li>普通怪物: 3只</li>
        <li>精英怪: 1只</li>
      </ul>
      <h2>4. 掉落物品</h2>
      <p>宝箱位置与奖励。</p>
    `
  },
  {
    id: 'char',
    name: '角色设定卡',
    content: `
      <h1>角色名: [Name]</h1>
      <h2>1. 基本信息</h2>
      <ul>
        <li><strong>年龄:</strong> 18</li>
        <li><strong>职业:</strong> 剑士</li>
        <li><strong>性格:</strong> 热血</li>
      </ul>
      <h2>2. 背景故事</h2>
      <p>角色的生平经历...</p>
      <h2>3. 技能列表</h2>
      <ul>
        <li><strong>技能Q:</strong> 描述...</li>
        <li><strong>技能E:</strong> 描述...</li>
        <li><strong>大招R:</strong> 描述...</li>
      </ul>
    `
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
  const [docs, setDocs] = useState<DocItem[]>(initialDocs);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [headings, setHeadings] = useState<HeadingItem[]>([]);
  const editorRef = useRef<any>(null);

  // 模板弹窗状态
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [targetParentId, setTargetParentId] = useState<string | null>(null);

  useEffect(() => {
    if (initialDocs.length === 0) {
      // 默认创建一个 GDD
      createDocFromTemplate('gdd', null);
    } else if (!activeDocId && initialDocs.length > 0) {
      setActiveDocId(initialDocs[0].id);
    }
  }, []);

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

  // 打开创建菜单
  const handleCreateClick = (parentId: string | null) => {
    setTargetParentId(parentId);
    setIsTemplateModalOpen(true);
  };

  // 真正的创建逻辑
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
    if (parentId) {
      // 展开父节点
      newDocs = newDocs.map(d => d.id === parentId ? { ...d, expanded: true } : d);
    }
    
    setDocs(newDocs);
    onUpdate(newDocs);
    setActiveDocId(newDoc.id);
    setIsTemplateModalOpen(false); // 关闭弹窗
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

  const scrollToHeading = (pos: number) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    editor.commands.setTextSelection(pos);
    const dom = editor.view.nodeDOM(pos);
    if (dom && dom instanceof HTMLElement) {
      dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      const domPos = editor.view.domAtPos(pos + 1);
      if (domPos.node && domPos.node instanceof HTMLElement) {
        domPos.node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (domPos.node.parentElement) {
        domPos.node.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const exportDoc = () => {
    const activeDoc = docs.find(d => d.id === activeDocId);
    if (!activeDoc) return;
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${activeDoc.title}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
          h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
          h2 { margin-top: 30px; border-left: 4px solid #10b981; padding-left: 10px; }
          blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 16px; color: #666; }
          pre { background: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
          img { max-width: 100%; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>${activeDoc.title}</h1>
        ${activeDoc.content}
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderTree = (parentId: string | null, depth = 0) => {
    const items = docs.filter(d => d.parentId === parentId);
    if (items.length === 0) return null;

    return items.map(doc => {
      const hasChildren = docs.some(d => d.parentId === doc.id);
      const isActive = activeDocId === doc.id;

      return (
        <div key={doc.id}>
          <div 
            className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer group select-none ${isActive ? 'bg-emerald-600/20 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => setActiveDocId(doc.id)}
          >
            <span className={`p-0.5 rounded hover:bg-slate-700/50 ${hasChildren ? 'opacity-100' : 'opacity-0'}`} onClick={(e) => hasChildren && toggleExpand(e, doc.id)}>
              {doc.expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
            </span>
            {hasChildren ? <Folder size={16} className="text-yellow-500/80"/> : <FileText size={16} className="text-blue-400/80"/>}
            <span className="flex-1 truncate text-sm">{doc.title}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100">
              <button onClick={(e) => { e.stopPropagation(); handleCreateClick(doc.id); }} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="新建子页"><Plus size={12} /></button>
              <button onClick={(e) => deleteDoc(e, doc.id)} className="p-1 hover:bg-red-900/50 rounded text-slate-400 hover:text-red-400" title="删除"><Trash2 size={12} /></button>
            </div>
          </div>
          
          {isActive && headings.length > 0 && (
             <div className="flex flex-col mb-1 animate-in slide-in-from-left-2 duration-200 border-l border-slate-700/50 ml-4 my-1">
                {headings.map((h, idx) => (
                   <div 
                     key={idx}
                     onClick={(e) => { e.stopPropagation(); scrollToHeading(h.pos); }}
                     className="flex items-center gap-2 py-1 pr-2 rounded cursor-pointer hover:bg-slate-800 text-slate-500 hover:text-emerald-300 text-xs transition-colors"
                     style={{ paddingLeft: `${depth * 12 + 24 + (h.level - 1) * 8}px` }}
                   >
                     <Hash size={10} className="opacity-50 shrink-0" />
                     <span className="truncate">{h.text}</span>
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
      {/* 左侧目录 */}
      <div className="w-64 bg-slate-800/50 border-r border-slate-700 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Documents</span>
          <button onClick={() => handleCreateClick(null)} className="p-1 hover:bg-emerald-600/20 rounded text-slate-400 hover:text-emerald-400"><Plus size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {renderTree(null)}
        </div>
      </div>

      {/* 右侧编辑器 */}
      <div className="flex-1 flex flex-col bg-slate-900 min-w-0">
        {activeDoc ? (
          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full h-full relative">
            <div className="flex items-center justify-between px-8 pt-8 pb-4 mx-8 border-b border-slate-800">
              <input 
                value={activeDoc.title}
                onChange={(e) => updateDocTitle(activeDoc.id, e.target.value)}
                className="bg-transparent text-4xl font-bold text-white outline-none flex-1 mr-4 placeholder-slate-700"
                placeholder="无标题"
              />
              <button 
                onClick={exportDoc}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 rounded transition-colors text-sm font-medium"
              >
                <Download size={16} />
                <span>导出</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-16 py-8">
              <TiptapEditor 
                key={activeDoc.id} 
                initialContent={activeDoc.content}
                onChange={(html: string) => updateDocContent(activeDoc.id, html)}
                onHeadingsUpdate={setHeadings}
                setEditorRef={(editor: any) => editorRef.current = editor} 
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
            <div className="text-center">
              <FilePlus size={48} className="mx-auto mb-4 opacity-20" />
              <p>选择一个文档，或者点击左侧 + 号创建</p>
            </div>
          </div>
        )}
      </div>

      {/* === 模板选择弹窗 === */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center backdrop-blur-sm" onClick={() => setIsTemplateModalOpen(false)}>
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl w-[500px] shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-4">选择一个模板开始</h3>
            <div className="grid grid-cols-2 gap-4">
              {TEMPLATES.map(t => (
                <div 
                  key={t.id}
                  onClick={() => createDocFromTemplate(t.id, targetParentId)}
                  className="bg-slate-700/50 hover:bg-emerald-600/20 border border-slate-600 hover:border-emerald-500/50 p-4 rounded-lg cursor-pointer transition-all group"
                >
                  <div className="font-bold text-slate-200 group-hover:text-emerald-400 mb-1">{t.name}</div>
                  <div className="text-xs text-slate-500 group-hover:text-slate-400">点击创建此类型的文档</div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setIsTemplateModalOpen(false)}
              className="mt-6 w-full py-2 text-slate-500 hover:text-slate-300 text-sm"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TiptapEditor({ initialContent, onChange, onHeadingsUpdate, setEditorRef }: any) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '输入 # 号加空格创建标题...' }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      extractHeadings(editor);
    },
    onCreate: ({ editor }) => {
      setEditorRef(editor);
      setTimeout(() => extractHeadings(editor), 100);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-lg max-w-none focus:outline-none min-h-[500px]',
      },
    },
  });

  const extractHeadings = (editor: any) => {
    const headings: HeadingItem[] = [];
    editor.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        headings.push({
          level: node.attrs.level,
          text: node.textContent,
          id: `heading-${pos}`,
          pos: pos 
        });
      }
    });
    onHeadingsUpdate(headings);
  };

  return <EditorContent editor={editor} />;
}
