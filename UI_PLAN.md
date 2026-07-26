# Game Planner Pro — UI 优化与后续开发计划

> 交接文档。给本地 Claude Code / 开发者：请**遵守第 2 节的设计系统约定**，然后按第 4 节的路线图一轮一轮迭代，每轮改动后跑第 5 节的校验命令再提交。

---

## 0. 如何使用本文件（给 Claude Code 的说明）

- 每次只做一个「迭代」（第 4 节里的一个条目），改完 → `npm run build`（真正的类型检查在这里）→ 自测 → 提交。
- **不要**破坏第 2 节的令牌体系；新代码一律用语义令牌和组件原语，不要再写死 `slate-*` / `emerald-*`。
- 涉及网络/协作（`src/utils/collaboration.ts`、`electron/`）的改动风险高，改前先本地联机自测。
- 文案是中文，保持一致。

---

## 1. 项目现状

- 技术栈：Electron + React 18 + TypeScript + Vite + TailwindCSS 3 + Capacitor（安卓）。TipTap 富文本、@xyflow、react-draggable/resizable 等。
- 入口：`src/main.tsx` → `<ErrorBoundary><App/></ErrorBoundary>` + `<Toaster/>` + `<ConfirmHost/>`。
- 主要模块（`src/components/`）：
  - `Dashboard/` 项目大厅
  - `Brainstorm/` 灵感白板（`Board.tsx` 深色画布；`NoteCard.tsx` **浅色便签**）
  - `Team/` 房间联机 + 待办
  - `Docs/` 策划文档（TipTap）
  - `UIPrototype/` UI 原型机
  - `Settings/` AI 配置
- 数据：`src/utils/storage.ts`（Electron 走 IPC 存硬盘，浏览器走 localStorage）。

---

## 2. 设计系统约定（务必遵守）

### 2.1 颜色令牌（定义于 `src/index.css` 的 `:root`，映射在 `tailwind.config.js`）

| 语义类               | 用途                     |
|----------------------|--------------------------|
| `bg`                 | 应用最底层背景           |
| `surface`            | 面板 / 卡片              |
| `surface-2`          | 抬升面板                 |
| `surface-3`          | 悬浮 / 更亮的块          |
| `line`               | 默认描边                 |
| `line-strong`        | 强调描边                 |
| `content`            | 主文字                   |
| `muted`              | 次要文字                 |
| `subtle`            | 三级文字 / 占位符        |
| `brand` / `brand-50…900` | 主强调色（薄荷绿，= emerald-500） |
| `iris-300…700`       | 次强调色（紫，用于 AI/原型） |

用法：`bg-surface`、`text-muted`、`border-line`、`bg-brand-500/10`、`text-iris-400` …都支持 `/透明度`。

### 2.2 组件原语（`@layer components`，见 `src/index.css`）

- 按钮：`.btn` `.btn-primary` `.btn-outline` `.btn-ghost` `.btn-danger`
- 容器：`.card` `.panel` `.glass`
- 表单：`.input`
- 其它：`.chip` `.nav-item` / `.nav-item-active` `.toast`
- 动画：`animate-fade-in` `animate-fade-in-up` `animate-scale-in` `animate-toast-in`；文字渐变 `.text-gradient-brand`

### 2.3 通用工具（新增，优先复用而非重造）

- **Toast**：`import { toast } from '@/utils/toast'` → `toast.success/error/warning/info(msg)`。`<Toaster/>` 已在 `main.tsx` 挂载。最多同时 4 条。
- **确认框**：`import { confirmDialog } from '@/utils/confirm'` → `if (await confirmDialog({ title, message?, confirmText?, danger? })) {…}`。**禁止再用原生 `alert/confirm`**。
- **错误边界**：`src/components/ErrorBoundary.tsx` 已包裹全局，防白屏。

### 2.4 迁移映射（如遇仍是旧配色的地方，按此换）

