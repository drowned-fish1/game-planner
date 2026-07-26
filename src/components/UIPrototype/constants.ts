// UI 原型机的画布配色。
// 刻意使用中性纯灰（不走应用的设计令牌），像剪辑台一样避免品牌色干扰用户正在设计的界面配色。
// 页面/弹窗默认底色会写入用户数据（UIPage.backgroundColor），修改只影响新建页面。

/** 原型编辑器外壳背景（工具区） */
export const PROTOTYPE_SHELL_BG = '#121212';
/** 画布滚动区背景（比外壳更深，突出页面） */
export const PROTOTYPE_CANVAS_BG = '#0f0f0f';
/** 新建普通页面的默认底色 */
export const DEFAULT_PAGE_BG = '#1e1e1e';
/** 新建弹窗类页面的默认底色 */
export const DEFAULT_MODAL_BG = '#2a2a2a';
/** 弹窗预览描边色 */
export const MODAL_PREVIEW_BORDER = '#444444';
