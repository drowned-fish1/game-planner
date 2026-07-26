import { useState } from 'react';
import { X, Upload, Save, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { CustomAsset } from '../../utils/storage';

interface AssetEditorModalProps {
  onSave: (asset: CustomAsset) => void;
  onClose: () => void;
}

export function AssetEditorModal({ onSave, onClose }: AssetEditorModalProps) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [label, setLabel] = useState('新资产');
  
  // 切片坐标与尺寸
  const [sx, setSx] = useState(0);
  const [sy, setSy] = useState(0);
  const [sw, setSw] = useState(64);
  const [sh, setSh] = useState(64);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setImageUrl(result);
        // 图片加载后，尝试自动设置宽高为图片原始尺寸的合理值
        const img = new Image();
        img.onload = () => {
            setSw(img.width > 200 ? 100 : img.width);
            setSh(img.height > 200 ? 100 : img.height);
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (!imageUrl) return;
    const newAsset: CustomAsset = {
      id: `custom_${uuidv4().slice(0, 8)}`,
      label,
      imageUrl, // 保存 Base64
      x: Number(sx), y: Number(sy), w: Number(sw), h: Number(sh)
    };
    onSave(newAsset);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center" onClick={onClose}>
      <div className="bg-surface w-[900px] h-[600px] rounded-xl border border-line flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-line bg-bg">
          <h3 className="text-content font-bold flex items-center gap-2">
            <ImageIcon className="text-iris-500" size={20}/> 
            资产切片编辑器 (Asset Slicer)
          </h3>
          <button onClick={onClose} className="text-muted hover:text-content" title="关闭" aria-label="关闭资产编辑器"><X size={20} /></button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：可视化切片区 */}
          <div className="flex-1 bg-[#1a1a1a] p-8 overflow-auto flex items-center justify-center relative pattern-grid">
             {imageUrl ? (
               <div className="relative inline-block shadow-2xl border border-line-strong bg-surface">
                 {/* 源图片 */}
                 <img src={imageUrl} className="max-w-none block" style={{ imageRendering: 'pixelated' }} alt="Source" draggable={false} />
                 
                 {/* 红色切片框 (绝对定位) */}
                 <div 
                    className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none transition-all duration-75"
                    style={{ left: sx, top: sy, width: sw, height: sh }}
                 >
                    <div className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] px-1 rounded font-mono whitespace-nowrap">
                        x:{sx}, y:{sy}, {sw}x{sh}
                    </div>
                 </div>
               </div>
             ) : (
               <div className="text-subtle flex flex-col items-center gap-2">
                 <ImageIcon size={48} className="opacity-20" />
                 <p>请先在右侧上传一张图片</p>
               </div>
             )}
          </div>

          {/* 右侧：控制面板 */}
          <div className="w-80 bg-bg border-l border-line p-6 flex flex-col gap-6 overflow-y-auto">
            
            {/* 1. 图片来源 */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-muted uppercase flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-surface-3 text-content flex items-center justify-center text-[10px]">1</span> 
                  图片来源
              </label>
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-line hover:border-brand-500 hover:bg-surface rounded-lg cursor-pointer transition-all group">
                  <Upload size={24} className="text-subtle group-hover:text-brand-400 mb-2" />
                  <span className="text-xs text-muted group-hover:text-content">点击上传图片</span>
                  <input type="file" onChange={handleFileChange} className="hidden" accept="image/*" />
              </label>
            </div>

            {/* 2. 切片参数 */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-brand-500 uppercase flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-brand-900 text-brand-400 flex items-center justify-center text-[10px]">2</span> 
                  定义切片 (Source Rect)
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <span className="text-[10px] text-subtle font-mono">X (起点)</span>
                    <input type="number" value={sx} onChange={e => setSx(Number(e.target.value))} className="w-full bg-surface border border-line-strong rounded px-2 py-1.5 text-content text-sm font-mono focus:border-brand-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] text-subtle font-mono">Y (起点)</span>
                    <input type="number" value={sy} onChange={e => setSy(Number(e.target.value))} className="w-full bg-surface border border-line-strong rounded px-2 py-1.5 text-content text-sm font-mono focus:border-brand-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] text-subtle font-mono">Width (宽)</span>
                    <input type="number" value={sw} onChange={e => setSw(Number(e.target.value))} className="w-full bg-surface border border-line-strong rounded px-2 py-1.5 text-content text-sm font-mono focus:border-brand-500 outline-none" />
                </div>
                <div className="space-y-1">
                    <span className="text-[10px] text-subtle font-mono">Height (高)</span>
                    <input type="number" value={sh} onChange={e => setSh(Number(e.target.value))} className="w-full bg-surface border border-line-strong rounded px-2 py-1.5 text-content text-sm font-mono focus:border-brand-500 outline-none" />
                </div>
              </div>

              <div className="text-[10px] text-subtle leading-tight">
                 调整上方数值，红框会对应移动。只有红框内的区域会被保存为资产。
              </div>
            </div>

            {/* 3. 保存 */}
            <div className="space-y-3 pt-4 border-t border-line mt-auto">
               <label className="text-xs font-bold text-muted uppercase">资产命名</label>
               <input value={label} onChange={e => setLabel(e.target.value)} className="w-full bg-surface border border-line-strong rounded px-3 py-2 text-content text-sm focus:border-iris-500 outline-none" placeholder="例如：红色按钮" />
               
               <button onClick={handleSave} disabled={!imageUrl} className="w-full bg-iris-600 hover:bg-iris-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg shadow-iris-700/20 transition-all active:scale-95">
                  <Save size={16} /> 保存到资产库
               </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}