- `bg-slate-900/950 → bg-bg`；`bg-slate-800 → bg-surface`；`bg-slate-700/600 → bg-surface-3`
- `border-slate-700/800 → border-line`；`border-slate-600/500 → border-line-strong`
- `text-slate-200/300 → text-content`；`text-slate-400 → text-muted`；`text-slate-500/600/700 → text-subtle`
- `emerald-* → brand-*`（同色号）；`purple-* → iris-*`（色号映射到 300–700）
- **例外**：`Brainstorm/NoteCard.tsx` 是画布上的**浅色便签**（白/米黄底 + 深色字），**不要**迁到深色令牌。默认状态色（red/yellow/blue 等语义色）保留。
- Tailwind 默认 `slate/emerald/purple` 仍在，旧存档数据不会因迁移而失效。

---

## 3. 已完成（迭代 1–24）

1. 设计系统：`tailwind.config.js` + `src/index.css`（令牌、字体、阴影、滚动条、焦点环、原语）。
2. 应用外壳 `App.tsx`（侧栏/顶栏/移动导航/保存状态）——仅改表现，协作逻辑原样保留。
3. 项目大厅 `Dashboard.tsx`（搜索、排序、封面悬浮、相对时间、右键/⋮ 菜单）。
4. 五大模块配色迁移（Settings/Docs/Team/TodoList/Board/UIPrototype 全套）。
5. 富文本（TipTap `prose`）+ 原生 `select`/复选框/占位符主题化。
6. Toast 通知系统（`utils/toast.tsx`）。
7. 应用内确认框（`utils/confirm.tsx`），并**清除全部原生 alert/confirm**。
8. 全局 ErrorBoundary、`prefers-reduced-motion`、Toast/确认框无障碍。
9. 协作模块：浏览器端消息解析加 `try/catch` 防坏帧崩溃。
10. 大厅：项目「创建副本」、`Ctrl/Cmd+N` 新建、首次空状态、排序偏好持久化。
11. UI 原型机首页：空状态、界面计数、Esc 关闭、模板弹窗响应式。
12. 房间/文档弹窗补 Esc，全局弹窗交互一致。
13. 白板空画布引导：`Board.tsx` 无便签时画布中央显示居中提示（覆盖层不随缩放，`pointer-events-none` 不挡操作）。已在浏览器实测三态（空显示/加贴消失/删贴恢复）。
14. 修复 `Board.tsx` 中 7 处编码损坏的协作状态乱码文案。
15. `AIDialog.tsx` 支持 Esc 关闭，关闭/提交按钮补无障碍属性。
16. Settings 增强：API Key 眼睛显隐切换、每配置「测试连接」按钮（`aiService.testAIConnection`，区分网络/API/HTTP/格式错误，toast 反馈）；标题行窄屏 flex-wrap。已在浏览器实测。
17. 全项目图标按钮可发现性与键盘可达性：56 处补 title/aria-label/role/tabIndex/onKeyDown（工作流并行修复），浏览器实测大厅 0 无名图标按钮、Enter 可开项目卡。
18. 移动端响应式：UICanvas 顶栏收缩约束与右键菜单视口钳制、TeamManager md 堆叠 lg 分栏 + break-all、375px 实测五模块无横向溢出。
19. 项目导入/导出：`storage.exportProject/importProject`（format/version 校验、新 id 深拷贝），Dashboard 顶栏「导入」+ 右键「导出项目」，合法/非法文件路径均实测。
20. 命令面板（Ctrl+K，搜索/方向键/Enter）与快捷键帮助（?）：`CommandPalette.tsx` + `ShortcutHelp.tsx`，App 集成（输入框聚焦时 ? 不触发），全链路实测。
21. 遗留配色迁移（AI 卡 purple→iris 等、Board 导出底色/网格点/连线色、UIPrototype 常量化）；**修复状态磁贴无法移动/删除**（此前不渲染拖拽栏，现覆盖式 h-6 栏）。
22. 白板多选与对齐：框选、批量移动/删除、基础对齐吸附。
23. 浅色主题：主题令牌、切换入口与本地偏好持久化。
24. 质量门禁：pre-commit 执行 TypeScript、ESLint 和单元测试；补齐 `storage` 与 `normalizeRoomServerUrl` 关键路径测试。
25. 全链路回归（见 `REGRESSION_CHECKLIST.md`）：生产构建下大厅/白板/文档/联机/UI 原型/设置全量验证（桌面+375px、深浅色）；修复 Electron dev 硬编码 5173 端口导致端口被占时加载错误应用的缺陷（改用 `VITE_DEV_SERVER_URL`）。
26. 协作健壮性：修复 connect Promise 在 joined 前 close/error/超时时永久挂起；异常断线自动重连（指数退避+上限+抖动，成功后重置，`getLatestSnapshot` 让房主重启后用最新内容重建房间）；手动退出取消一切定时器与重连；代号(generation)机制防重复连接/重复监听/重复 disconnected。纯逻辑拆到 `utils/roomConnection.ts`（退避/判定/解析 12 用例），`RoomClient` 支持注入 Fake WebSocket/假定时器（9 用例）；`scripts/verify-collab.mjs` 用两个真实客户端对接真实 CollabServer 验证加入/同步/断网/服务重启/恢复/退出，浏览器 UI 亦实测断线重连全流程。

