import { GitHubRepo, GitHubUser } from '../types';

const BASE_URL = 'https://api.github.com';

class GitHubService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private get headers() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
  }

  async validateToken(): Promise<GitHubUser> {
    const res = await fetch(`${BASE_URL}/user`, { headers: this.headers });
    if (!res.ok) throw new Error('Invalid token or network error');
    return res.json();
  }

  async getUserRepos(username: string): Promise<GitHubRepo[]> {
    // Fetch up to 100 recently updated repos
    const res = await fetch(`${BASE_URL}/users/${username}/repos?sort=updated&per_page=100`, { headers: this.headers });
    if (!res.ok) throw new Error('Failed to fetch repositories');
    return res.json();
  }

  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}`, { headers: this.headers });
    if (!res.ok) throw new Error('Failed to fetch repository details');
    return res.json();
  }

  async getBranch(owner: string, repo: string, branch: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/branches/${branch}`, { headers: this.headers });
    if (!res.ok) throw new Error('Failed to fetch branch details');
    return res.json();
  }

  async getFile(owner: string, repo: string, path: string): Promise<any> {
    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/${path}`, { headers: this.headers });
    if (!res.ok) throw new Error('File not found');
    return res.json();
  }

  async createRepo(name: string, description: string, owner?: string): Promise<GitHubRepo> {
    const res = await fetch(`${BASE_URL}/user/repos`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        name,
        description,
        private: false, // Pages is free for public repos
        auto_init: true, // Creates an initial commit (README) which helps Pages
      }),
    });
    
    if (!res.ok) {
      // Handle "Repository already exists" (422 Unprocessable Entity)
      if (res.status === 422) {
        // If we know the owner, try to fetch the existing repo
        if (owner) {
          try {
             console.log(`Repository ${name} might already exist. Attempting to fetch it...`);
             const existingRepo = await this.getRepo(owner, name);
             return existingRepo;
          } catch (e) {
             // If fetch fails, fall through to error throw
             console.warn('Failed to recover existing repo:', e);
          }
        }
      }

      const err = await res.json().catch(() => ({ message: res.statusText }));
      // Provide more specific error for common cases
      if (res.status === 401) throw new Error('Unauthorized: Please check your token permissions.');
      if (res.status === 403) throw new Error('Forbidden: Your token does not have permission to create repositories.');
      
      throw new Error(err.message || `Failed to create repository (${res.status})`);
    }
    return res.json();
  }

  async deleteRepo(owner: string, repo: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}`, {
      method: 'DELETE',
      headers: this.headers,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403) {
             throw new Error("Permission denied. Ensure your token has 'delete_repo' scope.");
        }
        if (res.status === 404) {
             throw new Error("Repository not found. It may have already been deleted.");
        }
        throw new Error(err.message || `Failed to delete repository (${res.status})`);
    }
  }

  async renameRepo(owner: string, repo: string, newName: string): Promise<GitHubRepo> {
    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}`, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify({ name: newName })
    });
    if (!res.ok) {
       const err = await res.json();
       throw new Error(err.message || 'Failed to rename repository');
    }
    return res.json();
  }

  async triggerWorkflowDispatch(owner: string, repo: string, workflowFileName: string = 'deploy.yml', ref: string = 'main') {
    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/actions/workflows/${workflowFileName}/dispatches`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ ref })
    });
    
    if (!res.ok) {
        // Try to read error
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to trigger workflow (${res.status})`);
    }
  }

  async uploadFile(owner: string, repo: string, path: string, content: string, message: string, isBase64: boolean = false, retryCount = 0): Promise<any> {
    // 1. Get SHA (only on first try to avoid redundant calls in recursion if not needed, 
    // but useful if we are retrying due to conflict)
    let sha: string | undefined;
    try {
      const getRes = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/${path}`, { headers: this.headers });
      if (getRes.ok) {
        const data = await getRes.json();
        sha = data.sha;
      }
    } catch (e) {
      // Ignore error, file probably doesn't exist
    }

    // Base64 encode content if it isn't already
    const contentEncoded = isBase64 ? content : btoa(unescape(encodeURIComponent(content)));

    const body = JSON.stringify({
      message,
      content: contentEncoded,
      sha, // Include SHA if updating
    });

    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: this.headers,
      body,
    });

    if (!res.ok) {
      // Retry logic for 409 (Conflict), 429 (Rate Limit), 5xx (Server Error), or general flaky network
      if (retryCount < 3) {
         // Exponential backoff: 1s, 2s, 4s
         const delay = 1000 * Math.pow(2, retryCount);
         await new Promise(resolve => setTimeout(resolve, delay));
         return this.uploadFile(owner, repo, path, content, message, isBase64, retryCount + 1);
      }

      let errorMessage = `Failed to upload ${path}`;
      try {
        const err = await res.json();
        errorMessage += `: ${err.message}`;
        console.error('Upload error details:', err);
      } catch (e) {
        errorMessage += `: ${res.status} ${res.statusText}`;
      }
      throw new Error(errorMessage);
    }
    return res.json();
  }

  async enablePages(owner: string, repo: string, branch: string = 'main', buildType: 'legacy' | 'workflow' = 'legacy') {
    // First, check if pages is already enabled
    try {
        const checkRes = await fetch(`${BASE_URL}/repos/${owner}/${repo}/pages`, { headers: this.headers });
        if (checkRes.ok) {
            // If already enabled, we might need to switch build_type if requested
            if (buildType === 'workflow') {
               // Update to workflow
               await fetch(`${BASE_URL}/repos/${owner}/${repo}/pages`, { 
                 method: 'PUT',
                 headers: this.headers,
                 body: JSON.stringify({ build_type: 'workflow' })
               });
            }
            return await checkRes.json();
        }
    } catch (e) {
        // ignore
    }

    // Enable it
    const body: any = {};
    if (buildType === 'workflow') {
      body.build_type = 'workflow';
    } else {
      body.source = {
          branch,
          path: '/'
      };
    }

    let res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/pages`, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Accept': 'application/vnd.github.switcheroo-preview+json' // Sometimes needed for Pages API
      },
      body: JSON.stringify(body),
    });

    // If initial creation fails (e.g. 409 conflict, or validation), try PUT if we wanted workflow
    if (!res.ok && res.status !== 409) {
       // If creating as workflow failed, try creating legacy then updating
       if (buildType === 'workflow') {
         res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/pages`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({ source: { branch, path: '/' } })
         });
         // Then update
         if (res.ok || res.status === 409) {
             await fetch(`${BASE_URL}/repos/${owner}/${repo}/pages`, {
                 method: 'PUT',
                 headers: this.headers,
                 body: JSON.stringify({ build_type: 'workflow' })
             });
             return;
         }
       }
       
       if (res.status === 409) return;
       const err = await res.json();
       throw new Error(err.message || 'Failed to enable GitHub Pages');
    }
    
    // Explicit update for workflow to be safe if created fresh
    if (buildType === 'workflow') {
         await fetch(`${BASE_URL}/repos/${owner}/${repo}/pages`, {
             method: 'PUT',
             headers: this.headers,
             body: JSON.stringify({ build_type: 'workflow' })
         });
    }

    return res.ok ? res.json() : null;
  }

  async getPagesInfo(owner: string, repo: string) {
      const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/pages`, { headers: this.headers });
      if (!res.ok) throw new Error('Could not retrieve Pages info');
      return res.json();
  }

  async getPagesBuilds(owner: string, repo: string) {
    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}/pages/builds`, { headers: this.headers });
    // If pages not enabled yet, it might return 404 or empty list
    if (!res.ok) return []; 
    return res.json();
  }
}

export const github = new GitHubService();