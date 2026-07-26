// 白板画布的纯几何逻辑：框选矩形、碰撞（命中）检测、对齐吸附。
// 与 React/DOM 解耦，行为与 Board.tsx 原实现逐行等价，便于单测。

export interface BoardRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GeometryItem {
  id: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface Point {
  x: number;
  y: number;
}

export const DEFAULT_ITEM_WIDTH = 200;
export const DEFAULT_ITEM_HEIGHT = 150;
/** 对齐吸附阈值（画布单位） */
export const SNAP_DISTANCE = 8;

/** 由框选起点与当前点得到规范化矩形（支持任意方向拖拽） */
export function marqueeRectFrom(start: Point, current: Point): BoardRect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  };
}

/** 框选命中检测：与矩形（由两个对角点定义）相交的磁贴 id 列表 */
export function itemsIntersectingRect(items: GeometryItem[], cornerA: Point, cornerB: Point): string[] {
  const rx1 = Math.min(cornerA.x, cornerB.x);
  const ry1 = Math.min(cornerA.y, cornerB.y);
  const rx2 = Math.max(cornerA.x, cornerB.x);
  const ry2 = Math.max(cornerA.y, cornerB.y);

  return items
    .filter((item) => {
      const w = item.width ?? DEFAULT_ITEM_WIDTH;
      const h = item.height ?? DEFAULT_ITEM_HEIGHT;
      return item.x < rx2 && item.x + w > rx1 && item.y < ry2 && item.y + h > ry1;
    })
    .map((item) => item.id);
}

/**
 * 对齐吸附：被拖磁贴接近其他磁贴的左/中/右、上/中/下对齐线（阈值内）时吸附。
 * excludeIds（多选整组拖动时的组内成员）不作为吸附参照物。
 * x、y 两轴各自取距离最近的候选；等于阈值时不吸附（与原实现的 < 判断一致）。
 */
export function snapDraggedPosition(
  dragged: GeometryItem,
  rawX: number,
  rawY: number,
  others: GeometryItem[],
  excludeIds: Set<string> | null = null,
  snapDistance: number = SNAP_DISTANCE,
): Point {
  const w = dragged.width ?? DEFAULT_ITEM_WIDTH;
  const h = dragged.height ?? DEFAULT_ITEM_HEIGHT;
  let nx = rawX;
  let ny = rawY;
  let bestXDist = snapDistance;
  let bestYDist = snapDistance;

  for (const other of others) {
    if (other.id === dragged.id || (excludeIds && excludeIds.has(other.id))) continue;
    const ow = other.width ?? DEFAULT_ITEM_WIDTH;
    const oh = other.height ?? DEFAULT_ITEM_HEIGHT;
    for (const cx of [other.x, other.x + ow / 2 - w / 2, other.x + ow - w]) {
      const d = Math.abs(rawX - cx);
      if (d < bestXDist) { bestXDist = d; nx = cx; }
    }
    for (const cy of [other.y, other.y + oh / 2 - h / 2, other.y + oh - h]) {
      const d = Math.abs(rawY - cy);
      if (d < bestYDist) { bestYDist = d; ny = cy; }
    }
  }

  return { x: nx, y: ny };
}
