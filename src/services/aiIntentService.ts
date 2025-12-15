import axios from 'axios';
import * as vscode from 'vscode';

export interface IntentResult {
  intent: 'search' | 'download' | 'modify' | 'explain' | 'open' | 'list' | 'help' | 'chat';
  confidence: number;
  parameters: {
    query?: string;
    projectName?: string;
    action?: string;
    filePath?: string;
    language?: string;
  };
  rawQuery: string;
}

export class AIIntentService {
  private config: vscode.WorkspaceConfiguration;
  // DeepSeek API 文档: https://api-docs.deepseek.com/zh-cn/
  // base_url: https://api.deepseek.com
  // 路径: /chat/completions
  private apiBaseUrl = 'https://api.deepseek.com/chat/completions';

  constructor() {
    this.config = vscode.workspace.getConfiguration('githubAI');
  }

  private getApiKey(): string | null {
    this.config = vscode.workspace.getConfiguration('githubAI');
    const key = this.config.get<string>('deepseekApiKey', '') || '';
    return key || null;
  }

  /**
   * 使用 AI 理解用户意图
   */
  async understandIntent(userQuery: string): Promise<IntentResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('请先配置 DeepSeek API Key');
    }

    const systemPrompt = `你是一个智能助手，专门理解用户关于 GitHub 项目和代码操作的意图。

用户可能的操作包括：
1. **search** - 搜索 GitHub 项目（如"找一个 React 项目"、"搜索 Python 的机器学习库"）
2. **download** - 下载项目（如"下载这个项目"、"克隆 react-todo"）
3. **modify** - 修改代码（如"添加错误处理"、"优化这个函数"、"重构代码"）
4. **explain** - 解释代码（如"这段代码什么意思"、"解释这个函数"）
5. **open** - 打开项目（如"打开 react-todo"、"切换到某个项目"）
6. **list** - 列出已下载项目（如"显示我的项目"、"有哪些项目"）
7. **chat** - 普通对话（如"你好"、"谢谢"）

请分析用户输入，返回 JSON 格式：
{
  "intent": "search|download|modify|explain|open|list|chat",
  "confidence": 0.0-1.0,
  "parameters": {
    "query": "搜索关键词（如果是搜索意图）",
    "projectName": "项目名称（如果是下载/打开意图）",
    "action": "具体操作描述（如果是修改代码）",
    "filePath": "文件路径（如果有提到）",
    "language": "编程语言（如果提到）"
  }
}

只返回 JSON，不要其他内容。`;

    try {
      const response = await axios.post(
        this.apiBaseUrl,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userQuery,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: 10000,
        }
      );

      const content = response.data.choices[0]?.message?.content || '';
      const cleaned = this.cleanJsonResponse(content);
      
      try {
        const result = JSON.parse(cleaned) as IntentResult;
        result.rawQuery = userQuery;
        return result;
      } catch (parseError) {
        // 如果解析失败，尝试降级处理
        return this.fallbackIntent(userQuery);
      }
    } catch (error: any) {
      console.error('AI 意图理解失败:', error);
      return this.fallbackIntent(userQuery);
    }
  }

  /**
   * 清理 AI 返回的 JSON（移除 markdown 代码块等）
   */
  private cleanJsonResponse(content: string): string {
    let cleaned = content.trim();
    
    // 移除 ```json 和 ``` 标记
    cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // 提取 JSON 对象
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return cleaned;
  }

  /**
   * 降级处理：简单的关键词匹配
   */
  private fallbackIntent(query: string): IntentResult {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('搜索') || lowerQuery.includes('找') || lowerQuery.includes('search')) {
      return {
        intent: 'search',
        confidence: 0.7,
        parameters: { query: query.replace(/搜索|找|search/gi, '').trim() },
        rawQuery: query,
      };
    }
    
    if (lowerQuery.includes('下载') || lowerQuery.includes('clone') || lowerQuery.includes('下载')) {
      return {
        intent: 'download',
        confidence: 0.7,
        parameters: {},
        rawQuery: query,
      };
    }
    
    if (lowerQuery.includes('修改') || lowerQuery.includes('改') || lowerQuery.includes('优化')) {
      return {
        intent: 'modify',
        confidence: 0.7,
        parameters: { action: query },
        rawQuery: query,
      };
    }
    
    if (lowerQuery.includes('打开') || lowerQuery.includes('open')) {
      return {
        intent: 'open',
        confidence: 0.7,
        parameters: {},
        rawQuery: query,
      };
    }
    
    if (lowerQuery.includes('列表') || lowerQuery.includes('项目') || lowerQuery.includes('list')) {
      return {
        intent: 'list',
        confidence: 0.7,
        parameters: {},
        rawQuery: query,
      };
    }

    return {
      intent: 'chat',
      confidence: 0.5,
      parameters: {},
      rawQuery: query,
    };
  }

  /**
   * 使用 AI 生成友好的回复
   */
  async generateResponse(intent: string, context?: any): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return '请先配置 DeepSeek API Key';
    }

    const prompt = `用户执行了操作：${intent}
${context ? `上下文：${JSON.stringify(context)}` : ''}

请生成一个友好、简洁的回复，用中文。`;

    try {
      // 根据 DeepSeek API 文档调用
      const response = await axios.post(
        this.apiBaseUrl,
        {
          model: 'deepseek-chat', // DeepSeek-V3.2 非思考模式
          messages: [
            {
              role: 'system',
              content: '你是一个友好、专业的助手，用简洁的中文回复用户。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 200,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          timeout: 15000,
        }
      );

      return response.data.choices[0]?.message?.content || '操作完成';
    } catch (error) {
      return '操作完成';
    }
  }
}

