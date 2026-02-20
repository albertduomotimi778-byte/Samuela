export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  has_pages: boolean;
  owner: {
    login: string;
  };
}

export interface Template {
  id: string;
  name: string;
  description: string;
  files: Record<string, string>; // filename -> content
}

export enum AppState {
  AUTH = 'AUTH',
  SELECTION = 'SELECTION',
  DEPLOYING = 'DEPLOYING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface LogEntry {
  message: string;
  timestamp: number;
  type: 'info' | 'success' | 'error';
}