---

## 4. 待办路线图（按优先级）

> 每条都是一个「迭代」。改动文件与验收标准已列出。

### P1 — 打磨与一致性
- ~~**[白板空画布引导]**~~ ✅ 已完成（迭代 13）
- ~~**[图标按钮可发现性]**~~ ✅ 已完成（迭代 17）
- ~~**[AIDialog Esc 一致性]**~~ ✅ 已完成（迭代 15）
- ~~**[移动端响应式复查]**~~ ✅ 已完成（迭代 18）
- ~~**[Settings 增强]**~~ ✅ 已完成（迭代 16）

### P2 — 功能增量
- ~~**[项目导入/导出]**~~ ✅ 已完成（迭代 19）
- ~~**[白板多选与对齐]**~~ ✅ 已完成（迭代 22）
- ~~**[命令面板 / 快捷键帮助]**~~ ✅ 已完成（迭代 20）
- ~~**[浅色主题]**~~ ✅ 已完成（迭代 23）

### P3 — 工程化
- ~~**[协作健壮性（需联机测试）]**~~ ✅ 已完成（迭代 26，真实双客户端 + 浏览器 UI 联机验证）
- **[i18n]** 抽离中文文案到字典，为将来多语言铺路。
- ~~**[质量门禁]**~~ ✅ 已完成（迭代 24）

---

## 5. 开发与验证命令（本地可跑，云端沙箱跑不了依赖）

```bash
npm install            # 首次
npm run dev            # 本地开发预览（Vite）
npm run build          # tsc 类型检查 + vite 打包 —— 每轮迭代后必跑
npm run lint           # ESLint
npm test               # storage / collaboration 工具函数单测
npm run electron:build # 打 Windows 安装包（可选）
```

**每轮迭代的收尾清单**：`npm run build` 通过 → 手动点一遍受影响的交互（尤其删除类流程）→ 提交。

---

## 6. 风险与注意事项

- **删除流程已改为异步**：`Dashboard/Settings/Team/Docs/UIPrototype` 的删除从同步 `confirm()` 改成 `await confirmDialog()`。逻辑已保留、删除前捕获了目标 id，但请各点一遍确认无回归。
- **NoteCard 是浅色的**：别顺手迁成深色令牌（见 2.4）。
- **协作/Electron 代码未在本轮做无法验证的重构**：只加了防御性 `try/catch`。深层断线/重连问题留待联机环境处理。
- **字体**：`index.html` 引了 Google Fonts（Inter / Space Grotesk），离线时自动回退系统字体，不影响使用；如需完全离线可改为本地打包字体。
- **令牌是唯一事实来源**：调色只改 `src/index.css` 的 `:root` 变量，全局生效。
