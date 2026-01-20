// src/components/UIPrototype/UIComponentWrapper.tsx
import { useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { UIComponent, InteractionType, CustomAsset } from '../../utils/storage';
import { PixelSprite } from './PixelSprite';
import { Move } from 'lucide-react';

interface UIComponentWrapperProps {
  component: UIComponent;
  // 新增：直接传入查找好的配置，避免 Wrapper 依赖 assets 文件
  assetConfig?: CustomAsset; 
  isSelected: boolean;
  isMoving: boolean;
  scale: number;
  globalVars?: Record<string, number>;
  onUpdate: (id: string, updates: Partial<UIComponent>) => void;
  onSelect: (e: React.MouseEvent | MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent | MouseEvent) => void;
  onInteraction: (type: InteractionType, targetId?: string, param?: string) => void;
}

export function UIComponentWrapper({ 
  component, 
  assetConfig, // 接收
  isSelected, isMoving, scale = 1, globalVars = {}, 
  onUpdate, onSelect, onContextMenu, onInteraction 
}: UIComponentWrapperProps) {
  const nodeRef = useRef(null);
  const componentScale = component.customScale || 1;
  const [toggleState, setToggleState] = useState(false);

  const displayW = component.width * componentScale;
  const displayH = component.height * componentScale;

  const checkCondition = (conditionStr: string): boolean => {
    if (!conditionStr) return true;
    try {
      const parts = conditionStr.trim().split(/\s+/);
      if (parts.length < 3) return false;
      const varName = parts[0];
      const op = parts[1];
      const targetVal = parseFloat(parts[2]);
      const currentVal = globalVars[varName] || 0;
      switch(op) {
        case '==': return currentVal === targetVal;
        case '!=': return currentVal !== targetVal;
        case '>':  return currentVal > targetVal;
        case '<':  return currentVal < targetVal;
        case '>=': return currentVal >= targetVal;
        case '<=': return currentVal <= targetVal;
        default: return false;
      }
    } catch (e) { return false; }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isMoving) return;
    const { type, targetId, param } = component.interaction || { type: 'none' };
    if (type === 'none') return; 

    if (type === 'toggle') setToggleState(!toggleState);
    if (type === 'increment') onInteraction('increment', undefined, param || 'VAR'); 

    if (type === 'trigger_cond') {
        if (checkCondition(param || '')) {
            if (targetId) onInteraction('navigate', targetId);
        }
        return;
    }
    if (['navigate', 'open_modal', 'close_modal', 'back'].includes(type)) {
      onInteraction(type, targetId, param);
    }
  };

  const toggleClass = (component.interaction?.type === 'toggle' && !toggleState) ? 'brightness-50' : '';
  let borderClass = '';
  if (isMoving) borderClass = 'ring-2 ring-emerald-400 ring-dashed cursor-move z-[999]';
  else if (isSelected) borderClass = 'ring-2 ring-purple-500 cursor-pointer';
  else borderClass = component.interaction?.type !== 'none' ? 'hover:ring-1 hover:ring-white/50 cursor-pointer' : '';

  const opacity = component.state?.isDisabled ? 0.5 : 1;
  const displayStyle = component.state?.isVisible === false ? 'none' : 'block';

  return (
    <Draggable
      nodeRef={nodeRef}
      position={{ x: component.x, y: component.y }}
      scale={scale}
      disabled={!isMoving} 
      onStop={(_, data) => onUpdate(component.id, { x: data.x, y: data.y })}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(e); }}
    >
      <div 
        ref={nodeRef}
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e); }}
        className={`absolute group transition-all active:scale-95 ${borderClass} ${toggleClass}`}
        style={{ width: displayW, height: displayH, zIndex: isMoving ? 9999 : (component.zIndex || 1), opacity: opacity, display: displayStyle }}
      >
        {isMoving && <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"><Move size={24} className="text-emerald-400 drop-shadow-md animate-pulse" /></div>}

        {/* 使用传入的 assetConfig 渲染 */}
        {assetConfig ? (
          <PixelSprite 
            config={assetConfig} 
            scale={componentScale} 
            overrideW={component.width} 
            overrideH={component.height}
            className="w-full h-full block"
          />
        ) : (
          <div className="w-full h-full bg-red-500/50 border border-red-500 flex items-center justify-center text-xs text-white overflow-hidden">
             {component.name}
          </div>
        )}
        
        {component.interaction?.type === 'increment' && (
          <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-xl pointer-events-none select-none">
            {globalVars?.[component.interaction.param || ''] || 0}
          </div>
        )}

        {!isMoving && component.interaction?.type !== 'none' && (
           <div className="absolute -top-2 -right-2 bg-slate-700 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm z-[200] pointer-events-none border border-slate-500">
             {component.interaction?.type}
           </div>
        )}
      </div>
    </Draggable>
  );
}