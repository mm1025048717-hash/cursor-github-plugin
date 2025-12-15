import * as vscode from 'vscode';
import { GitHubService } from './services/githubService';
import { ProjectManager } from './services/projectManager';
import { AICodeModifier } from './services/aiCodeModifier';
import { ChatPanel } from './ui/chatPanel';

let githubService: GitHubService;
let projectManager: ProjectManager;
let aiCodeModifier: AICodeModifier;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext) {
  console.log('GitHub AI Plugin 已激活');
  extensionContext = context;

  // 初始化服务
  githubService = new GitHubService();
  projectManager = new ProjectManager(context);
  aiCodeModifier = new AICodeModifier();

  // 注册命令：打开 AI 对话界面（主要入口）
  const chatCommand = vscode.commands.registerCommand(
    'githubAI.chat',
    async () => {
      ChatPanel.createOrShow(context, githubService, projectManager, aiCodeModifier);
    }
  );

  // 保留原有命令以兼容性
  const searchCommand = vscode.commands.registerCommand(
    'githubAI.searchProject',
    async () => {
      ChatPanel.createOrShow(context, githubService, projectManager, aiCodeModifier);
    }
  );

  // 注册命令：对话修改代码
  const chatModifyCommand = vscode.commands.registerCommand(
    'githubAI.chatModify',
    async () => {
      await handleChatModify();
    }
  );

  // 注册命令：打开已下载项目
  const openProjectCommand = vscode.commands.registerCommand(
    'githubAI.openProject',
    async () => {
      await handleOpenProject();
    }
  );

  // 注册命令：刷新项目列表
  const refreshProjectsCommand = vscode.commands.registerCommand(
    'githubAI.refreshProjects',
    async () => {
      await handleRefreshProjects();
    }
  );

  context.subscriptions.push(
    chatCommand,
    searchCommand,
    chatModifyCommand,
    openProjectCommand,
    refreshProjectsCommand
  );
}

// 旧的搜索函数已移除，现在使用统一的 ChatPanel 对话界面

/**
 * 处理下载项目
 */
async function handleDownloadProject(repo: any) {
  try {
    const project = await projectManager.downloadProject(repo);

    vscode.window.showInformationMessage(
      `项目 ${project.fullName} 下载成功！`,
      '打开项目'
    ).then((action) => {
      if (action === '打开项目') {
        projectManager.openProject(project);
      }
    });
  } catch (error: any) {
    vscode.window.showErrorMessage(`下载失败: ${error.message}`);
  }
}

/**
 * 处理对话修改代码
 */
async function handleChatModify() {
  // 获取当前活动编辑器
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('请先打开一个代码文件');
    return;
  }

  const filePath = editor.document.uri.fsPath;

  // 获取用户需求
  const userRequest = await vscode.window.showInputBox({
    placeHolder: '例如：添加错误处理、优化性能、添加注释',
    prompt: '描述你想要对代码做的修改',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return '请输入修改需求';
      }
      return null;
    },
  });

  if (!userRequest) {
    return;
  }

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'AI 正在分析并修改代码...',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });

        // 获取项目上下文（如果有）
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        let context = '';
        if (workspaceFolder) {
          context = `项目路径: ${workspaceFolder.uri.fsPath}`;
        }

        // 调用 AI 修改代码
        const result = await aiCodeModifier.modifyCode({
          filePath,
          userRequest,
          context,
        });

        progress.report({ increment: 100 });

        if (result.success && result.modifiedCode) {
          // 询问用户是否应用修改
          const action = await vscode.window.showInformationMessage(
            '代码修改完成，是否应用？',
            '应用',
            '预览',
            '取消'
          );

          if (action === '应用') {
            // 应用修改
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
              editor.document.positionAt(0),
              editor.document.positionAt(editor.document.getText().length)
            );
            edit.replace(editor.document.uri, fullRange, result.modifiedCode!);
            await vscode.workspace.applyEdit(edit);
            await editor.document.save();

            vscode.window.showInformationMessage('代码已成功修改！');
          } else if (action === '预览') {
            // 在新窗口中预览
            const doc = await vscode.workspace.openTextDocument({
              content: result.modifiedCode,
              language: editor.document.languageId,
            });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          }
        } else {
          vscode.window.showErrorMessage(`修改失败: ${result.error || '未知错误'}`);
        }
      }
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`AI 修改代码失败: ${error.message}`);
  }
}

/**
 * 处理打开已下载项目
 */
async function handleOpenProject() {
  const projects = await projectManager.getAllProjects();

  if (projects.length === 0) {
    vscode.window.showInformationMessage('还没有下载任何项目');
    return;
  }

  // 验证项目是否存在
  const validProjects = projects.filter((p) => projectManager.validateProject(p));

  if (validProjects.length === 0) {
    vscode.window.showWarningMessage('所有项目都已不存在，是否清理列表？', '清理').then((action) => {
      if (action === '清理') {
        // TODO: 清理无效项目
      }
    });
    return;
  }

  const items = validProjects.map((project) => ({
    label: `$(folder) ${project.fullName}`,
    description: project.description || '',
    detail: `📁 ${project.localPath} | ⭐ ${project.stars} | ${project.language || 'N/A'}`,
    project: project,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: '选择一个项目打开',
  });

  if (selected) {
    await projectManager.openProject(selected.project);
  }
}

/**
 * 处理刷新项目列表
 */
async function handleRefreshProjects() {
  const projects = await projectManager.getAllProjects();
  vscode.window.showInformationMessage(`当前有 ${projects.length} 个已下载的项目`);
}

export function deactivate() {
  console.log('GitHub AI Plugin 已停用');
}

