import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { CodeModificationRequest, CodeModificationResponse } from '../types';

export class AICodeModifier {
  private config: vscode.WorkspaceConfiguration;
  private apiKey: string | null = null;
  // DeepSeek API 文档: https://api-docs.deepseek.com/zh-cn/
  // base_url: https://api.deepseek.com
  // 路径: /chat/completions
  private apiBaseUrl = 'https://api.deepseek.com/chat/completions';

  constructor() {
    this.config = vscode.workspace.getConfiguration('githubAI');
    // 从配置读取 API Key
    this.apiKey = this.config.get<string>('deepseekApiKey', '') || null;
  }

  /**
   * 使用 AI 修改代码
   */
  async modifyCode(request: CodeModificationRequest): Promise<CodeModificationResponse> {
    if (!this.apiKey) {
      throw new Error('请先配置 DeepSeek API Key');
    }

    // 读取文件内容
    let originalCode = '';
    if (fs.existsSync(request.filePath)) {
      originalCode = fs.readFileSync(request.filePath, 'utf-8');
    }

    // 构建上下文
    const context = this.buildContext(request, originalCode);

    // 调用 AI API
    try {
      // 根据 DeepSeek API 文档：https://api-docs.deepseek.com/zh-cn/
      const response = await axios.post(
        this.apiBaseUrl,
        {
          model: 'deepseek-chat', // DeepSeek-V3.2 非思考模式，适合代码生成
          messages: [
            {
              role: 'system',
              content: `你是一个专业的代码助手。根据用户的需求，修改代码文件。

要求：
1. 只返回修改后的完整代码，不要返回其他内容
2. 保持代码风格和结构
3. 确保代码语法正确
4. 如果用户需求不明确，可以提出建议

代码文件路径: ${request.filePath}
文件语言: ${this.detectLanguage(request.filePath)}`,
            },
            {
              role: 'user',
              content: `原始代码：
\`\`\`${this.detectLanguage(request.filePath)}
${originalCode}
\`\`\`

用户需求：${request.userRequest}

${context ? `额外上下文：${context}` : ''}

请根据用户需求修改代码，返回完整的修改后的代码。`,
            },
          ],
          temperature: 0.3, // 较低的 temperature 确保代码准确性
          max_tokens: 8000, // 支持较长的代码文件
          stream: false, // 非流式输出，确保返回完整代码
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`, // Bearer token 格式
          },
          timeout: 90000, // 代码生成可能需要更长时间
        }
      );

      const modifiedCode = response.data.choices[0]?.message?.content || '';
      
      // 清理代码（移除可能的 markdown 代码块标记）
      const cleanedCode = this.cleanCode(modifiedCode);

      return {
        success: true,
        modifiedCode: cleanedCode,
        explanation: '代码修改完成',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * 构建上下文信息
   */
  private buildContext(request: CodeModificationRequest, code: string): string {
    let context = '';

    if (request.context) {
      context += `项目上下文：${request.context}\n`;
    }

    // 分析代码结构，提供额外上下文
    const codeStructure = this.analyzeCodeStructure(code);
    if (codeStructure) {
      context += `代码结构：${codeStructure}\n`;
    }

    return context.trim();
  }

  /**
   * 分析代码结构
   */
  private analyzeCodeStructure(code: string): string | null {
    // 简单分析：提取函数、类等
    const functions = code.match(/(?:function|const|let|var)\s+(\w+)\s*[=\(]/g);
    const classes = code.match(/class\s+(\w+)/g);
    const imports = code.match(/import\s+.+from\s+['"](.+?)['"]/g);

    const parts: string[] = [];
    if (classes && classes.length > 0) {
      parts.push(`类: ${classes.length}个`);
    }
    if (functions && functions.length > 0) {
      parts.push(`函数: ${functions.length}个`);
    }
    if (imports && imports.length > 0) {
      parts.push(`依赖: ${imports.length}个`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.vue': 'vue',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.xml': 'xml',
      '.md': 'markdown',
    };

    return languageMap[ext] || 'text';
  }

  /**
   * 清理代码（移除 markdown 代码块标记等）
   */
  private cleanCode(code: string): string {
    // 移除 ```language 和 ``` 标记
    let cleaned = code.replace(/```[\w]*\n?/g, '').trim();
    
    // 如果还有多余的内容，尝试提取代码块
    const codeBlockMatch = cleaned.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleaned = codeBlockMatch[1].trim();
    }

    return cleaned;
  }

  /**
   * 解释代码
   */
  async explainCode(filePath: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('请先配置 DeepSeek API Key');
    }

    const code = fs.readFileSync(filePath, 'utf-8');

    try {
      // 根据 DeepSeek API 文档调用
      const response = await axios.post(
        this.apiBaseUrl,
        {
          model: 'deepseek-chat', // DeepSeek-V3.2 非思考模式
          messages: [
            {
              role: 'system',
              content: '你是一个代码解释助手。请用中文清晰地解释代码的功能和结构。',
            },
            {
              role: 'user',
              content: `请解释以下代码：

\`\`\`${this.detectLanguage(filePath)}
${code}
\`\`\``,
            },
          ],
          temperature: 0.5, // 适中的 temperature 平衡准确性和创造性
          max_tokens: 2000,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          timeout: 30000,
        }
      );

      return response.data.choices[0]?.message?.content || '无法解释代码';
    } catch (error: any) {
      throw new Error(`解释代码失败: ${error.message}`);
    }
  }
}

