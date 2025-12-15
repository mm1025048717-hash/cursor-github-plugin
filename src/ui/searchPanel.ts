import * as vscode from 'vscode';
import { GitHubRepository } from '../types';

export class SearchPanel {
  public static currentPanel: SearchPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this._panel = panel;
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.html = this._getHtmlForWebview();
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SearchPanel.currentPanel) {
      SearchPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'githubAISearch',
      'GitHub AI 搜索',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );

    SearchPanel.currentPanel = new SearchPanel(panel);
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    SearchPanel.currentPanel = new SearchPanel(panel);
  }

  public updateSearchResults(repositories: GitHubRepository[]) {
    this._panel.webview.postMessage({
      command: 'updateResults',
      repositories,
    });
  }

  private _getHtmlForWebview(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub AI 搜索</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            margin: 0;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .search-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .search-box {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        input[type="text"] {
            flex: 1;
            padding: 12px;
            font-size: 14px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border-radius: 4px;
        }
        button {
            padding: 12px 24px;
            font-size: 14px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .results {
            display: grid;
            gap: 16px;
        }
        .repo-card {
            padding: 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background: var(--vscode-sideBar-background);
            cursor: pointer;
            transition: all 0.2s;
        }
        .repo-card:hover {
            border-color: var(--vscode-button-background);
            transform: translateY(-2px);
        }
        .repo-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 8px;
        }
        .repo-name {
            font-size: 18px;
            font-weight: 600;
            color: var(--vscode-textLink-foreground);
        }
        .repo-stats {
            display: flex;
            gap: 16px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .repo-description {
            margin: 8px 0;
            color: var(--vscode-editor-foreground);
        }
        .repo-meta {
            display: flex;
            gap: 12px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="search-container">
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="用自然语言描述你想要找的项目，例如：找一个 React 的待办事项应用">
            <button id="searchBtn">搜索</button>
        </div>
        <div id="results" class="results">
            <div class="empty-state">
                <p>输入关键词开始搜索 GitHub 项目</p>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const searchInput = document.getElementById('searchInput');
        const searchBtn = document.getElementById('searchBtn');
        const resultsDiv = document.getElementById('results');

        searchBtn.addEventListener('click', () => {
            const query = searchInput.value.trim();
            if (query) {
                vscode.postMessage({ command: 'search', query });
                resultsDiv.innerHTML = '<div class="loading">正在搜索...</div>';
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateResults':
                    displayResults(message.repositories);
                    break;
            }
        });

        function displayResults(repositories) {
            if (repositories.length === 0) {
                resultsDiv.innerHTML = '<div class="empty-state"><p>未找到匹配的项目</p></div>';
                return;
            }

            resultsDiv.innerHTML = repositories.map(repo => \`
                <div class="repo-card" data-repo='\${JSON.stringify(repo)}'>
                    <div class="repo-header">
                        <div class="repo-name">\${repo.full_name}</div>
                        <div class="repo-stats">
                            <span>⭐ \${repo.stars}</span>
                            <span>🍴 \${repo.forks}</span>
                            <span>\${repo.language || 'N/A'}</span>
                        </div>
                    </div>
                    <div class="repo-description">\${repo.description || '无描述'}</div>
                    <div class="repo-meta">
                        <span>📅 更新于: \${new Date(repo.updated_at).toLocaleDateString()}</span>
                    </div>
                </div>
            \`).join('');

            document.querySelectorAll('.repo-card').forEach(card => {
                card.addEventListener('click', () => {
                    const repo = JSON.parse(card.dataset.repo);
                    vscode.postMessage({ command: 'download', repo });
                });
            });
        }
    </script>
</body>
</html>`;
  }

  private dispose() {
    SearchPanel.currentPanel = undefined;
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}

