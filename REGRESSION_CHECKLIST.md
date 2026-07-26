# 全链路回归清单（迭代 25）

> 执行日期：2026-07-27 · 基线：f8f5d93 · 生产构建（`vite preview`，端口 4790）+ Electron dev
>
> **验证方式说明**：本轮在无头浏览器窗格中执行，无法截图/坐标点击；拖拽、框选等指针交互
> 通过在页面内合成真实 DOM 事件（`MouseEvent`/`KeyboardEvent`/`dispatchEvent`）驱动**应用
> 原有事件处理器**完成，并以 DOM 状态 + `localStorage` 数据为验收依据。Electron 窗口内部
> 无远程调试端口，GUI 交互无法从外部驱动，改以进程/网络/数据文件证据验证（详见下文）。

## 1. 自动化门禁

| 项目 | 结果 |
|------|------|
| `npm test`（node --test，9 用例） | ✅ 9 pass / 0 fail |
| `npm run lint` | ✅ 0 errors（51 warnings，迭代 27 处理） |
| `npm run build`（tsc + vite） | ✅ 通过；主包 848.48 kB（迭代 29 处理） |
| pre-commit 钩子（tsc + eslint + test） | ✅ 提交时执行通过 |

## 2. 浏览器版（生产构建）— 桌面 1280px · 深色

### 项目大厅
- [x] 创建新项目（卡片出现、排序置顶）
- [x] 重命名项目（triple-click 全选 + 输入 + Enter）
- [x] 打开项目（卡片 role=button，进入白板视图）
- [x] 创建副本（内容深拷贝：白板磁贴 + 7 个 UI 页面均复制）
- [x] 导出项目（文件名 `<项目名>.gp-project.json`；payload `format: game-planner-project, version: 1`）
- [x] 导入项目（合法文件 → 新项目 + 完整内容；`{"format":"wrong"}` → toast「导入失败：文件不是 Game Planner 的项目导出文件」且项目数不变）
- [x] 删除项目（confirmDialog 文案正确 → 确认后卡片消失、contents 级联清理）
- [x] 图标按钮可发现性：大厅 0 个无名图标按钮

### 灵感白板
- [x] FAB 展开 → 添加便签（空状态「白板还是空的」消失/恢复联动正确）
- [x] 便签文本编辑（React onChange 路径）
- [x] 拖拽移动（+150/+100 精确位移）
- [x] 对齐吸附（拖至距目标左边线 5px → 精确吸附到 540；y 距离 80px 不吸附，阈值 8px 符合实现）
- [x] 连接点连线（A 右锚点 → 提示「请点击另一个连接点完成连线」→ B 左锚点 → Xarrow 出现 + 删除连线按钮）
- [x] 框选（画布空白 mousedown + 拖动 → 选框可见 → 2 张磁贴 ring 选中 + 左下角「已选 2 张磁贴」提示）
- [x] 多选整体移动（拖任一选中磁贴，两卡相对位移保持 Δx=0/Δy=80 不变）
- [x] Delete 批量删除（磁贴 + 关联连线级联删除，空状态恢复）
- [x] 状态磁贴：添加、点击循环（未使用→废弃，符合 STATUS_TYPES 顺序）、拖拽栏与删除按钮存在（迭代 21 修复未回归）
- [x] 导出图片：触发 html-to-image 流程；⚠️ 控制台出现 Google Fonts 跨域 CSS `SecurityError`（非致命，字体回退，迭代 29 移除运行时 Google Fonts 后消除）
- [x] Ctrl+S 保存 → `gp_all_data.contents[projectId].brainstorm` 持久化确认

### 策划文档
- [x] 文档树（根文档 + 新建子文档层级显示）
- [x] 标题编辑、TipTap 正文输入（execCommand insertText 走真实编辑器）
- [x] 模板弹窗（空白/GDD/关卡/角色卡）
- [x] AI 弹窗打开；Esc 逐层关闭（AI 弹窗、模板弹窗均关闭）

### 房间联机（团队）
- [x] 房间/成员/待办三个标签渲染
- [x] 添加成员（弹窗表单 → 卡片出现 → 出现在待办指派下拉）
- [x] 添加待办 + 指派成员 + 勾选完成
- [x] 主持/加入/扫描局域网入口渲染（联机行为详测归迭代 26）

