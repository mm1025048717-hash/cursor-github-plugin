# 快速开始指南

## 🎯 项目概述

这是一个 Cursor IDE 插件，让你可以用自然语言：
1. 🔍 **搜索 GitHub 项目** - "找一个 React 的待办事项应用"
2. ⬇️ **自动下载项目** - 一键克隆到本地
3. 💬 **自然语言修改代码** - "添加错误处理"、"优化这个函数"

## 🚀 5分钟快速开始

### 步骤 1: 安装依赖

```bash
cd cursor-github-plugin
npm install
```

### 步骤 2: 编译

```bash
npm run compile
```

### 步骤 3: 在 Cursor 中运行

1. 在 Cursor 中打开 `cursor-github-plugin` 文件夹
2. 按 `F5` 启动调试
3. 会打开一个新的 Cursor 窗口，插件已加载

### 步骤 4: 配置 API 密钥

1. 在新窗口中按 `Ctrl+,` 打开设置
2. 搜索 "GitHub AI"
3. 配置 **DeepSeek API Key** (必需)
   - 访问 https://www.deepseek.com/ 获取 API Key
4. (可选) 配置 **GitHub Token** 以提高搜索速率限制

### 步骤 5: 开始使用！

#### 搜索项目
1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "GitHub AI: 搜索项目"
3. 用自然语言描述：`找一个 React 的待办事项应用`
4. 选择项目并下载

#### 修改代码
1. 打开任意代码文件
2. 按 `Ctrl+Shift+P`
3. 输入 "GitHub AI: 对话修改代码"
4. 描述需求：`添加错误处理`
5. 选择 "应用" 或 "预览"

## 📦 打包发布

```bash
npm run package
```

会在项目根目录生成 `.vsix` 文件，可以安装到任何 Cursor/VS Code 实例。

## 🎨 功能演示

### 场景 1: 搜索并下载项目

```
用户: 执行命令 "GitHub AI: 搜索项目"
用户: 输入 "找一个 TypeScript 的 REST API 框架"
→ AI: 搜索 GitHub，展示匹配的项目列表
→ 用户: 选择 "microsoft/fastify"
→ AI: 自动克隆项目到本地
→ 用户: 选择 "打开项目"
→ Cursor: 在新窗口打开项目
```

### 场景 2: 自然语言修改代码

```
用户: 打开 app.ts 文件
用户: 执行命令 "GitHub AI: 对话修改代码"
用户: 输入 "在这个函数中添加参数验证和错误处理"
→ AI: 分析代码，生成修改后的版本
→ 用户: 选择 "预览"
→ Cursor: 在对比视图中显示修改
→ 用户: 确认后选择 "应用"
→ 代码已更新
```

## 🔧 开发模式

如果你想修改插件代码：

```bash
# 终端 1: 监听模式编译
npm run watch

# 终端 2: 在 Cursor 中按 F5 启动调试
```

每次保存文件后会自动重新编译。

## ⚙️ 配置说明

### GitHub Token (可选)
- **作用**: 提高 GitHub API 速率限制（未认证 60/小时 → 认证 5000/小时）
- **获取**: https://github.com/settings/tokens
- **权限**: 只需 `public_repo` 权限

### DeepSeek API Key (必需)
- **作用**: 用于 AI 代码理解和修改
- **获取**: https://www.deepseek.com/
- **注意**: 需要账户有余额

### 下载路径
- **默认**: `${workspaceFolder}/github-projects`
- **说明**: 下载的项目会保存在此路径

## 🐛 常见问题

**Q: 编译失败？**
```bash
rm -rf node_modules package-lock.json out
npm install
npm run compile
```

**Q: 插件无法加载？**
- 检查 `out/extension.js` 是否存在
- 查看 Cursor 的输出面板查看错误信息

**Q: API 调用失败？**
- 检查 API Key 是否正确配置
- 检查网络连接
- 查看错误提示信息

## 📚 更多信息

- [完整使用指南](README-使用指南.md)
- [安装说明](INSTALL.md)
- [项目 README](README.md)

