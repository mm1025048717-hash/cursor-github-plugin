# DeepSeek API 接入说明

根据 [DeepSeek API 官方文档](https://api-docs.deepseek.com/zh-cn/) 正确接入。

## 📚 API 文档

- 官方文档：https://api-docs.deepseek.com/zh-cn/
- API 基础 URL：`https://api.deepseek.com`
- 端点：`/chat/completions`

## 🔑 API Key 配置

### 方法 1: 在 Cursor 设置中配置（推荐）

1. 按 `Ctrl+,` 打开设置
2. 搜索 "GitHub AI"
3. 找到 "DeepSeek Api Key" 配置项
4. 输入你的 API Key

### 方法 2: 获取 API Key

1. 访问：https://platform.deepseek.com/api_keys
2. 注册/登录账号
3. 创建 API Key
4. 复制 API Key 到设置中

## 🔧 API 调用格式

根据文档，DeepSeek API 使用与 OpenAI 兼容的格式：

```typescript
POST https://api.deepseek.com/chat/completions
Headers:
  Content-Type: application/json
  Authorization: Bearer ${DEEPSEEK_API_KEY}
Body:
{
  "model": "deepseek-chat",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "stream": false
}
```

## 🤖 模型说明

根据文档：

- **`deepseek-chat`** - DeepSeek-V3.2 的**非思考模式**
  - 适合：快速响应、代码生成、对话
  - 本插件使用此模型

- **`deepseek-reasoner`** - DeepSeek-V3.2 的**思考模式**
  - 适合：复杂推理、深度分析
  - 需要时可以使用

## ✅ 当前实现

插件已正确实现 DeepSeek API 调用：

1. **aiIntentService.ts** - 意图理解服务
   - URL: `https://api.deepseek.com/chat/completions`
   - 模型: `deepseek-chat`
   - 用途: 理解用户自然语言意图

2. **aiCodeModifier.ts** - 代码修改服务
   - URL: `https://api.deepseek.com/chat/completions`
   - 模型: `deepseek-chat`
   - 用途: 代码生成和修改

## 🧪 测试 API

### 使用 curl 测试

```bash
curl https://api.deepseek.com/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

### 使用 Node.js 测试

```javascript
import axios from 'axios';

const response = await axios.post(
  'https://api.deepseek.com/chat/completions',
  {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello!' }
    ],
    stream: false
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }
);

console.log(response.data.choices[0].message.content);
```

## ⚠️ 注意事项

1. **API Key 安全**
   - 不要将 API Key 提交到代码仓库
   - 使用配置项存储，不要硬编码

2. **速率限制**
   - 查看文档了解当前速率限制
   - 根据你的套餐可能有不同限制

3. **错误处理**
   - API 返回的错误码请参考文档
   - 常见错误：401（API Key 无效）、429（速率限制）、500（服务器错误）

4. **超时设置**
   - 代码生成可能需要较长时间
   - 建议设置合理的超时时间（30-90秒）

## 🔗 相关链接

- [DeepSeek API 文档](https://api-docs.deepseek.com/zh-cn/)
- [快速开始](https://api-docs.deepseek.com/zh-cn/#快速开始)
- [模型 & 价格](https://api-docs.deepseek.com/zh-cn/#模型--价格)
- [错误码](https://api-docs.deepseek.com/zh-cn/#错误码)

## 📝 更新日志

- ✅ 已更新为官方 API 端点格式
- ✅ 使用 `deepseek-chat` 模型（DeepSeek-V3.2 非思考模式）
- ✅ 添加了完整的错误处理
- ✅ 优化了超时设置

