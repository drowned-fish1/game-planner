// src/components/UIPrototype/PixelSprite.tsx
import React, { useRef, useEffect } from 'react';
import { CustomAsset } from '../../utils/storage';

// 兼容类型：我们的配置既可能是 CustomAsset，也可能来自 assets.ts
export type SpriteConfig = CustomAsset;

interface PixelSpriteProps {
  config: SpriteConfig;
  scale?: number;     // 视觉缩放倍率
  className?: string;
  onClick?: () => void;
  overrideW?: number; // 允许外部覆盖宽度 (用于微调)
  overrideH?: number; // 允许外部覆盖高度
}

export const PixelSprite: React.FC<PixelSpriteProps> = ({ 
  config, 
  scale = 1, 
  className = '', 
  onClick,
  overrideW,
  overrideH
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    // === 核心修改：优先使用 config 中的 imageUrl ===
    // 如果 config.imageUrl 存在（用户上传的），用它；否则用默认 assets 图
    img.src = config.imageUrl || './assets/ui-sprites.png';
    
    img.onload = () => {
      // 计算最终在画布上的尺寸
      const finalW = (overrideW || config.w) * scale;
      const finalH = (overrideH || config.h) * scale;
      
      canvas.width = finalW;
      canvas.height = finalH;

      // 关闭抗锯齿（像素风核心）
      ctx.imageSmoothingEnabled = false;

      // 绘图：从源图 (x,y,w,h) -> 画布 (0,0,finalW,finalH)
      ctx.drawImage(
        img,
        config.x,        
        config.y,        
        config.w,        
        config.h,        
        0,               
        0,               
        finalW,          
        finalH           
      );
    };
  }, [config, scale, overrideW, overrideH]); 

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      className={`inline-block ${className}`}
      style={{
        display: 'block',
        pointerEvents: 'none', // 让点击事件穿透给父级 Wrapper 处理
      }}
      title={config.label}
    />
  );
};