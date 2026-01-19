import React, { useRef, useEffect } from 'react';

export interface SpriteConfig {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

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

    // 创建图片对象加载精灵图
    const img = new Image();
    img.src = '/assets/ui-sprites.png'; // 确保你的图片路径正确
    
    img.onload = () => {
      // 1. 设置画布尺寸（基于缩放后的尺寸）
      // 这里的 override 允许你在设置页面手动修改最终显示的宽高
      const finalW = (overrideW || config.w) * scale;
      const finalH = (overrideH || config.h) * scale;
      
      canvas.width = finalW;
      canvas.height = finalH;

      // 2. 关闭抗锯齿（像素风核心）
      ctx.imageSmoothingEnabled = false;

      // 3. 绘图：从源图的 (x,y) 截取 (w,h)，画到画布的 (0,0) 并缩放到 (finalW, finalH)
      // drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
      ctx.drawImage(
        img,
        config.x,        // 源图 X
        config.y,        // 源图 Y
        config.w,        // 源图 W (截取多少)
        config.h,        // 源图 H
        0,               // 画布 X
        0,               // 画布 Y
        finalW,          // 画布 W (画多大)
        finalH           // 画布 H
      );
    };
  }, [config, scale, overrideW, overrideH]); // 当配置变动时重绘

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      className={`inline-block ${className}`}
      style={{
        // 确保 canvas 作为一个块级元素被正确布局
        display: 'block',
        pointerEvents: 'none', // 让点击穿透给父级处理选中
      }}
      title={config.label}
    />
  );
};