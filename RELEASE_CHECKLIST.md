# 发行检查清单（迭代 30）

> 执行日期：2026-07-27 · 版本 0.2.0（本轮不提升版本号、不发布、不推送）

## 1. Package Metadata

| 项 | 状态 | 说明 |
|----|------|------|
| `name` / `version` | ✅ | game-planner / 0.2.0（版本号未动） |
| `description` | ✅ 本轮补齐 | 此前缺失，electron-builder 有警告 |
| `author` | ✅ 本轮补齐 | 此前缺失，electron-builder 有警告 |
| `build.appId` | ✅ | `com.gameplanner.app`（Windows）；Android 为 `com.gameplanner.pro` |
| `build.productName` | ✅ | Game Planner Pro |
| `build.copyright` | ✅ 本轮更新 | `Copyright © 2024-2026 Game Planner Pro`，UTF-8 无乱码 |
| 图标 | ✅ | `public/icon.ico` / `icon.png` 由 `scripts/generate-icons.ps1` 生成，Electron 与 Android 共用源 |
| **`electron-builder.json5` 占位模板** | ✅ 本轮删除 | 内含 `YourAppID`/`YourAppName` 且 files 缺 `electron/` 目录；electron-builder 配置发现顺序中该文件可能覆盖 package.json 的正确配置，属发布隐患，已移除（实测删除后配置仍从 package.json `build` 字段加载） |

## 2. Windows 打包（electron-builder）

- ✅ `npm run electron:build` 全流程通过（icon:generate → tsc+vite build → electron-builder）
- ✅ 补齐 description/author 后无 metadata 警告
- ✅ 产物：`release/win-unpacked/Game Planner Pro.exe` + `release/Game Planner Pro Setup 0.2.0.exe`（NSIS，81MB）
- 提示：`electron-squirrel-startup` 依赖对 NSIS 无用（可在未来清理，本轮不动依赖树——cnpm 布局）

## 3. 打包产物运行验证（win-unpacked，通过 CDP 驱动真实 UI）

| 验证项 | 结果 |
|--------|------|
| 应用启动、标题、IPC 桥（electronAPI）可用 | ✅ |
| 项目存储：创建项目 → 立即写入 `%APPDATA%\game-planner\gp_data.json` | ✅（2 → 3） |
| 导出：`<项目名>.gp-project.json`，payload `format/version` 正确 | ✅ |
| 导入：导出文件再导入 → 新项目 + 内容持久化 | ✅（3 → 4） |
| 主题：设置页切浅色 → `html.light` + `gp_theme=light` | ✅ |
| **重启后**项目数据持久化（gp_data.json） | ✅ |
| **重启后**主题持久化（localStorage） | ✅（正常关闭下恢复浅色；注意：`taskkill /F` 强杀会丢失未刷盘的 localStorage 写入，属 Chromium 行为，正常退出无此问题） |
| 测试数据清理、用户项目（2 个）与深色主题复原 | ✅ |

注意：打包应用 userData 目录为 `%APPDATA%\game-planner`（取 package.json `name`），与 dev 模式**同目录**——
开发调试与正式使用共享同一份 `gp_data.json`，联调时须小心，勿在 dev 里误删正式数据。

## 4. Android（Capacitor）

- ✅ `npx cap sync android` 通过（dist → android/app/src/main/assets/public）
- ✅ `gradlew.bat assembleDebug` 通过 → `android/app/build/outputs/apk/debug/app-debug.apk`（4.7MB）
- ✅ 模拟器（emulator-5554）安装、启动，WebView 渲染出真实应用（标题正确、项目大厅可见）
- ⚠️ `npm run android:build` 的 `cd android && gradlew.bat` 在 npm script-shell 为 bash 时找不到
  `gradlew.bat`（需 `./` 前缀）；在 cmd/PowerShell 终端执行则正常。构建环境要求：JDK 21、
  Android SDK（`android/local.properties` 指向 `%LOCALAPPDATA%\Android\Sdk`）
- ⚠️ 仅验证 debug APK；release 签名（keystore）未配置，发布 Play/商店前需补

## 5. 已知遗留（不阻塞本轮）

1. release/ 目录含历史版本产物（0.3.0/0.4.0/0.5.0 zip 等），命名与当前 0.2.0 版本号不连续——历史遗留，建议发布前清理归档。
2. `electron-squirrel-startup` 冗余依赖（NSIS 不需要）。
3. Windows 未配置代码签名（signAndEditExecutable: false），安装时会有 SmartScreen 提示。
4. Browserslist 数据 6 个月未更新（构建提示，非阻塞）。

## 6. 发布前动作（下次发版时执行，本轮不做）

- [ ] 版本号提升（package.json，同步影响安装包文件名）
- [ ] 清理/归档 release/ 历史产物
- [ ] Android release keystore 与签名配置
- [ ] （可选）Windows 代码签名证书
