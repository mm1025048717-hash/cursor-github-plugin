# 安装指南

## 前置要求

- Node.js 16+ 
- npm 或 yarn
- Cursor IDE 或 VS Code
- Git (用于克隆项目)

## 安装步骤

### 1. 安装依赖

```bash
cd cursor-github-plugin
npm install
```

### 2. 编译项目

```bash
npm run compile
```

### 3. 打包插件

```bash
npm run package
```

这会在项目根目录生成 `.vsix` 文件。

### 4. 安装到 Cursor

有两种方式安装：

#### 方式 1: 从 VSIX 文件安装（推荐）

1. 在 Cursor 中按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (Mac)
2. 输入 "Extensions: Install from VSIX..."
3. 选择生成的 `.vsix` 文件

#### 方式 2: 开发模式运行

1. 在 Cursor 中打开项目文件夹
2. 按 `F5` 启动调试
3. 会打开一个新的 Cursor 窗口，插件已加载

### 5. 配置 API 密钥

1. 打开设置 (`Ctrl+,` 或 `Cmd+,`)
2. 搜索 "GitHub AI"
3. 配置：
   - **GitHub Token** (可选): [获取方式](https://github.com/settings/tokens)
   - **DeepSeek API Key** (必需): [获取方式](https://www.deepseek.com/)

## 验证安装

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "GitHub AI"
3. 应该能看到以下命令：
   - GitHub AI: 搜索项目
   - GitHub AI: 对话修改代码
   - GitHub AI: 打开已下载项目
   - GitHub AI: 刷新项目列表

## 卸载

1. 按 `Ctrl+Shift+P`
2. 输入 "Extensions: Uninstall Extension"
3. 选择 "GitHub AI Plugin for Cursor"

## 故障排除

### 编译错误

如果遇到 TypeScript 编译错误：

```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
npm run compile
```

### 插件无法加载

1. 检查 `out/extension.js` 是否存在
2. 查看 Cursor 的输出面板 (View → Output → 选择扩展)
3. 检查是否有错误信息

### API 配置问题

- GitHub Token: 确保有 `public_repo` 权限
- DeepSeek API Key: 确保有效且有余额

## 开发模式

如果你想修改插件代码：

```bash
# 监听模式编译
npm run watch

# 在另一个终端运行调试
# 在 Cursor 中按 F5
```

每次保存文件后，代码会自动重新编译。

