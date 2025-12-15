import * as vscode from 'vscode';
import { AIIntentService, IntentResult } from '../services/aiIntentService';
import { GitHubService } from '../services/githubService';
import { ProjectManager } from '../services/projectManager';
import { AICodeModifier } from '../services/aiCodeModifier';

export class ChatPanel {
  public static currentPanel: ChatPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];
  private aiIntentService: AIIntentService;
  private githubService: GitHubService;
  private projectManager: ProjectManager;
  private aiCodeModifier: AICodeModifier;
  private context: vscode.ExtensionContext;
  private currentSearchResults: any[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    githubService: GitHubService,
    projectManager: ProjectManager,
    aiCodeModifier: AICodeModifier
  ) {
    this._panel = panel;
    this.context = context;
    this.githubService = githubService;
    this.projectManager = projectManager;
    this.aiCodeModifier = aiCodeModifier;
    this.aiIntentService = new AIIntentService();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._update();
  }

  public static createOrShow(
    context: vscode.ExtensionContext,
    githubService: GitHubService,
    projectManager: ProjectManager,
    aiCodeModifier: AICodeModifier
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ChatPanel.currentPanel) {
      ChatPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'githubAIChat',
      'GitHub AI 助手',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    ChatPanel.currentPanel = new ChatPanel(
      panel,
      context,
      githubService,
      projectManager,
      aiCodeModifier
    );

    // 监听消息
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'sendMessage':
            await this.currentPanel?.handleUserMessage(message.text);
            break;
        }
      },
      null,
      context.subscriptions
    );
  }

  private async handleUserMessage(userInput: string) {
    // 显示用户消息
    this.sendMessageToWebview('user', userInput);

    try {
      // 显示加载状态
      this.sendMessageToWebview('assistant', '思考中...', true);

      // 使用 AI 理解意图
      const intent = await this.aiIntentService.understandIntent(userInput);

      // 根据意图执行操作
      await this.executeIntent(intent);
    } catch (error: any) {
      this.sendMessageToWebview('assistant', `❌ 出错了：${error.message}`, false);
    }
  }

  private async executeIntent(intent: IntentResult) {
    switch (intent.intent) {
      case 'search':
        await this.handleSearch(intent);
        break;
      case 'download':
        await this.handleDownload(intent);
        break;
      case 'modify':
        await this.handleModify(intent);
        break;
      case 'explain':
        await this.handleExplain(intent);
        break;
      case 'open':
        await this.handleOpen(intent);
        break;
      case 'list':
        await this.handleList(intent);
        break;
      case 'help':
      case 'chat':
        await this.handleChat(intent);
        break;
    }
  }

  private async handleSearch(intent: IntentResult) {
    const query = intent.parameters.query || intent.rawQuery;
    const results = await this.githubService.searchRepositories(query);
    this.currentSearchResults = results.repositories;

    if (results.repositories.length === 0) {
      this.sendMessageToWebview('assistant', '🔍 没有找到匹配的项目。试试换个关键词？', false);
      return;
    }

    // 显示搜索结果
    const resultsHtml = results.repositories
      .slice(0, 5)
      .map(
        (repo, index) => `
      <div class="repo-result" data-index="${index}">
        <div class="repo-name">⭐ ${repo.full_name}</div>
        <div class="repo-desc">${repo.description || '无描述'}</div>
        <div class="repo-meta">${repo.stars} stars · ${repo.forks} forks · ${repo.language || 'N/A'}</div>
      </div>
    `
      )
      .join('');

    this.sendMessageToWebview(
      'assistant',
      `🔍 找到 ${results.total_count} 个项目，这里是最相关的 5 个：\n\n${resultsHtml}\n\n告诉我你要下载哪个，或者继续搜索。`,
      false
    );
  }

  private async handleDownload(intent: IntentResult) {
    if (this.currentSearchResults.length === 0) {
      this.sendMessageToWebview('assistant', '❌ 请先搜索项目。说"找一个 [项目类型] 的项目"开始搜索。', false);
      return;
    }

    // 尝试匹配项目名称或序号
    const query = intent.parameters.projectName || intent.rawQuery;
    let matchedRepo = null;

    // 检查是否是序号（如"下载第1个"、"下载第一个"）
    const indexMatch = query.match(/(?:第|下载|clone)\s*([一二三四五六七八九十\d]+)/);
    if (indexMatch) {
      const numStr = indexMatch[1];
      let index = 0;
      if (/^\d+$/.test(numStr)) {
        index = parseInt(numStr) - 1;
      } else {
        const numMap: { [key: string]: number } = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
        };
        index = (numMap[numStr] || 1) - 1;
      }
      matchedRepo = this.currentSearchResults[index];
    } else {
      // 按名称匹配
      matchedRepo = this.currentSearchResults.find(
        (repo) =>
          repo.full_name.toLowerCase().includes(query.toLowerCase()) ||
          repo.name.toLowerCase().includes(query.toLowerCase())
      ) || this.currentSearchResults[0];
    }

    if (!matchedRepo) {
      this.sendMessageToWebview('assistant', '❌ 没找到匹配的项目，请重新选择。', false);
      return;
    }

    try {
      this.sendMessageToWebview('assistant', `📥 正在下载 ${matchedRepo.full_name}...`, true);
      const project = await this.projectManager.downloadProject(matchedRepo);
      this.sendMessageToWebview(
        'assistant',
        `✅ 下载完成！项目已保存到：${project.localPath}\n\n说"打开项目"或"打开 ${project.name}"就可以在 Cursor 中打开它。`,
        false
      );
    } catch (error: any) {
      this.sendMessageToWebview('assistant', `❌ 下载失败：${error.message}`, false);
    }
  }

  private async handleModify(intent: IntentResult) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendMessageToWebview('assistant', '❌ 请先打开一个代码文件。', false);
      return;
    }

    try {
      this.sendMessageToWebview('assistant', '🤖 AI 正在分析代码并生成修改...', true);
      const result = await this.aiCodeModifier.modifyCode({
        filePath: editor.document.uri.fsPath,
        userRequest: intent.parameters.action || intent.rawQuery,
      });

      if (result.success && result.modifiedCode) {
        // 应用修改
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length)
        );
        edit.replace(editor.document.uri, fullRange, result.modifiedCode);
        await vscode.workspace.applyEdit(edit);
        await editor.document.save();

        this.sendMessageToWebview('assistant', '✅ 代码已修改完成！', false);
      } else {
        this.sendMessageToWebview('assistant', `❌ 修改失败：${result.error}`, false);
      }
    } catch (error: any) {
      this.sendMessageToWebview('assistant', `❌ 出错了：${error.message}`, false);
    }
  }

  private async handleExplain(intent: IntentResult) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this.sendMessageToWebview('assistant', '❌ 请先打开一个代码文件。', false);
      return;
    }

    try {
      this.sendMessageToWebview('assistant', '📖 正在分析代码...', true);
      const explanation = await this.aiCodeModifier.explainCode(editor.document.uri.fsPath);
      this.sendMessageToWebview('assistant', `📖 ${explanation}`, false);
    } catch (error: any) {
      this.sendMessageToWebview('assistant', `❌ 解释失败：${error.message}`, false);
    }
  }

  private async handleOpen(intent: IntentResult) {
    const projects = await this.projectManager.getAllProjects();
    if (projects.length === 0) {
      this.sendMessageToWebview('assistant', '📁 你还没有下载任何项目。先搜索并下载一个吧！', false);
      return;
    }

    const projectName = intent.parameters.projectName?.toLowerCase() || '';
    const matchedProject =
      projects.find((p) => p.fullName.toLowerCase().includes(projectName)) || projects[0];

    try {
      await this.projectManager.openProject(matchedProject);
      this.sendMessageToWebview('assistant', `✅ 已打开项目：${matchedProject.fullName}`, false);
    } catch (error: any) {
      this.sendMessageToWebview('assistant', `❌ 打开失败：${error.message}`, false);
    }
  }

  private async handleList(intent: IntentResult) {
    const projects = await this.projectManager.getAllProjects();
    if (projects.length === 0) {
      this.sendMessageToWebview('assistant', '📁 你还没有下载任何项目。', false);
      return;
    }

    const listHtml = projects
      .map((p) => `• ${p.fullName} (${p.language || 'N/A'}) - ${p.stars} ⭐`)
      .join('\n');

    this.sendMessageToWebview('assistant', `📁 已下载的项目：\n\n${listHtml}`, false);
  }

  private async handleChat(intent: IntentResult) {
    const response = await this.aiIntentService.generateResponse(intent.intent, intent);
    this.sendMessageToWebview('assistant', response, false);
  }

  private sendMessageToWebview(role: 'user' | 'assistant', content: string, isLoading: boolean = false) {
    this._panel.webview.postMessage({
      command: 'addMessage',
      role,
      content,
      isLoading,
    });
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub AI 控制台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            background: radial-gradient(circle at 20% 20%, rgba(116, 165, 255, 0.25), transparent 35%),
                        radial-gradient(circle at 80% 0%, rgba(118, 75, 162, 0.25), transparent 30%),
                        linear-gradient(135deg, #5f7cff 0%, #7c4dff 50%, #121826 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            color: #e9ecf5;
            padding: 28px 16px 24px;
        }
        .shell {
            width: min(1200px, 100%);
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .glass {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 18px;
            backdrop-filter: blur(12px);
            box-shadow: 0 10px 40px rgba(0,0,0,0.35);
        }
        .header {
            padding: 18px 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .title {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .title h1 {
            font-size: 24px;
            font-weight: 700;
            background: linear-gradient(135deg, #c3d9ff 0%, #9cc4ff 50%, #e5d6ff 100%);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .title span {
            font-size: 13px;
            color: #b9c2d8;
        }
        .badges {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .badge {
            padding: 6px 10px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.08);
            color: #d7def0;
            font-size: 12px;
            border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .layout {
            display: grid;
            grid-template-columns: 1.1fr 0.9fr;
            gap: 16px;
        }
        @media (max-width: 960px) {
            .layout { grid-template-columns: 1fr; }
        }
        .card {
            padding: 16px;
        }
        .card h2 {
            font-size: 16px;
            font-weight: 600;
            color: #e8eeff;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .sub {
            font-size: 13px;
            color: #a9b4cc;
            margin-bottom: 14px;
            line-height: 1.5;
        }
        .pill-row {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }
        .pill {
            padding: 10px 12px;
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: #dfe6f7;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .pill:hover {
            background: rgba(255, 255, 255, 0.12);
            transform: translateY(-1px);
        }
        .quick-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 10px;
        }
        .quick {
            padding: 12px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.05);
            color: #dfe6f7;
            font-size: 13px;
            line-height: 1.5;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .quick:hover { background: rgba(255, 255, 255, 0.12); transform: translateY(-1px); }
        .quick strong { display: block; margin-bottom: 6px; font-size: 14px; color: #f3f6ff; }

        .chat-box {
            height: 540px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 10px;
            scroll-behavior: smooth;
        }
        .messages::-webkit-scrollbar { width: 8px; }
        .messages::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
        .message {
            max-width: 86%;
            padding: 14px 16px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(10px);
            color: #e8eeff;
            font-size: 14px;
            line-height: 1.6;
            animation: slideIn 0.25s ease-out;
            word-break: break-word;
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        .message.user {
            align-self: flex-end;
            background: linear-gradient(135deg, rgba(118, 153, 255, 0.9), rgba(141, 108, 255, 0.9));
            color: #fff;
        }
        .message.loading { color: #cdd7ef; }
        .message strong { color: #fff; }
        .message code {
            background: rgba(0,0,0,0.25);
            padding: 2px 6px;
            border-radius: 6px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        }
        .repo-result {
            margin: 10px 0;
            padding: 10px 12px;
            border-radius: 12px;
            background: rgba(118, 153, 255, 0.12);
            border: 1px solid rgba(118, 153, 255, 0.18);
            cursor: pointer;
            transition: all 0.2s;
        }
        .repo-result:hover { background: rgba(118, 153, 255, 0.2); transform: translateX(4px); }
        .repo-name { font-weight: 600; margin-bottom: 4px; color: #dfe6ff; }
        .repo-desc { font-size: 13px; color: #b7c1da; margin-bottom: 4px; }
        .repo-meta { font-size: 12px; color: #9fb0d4; }

        .input-area {
            display: flex;
            gap: 10px;
            padding: 8px;
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.07);
            border: 1px solid rgba(255, 255, 255, 0.08);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
        }
        #messageInput {
            flex: 1;
            background: rgba(0,0,0,0.25);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 10px;
            padding: 12px 14px;
            color: #e8eeff;
            font-size: 14px;
            outline: none;
        }
        #messageInput::placeholder { color: #9fb0d4; }
        #sendButton {
            padding: 12px 18px;
            border: none;
            border-radius: 10px;
            background: linear-gradient(135deg, #7ea4ff 0%, #9b7dff 100%);
            color: #fff;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 8px 20px rgba(126,164,255,0.35);
        }
        #sendButton:hover { transform: translateY(-1px); }
        #sendButton:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .typing-indicator { display: inline-flex; gap: 5px; align-items: center; }
        .typing-dot {
            width: 8px; height: 8px; border-radius: 50%; background: #bcd2ff;
            animation: typing 1.4s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typing { 0%, 60%, 100% { transform: translateY(0); opacity: 0.7;} 30% { transform: translateY(-8px); opacity: 1;} }
    </style>
</head>
<body>
    <div class="shell">
        <div class="glass header">
            <div class="title">
                <h1>✨ GitHub AI 控制台</h1>
                <span>搜索 / 下载 / 修改 / 打开项目 · 深度联动 Cursor 工作区</span>
            </div>
            <div class="badges">
                <span class="badge">GitHub Token：设置中</span>
                <span class="badge">DeepSeek Key：设置中</span>
                <span class="badge">工作区：自动识别</span>
            </div>
        </div>

        <div class="layout">
            <div class="glass card">
                <h2>🚀 快捷操作</h2>
                <p class="sub">一键触发常用意图，立即和 Cursor 联动。</p>
                <div class="quick-grid" id="quickActions">
                    <div class="quick" data-prompt="找一个 React 的待办事项应用">
                        <strong>搜索项目</strong>
                        找一个 React 的待办事项应用
                    </div>
                    <div class="quick" data-prompt="下载刚才搜索到的第一个项目">
                        <strong>下载项目</strong>
                        下载刚才搜索到的第一个项目
                    </div>
                    <div class="quick" data-prompt="打开刚才下载的项目">
                        <strong>打开项目</strong>
                        在 Cursor 中打开最新下载的项目
                    </div>
                    <div class="quick" data-prompt="帮我优化这段代码的性能">
                        <strong>修改代码</strong>
                        描述要修改的当前文件
                    </div>
                    <div class="quick" data-prompt="解释这段代码在做什么">
                        <strong>解释代码</strong>
                        获取当前文件的解释
                    </div>
                    <div class="quick" data-prompt="列出我已下载的项目">
                        <strong>项目列表</strong>
                        查看已下载并可直接打开的项目
                    </div>
                </div>
            </div>

            <div class="glass card">
                <h2>🧭 使用提示</h2>
                <p class="sub">先在设置里填写 GitHub Token 与 DeepSeek Key。搜索后说“下载第一个 / 打开项目”即可直接联动。</p>
                <div class="pill-row">
                    <div class="pill" data-prompt="找一个 Vue 的低代码平台">🔍 搜索低代码</div>
                    <div class="pill" data-prompt="下载这个项目">📥 立即下载</div>
                    <div class="pill" data-prompt="打开项目">📂 在 Cursor 打开</div>
                    <div class="pill" data-prompt="给当前文件添加错误处理">✏️ 修改当前文件</div>
                    <div class="pill" data-prompt="解释当前函数的作用">📖 解释函数</div>
                </div>
            </div>
        </div>

        <div class="glass card chat-box">
            <h2>💬 对话</h2>
            <div class="messages" id="messages">
                <div class="message assistant">
                    👋 你好！我是你的 GitHub AI 助手。可以：
                    <br>• 搜索并下载 GitHub 项目
                    <br>• 在 Cursor 中打开项目
                    <br>• 修改 / 解释当前文件代码
                    <br><br>试试：<code>找一个 React 的待办事项应用</code>
                </div>
            </div>
            <div class="input-area">
                <input type="text" id="messageInput" placeholder="输入想做的事，如：找一个 Python 爬虫项目…" autocomplete="off" />
                <button id="sendButton">发送</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const quickActions = document.getElementById('quickActions');

        function addMessage(role, content, isLoading = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role} \${isLoading ? 'loading' : ''}\`;

            const contentDiv = document.createElement('div');
            if (isLoading && role === 'assistant') {
                contentDiv.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
            } else {
                contentDiv.innerHTML = content
                    .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                    .replace(/\\n/g, '<br>');
            }

            messageDiv.appendChild(contentDiv);
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            if (isLoading) return messageDiv;
            return null;
        }

        function sendMessage(text) {
            const value = text.trim();
            if (!value || sendButton.disabled) return;

            addMessage('user', value);
            messageInput.value = '';
            sendButton.disabled = true;

            vscode.postMessage({ command: 'sendMessage', text: value });

            setTimeout(() => {
                sendButton.disabled = false;
                messageInput.focus();
            }, 120);
        }

        sendButton.addEventListener('click', () => sendMessage(messageInput.value));
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(messageInput.value);
            }
        });

        quickActions?.addEventListener('click', (e) => {
            const el = e.target instanceof HTMLElement ? e.target : null;
            const target = el ? el.closest('[data-prompt]') as HTMLElement | null : null;
            if (target) {
                const prompt = target.getAttribute('data-prompt') || '';
                sendMessage(prompt);
            }
        });

        document.querySelectorAll('.pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt') || '';
                sendMessage(prompt);
            });
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'addMessage') {
                const lastMessage = messagesDiv.lastElementChild;
                if (lastMessage && lastMessage.classList.contains('loading')) {
                    lastMessage.remove();
                }
                const messageDiv = addMessage(message.role, message.content, message.isLoading);
                if (!message.isLoading) {
                    sendButton.disabled = false;
                    messageInput.focus();
                }
            }
        });

        messageInput.focus();
    </script>
</body>
</html>`;
  }

  private dispose() {
    ChatPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

