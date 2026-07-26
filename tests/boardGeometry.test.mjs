import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { loadSourceModule } from './helpers/vite-loader.mjs';

let geo;

before(async () => {
  globalThis.window = { electronAPI: undefined, location: { protocol: 'http:' } };
  geo = await loadSourceModule('/src/components/Brainstorm/boardGeometry.ts');
});

describe('marqueeRectFrom', () => {
  test('normalizes any drag direction into a positive rect', () => {
    assert.deepEqual(geo.marqueeRectFrom({ x: 10, y: 20 }, { x: 110, y: 80 }), { x: 10, y: 20, w: 100, h: 60 });
    // 反向拖拽（右下 → 左上）
    assert.deepEqual(geo.marqueeRectFrom({ x: 110, y: 80 }, { x: 10, y: 20 }), { x: 10, y: 20, w: 100, h: 60 });
    // 零尺寸
    assert.deepEqual(geo.marqueeRectFrom({ x: 5, y: 5 }, { x: 5, y: 5 }), { x: 5, y: 5, w: 0, h: 0 });
  });
});

describe('itemsIntersectingRect（框选碰撞）', () => {
  const items = [
    { id: 'inside', x: 100, y: 100, width: 50, height: 50 },
    { id: 'partial', x: 190, y: 100, width: 50, height: 50 },
    { id: 'outside', x: 400, y: 400, width: 50, height: 50 },
    { id: 'default-size', x: 150, y: 150 }, // 未给尺寸 → 200x150 默认
  ];

  test('hits fully contained and partially overlapping items', () => {
    const hit = geo.itemsIntersectingRect(items, { x: 90, y: 90 }, { x: 200, y: 200 });
    assert.deepEqual(hit.sort(), ['default-size', 'inside', 'partial']);
  });

  test('corner order does not matter', () => {
    const a = geo.itemsIntersectingRect(items, { x: 200, y: 200 }, { x: 90, y: 90 });
    const b = geo.itemsIntersectingRect(items, { x: 90, y: 90 }, { x: 200, y: 200 });
    assert.deepEqual(a.sort(), b.sort());
  });

  test('edge-touching item is NOT selected (strict inequality)', () => {
    // 矩形右边界 = item.x：item.x < rx2 为 false
    const hit = geo.itemsIntersectingRect(items, { x: 0, y: 0 }, { x: 100, y: 100 });
    assert.deepEqual(hit, []);
  });

  test('uses 200x150 defaults when item has no explicit size', () => {
    // default-size 磁贴覆盖 [150,350]x[150,300]；选框只碰它的右下角区域
    const hit = geo.itemsIntersectingRect(items, { x: 340, y: 290 }, { x: 360, y: 310 });
    assert.deepEqual(hit, ['default-size']);
  });
});

describe('snapDraggedPosition（对齐吸附）', () => {
  const anchor = { id: 'anchor', x: 540, y: 300, width: 200, height: 150 };
  const dragged = { id: 'drag', x: 0, y: 0, width: 200, height: 150 };

  test('snaps x to the left edge within threshold, keeps y untouched', () => {
    const pos = geo.snapDraggedPosition(dragged, 545, 380, [anchor, dragged]);
    assert.equal(pos.x, 540);
    assert.equal(pos.y, 380);
  });

  test('no snap at exactly the threshold distance (strict <)', () => {
    const pos = geo.snapDraggedPosition(dragged, 548, 380, [anchor, dragged]);
    assert.equal(pos.x, 548);
  });

  test('snaps to center and right alignment lines', () => {
    // 不同宽度：dragged w=100，anchor w=200 → 中线候选 540+100-50=590，右线候选 540+200-100=640
    const narrow = { ...dragged, width: 100 };
    assert.equal(geo.snapDraggedPosition(narrow, 587, 0, [anchor]).x, 590);
    assert.equal(geo.snapDraggedPosition(narrow, 643, 0, [anchor]).x, 640);
  });

  test('picks the nearest candidate when multiple are in range', () => {
    const a = { id: 'a', x: 100, y: 0, width: 200, height: 150 };
    const b = { id: 'b', x: 106, y: 500, width: 200, height: 150 };
    // rawX=103：距 a.x=100 3px、距 b.x=106 3px…改 rawX=104：距 a 4、距 b 2 → 吸到 106
    assert.equal(geo.snapDraggedPosition(dragged, 104, 900, [a, b]).x, 106);
  });

  test('y snaps independently to top/middle/bottom lines', () => {
    const pos = geo.snapDraggedPosition(dragged, 900, 305, [anchor]);
    assert.equal(pos.x, 900);
    assert.equal(pos.y, 300);
  });

  test('excludes itself and group members (multi-select drag)', () => {
    const groupMate = { id: 'mate', x: 700, y: 700, width: 200, height: 150 };
    const exclude = new Set(['mate']);
    // groupMate 在阈值内但被排除 → 不吸附
    const pos = geo.snapDraggedPosition(dragged, 702, 702, [anchor, dragged, groupMate], exclude);
    assert.equal(pos.x, 702);
    assert.equal(pos.y, 702);
  });

  test('no reference items → raw position unchanged', () => {
    assert.deepEqual(geo.snapDraggedPosition(dragged, 42, 24, [dragged]), { x: 42, y: 24 });
  });
});
