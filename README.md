# 🎮 Game Planner Pro

> 一款专为独立游戏开发者打造的一站式电子游戏策划工具。集成灵感白板、文档编辑器、像素风 UI 原型机以及强大的 AI 辅助功能。

![Version](https://img.shields.io/badge/version-0.2.0-blue) ![Electron](https://img.shields.io/badge/Electron-29.0-green) ![React](https://img.shields.io/badge/React-18.0-blue) ![License](https://img.shields.io/badge/license-MIT-orange)

## ✨ 核心功能 (Features)

### 💡 灵感白板 (Brainstorm Board)
* **无限画布**：支持自由拖拽、缩放、平移。
* **多媒体支持**：直接拖入图片、视频、音频文件。
* **连线逻辑**：可视化连接各个节点，梳理游戏流程。
* **AI 智能总结**：
    * **单点总结**：右键磁贴，AI 自动提炼内容。
    * **汇聚分析**：将多个磁贴连线指向 AI 节点，一键生成综合分析报告。

### 📝 智能策划文档 (Smart Docs)
* **树状结构**：无限层级的文档目录树。
* **所见即所得**：基于 Tiptap 的富文本编辑体验。
* **AI 写作助手**：选中文字即可呼出 AI 菜单，支持**润色**、**扩写**、**总结**、**翻译**。
* **安全模式**：AI 生成内容需人工确认后才会写入文档，防止误操作。

### 🎨 UI 原型机 (Pixel UI Prototyper)
* **像素风渲染**：专为像素游戏优化的 Canvas 渲染引擎，杜绝模糊。
* **可视化交互**：无需代码，通过下拉菜单配置 `跳转`、`弹窗`、`变量修改` 等逻辑。
* **资产切片**：内置资产编辑器，支持上传图片并自定义切片 (Slice)。
* **实时预览**：在编辑器内直接运行和测试 UI 交互流。

### ⚙️ 灵活的 AI 配置
* **多源支持**：兼容 OpenAI 格式接口，支持 DeepSeek、Claude、ChatGPT 等。
* **自定义配置**：在设置页管理多个 API Key 和 Base URL，随时切换。

---

## 🛠️ 技术栈 (Tech Stack)

* **Runtime**: Electron (开启 `nodeIntegration: false`, `contextIsolation: true`, `webSecurity: false`)
* **Frontend**: React + TypeScript + Vite
* **Styling**: Tailwind CSS
* **State/Storage**: LocalStorage (纯本地存储，隐私安全)
* **Key Libraries**:
    * `react-xarrows`: 连线绘制
    * `@tiptap/react`: 富文本编辑
    * `react-draggable` / `react-resizable`: 拖拽与缩放交互
    * `html-to-image`: 画布截图导出

---

## 🚀 快速开始 (Getting Started)

### 环境要求
* Node.js >= 16.0.0
* npm 或 yarn

### 安装步骤

1.  **克隆项目**
    ```bash
    git clone [https://github.com/yourusername/game-planner.git](https://github.com/yourusername/game-planner.git)
    cd game-planner
    ```

2.  **安装依赖**
    > ⚠️ 注意：由于依赖版本敏感，建议使用 npm 并严格按照 package.json 安装
    ```bash
    npm install
    ```

3.  **启动开发模式**
    ```bash
    npm run dev
    ```

4.  **打包构建 (Windows/Mac/Linux)**
    ```bash
    npm run electron:build
    ```

---

## 📖 使用指南 (Usage)

1.  **配置 AI**: 首次进入，请点击侧边栏底部的 **"设置"**，添加你的 API Key 和 Base URL (如 DeepSeek 或 OpenAI)。
2.  **创建项目**: 在仪表盘点击 "+" 号创建新项目。
3.  **开始策划**:
    * 切换到 **白板** 整理思路。
    * 切换到 **文档** 撰写 GDD。
    * 切换到 **UI 原型** 搭建游戏界面。

---

---

## 🤝 贡献 (Contributing)

欢迎提交 Issue 和 Pull Request！

1.  Fork 本仓库
2.  新建 Feat_xxx 分支
3.  提交代码
4.  新建 Pull Request

---

**License** [MIT](LICENSE) © 2026 Game Planner Team