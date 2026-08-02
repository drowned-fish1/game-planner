# Game Planner Pro

> A local-first, cross-platform planning workspace for indie game developers.

[![CI](https://github.com/drowned-fish1/game-planner/actions/workflows/ci.yml/badge.svg)](https://github.com/drowned-fish1/game-planner/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/version-0.6.0-blue)
![Electron](https://img.shields.io/badge/Electron-29-green)
![React](https://img.shields.io/badge/React-18-blue)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Game Planner Pro brings brainstorming, game design documents, task tracking, UI prototyping, and LAN collaboration into one open-source workspace. It runs as an Electron desktop app and can also be built for Android with Capacitor. Project data stays local by default, and AI features are optional and configured by the user.

中文简介：Game Planner Pro 是面向独立游戏开发者的一站式开源策划工作台，整合灵感白板、GDD 文档、团队待办、UI 原型、局域网协作与可选的 AI 辅助能力。

## Features

- **Visual brainstorming board** — infinite canvas, draggable cards, media, connections, multi-select, alignment guides, and export.
- **Structured game design documents** — a tree-based rich-text editor powered by Tiptap, with optional human-reviewed AI writing actions.
- **UI prototyping** — compose pixel-oriented interfaces, slice image assets, configure interactions, and preview flows without writing game code.
- **Team planning** — project tasks and lightweight collaboration tools in the same workspace.
- **LAN collaboration** — host or join a room over WebSockets with reconnect handling and snapshot synchronization.
- **Local-first storage** — atomic desktop writes, rolling backups, corruption recovery, project import/export, and browser fallbacks.
- **Cross-platform delivery** — Electron desktop builds and an Android project through Capacitor.
- **Accessible workflow** — keyboard navigation, command palette, shortcuts, responsive layouts, light/dark themes, and Chinese/English UI foundations.

## Project status

Game Planner Pro is under active development. Version 0.6.0 includes automated coverage for AI service behavior, board geometry, collaboration and reconnect flows, storage recovery, and theme persistence. The current test suite contains 88 passing tests.

The project is maintained by [drowned-fish1](https://github.com/drowned-fish1). Issues and pull requests are welcome.

## Getting started

### Requirements

- Node.js 18 or newer
- npm

### Run locally

```bash
git clone https://github.com/drowned-fish1/game-planner.git
cd game-planner
npm install
npm run dev
```

### Quality checks

```bash
npm run lint
npm test
npm run build
```

### Package the desktop app

```bash
npm run electron:build
```

### Build Android

```bash
npm run android:sync
cd android
./gradlew assembleDebug
```

On Windows PowerShell, use `./gradlew.bat assembleDebug` for the final command.

## AI configuration and privacy

AI features are disabled until a user supplies an API configuration in Settings. The app supports OpenAI-compatible chat-completion endpoints. Generated text is presented for review before it is inserted into a document.

API credentials and project data are handled locally by the app. Do not commit credentials or include secrets in exported projects, issues, or bug reports.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow. Please report security-sensitive issues according to [SECURITY.md](SECURITY.md), rather than opening a public issue.

## License

Released under the [MIT License](LICENSE). Copyright © 2024–2026 Game Planner Pro contributors.
