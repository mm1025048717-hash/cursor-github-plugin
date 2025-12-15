import { Octokit } from '@octokit/rest';
import * as vscode from 'vscode';
import { GitHubRepository, SearchResult } from '../types';

export class GitHubService {
  private octokit: Octokit;
  private config: vscode.WorkspaceConfiguration;

  constructor() {
    this.config = vscode.workspace.getConfiguration('githubAI');
    const token = this.config.get<string>('githubToken', '');
    
    this.octokit = new Octokit({
      auth: token || undefined,
    });
  }

  /**
   * 使用自然语言搜索 GitHub 项目
   */
  async searchRepositories(query: string): Promise<SearchResult> {
    try {
      const maxResults = this.config.get<number>('maxSearchResults', 20);
      
      // 解析自然语言查询，提取关键词和筛选条件
      const searchQuery = this.parseNaturalLanguageQuery(query);
      
      const response = await this.octokit.rest.search.repos({
        q: searchQuery,
        sort: 'stars',
        order: 'desc',
        per_page: maxResults,
      });

      const repositories: GitHubRepository[] = response.data.items.map(item => ({
        id: item.id,
        name: item.name,
        full_name: item.full_name,
        description: item.description || null,
        html_url: item.html_url,
        clone_url: item.clone_url,
        ssh_url: item.ssh_url,
        stars: item.stargazers_count,
        forks: item.forks_count,
        language: item.language,
        topics: item.topics || [],
        created_at: item.created_at,
        updated_at: item.updated_at,
        pushed_at: item.pushed_at,
        owner: {
          login: item.owner?.login || 'unknown',
          avatar_url: item.owner?.avatar_url || '',
        },
      }));

      return {
        repositories,
        total_count: response.data.total_count,
        query: searchQuery,
      };
    } catch (error: any) {
      if (error.status === 403) {
        throw new Error('GitHub API 速率限制，请配置 GitHub Token 或稍后重试');
      }
      throw new Error(`搜索失败: ${error.message}`);
    }
  }

  /**
   * 解析自然语言查询，转换为 GitHub 搜索语法
   */
  private parseNaturalLanguageQuery(naturalQuery: string): string {
    // 简单的关键词提取，后续可以使用 AI 增强
    let query = naturalQuery.trim();
    
    // 移除常见的自然语言词汇
    const stopWords = ['找一个', '搜索', '找', '帮我', '给我', '想要', '需要'];
    stopWords.forEach(word => {
      query = query.replace(new RegExp(word, 'gi'), '');
    });

    // 检测语言要求（如 "Python项目"、"React应用"）
    const languagePatterns: { [key: string]: string } = {
      'python': 'language:python',
      'javascript': 'language:javascript',
      'typescript': 'language:typescript',
      'react': 'language:typescript OR language:javascript react',
      'vue': 'language:javascript vue',
      'node': 'language:javascript node',
      'java': 'language:java',
      'go': 'language:go',
      'rust': 'language:rust',
      'cpp': 'language:cpp',
      'c++': 'language:cpp',
    };

    let searchQuery = query;
    let languageFilter = '';

    for (const [keyword, filter] of Object.entries(languagePatterns)) {
      if (query.toLowerCase().includes(keyword)) {
        languageFilter = filter;
        searchQuery = query.replace(new RegExp(keyword, 'gi'), '').trim();
        break;
      }
    }

    // 组合搜索查询
    if (languageFilter) {
      return `${searchQuery} ${languageFilter}`.trim();
    }

    return searchQuery || '*';
  }

  /**
   * 获取仓库详细信息
   */
  async getRepositoryDetails(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      const repoData = response.data;
      return {
        id: repoData.id,
        name: repoData.name,
        full_name: repoData.full_name,
        description: repoData.description || null,
        html_url: repoData.html_url,
        clone_url: repoData.clone_url,
        ssh_url: repoData.ssh_url || '',
        stars: repoData.stargazers_count,
        forks: repoData.forks_count,
        language: repoData.language,
        topics: repoData.topics || [],
        created_at: repoData.created_at,
        updated_at: repoData.updated_at,
        pushed_at: repoData.pushed_at || repoData.updated_at,
        owner: {
          login: repoData.owner.login,
          avatar_url: repoData.owner.avatar_url || '',
        },
      };
    } catch (error: any) {
      throw new Error(`获取仓库信息失败: ${error.message}`);
    }
  }

  /**
   * 获取仓库的 README 内容
   */
  async getRepositoryReadme(owner: string, repo: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getReadme({
        owner,
        repo,
      });

      // Base64 解码
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return content;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw new Error(`获取 README 失败: ${error.message}`);
    }
  }
}

