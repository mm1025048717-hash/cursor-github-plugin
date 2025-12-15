// GitHub 项目信息类型
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  stars: number;
  forks: number;
  language: string | null;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

// 搜索结果
export interface SearchResult {
  repositories: GitHubRepository[];
  total_count: number;
  query: string;
}

// 下载的项目信息
export interface DownloadedProject {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  localPath: string;
  cloneUrl: string;
  downloadedAt: string;
  language: string | null;
  stars: number;
}

// AI 代码修改请求
export interface CodeModificationRequest {
  filePath: string;
  userRequest: string;
  context?: string; // 文件上下文或项目上下文
}

// AI 代码修改响应
export interface CodeModificationResponse {
  success: boolean;
  modifiedCode?: string;
  explanation?: string;
  error?: string;
  suggestions?: string[];
}

// 自然语言查询解析结果
export interface QueryIntent {
  intent: 'search' | 'modify' | 'explain' | 'refactor' | 'add_feature' | 'fix_bug';
  keywords: string[];
  language?: string;
  topic?: string;
  requirements: string[];
}

