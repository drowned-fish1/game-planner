// 主题管理：html 根元素切 .light 类，默认深色，偏好存 localStorage
export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'gp_theme';

export const getTheme = (): ThemeMode => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
};

export const applyTheme = (mode: ThemeMode) => {
  const root = document.documentElement;
  // 切换瞬间禁用全部过渡，防止 transition:all 元素卡在旧主题颜色的插值上。
  // 中间的强制重排保证「禁过渡 + 新主题」作为一次完整样式重算落地，
  // 否则加类/移类可能被浏览器合并进同一次重算而失去抑制效果。
  root.classList.add('theme-switching');
  root.classList.toggle('light', mode === 'light');
  void document.body.offsetWidth;
  root.classList.remove('theme-switching');
};

export const setTheme = (mode: ThemeMode) => {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage 不可用时仅本次会话生效
  }
  applyTheme(mode);
};

/** 应用启动时调用一次 */
export const initTheme = () => {
  applyTheme(getTheme());
};
