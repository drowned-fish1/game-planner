import { useRef, useState } from 'react';
import Draggable from 'react-draggable';
import { UIComponent, InteractionType } from '../../utils/storage';
import { PixelSprite } from './PixelSprite';
import { UI_ASSETS } from './assets';
import { Move } from 'lucide-react';

interface UIComponentWrapperProps {
  component: UIComponent;
  isSelected: boolean;
  isMoving: boolean;
  scale: number;
  globalVars?: Record<string, number>; // 接收全局变量
  onUpdate: (id: string, updates: Partial<UIComponent>) => void;
  onSelect: (e: React.MouseEvent | MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent | MouseEvent) => void;
  onInteraction: (type: InteractionType, targetId?: string, param?: string) => void;
}

export function UIComponentWrapper({ 
  component, isSelected, isMoving, scale = 1, globalVars = {}, onUpdate, onSelect, onContextMenu, onInteraction 
}: UIComponentWrapperProps) {
  const nodeRef = useRef(null);
  const spriteConfig = UI_ASSETS.find(a => a.id === component.src);
  const componentScale = component.customScale || 1;
  const [toggleState, setToggleState] = useState(false);

  const displayW = component.width * componentScale;
  const displayH = component.height * componentScale;

  // === 真实条件解析器 ===
  const checkCondition = (conditionStr: string): boolean => {
    if (!conditionStr) return true;
    try {
      // 语法: "VAR OP VALUE" (例如: "HP > 0")
      const parts = conditionStr.trim().split(/\s+/);
      if (parts.length < 3) return false;

      const varName = parts[0];
      const op = parts[1];
      const targetVal = parseFloat(parts[2]);
      
      const currentVal = globalVars[varName] || 0; // 获取变量值，默认0

      switch(op) {
        case '==': return currentVal === targetVal;
        case '!=': return currentVal !== targetVal;
        case '>':  return currentVal > targetVal;
        case '<':  return currentVal < targetVal;
        case '>=': return currentVal >= targetVal;
        case '<=': return currentVal <= targetVal;
        default: return false;
      }
    } catch (e) {
      console.error("Condition parse error:", e);
      return false;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // 如果正在移动，不触发交互
    if (isMoving) return;
    
    // 如果是编辑选择模式，可以触发选中，但我们这里阻止冒泡
    // 注意：如果我们希望点击既能选中又能触发交互，这里需要权衡
    // 目前逻辑：非移动模式下，优先触发交互
    
    const { type, targetId, param } = component.interaction || { type: 'none' };
    
    if (type === 'none') return; // 无交互直接返回

    // 1. 本地逻辑
    if (type === 'toggle') setToggleState(!toggleState);
    if (type === 'increment') {
        // 数值增加也属于全局变量修改，上报给 UIManager
        onInteraction('increment', undefined, param || 'VAR'); 
    }

    // 2. 条件判断逻辑 (Trigger Condition)
    // 语法: 放在 param 里，格式 "条件 -> 目标页面ID"
    // 例如: "HP > 0" (如果满足，执行 targetId 的跳转)
    if (type === 'trigger_cond') {
        if (checkCondition(param || '')) {
            console.log("Condition Met! Navigating...");
            if (targetId) onInteraction('navigate', targetId);
        } else {
            console.log("Condition Failed.");
            // 可以加一个震动动画提示失败
        }
        return;
    }

    // 3. 通用上报 (跳转、弹窗)
    if (['navigate', 'open_modal', 'close_modal', 'back'].includes(type)) {
      onInteraction(type, targetId, param);
    }
  };

  const toggleClass = (component.interaction?.type === 'toggle' && !toggleState) ? 'brightness-50' : '';
  
  let borderClass = '';
  if (isMoving) {
    borderClass = 'ring-2 ring-emerald-400 ring-dashed cursor-move z-[999]';
  } else if (isSelected) {
    borderClass = 'ring-2 ring-purple-500 cursor-pointer';
  } else {
    // 只有有交互功能的才显示手型，否则显示默认
    borderClass = component.interaction?.type !== 'none' ? 'hover:ring-1 hover:ring-white/50 cursor-pointer' : '';
  }

  const opacity = component.state?.isDisabled ? 0.5 : 1;
  const displayStyle = component.state?.isVisible === false ? 'none' : 'block';

  const renderInteractionBadge = () => {
    const type = component.interaction?.type;
    if (!type || type === 'none') return null;
    const badges: Record<string, string> = {
      navigate: '跳转', open_modal: '弹窗', close_modal: '关闭',
      back: '返回', toggle: '开关', increment: '数值+', trigger_cond: '条件',
    };
    return (
      <div className={`absolute -top-2 -right-2 bg-slate-700 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm z-[200] pointer-events-none whitespace-nowrap border border-slate-500`}>
        {badges[type] || type}
      </div>
    );
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      position={{ x: component.x, y: component.y }}
      scale={scale}
      disabled={!isMoving} 
      onStop={(_, data) => {
        onUpdate(component.id, { x: data.x, y: data.y });
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(e); // 保持选中功能
      }}
    >
      <div 
        ref={nodeRef}
        onClick={handleClick}
        onContextMenu={(e) => { 
          e.preventDefault(); 
          e.stopPropagation(); 
          onContextMenu(e); 
        }}
        className={`absolute group transition-all active:scale-95 ${borderClass} ${toggleClass}`}
        style={{ 
          width: displayW, 
          height: displayH, 
          zIndex: isMoving ? 9999 : (component.zIndex || 1), 
          opacity: opacity,
          display: displayStyle
        }}
      >
        {isMoving && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <Move size={24} className="text-emerald-400 drop-shadow-md animate-pulse" />
          </div>
        )}

        {spriteConfig ? (
          <PixelSprite 
            config={spriteConfig} 
            scale={componentScale} 
            overrideW={component.width} 
            overrideH={component.height}
            className="w-full h-full block"
          />
        ) : (
          <div className="w-full h-full bg-red-500/50 border border-red-500 flex items-center justify-center text-xs text-white">Miss</div>
        )}
        
        {/* 显示绑定的变量值 (针对 increment 类型) */}
        {component.interaction?.type === 'increment' && (
          <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] text-xl pointer-events-none select-none">
            {globalVars?.[component.interaction.param || ''] || 0}
          </div>
        )}

        {!isMoving && renderInteractionBadge()}
        
        {!isMoving && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[200]">
            {component.name}
          </div>
        )}
      </div>
    </Draggable>
  );
}