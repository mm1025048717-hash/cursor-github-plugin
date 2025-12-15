# Cursor GitHub AI 插件

一个强大的 Cursor IDE 插件，使用自然语言搜索 GitHub 开源项目，自动下载，并通过对话方式修改代码。

## 🚀 功能特性

### 核心功能
- **自然语言搜索**: 用自然语言描述需求，自动搜索 GitHub 项目
- **智能下载**: 自动克隆或下载选定的项目到本地
- **AI 代码修改**: 通过自然语言对话修改代码，无需手动编辑
- **项目管理**: 管理下载的项目，快速打开和切换

### 使用场景
- 快速查找和集成开源项目
- 学习开源代码并快速修改
- 原型开发时快速获取参考代码
- 项目改造和定制

## 📦 技术栈

- **TypeScript** - 类型安全
- **VS Code Extension API** - Cursor/VS Code 扩展接口
- **GitHub API** - 项目搜索和下载
- **DeepSeek API** - AI 代码理解和修改
- **Node.js** - 后端服务

## 🛠️ 安装与使用

### 安装步骤
1. 克隆或下载此项目
2. 安装依赖: `npm install`
3. 编译: `npm run compile`
4. 在 Cursor 中按 F5 调试运行

### 基本使用
1. 打开命令面板 (Ctrl+Shift+P)
2. 输入 "GitHub AI: Search Project"
3. 用自然语言描述你要找的项目
4. 选择项目并自动下载
5. 使用 "GitHub AI: Chat & Modify" 开始对话修改代码

## 📖 API 配置

需要配置以下 API 密钥：
- `GITHUB_TOKEN`: GitHub Personal Access Token (可选，提高速率限制)
- `DEEPSEEK_API_KEY`: DeepSeek API 密钥 (用于 AI 代码修改)

## 🎯 开发计划

- [x] 项目结构设计
- [ ] GitHub API 集成
- [ ] 项目搜索功能
- [ ] 项目下载功能
- [ ] AI 代码理解
- [ ] 自然语言代码修改
- [ ] 用户界面
- [ ] 错误处理和日志

