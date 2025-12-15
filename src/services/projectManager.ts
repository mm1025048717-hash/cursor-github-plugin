import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import simpleGit, { SimpleGit } from 'simple-git';
import { GitHubRepository, DownloadedProject } from '../types';

export class ProjectManager {
  private config: vscode.WorkspaceConfiguration;
  private projectsFilePath: string;

  constructor(context: vscode.ExtensionContext) {
    this.config = vscode.workspace.getConfiguration('githubAI');
    const storagePath = context.globalStoragePath;
    this.projectsFilePath = path.join(storagePath, 'downloaded-projects.json');
  }

  /**
   * 获取下载目录
   */
  getDownloadPath(): string {
    const configPath = this.config.get<string>('downloadPath', '${workspaceFolder}/github-projects');
    
    // 替换 ${workspaceFolder}
    if (configPath.includes('${workspaceFolder}')) {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceFolder) {
        return configPath.replace('${workspaceFolder}', workspaceFolder);
      }
    }

    // 如果没有工作区，使用用户目录
    return path.join(os.homedir(), 'github-projects');
  }

  /**
   * 下载/克隆项目
   */
  async downloadProject(repository: GitHubRepository): Promise<DownloadedProject> {
    const downloadPath = this.getDownloadPath();
    const projectPath = path.join(downloadPath, repository.full_name);

    // 确保下载目录存在
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }

    // 如果项目已存在，提示用户
    if (fs.existsSync(projectPath)) {
      const overwrite = await vscode.window.showWarningMessage(
        `项目 ${repository.full_name} 已存在，是否覆盖？`,
        '覆盖',
        '取消'
      );

      if (overwrite === '覆盖') {
        fs.rmSync(projectPath, { recursive: true, force: true });
      } else {
        throw new Error('下载已取消');
      }
    }

    // 显示进度
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `正在下载 ${repository.full_name}...`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0, message: '正在克隆仓库...' });

        try {
          const git: SimpleGit = simpleGit();
          await git.clone(repository.clone_url, projectPath);
          
          progress.report({ increment: 100, message: '下载完成！' });
        } catch (error: any) {
          throw new Error(`克隆失败: ${error.message}`);
        }
      }
    );

    // 保存项目信息
    const project: DownloadedProject = {
      id: repository.id.toString(),
      name: repository.name,
      fullName: repository.full_name,
      description: repository.description,
      localPath: projectPath,
      cloneUrl: repository.clone_url,
      downloadedAt: new Date().toISOString(),
      language: repository.language,
      stars: repository.stars,
    };

    await this.saveProject(project);

    return project;
  }

  /**
   * 保存项目信息到本地文件
   */
  private async saveProject(project: DownloadedProject): Promise<void> {
    const projects = await this.getAllProjects();
    
    // 检查是否已存在
    const existingIndex = projects.findIndex(p => p.id === project.id);
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }

    // 确保目录存在
    const dir = path.dirname(this.projectsFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.projectsFilePath, JSON.stringify(projects, null, 2), 'utf-8');
  }

  /**
   * 获取所有已下载的项目
   */
  async getAllProjects(): Promise<DownloadedProject[]> {
    if (!fs.existsSync(this.projectsFilePath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.projectsFilePath, 'utf-8');
      return JSON.parse(content) as DownloadedProject[];
    } catch (error) {
      vscode.window.showErrorMessage(`读取项目列表失败: ${error}`);
      return [];
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: string): Promise<void> {
    const projects = await this.getAllProjects();
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      throw new Error('项目不存在');
    }

    // 删除本地文件
    if (fs.existsSync(project.localPath)) {
      fs.rmSync(project.localPath, { recursive: true, force: true });
    }

    // 从列表中移除
    const filteredProjects = projects.filter(p => p.id !== projectId);
    
    fs.writeFileSync(
      this.projectsFilePath,
      JSON.stringify(filteredProjects, null, 2),
      'utf-8'
    );
  }

  /**
   * 在 Cursor 中打开项目
   */
  async openProject(project: DownloadedProject): Promise<void> {
    const uri = vscode.Uri.file(project.localPath);
    await vscode.commands.executeCommand('vscode.openFolder', uri, true);
  }

  /**
   * 验证项目是否仍然存在
   */
  validateProject(project: DownloadedProject): boolean {
    return fs.existsSync(project.localPath);
  }
}