### UI 原型
- [x] 7 种页面模板全部创建成功并持久化：`screen`(PC/iPhone/Tablet) / `modal_center` / `modal_bottom` / `sidebar_left` / `toast`
- [x] 画布内添加文本组件
- [x] 资产库渲染（蓝色按钮/红色按钮/基础面板/血条底/血条红/游玩/设置）
- [x] 导出为图片（同白板 ⚠️ Google Fonts 跨域警告）

### 设置
- [x] AI 配置表单 + Key 显隐切换 + 删除配置守卫（至少保留一个）
- [x] 测试连接成功路径：本地 mock 端点（POST → 200，`choices[0].message.content`）
- [x] 测试连接失败路径：`ERR_CONNECTION_REFUSED` → toast.error（网络请求记录佐证两条路径均执行）
- [x] 主题切换按钮：深色 ⇄ 浅色

### 全局
- [x] 命令面板 Ctrl+K：打开、搜索过滤「白板」、Enter 执行跳转、面板关闭
- [x] 快捷键帮助 ?：打开 + Esc 关闭
- [x] Toast 系统（导入失败错误 toast 实测捕获）
- [x] confirmDialog（删除项目/删除配置均为应用内确认框，无原生 alert/confirm）

## 3. 浅色主题 + 375px 移动端

- [x] 浅色切换：`html.light` 类 + `--bg` 令牌 `12 17 26 → 244 246 250`，`gp_theme` 持久化
- [x] 375×812 视口下五模块（白板/联机/文档/UI/设置）均无横向溢出
- [x] 移动端底部导航渲染；白板 浏览/编辑/连线 三模式按钮出现（`isDesktop<768` 分支）
  - 注：视口仿真不自动派发 `resize` 事件，手动派发后立即生效；真机旋转/缩放会触发原生事件，非应用缺陷
- [x] 切回深色 + 桌面视口后状态正常

## 4. Electron 版（dev）

- [x] `npm run dev` 拉起 vite + Electron，主进程无报错
- [x] **发现并修复回归级缺陷**：`electron/main.js` dev 模式硬编码 `loadURL('http://localhost:5173')`。
      本机 5173 被其他项目残留 vite 进程占用，vite 自动落到 5174，Electron 窗口会加载**错误的应用**。
      修复：优先读取 vite-plugin-electron 注入的 `VITE_DEV_SERVER_URL`。
      验证：重启后 Electron 渲染进程 TCP 连接到 5174（netstat 证据）✅
- [x] IPC 存储：`%APPDATA%/game-planner/gp_data.json` 存在（385 KB），结构 `projects/contents/configs` 完好，含用户真实项目
- [x] 内置协作服务：`http://127.0.0.1:17888/` 返回 serviceInfo（ready:true, wsPath:/ws, LAN 地址列表）
- [ ] Electron 窗口内 GUI 交互（点击/拖拽）：**无法执行** — 窗口未开远程调试端口，外部无法驱动；
      渲染内容与浏览器版为同一 bundle，差异面（IPC 存储、collab 服务）已按上述方式验证

## 5. 发现的问题与处置

| # | 问题 | 级别 | 处置 |
|---|------|------|------|
| 1 | Electron dev 硬编码 5173，端口被占时加载错误应用 | 回归级（dev） | ✅ 本轮修复（`VITE_DEV_SERVER_URL`） |
| 2 | 白板/UI 原型导出图片时 Google Fonts 跨域 CSS SecurityError 噪音 | 低（非致命） | 迭代 29 移除运行时 Google Fonts 后消除 |
| 3 | 大厅封面上传 `accept="image/*"` 仅靠文件选择器过滤，change 处理器不校验 MIME，非图片文件会被存成 data URL 封面 | 低 | 记录；建议后续在 handler 中校验 `file.type.startsWith('image/')` |
| 4 | 新磁贴固定出生在画布中心，连续添加完全重叠，需手动拖开 | 低（体验） | 记录；可考虑级联偏移 |

## 6. 结论

除 Electron dev 端口缺陷（已修复）外，迭代 13–24 的全部功能在生产构建下无回归。
测试产生的项目/数据已全部清理，localStorage 恢复至回归前状态。
