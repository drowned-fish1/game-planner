import { SpriteConfig } from './PixelSprite';

// 这里填入你测量的数据
// 格式：{ id: '唯一ID', x: 0, y: 0, w: 宽, h: 高, label: '展示名' }

export const UI_ASSETS: SpriteConfig[] = [
  // === 示例数据（你需要根据你的图修改这些数字）===
  
  // 1. 蓝色按钮
  { id: 'btn_blue_normal', x: 0, y: 16, w: 16, h: 16, label: '蓝色按钮' },
  
  // 2. 红色按钮 (假设它在蓝色按钮右边)
  { id: 'btn_red_normal', x: 50, y: 0, w: 48, h: 16, label: '红色按钮' },
  
  // 3. 大面板背景 (假设在大图下面)
  { id: 'panel_bg', x: 0, y: 32, w: 96, h: 96, label: '基础面板' },
  
  // 4. 血条空槽
  { id: 'bar_empty', x: 100, y: 0, w: 64, h: 10, label: '血条底' },
  
  // 5. 血条满槽
  { id: 'bar_full', x: 100, y: 12, w: 64, h: 10, label: '血条红' },
  { id: 'Play', x:160 , y: 16, w: 115, h: 33, label: '游玩' },
  { id: 'setting', x:128 , y: 16, w: 16, h: 16, label: '设置' },
];