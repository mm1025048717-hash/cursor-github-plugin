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
  private config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('githubAI');
  private getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => possible.charAt(Math.floor(Math.random() * possible.length))).join('');
  }

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
          case 'saveKeys':
            await this.currentPanel?.saveKeys(message.githubToken, message.deepseekKey);
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

  private async saveKeys(githubToken: string, deepseekKey: string) {
    const cfg = vscode.workspace.getConfiguration('githubAI');
    if (githubToken !== undefined) {
      await cfg.update('githubToken', githubToken, vscode.ConfigurationTarget.Global);
    }
    if (deepseekKey !== undefined) {
      await cfg.update('deepseekApiKey', deepseekKey, vscode.ConfigurationTarget.Global);
    }
    // 重新加载配置以让新 Key 立即生效
    this.config = vscode.workspace.getConfiguration('githubAI');
    this.aiIntentService = new AIIntentService();
    this.aiCodeModifier = new AICodeModifier();
    this.sendMessageToWebview('assistant', '配置已保存，重新尝试你的指令即可。');
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    const githubToken = this.config.get<string>('githubToken', '') || '';
    const deepseekKey = this.config.get<string>('deepseekApiKey', '') || '';
    const nonce = this.getNonce();
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub AI 控制台</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this._panel.webview.cspSource} https: data:; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src https: ${this._panel.webview.cspSource}; font-src ${this._panel.webview.cspSource} data:;">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(180deg, #f7faff 0%, #eef3fb 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            color: #15223b;
            padding: 16px;
        }
        .app {
            width: min(1280px, 100%);
            display: grid;
            grid-template-columns: 280px 1fr;
            gap: 16px;
        }
        @media (max-width: 960px) {
            .app { grid-template-columns: 1fr; }
        }
        .panel {
            background: #ffffff;
            border: 1px solid #e6ebf5;
            border-radius: 16px;
            box-shadow: 0 12px 36px rgba(25, 61, 125, 0.08);
            padding: 16px;
        }
        .side {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .section-title {
            font-size: 14px;
            font-weight: 700;
            color: #0f1b33;
            margin-bottom: 10px;
        }
        .config-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
            padding: 12px;
            background: #f8fbff;
            border: 1px solid #e3eaf6;
            border-radius: 12px;
        }
        .config-item label {
            font-size: 12px;
            color: #5a6887;
        }
        .config-item input {
            padding: 10px;
            border-radius: 10px;
            border: 1px solid #d8e2f4;
            background: #fff;
            color: #15223b;
        }
        .config-item small {
            color: #7b86a0;
            font-size: 12px;
        }
        .config-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .btn {
            padding: 10px 14px;
            border-radius: 10px;
            border: 1px solid #d6e3ff;
            background: linear-gradient(180deg, #f8fbff 0%, #e8f0ff 100%);
            color: #0f1b33;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .btn:hover { border-color: #a9c4ff; transform: translateY(-1px); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        .quick-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .quick-item {
            padding: 12px;
            border-radius: 12px;
            background: #f8fbff;
            border: 1px solid #e3eaf6;
            color: #15223b;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .quick-item:hover { background: #eaf1ff; border-color: #c9dafc; }
        .main {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .title h1 {
            font-size: 20px;
            font-weight: 700;
            color: #0f1b33;
        }
        .title span {
            font-size: 13px;
            color: #5a6887;
        }
        .status {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .badge {
            padding: 6px 10px;
            border-radius: 10px;
            background: #f4f6fb;
            color: #2c3e66;
            font-size: 12px;
            border: 1px solid #e0e6f2;
        }
        .chat-box {
            display: flex;
            flex-direction: column;
            height: 640px;
            gap: 12px;
        }
        .messages {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 8px;
            scroll-behavior: smooth;
        }
        .messages::-webkit-scrollbar { width: 8px; }
        .messages::-webkit-scrollbar-thumb { background: #d3dcf2; border-radius: 4px; }
        .message {
            max-width: 86%;
            padding: 12px 14px;
            border-radius: 12px;
            border: 1px solid #e3e8f2;
            background: #ffffff;
            color: #1f2a44;
            font-size: 14px;
            line-height: 1.6;
            animation: slideIn 0.2s ease-out;
            word-break: break-word;
        }
        @keyframes slideIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }
        .message.user {
            align-self: flex-end;
            background: #eef4ff;
            border-color: #d4e3ff;
        }
        .message.loading { color: #5a6787; }
        .message code {
            background: #f2f5fb;
            padding: 2px 6px;
            border-radius: 6px;
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            color: #1f2a44;
        }
        .repo-result {
            margin: 8px 0;
            padding: 10px 12px;
            border-radius: 10px;
            background: #f7f9fc;
            border: 1px solid #e3e8f2;
            cursor: pointer;
            transition: all 0.15s;
        }
        .repo-result:hover { background: #eaf1ff; border-color: #d4e3ff; }
        .input-area {
            display: flex;
            gap: 10px;
            padding: 10px;
            border-radius: 12px;
            background: #f7f9fc;
            border: 1px solid #e3e8f2;
        }
        #messageInput {
            flex: 1;
            background: #fff;
            border: 1px solid #d9e2f2;
            border-radius: 8px;
            padding: 12px 14px;
            color: #1f2a44;
            font-size: 14px;
            outline: none;
        }
        #messageInput::placeholder { color: #7a869c; }
        .typing-indicator { display: inline-flex; gap: 5px; align-items: center; }
        .typing-dot {
            width: 8px; height: 8px; border-radius: 50%; background: #abc7ff;
            animation: typing 1.4s infinite;
        }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    </style>
</head>
<body>
    <div class="app">
        <div class="side">
            <div class="panel">
                <div class="section-title">配置</div>
                <div class="config-item">
                    <label>GitHub Token</label>
                    <input type="text" id="githubTokenInput" value="${githubToken}" placeholder="在设置中填写 githubAI.githubToken" />
                    <small>用于提高 GitHub API 速率限制。</small>
                    <div class="config-actions">
                        <a class="btn" href="command:workbench.action.openSettings?%5B%22githubAI.githubToken%22%5D">打开设置</a>
                        <button class="btn" id="saveKeysBtn">保存配置</button>
                    </div>
                </div>
                <div class="config-item">
                    <label>DeepSeek API Key</label>
                    <input type="text" id="deepseekKeyInput" value="${deepseekKey}" placeholder="在设置中填写 githubAI.deepseekApiKey" />
                    <small>用于代码修改 / 解释。未配置会提示填写。</small>
                    <div class="config-actions">
                        <a class="btn" href="command:workbench.action.openSettings?%5B%22githubAI.deepseekApiKey%22%5D">打开设置</a>
                    </div>
                </div>
            </div>
            <div class="panel">
                <div class="section-title">快捷操作</div>
                <div class="quick-list" id="quickActions">
                    <div class="quick-item" data-prompt="找一个 React 的待办事项应用">搜索项目 · 找一个 React 的待办事项应用</div>
                    <div class="quick-item" data-prompt="下载刚才搜索到的第一个项目">下载项目 · 下载刚才搜索到的第一个</div>
                    <div class="quick-item" data-prompt="打开刚才下载的项目">打开项目 · 最新下载</div>
                    <div class="quick-item" data-prompt="帮我优化这段代码的性能">修改代码 · 描述要修改的当前文件</div>
                    <div class="quick-item" data-prompt="解释这段代码在做什么">解释代码 · 获取当前文件的解释</div>
                    <div class="quick-item" data-prompt="列出我已下载的项目">项目列表 · 查看已下载的项目</div>
                </div>
            </div>
        </div>

        <div class="main">
            <div class="panel header">
                <div class="title">
                    <h1>GitHub AI 控制台</h1>
                    <span>搜索 / 下载 / 修改 / 打开项目 · 深度联动 Cursor 工作区</span>
                </div>
                <div class="status">
                    <span class="badge">GitHub Token：设置中</span>
                    <span class="badge">DeepSeek Key：设置中</span>
                    <span class="badge">工作区：自动识别</span>
                </div>
            </div>

            <div class="panel chat-box">
                <div class="messages" id="messages">
                    <div class="message assistant">
                        你好！我是你的 GitHub AI 助手。可以：
                        <br>• 搜索并下载 GitHub 项目
                        <br>• 在 Cursor 中打开项目
                        <br>• 修改 / 解释当前文件代码
                        <br><br>试试：<code>找一个 React 的待办事项应用</code>
                    </div>
                </div>
                <div class="input-area">
                    <input type="text" id="messageInput" placeholder="输入想做的事，如：找一个 Python 爬虫项目…" autocomplete="off" />
                    <button class="btn" id="sendButton">发送</button>
                </div>
            </div>
        </div>
    </div>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const messagesDiv = document.getElementById('messages');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const quickActions = document.getElementById('quickActions');
        const saveKeysBtn = document.getElementById('saveKeysBtn');
        const githubTokenInput = document.getElementById('githubTokenInput');
        const deepseekKeyInput = document.getElementById('deepseekKeyInput');
        let isSending = false;

        // 强制清理旧的 webview service worker，避免缓存旧版本页面/脚本
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((reg) => reg.unregister());
            }).catch(() => {});
        }

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
            if (!value || sendButton.disabled || isSending) return;
            isSending = true;

            addMessage('user', value);
            messageInput.value = '';
            sendButton.disabled = true;

            vscode.postMessage({ command: 'sendMessage', text: value });

            setTimeout(() => {
                sendButton.disabled = false;
                isSending = false;
                messageInput.focus();
            }, 300);
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
            const target = el ? el.closest('[data-prompt]') : null;
            if (target instanceof HTMLElement) {
                const prompt = target.getAttribute('data-prompt') || '';
                sendMessage(prompt);
            }
        });

        saveKeysBtn?.addEventListener('click', () => {
            const githubToken = githubTokenInput && githubTokenInput instanceof HTMLInputElement ? githubTokenInput.value : '';
            const deepseekKey = deepseekKeyInput && deepseekKeyInput instanceof HTMLInputElement ? deepseekKeyInput.value : '';
            vscode.postMessage({ command: 'saveKeys', githubToken, deepseekKey });
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
                    isSending = false;
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

