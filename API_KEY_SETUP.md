# 🔑 API Key 配置指南

## DeepSeek API Key 配置

### 方法 1: 在 Cursor 设置中配置（推荐）

1. **打开设置**
   - 按 `Ctrl+,` (Windows/Linux) 或 `Cmd+,` (Mac)
   - 或点击 文件 → 首选项 → 设置

2. **搜索配置**
   - 在搜索框中输入：`githubAI.deepseekApiKey`
   - 或直接搜索：`DeepSeek API Key`

3. **输入 API Key**
   - 在输入框中粘贴你的 DeepSeek API Key
   - 格式：`sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

4. **保存**
   - 配置会自动保存
   - 无需重启，立即生效

### 方法 2: 直接在 settings.json 中配置

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入：`Preferences: Open User Settings (JSON)`
3. 添加以下配置：

```json
{
  "githubAI.deepseekApiKey": "sk-你的API密钥"
}
```

## 🔑 获取 DeepSeek API Key

1. **访问平台**
   - 打开：https://platform.deepseek.com/api_keys

2. **注册/登录**
   - 如果没有账号，先注册
   - 使用邮箱或手机号注册

3. **创建 API Key**
   - 登录后，点击"创建 API Key"
   - 给 Key 起个名字（可选）
   - 点击"创建"

4. **复制 API Key**
   - 创建成功后，会显示 API Key
   - ⚠️ **重要**：API Key 只会显示一次
   - 立即复制并妥善保存
   - 格式：`sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## ✅ 验证配置

配置完成后，可以通过以下方式验证：

1. **打开助手**
   - 按 `Ctrl+Shift+P`
   - 输入：`GitHub AI: 打开助手`

2. **测试对话**
   - 在对话界面输入："你好"
   - 如果 AI 能正常回复，说明配置成功

3. **测试搜索**
   - 输入："找一个 React 项目"
   - 如果能看到搜索结果，说明配置正确

## ⚠️ 注意事项

### 安全建议

1. **不要硬编码**
   - ❌ 不要将 API Key 写在代码中
   - ✅ 使用配置项存储

2. **不要分享**
   - ❌ 不要将 API Key 分享给他人
   - ❌ 不要提交到公开代码仓库

3. **定期更换**
   - 如果怀疑泄露，立即在平台删除并重新创建

### 常见问题

**Q: API Key 在哪里找？**
A: https://platform.deepseek.com/api_keys

**Q: API Key 格式是什么？**
A: 以 `sk-` 开头，后面跟着一串字符

**Q: 配置后还是提示需要 API Key？**
A: 
- 检查配置项名称是否正确：`githubAI.deepseekApiKey`
- 检查 API Key 格式是否正确（包含 `sk-` 前缀）
- 重启 Cursor 后再试

**Q: API Key 无效怎么办？**
A:
- 检查是否复制完整
- 检查是否有多余的空格
- 在平台重新创建一个新的 API Key

**Q: 如何查看 API 使用情况？**
A:
- 登录 https://platform.deepseek.com
- 在控制台查看使用量和余额

## 📚 相关文档

- [DeepSeek API 文档](https://api-docs.deepseek.com/zh-cn/)
- [DEEPSEEK_API_SETUP.md](DEEPSEEK_API_SETUP.md) - API 接入说明
- [快速开始.md](快速开始.md) - 完整使用指南

