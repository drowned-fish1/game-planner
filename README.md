一个专为游戏策划师设计的现代化桌面应用，集灵感收集、文档管理、团队协作于一体，帮助游戏开发者更高效地组织创意、规划项目。

✨ 核心特性

🧠 灵感白板（Brainstorm Board）

· 多格式贴纸：支持文字、图片、链接、代码片段等多种内容形式 · 自由布局：拖拽式无限画布，随心放置和组织灵感 · 智能连接：使用连线建立灵感之间的关联，构建思维网络 · 实时保存：自动保存所有更改，永不丢失创意

📚 智能文档系统

· 专业模板库：内置游戏行业标准模板 · 🎮 GDD游戏策划案模板 · 🗺️ 关卡设计模板 · 👤 角色设定卡模板 · 📝 空白文档模板 · 结构化编辑：分章节、可折叠的文档编辑器 · 快速创建：一键生成完整文档结构

👥 团队协作

· 成员管理：添加/移除团队成员，分配角色 · 权限控制：基于角色的访问权限管理 · 实时待办：团队任务清单，协同工作流 · 项目共享：团队内项目共享与协作

🎨 媒体支持

· 图片导入：支持拖拽上传图片到灵感贴纸 · 内容预览：链接自动生成预览卡片 · 富文本编辑：基本的文本格式化功能

🛠️ 技术架构

技术栈

· 前端框架: React 18 + TypeScript · 桌面框架: Electron 28 · 构建工具: Vite 5 · 样式方案: Tailwind CSS 3.4 · 交互库: React Draggable + React Xarrows · 数据持久化: LocalStorage (模拟数据库)

项目结构

game-planner/
├── electron/                  # Electron 主进程代码
│   └── main.js               # 窗口创建、系统事件处理、开发者工具控制
├── src/                       # React 渲染进程代码 (UI 层)
│   ├── components/
│   │   ├── Brainstorm/        # [灵感白板] 模块
│   │   │   ├── Board.tsx     # 画布逻辑、缩放、截图、右键菜单
│   │   │   └── NoteCard.tsx  # 多媒体磁贴 (视频/代码/图片/状态) 的封装
│   │   ├── Dashboard/         # [仪表盘] 首页，概览数据
│   │   ├── Docs/              # [策划文档] Tiptap 编辑器集成
│   │   ├── Team/              # [团队管理] 成员列表与任务分配
│   │   └── UIPrototype/       # [UI 原型机] (正在开发中)
│   │       ├── UIManager.tsx # 页面流管理 (新增/删除/预览入口)
│   │       └── UICanvas.tsx  # 页面编辑器 (拖拽资产、属性配置)
│   ├── utils/
│   │   └── storage.ts        # 数据持久化层 (LocalStorage 读写 + 类型定义)
│   ├── App.tsx               # 全局路由、侧边栏导航、模块切换逻辑
│   └── main.tsx              # React 入口
├── package.json              # 依赖管理与脚本命令
└── vite.config.ts            # Vite 配置 (已剥离 Electron 插件，纯 React 模式)
🚀 快速开始

环境要求

· Node.js 18+ · npm 9+

安装步骤

# 克隆项目
git clone <repository-url>

# 进入项目目录
cd game-planner

# 安装依赖
npm install

# 启动开发服务器
npm run dev


# 打包桌面应用
npm run electron:build
📋 功能路线图

✅ 已实现

· 灵感白板系统（拖拽+连线） · 项目大厅与文档管理 · 专业游戏文档模板 · 多媒体内容支持 · 团队管理与待办事项 · 本地数据持久化

🔄 开发中

· UI原型机功能 · 游戏界面组件库 · 可交互UI原型 · 布局与样式工具

📅 计划中

· 实时联机协作 · 多人实时编辑 · 变更同步与冲突解决 · 在线演示模式 · 高级功能 · 版本历史与差异对比 · 导出与分享功能 · 插件系统  · 游戏引擎导出

🎯 使用场景

独立开发者

· 整理游戏设计灵感 · 结构化编写策划文档 · 管理个人项目进度

小型团队

· 共享创意白板 · 协同编写游戏策划案 · 分配团队任务与跟踪进度

教育场景

· 游戏设计教学工具 · 学生项目协作平台 · 作品集整理与管理

🤝 贡献指南

我们欢迎所有形式的贡献！请参考以下步骤：

Fork 本仓库
创建功能分支 (git checkout -b feature/AmazingFeature)
提交更改 (git commit -m 'Add some AmazingFeature')
推送到分支 (git push origin feature/AmazingFeature)
开启一个 Pull Request
开发规范

· 使用TypeScript编写所有代码 · 遵循现有的代码风格 · 添加适当的注释和文档 · 确保代码通过ESLint检查

🙏 致谢

感谢所有贡献者和用户的支持！特别感谢以下开源项目：

· React - UI框架 · Electron - 桌面应用框架 · Tailwind CSS - 样式框架 · 以及所有依赖库的维护者们