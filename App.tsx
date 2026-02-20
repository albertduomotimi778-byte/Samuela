import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { github } from './services/github';
import { GitHubUser, GitHubRepo, AppState, LogEntry } from './types';
import { TEMPLATES } from './constants';
import { Button } from './components/Button';
import { 
  Github, 
  Globe, 
  Layout, 
  Plus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  ExternalLink,
  BookOpen,
  Loader2,
  Key,
  Trash,
  Upload,
  RefreshCw
} from './components/Icons';

// Add global type definition for WebToApp interface
declare global {
  interface Window {
    onNativePremiumActive?: boolean;
    WebToApp?: {
      lock: () => void;
    };
  }
}

// --- Workflow Template Generator ---
const getWorkflowYaml = (projectType: 'node' | 'jekyll' | 'mkdocs' | 'static', buildCmd?: string) => {
  let buildSteps = '';
  
  switch (projectType) {
    case 'node':
      buildSteps = `
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
      - name: Install dependencies
        run: npm install --legacy-peer-deps
      - name: Build
        env:
           CI: false 
        run: ${buildCmd || 'npm run build -- --base=./'}
      `;
      break;
    case 'jekyll':
      buildSteps = `
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.1'
          bundler-cache: true
      - name: Build
        run: bundle exec jekyll build
      `;
      break;
    case 'mkdocs':
      buildSteps = `
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.x'
      - name: Install dependencies
        run: pip install mkdocs-material
      - name: Build
        run: mkdocs build
      `;
      break;
    case 'static':
    default:
      buildSteps = '';
      break;
  }

  return `name: Deploy to GitHub Pages

on:
  push:
    branches: ["main", "master"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
${buildSteps}
      - name: Check output directory and handle SPA fallback
        id: check_dir
        run: |
          if [ -d "dist" ]; then
            cp dist/index.html dist/404.html || true
            echo "artifact_path=./dist" >> $GITHUB_OUTPUT
          elif [ -d "build" ]; then
            cp build/index.html build/404.html || true
            echo "artifact_path=./build" >> $GITHUB_OUTPUT
          elif [ -d "_site" ]; then
            # Jekyll/MkDocs default
            cp _site/index.html _site/404.html || true
            echo "artifact_path=./_site" >> $GITHUB_OUTPUT
          elif [ -d "site" ]; then
             # MkDocs alternative
            cp site/index.html site/404.html || true
            echo "artifact_path=./site" >> $GITHUB_OUTPUT
          else
            # Static site fallback: upload current directory
            if [ -f "index.html" ]; then cp index.html 404.html || true; fi
            echo "artifact_path=." >> $GITHUB_OUTPUT
          fi
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: \${{ steps.check_dir.outputs.artifact_path }}

  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
`;
};

// --- Helper: Zip Processing ---
interface ProcessedZip {
  files: Record<string, string>;
  projectType: 'node' | 'jekyll' | 'mkdocs' | 'static';
  hasAiDependency: boolean; 
  buildScript?: string;
}

const processZipFile = async (file: File): Promise<ProcessedZip> => {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  const files: Record<string, string> = {};
  
  const filePaths = Object.keys(contents.files).filter(path => !(contents.files[path] as any).dir);
  if (filePaths.length === 0) throw new Error("The zip file is empty.");

  const firstPathParts = filePaths[0].split('/');
  let rootPrefix = '';
  if (firstPathParts.length > 1) {
    const potentialRoot = firstPathParts[0] + '/';
    if (filePaths.every(p => p.startsWith(potentialRoot))) {
      rootPrefix = potentialRoot;
    }
  }

  for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
    const entry = zipEntry as any;
    if (entry.dir) continue;
    if (!relativePath.startsWith(rootPrefix)) continue;
    
    const cleanPath = relativePath.slice(rootPrefix.length);

    if (cleanPath.startsWith('node_modules/') || 
        cleanPath.includes('/node_modules/') ||
        cleanPath.includes('__MACOSX') || 
        cleanPath.includes('.DS_Store')) {
      continue;
    }
    
    const content = await entry.async('base64');
    files[cleanPath] = content;
  }

  // Detection logic
  let projectType: ProcessedZip['projectType'] = 'static';
  let buildScript: string | undefined;
  let hasAiDependency = false;

  const hasPackageJson = files['package.json'] !== undefined;
  const hasMkDocs = files['mkdocs.yml'] !== undefined;
  const hasJekyll = files['_config.yml'] !== undefined || files['Gemfile'] !== undefined;

  if (hasPackageJson) {
      projectType = 'node';
      try {
        const jsonStr = decodeURIComponent(escape(window.atob(files['package.json'])));
        const pkg = JSON.parse(jsonStr);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (allDeps['@google/generative-ai'] || allDeps['google-generative-ai']) {
          hasAiDependency = true;
        }
        if (pkg.scripts && pkg.scripts.build) {
            buildScript = 'npm run build';
            // Add base flag if it's vite and not already present
            if (pkg.scripts.build.includes('vite build') && !pkg.scripts.build.includes('--base')) {
                buildScript = 'npm run build -- --base=./';
            }
        }
      } catch (e) {
        // ignore parse error
      }
  } else if (hasMkDocs) {
      projectType = 'mkdocs';
  } else if (hasJekyll) {
      projectType = 'jekyll';
  }

  if (projectType === 'static' && !files['index.html']) {
     throw new Error("Could not find 'index.html', 'package.json', 'mkdocs.yml', or '_config.yml' in the zip file.");
  }

  return { files, projectType, hasAiDependency, buildScript };
};

// --- Subcomponents within App.tsx ---

const AuthStep = ({ onAuth }: { onAuth: (token: string) => void }) => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError('');
    
    try {
      github.setToken(token);
      await github.validateToken();
      onAuth(token);
    } catch (err) {
      setError('Invalid token. Please check your permissions and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto w-full animate-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-50 p-3 rounded-full">
              <Github className="w-8 h-8 text-indigo-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Connect to GitHub</h1>
          <p className="text-center text-slate-500 mb-8">
            Enter your Personal Access Token to start deploying websites instantly.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-slate-700 mb-1">
                Personal Access Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                placeholder="ghp_..."
                required
              />
            </div>
            {error && (
              <div className="flex items-center text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" isLoading={loading}>
              Connect Account
            </Button>
          </form>
        </div>
        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 text-center">
            Need a token? <a href="https://github.com/settings/tokens/new?scopes=repo,workflow,delete_repo" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center">Generate one here <ExternalLink className="w-3 h-3 ml-1" /></a> with <code>repo</code>, <code>workflow</code>, and <code>delete_repo</code> scopes.
          </p>
        </div>
      </div>
    </div>
  );
};

interface SelectionStepProps {
  user: GitHubUser;
  onDeploy: (repoName: string, isNew: boolean, files: Record<string, string> | null, projectType: string, apiKey: string | null, templateId?: string, buildCmd?: string) => void;
  // Pre-fill props for update flow
  initialRepoName?: string;
}

const SelectionStep = ({ user, onDeploy, initialRepoName }: SelectionStepProps) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'template' | 'existing'>('upload');
  const [repoType, setRepoType] = useState<'new' | 'existing'>(initialRepoName ? 'existing' : 'new');
  
  // When switching to 'existing' tab, force repoType to 'existing'
  useEffect(() => {
    if (activeTab === 'existing') {
      setRepoType('existing');
    }
  }, [activeTab]);
  
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [search, setSearch] = useState('');
  
  const [newRepoName, setNewRepoName] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(initialRepoName || '');
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [processingZip, setProcessingZip] = useState(false);
  const [zipError, setZipError] = useState('');
  
  const [zipAnalysis, setZipAnalysis] = useState<{projectType: string, count: number, hasAiDependency: boolean} | null>(null);
  const [apiKey, setApiKey] = useState('');

  // Ad Overlay State
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [adTimer, setAdTimer] = useState(7);

  // Effect to handle initialRepoName from Update flow
  useEffect(() => {
      if (initialRepoName) {
          setRepoType('existing');
          setSelectedRepo(initialRepoName);
      }
  }, [initialRepoName]);

  // Persist newRepoName to prevent work loss on reload
  useEffect(() => {
      const savedName = sessionStorage.getItem('gh_deployer_new_repo_name');
      if (savedName && !initialRepoName) {
          setNewRepoName(savedName);
      }
  }, [initialRepoName]);

  useEffect(() => {
      sessionStorage.setItem('gh_deployer_new_repo_name', newRepoName);
  }, [newRepoName]);

  useEffect(() => {
    if (repoType === 'existing') {
      setLoadingRepos(true);
      github.getUserRepos(user.login)
        .then(setRepos)
        .catch(console.error)
        .finally(() => setLoadingRepos(false));
    }
  }, [repoType, user.login]);

  // Ad Timer Logic
  useEffect(() => {
    let interval: any;
    if (showAdOverlay && adTimer > 0) {
      interval = setInterval(() => {
        setAdTimer((prev) => prev - 1);
      }, 1000);
    } else if (showAdOverlay && adTimer === 0) {
      setShowAdOverlay(false);
      executeDeploy();
    }
    return () => clearInterval(interval);
  }, [showAdOverlay, adTimer]);

  const handleZipSelection = async (file: File) => {
      setZipFile(file);
      setZipError('');
      setZipAnalysis(null);
      setProcessingZip(true);
      
      try {
          const result = await processZipFile(file);
          setZipAnalysis({
              projectType: result.projectType,
              count: Object.keys(result.files).length,
              hasAiDependency: result.hasAiDependency
          });
      } catch (e: any) {
          setZipError(e.message);
          setZipFile(null);
      } finally {
          setProcessingZip(false);
      }
  };

  const executeDeploy = async () => {
    const repoName = repoType === 'new' ? newRepoName : selectedRepo;
    if (!repoName) return;

    if (activeTab === 'upload') {
      if (!zipFile) return;
      setProcessingZip(true);
      setZipError('');
      try {
        const result = await processZipFile(zipFile);
        onDeploy(repoName, repoType === 'new', result.files, result.projectType, apiKey || null, undefined, result.buildScript);
        // Clear saved work on success
        sessionStorage.removeItem('gh_deployer_new_repo_name');
        setNewRepoName('');
      } catch (e: any) {
        setZipError(e.message);
      } finally {
        setProcessingZip(false);
      }
    } else if (activeTab === 'template') {
      onDeploy(repoName, repoType === 'new', null, 'node', null, selectedTemplate);
      sessionStorage.removeItem('gh_deployer_new_repo_name');
      setNewRepoName('');
    } else {
      // Existing repository flow - no files to upload
      onDeploy(repoName, false, null, 'auto', null);
      sessionStorage.removeItem('gh_deployer_new_repo_name');
      setNewRepoName('');
    }
  };

  const handleDeployClick = () => {
    // Check for premium status
    if (window.onNativePremiumActive === false) {
      if (window.WebToApp && window.WebToApp.lock) {
        window.WebToApp.lock();
        return;
      }
    }

    const repoName = repoType === 'new' ? newRepoName : selectedRepo;
    if (!repoName) return;
    if (activeTab === 'upload' && !zipFile) return;

    // Start Ad Flow
    setAdTimer(7);
    setShowAdOverlay(true);
  };

  const filteredRepos = repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-4xl mx-auto w-full animate-in relative">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 p-6 flex flex-col">
          <div className="flex items-center space-x-3 mb-8">
            <img src={user.avatar_url} alt={user.login} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
            <div className="overflow-hidden">
              <p className="font-medium text-slate-900 truncate">{user.name || user.login}</p>
              <p className="text-xs text-slate-500 truncate">@{user.login}</p>
            </div>
          </div>
          
          <nav className="space-y-2 flex-1">
            <button
              onClick={() => setActiveTab('upload')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                activeTab === 'upload' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Upload Project</span>
            </button>
            <button
              onClick={() => setActiveTab('template')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                activeTab === 'template' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Layout className="w-4 h-4" />
              <span>Use Template</span>
            </button>
            <button
              onClick={() => setActiveTab('existing')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                activeTab === 'existing' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Existing Repo</span>
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 flex flex-col">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            {activeTab === 'upload' ? 'Deploy from Zip' : activeTab === 'template' ? 'Deploy from Template' : 'Deploy Existing Repository'}
          </h2>

          <div className="space-y-8 flex-1">
            {/* Source Selection */}
            {activeTab !== 'existing' && (
              activeTab === 'upload' ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50 group">
                  <input 
                    type="file" 
                    accept=".zip"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleZipSelection(e.target.files[0]);
                      }
                    }}
                    className="hidden" 
                    id="zip-upload"
                  />
                  <label htmlFor="zip-upload" className="cursor-pointer block">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-indigo-200 transition-colors">
                      <Plus className="w-6 h-6 text-indigo-600" />
                    </div>
                    {zipFile ? (
                      <div>
                        <p className="font-medium text-indigo-600">{zipFile.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-slate-700">Drop your project zip here</p>
                        <p className="text-sm text-slate-500 mt-1">Supports source code (React, Vue) or static sites</p>
                      </div>
                    )}
                  </label>
                </div>
                {processingZip && !showAdOverlay && (
                    <div className="text-sm text-indigo-600 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing zip file...
                    </div>
                )}
                {zipAnalysis && (
                     <div className="space-y-3">
                       <div className="text-sm bg-green-50 text-green-700 p-3 rounded-lg border border-green-100 flex items-start">
                          <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                              <span className="font-semibold">Ready to upload!</span> 
                              <p>Found {zipAnalysis.count} files.</p>
                              <p className="text-xs mt-1 font-medium bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded inline-block">
                                Type: {zipAnalysis.projectType.charAt(0).toUpperCase() + zipAnalysis.projectType.slice(1)}
                              </p>
                          </div>
                       </div>
                       
                       {/* AI App Detection */}
                       {zipAnalysis.hasAiDependency && (
                         <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 animate-in">
                            <div className="flex items-center mb-2 text-indigo-800 font-semibold">
                              <Key className="w-4 h-4 mr-2" />
                              Gemini API Key Required
                            </div>
                            <p className="text-xs text-indigo-700 mb-3">
                              This looks like a Google AI app. To make it work online, you must provide your API key. It will be securely injected into the deployment.
                            </p>
                            <input
                              type="password"
                              placeholder="AIzaSy..."
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              className="w-full px-3 py-2 border border-indigo-200 rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                         </div>
                       )}
                     </div>
                )}
                {zipError && (
                  <div className="flex items-start text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                    {zipError}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TEMPLATES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedTemplate === t.id 
                        ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-semibold ${selectedTemplate === t.id ? 'text-indigo-900' : 'text-slate-900'}`}>{t.name}</span>
                      {selectedTemplate === t.id && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                    </div>
                    <p className="text-sm text-slate-500">{t.description}</p>
                  </button>
                ))}
              </div>
            )
            )}

            <hr className="border-slate-100" />

            {/* Destination Selection */}
            <div>
              {activeTab !== 'existing' && (
                <div className="flex space-x-4 mb-4">
                  <button
                    onClick={() => setRepoType('new')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      repoType === 'new' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    New Repository
                  </button>
                  <button
                    onClick={() => setRepoType('existing')}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      repoType === 'existing' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Existing Repository
                  </button>
                </div>
              )}

              {repoType === 'new' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Repository Name</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-sm">
                      {user.login} /
                    </span>
                    <input
                      type="text"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value.replace(/[^a-z0-9-]/g, '-').toLowerCase())}
                      className="flex-1 block w-full rounded-none rounded-r-lg border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 min-w-0 text-sm p-2.5 border outline-none"
                      placeholder="my-project"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                   {/* Warning for Public Repo */}
                   <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start mb-3">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 mr-2 flex-shrink-0" />
                      <p className="text-sm text-amber-800">
                        <strong>Important:</strong> The repository must be <strong>public</strong> for GitHub Pages to work on the free plan.
                      </p>
                   </div>

                   <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search repositories..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                    />
                  </div>
                  <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto custom-scrollbar">
                     {loadingRepos ? (
                       <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                     ) : filteredRepos.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">No repositories found</div>
                     ) : (
                       filteredRepos.map(repo => (
                         <button
                           key={repo.id}
                           onClick={() => setSelectedRepo(repo.name)}
                           className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between hover:bg-slate-50 ${
                             selectedRepo === repo.name ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                           }`}
                         >
                           <span>{repo.name}</span>
                           {selectedRepo === repo.name && <CheckCircle2 className="w-4 h-4" />}
                         </button>
                       ))
                     )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-100 flex justify-end">
            <Button 
              onClick={handleDeployClick}
              disabled={(repoType === 'new' && !newRepoName) || (repoType === 'existing' && !selectedRepo) || (activeTab === 'upload' && !zipFile)}
              isLoading={processingZip}
            >
              {activeTab === 'upload' ? 'Upload & Deploy' : activeTab === 'template' ? 'Create & Deploy' : 'Deploy Repository'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Ad Interstitial Overlay */}
      {showAdOverlay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900">
            {/* Background Ad Iframe */}
            <iframe 
                src="https://www.effectivegatecpm.com/genejfm2xp?key=8438651eb178c2abbd3ef7cbd93b243d" 
                className="absolute inset-0 w-full h-full border-0 bg-white"
                title="Advertisement"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            {/* Dark overlay to ensure text readability and prevent accidental clicks during countdown */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            
            {/* Countdown Modal */}
            <div className="relative z-10 bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 animate-in">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-6 relative">
                     <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                     <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-bold text-xs mt-8 text-indigo-800">{adTimer}</span>
                     </div>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">Processing Deployment</h3>
                <p className="text-slate-500 text-center mb-6">
                    Your deployment will start automatically in <span className="font-bold text-indigo-600">{adTimer} seconds</span>.
                </p>
                
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-indigo-600 transition-all duration-1000 ease-linear"
                        style={{ width: `${((7 - adTimer) / 7) * 100}%` }}
                    />
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const DeploymentStep = ({ logs, url, onReset }: { logs: LogEntry[], url: string | null, onReset: () => void }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="max-w-2xl mx-auto w-full animate-in">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8">
          <div className="flex flex-col items-center justify-center mb-8">
            {url ? (
              <div className="bg-green-100 p-4 rounded-full mb-4 animate-bounce">
                <Globe className="w-12 h-12 text-green-600" />
              </div>
            ) : (
              <div className="bg-indigo-50 p-4 rounded-full mb-4">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
              </div>
            )}
            <h2 className="text-2xl font-bold text-slate-900">
              {url ? 'Website Deployed!' : 'Deploying your site...'}
            </h2>
            <p className="text-slate-500 mt-2 text-center">
              {url ? 'Your site is now live on GitHub Pages.' : 'Please wait while we process your files and build your site.'}
            </p>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 mb-6 shadow-inner font-mono text-sm h-64 overflow-y-auto" ref={scrollRef}>
            {logs.map((log, i) => (
              <div key={i} className={`mb-2 flex items-start ${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'success' ? 'text-green-400' : 'text-slate-300'
              }`}>
                <span className="mr-2 text-slate-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span>{log.type === 'success' && '✓ '}{log.message}</span>
              </div>
            ))}
            {!url && <div className="animate-pulse text-indigo-400">_</div>}
          </div>

          {url ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-600 truncate mr-4">{url}</span>
                <a 
                  href={url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center text-indigo-600 font-medium hover:text-indigo-700"
                >
                  Visit Site <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              </div>
              <Button onClick={onReset} variant="outline" className="w-full">
                Deploy Another Site
              </Button>
            </div>
          ) : (
             <div className="text-center text-xs text-slate-400">
               We are verifying the build status to ensure no 404 errors. This takes about 30-90 seconds.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Manage Dashboard Step ---
interface ManageStepProps {
    user: GitHubUser;
    onUpdate: (repoName: string) => void;
}

const ManageStep = ({ user, onUpdate }: ManageStepProps) => {
    const [repos, setRepos] = useState<GitHubRepo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [rebuildingId, setRebuildingId] = useState<number | null>(null);

    const loadRepos = async () => {
        setLoading(true);
        try {
            const allRepos = await github.getUserRepos(user.login);
            // Filter only repos that likely have pages enabled or we created (has_pages is the best proxy)
            const pageRepos = allRepos.filter(r => r.has_pages);
            setRepos(pageRepos);
        } catch (e: any) {
            setError('Failed to load repositories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRepos();
    }, [user.login]);

    const handleRebuild = async (repo: GitHubRepo) => {
        if (rebuildingId === repo.id) return;
        setRebuildingId(repo.id);
        
        try {
            await github.triggerWorkflowDispatch(repo.owner.login, repo.name, 'deploy.yml', repo.default_branch);
            // Optimistically tell user
            alert(`Rebuild triggered for ${repo.name}. It should be live in a few minutes.`);
        } catch (e: any) {
            alert(`Failed to trigger rebuild: ${e.message}. You can try again or check the Actions tab on GitHub.`);
        } finally {
            setRebuildingId(null);
        }
    }

    const handleDelete = async () => {
        if (!deletingId) return;
        const repo = repos.find(r => r.id === deletingId);
        if (!repo) return;
        
        setIsDeleting(true);
        try {
            await github.deleteRepo(repo.owner.login, repo.name);
            setRepos(prev => prev.filter(r => r.id !== deletingId));
            setDeletingId(null);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredRepos = repos.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="max-w-6xl mx-auto w-full animate-in">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-900">My Sites</h2>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search sites..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                    />
                </div>
             </div>

             {loading ? (
                 <div className="flex justify-center p-12">
                     <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                 </div>
             ) : filteredRepos.length === 0 ? (
                 <div className="text-center p-12 bg-white rounded-xl border border-slate-200">
                     <div className="bg-slate-50 p-4 rounded-full inline-flex mb-4">
                         <Layout className="w-8 h-8 text-slate-400" />
                     </div>
                     <h3 className="text-lg font-medium text-slate-900 mb-2">No active sites found</h3>
                     <p className="text-slate-500 mb-6 max-w-sm mx-auto">
                        It looks like you haven't deployed any websites with GitHub Pages yet. Get started by deploying a new project!
                     </p>
                 </div>
             ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {filteredRepos.map(repo => (
                         <div key={repo.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col relative group">
                             <div className="flex-1 mb-4">
                                 <div className="flex items-start justify-between">
                                     <div>
                                        <h3 className="font-semibold text-slate-900 truncate pr-2 max-w-[200px]" title={repo.name}>{repo.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1">Updated {new Date(repo.updated_at).toLocaleDateString()}</p>
                                     </div>
                                     <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button 
                                             onClick={() => setDeletingId(repo.id)}
                                             className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                             title="Delete"
                                         >
                                             <Trash className="w-4 h-4" />
                                         </button>
                                     </div>
                                 </div>
                                 
                                 <div className="mt-4 flex items-center space-x-2 text-sm text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 truncate">
                                     <Globe className="w-4 h-4 text-green-600 flex-shrink-0" />
                                     <a 
                                         href={`https://${user.login}.github.io/${repo.name}/`} 
                                         target="_blank" 
                                         rel="noreferrer"
                                         className="truncate hover:text-indigo-600 hover:underline flex-1"
                                     >
                                         {user.login}.github.io/{repo.name}
                                     </a>
                                     <ExternalLink className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                 </div>
                             </div>

                             <div className="pt-4 border-t border-slate-100 flex items-center justify-between space-x-2">
                                 <Button 
                                     variant="outline" 
                                     className="flex-1 justify-center text-xs px-2"
                                     onClick={() => handleRebuild(repo)}
                                     isLoading={rebuildingId === repo.id}
                                     title="Trigger a new build if site is broken"
                                 >
                                     <RefreshCw className="w-3 h-3 mr-2" />
                                     Rebuild
                                 </Button>
                                 <Button 
                                     variant="outline" 
                                     className="flex-1 justify-center text-xs px-2"
                                     onClick={() => onUpdate(repo.name)}
                                 >
                                     <Upload className="w-3 h-3 mr-2" />
                                     Update
                                 </Button>
                             </div>
                             
                             {/* Delete Confirmation Overlay */}
                             {deletingId === repo.id && (
                                 <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-6 rounded-xl text-center animate-in">
                                     <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                                     <h4 className="text-lg font-bold text-slate-900 mb-2">Delete this site?</h4>
                                     <p className="text-sm text-slate-500 mb-6">
                                         This will permanently delete the repository <strong>{repo.name}</strong> and take your site offline.
                                     </p>
                                     <div className="flex space-x-3 w-full">
                                         <Button variant="outline" onClick={() => setDeletingId(null)} className="flex-1">Cancel</Button>
                                         <Button 
                                             className="bg-red-600 hover:bg-red-700 text-white flex-1" 
                                             onClick={handleDelete}
                                             isLoading={isDeleting}
                                         >
                                             Delete
                                         </Button>
                                     </div>
                                 </div>
                             )}
                         </div>
                     ))}
                 </div>
             )}
        </div>
    );
};

// --- Optimized Ad Banner Component ---
const AdBanner = () => {
  const [key, setKey] = useState(0);

  useEffect(() => {
    // Refresh the ad every 25 seconds to cycle through offers and increase impression count
    const timer = setInterval(() => {
      setKey(prev => prev + 1);
    }, 25000); 
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full px-4 mb-4 mt-4">
       <div className="max-w-4xl mx-auto">
          <div className="bg-slate-100 rounded-xl overflow-hidden border border-slate-200 h-[100px] w-full relative group">
              {/* Fallback/Loading state */}
              <div className="absolute inset-0 flex items-center justify-center text-slate-300 text-xs">
                  <span className="animate-pulse">Loading offer...</span>
              </div>
              
              <iframe 
                 key={key}
                 // Add timestamp param to prevent caching and force a fresh ad request from the network
                 src={`https://www.effectivegatecpm.com/genejfm2xp?key=8438651eb178c2abbd3ef7cbd93b243d&_t=${Date.now()}`} 
                 className="absolute inset-0 w-full h-full border-0 z-10 bg-white"
                 title="Sponsored Content"
                 scrolling="no"
                 sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
                 referrerPolicy="no-referrer"
                 loading="eager"
              />
          </div>
          <div className="flex justify-between items-center mt-1 px-1">
             <p className="text-[10px] text-slate-300 uppercase tracking-wider">Sponsored</p>
             <p className="text-[10px] text-slate-300 opacity-60">Auto-refreshes</p>
          </div>
       </div>
    </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [state, setState] = useState<AppState>(AppState.AUTH);
  const [view, setView] = useState<'deploy' | 'manage'>('deploy');
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(true);
  
  // State to pass from Manage to Deploy
  const [updateRepoName, setUpdateRepoName] = useState<string | undefined>(undefined);

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { message, timestamp: Date.now(), type }]);
  };

  // ADDED: Cache clearing logic to ensure fresh app version when online
  useEffect(() => {
      const updateApp = async () => {
          // If we are online and support cache API, clear caches to ensure fresh assets on next fetch
          if (navigator.onLine && 'caches' in window) {
              try {
                  const keys = await caches.keys();
                  if (keys.length > 0) {
                      await Promise.all(keys.map(key => caches.delete(key)));
                      console.log('App cache cleared for update.');
                  }
              } catch (e) {
                  console.error('Failed to clear cache', e);
              }
          }
      };
      
      updateApp();
      window.addEventListener('online', updateApp);
      return () => window.removeEventListener('online', updateApp);
  }, []);

  useEffect(() => {
    const init = async () => {
      const savedToken = localStorage.getItem('gh_deployer_token');
      if (savedToken) {
        try {
          github.setToken(savedToken);
          const u = await github.validateToken();
          setUser(u);
          setState(AppState.SELECTION);
        } catch (e) {
          console.log('Session expired or invalid');
          localStorage.removeItem('gh_deployer_token');
        }
      }
      setIsCheckingToken(false);
    };
    init();
  }, []);

  const handleAuth = async (token: string) => {
    try {
      const u = await github.validateToken();
      localStorage.setItem('gh_deployer_token', token);
      setUser(u);
      setState(AppState.SELECTION);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('gh_deployer_token');
    github.setToken('');
    setUser(null);
    setState(AppState.AUTH);
  };

  const handleUpdateRedirect = (repoName: string) => {
      setUpdateRepoName(repoName);
      setView('deploy');
      setState(AppState.SELECTION);
  };

  const handleDeploy = async (repoName: string, isNew: boolean, zipFiles: Record<string, string> | null, projectTypeParam: string, apiKey: string | null, templateId?: string, buildCmdParam?: string) => {
    if (!user) return;
    setState(AppState.DEPLOYING);
    setLogs([]);
    setDeployedUrl(null);
    setUpdateRepoName(undefined); // Clear update state

    let projectType = projectTypeParam;
    let buildCmd = buildCmdParam;

    try {
      let repoOwner = user.login;
      let defaultBranch = 'main';

      if (isNew) {
        addLog(`Creating repository '${repoName}'...`);
        const newRepo = await github.createRepo(repoName, 'Created via GitPage Deployer', repoOwner);
        defaultBranch = newRepo.default_branch;
        addLog('Repository created (or found).', 'success');
      } else {
        addLog(`Fetching details for '${repoName}'...`);
        try {
          const existingRepo = await github.getRepo(repoOwner, repoName);
          defaultBranch = existingRepo.default_branch;
          addLog(`Using existing repository '${repoName}' (branch: ${defaultBranch})`);
          
          // Check for private repo warning
          if (existingRepo.private) {
              addLog('Warning: This repository is private. GitHub Pages may require a Pro subscription.', 'info');
          }

          // Auto-detect project type if not provided (i.e. existing repo flow)
          if (!zipFiles && !templateId) {
              addLog('Detecting project type from repository...');
              try {
                  const pkgData = await github.getFile(repoOwner, repoName, 'package.json');
                  projectType = 'node';
                  addLog('Detected package.json (Node.js)');
                  
                  // Try to parse package.json for build script
                  try {
                      const jsonStr = decodeURIComponent(escape(window.atob(pkgData.content)));
                      const pkg = JSON.parse(jsonStr);
                      if (pkg.scripts && pkg.scripts.build) {
                          buildCmd = 'npm run build';
                          if (pkg.scripts.build.includes('vite build') && !pkg.scripts.build.includes('--base')) {
                              buildCmd = 'npm run build -- --base=./';
                          }
                          addLog(`Detected build script: ${buildCmd}`);
                      }
                  } catch (e) {
                      console.warn('Failed to parse remote package.json', e);
                  }

              } catch (e) {
                  try {
                      await github.getFile(repoOwner, repoName, 'mkdocs.yml');
                      projectType = 'mkdocs';
                      addLog('Detected mkdocs.yml (MkDocs)');
                  } catch (e2) {
                      try {
                          await github.getFile(repoOwner, repoName, '_config.yml');
                          projectType = 'jekyll';
                          addLog('Detected _config.yml (Jekyll)');
                      } catch (e3) {
                          projectType = 'static';
                          addLog('No build config detected, assuming static site.');
                      }
                  }
              }
          }

        } catch (e) {
          addLog('Could not fetch repo details, defaulting to main branch', 'error');
        }
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
      // IMPORTANT: We now enforce 'workflow' build type for ALL projects
      const buildType = 'workflow';
      
      // We upload the workflow file first if it's new, but we must ensure pages is enabled for workflow.
      // Sometimes enabling pages on an empty repo fails.
      
      addLog('Configuring repository...');
      await github.uploadFile(repoOwner, repoName, '.nojekyll', '', 'Disable Jekyll');

      if (zipFiles) {
        addLog('Analyzing project structure...');
        const fileCount = Object.keys(zipFiles).length;
        addLog(`Uploading ${fileCount} files from project...`);
        
        // --- 1. INJECT ENVIRONMENT VARIABLES ---
        if (apiKey) {
            addLog('Injecting API Keys into environment...');
            const envContent = `
VITE_GEMINI_API_KEY=${apiKey}
VITE_GOOGLE_API_KEY=${apiKey}
VITE_API_KEY=${apiKey}
REACT_APP_GEMINI_API_KEY=${apiKey}
REACT_APP_GOOGLE_API_KEY=${apiKey}
NEXT_PUBLIC_GEMINI_API_KEY=${apiKey}
NEXT_PUBLIC_GOOGLE_API_KEY=${apiKey}
GOOGLE_API_KEY=${apiKey}
GEMINI_API_KEY=${apiKey}
API_KEY=${apiKey}
PUBLIC_URL=/${repoName}/
`.trim();
            zipFiles['.env'] = window.btoa(envContent);
        }

        // --- 2. PATCH INDEX.HTML FOR COMPATIBILITY ---
        if (zipFiles['index.html']) {
            addLog('Patching index.html for production environment...');
            let htmlContent = decodeURIComponent(escape(window.atob(zipFiles['index.html'])));
            
            // Inject process polyfill 
            if (!htmlContent.includes('window.process')) {
                const polyfill = '<script>window.process = { env: { NODE_ENV: "production" } };</script>';
                htmlContent = htmlContent.replace('<head>', `<head>${polyfill}`);
            }
            
            // Fix absolute paths (e.g. href="/assets/..." -> href="./assets/...")
            // Matches any absolute path starting with / that doesn't look like a protocol (//)
            htmlContent = htmlContent.replace(/(href|src)=["']\/([^/][^"']*)["']/g, '$1="./$2"');
            
            zipFiles['index.html'] = window.btoa(unescape(encodeURIComponent(htmlContent)));
        }

        // --- 3. PATCH PACKAGE.JSON ---
        if (projectType === 'node' && zipFiles['package.json']) {
           try {
             const jsonString = decodeURIComponent(escape(window.atob(zipFiles['package.json'])));
             const pkg = JSON.parse(jsonString);
             
             const homepageUrl = `https://${repoOwner}.github.io/${repoName}/`;
             pkg.homepage = homepageUrl;
             
             if (pkg.scripts && pkg.scripts.build && pkg.scripts.build.includes('vite build')) {
                 // Force relative base for robustness against renaming
                 if (!pkg.scripts.build.includes('--base')) {
                     pkg.scripts.build = pkg.scripts.build.replace('vite build', `vite build --base=./`);
                 } else {
                     // If it already has --base, replace it or leave it? Safer to replace if it's potentially absolute
                     pkg.scripts.build = pkg.scripts.build.replace(/--base=[^ ]+/, '--base=./');
                 }
             }

             zipFiles['package.json'] = window.btoa(unescape(encodeURIComponent(JSON.stringify(pkg, null, 2))));
           } catch (e) {
             console.warn('Failed to patch package.json', e);
           }
        }

        let count = 0;
        const total = Object.entries(zipFiles).length;
        const CHUNK_SIZE = 3;
        const entries = Object.entries(zipFiles);
        
        for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
            const chunk = entries.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(([filename, content]) => 
                 github.uploadFile(repoOwner, repoName, filename, content, 'Deploy from Zip', true)
            ));
            count += chunk.length;
            if (count % 9 === 0) addLog(`Uploaded ${count}/${total} files...`);
            await new Promise(r => setTimeout(r, 300));
        }
        
        addLog('Project content uploaded.', 'success');

      } else if (templateId) {
          const template = TEMPLATES.find(t => t.id === templateId);
          if (template) {
            addLog(`Uploading template '${template.name}' files...`);
            for (const [filename, content] of Object.entries(template.files)) {
                await github.uploadFile(repoOwner, repoName, filename, content, 'Initial commit via GitPage Deployer');
                addLog(`Uploaded ${filename}`);
            }
            addLog('Template files uploaded.', 'success');
          }
      }

      // --- 4. UPLOAD WORKFLOW FOR EVERYONE ---
      // We always use the workflow logic now.
      addLog('Deploying build workflow...');
      const workflowContent = getWorkflowYaml(projectType as any, buildCmd);
      await github.uploadFile(repoOwner, repoName, '.github/workflows/deploy.yml', workflowContent, 'Add deployment workflow');

      // --- 5. ENABLE PAGES ---
      // Now that content and workflow exists, we enable pages for workflow
      addLog(`Initializing GitHub Pages (Type: ${buildType})...`);
      try {
        await github.enablePages(repoOwner, repoName, defaultBranch, buildType);
        addLog('GitHub Pages configuration initialized.', 'success');
      } catch (e: any) {
          // If 409, it might be busy or already set.
          addLog('GitHub Pages configuration verified.', 'info');
      }

      addLog('Triggering build pipeline...');
      addLog('This ensures a fresh build of your site.');
      
      // FETCH LATEST COMMIT SHA
      let latestCommitSha = '';
      try {
          const branchInfo = await github.getBranch(repoOwner, repoName, defaultBranch);
          latestCommitSha = branchInfo.commit.sha;
          addLog(`Tracking build for commit: ${latestCommitSha.substring(0, 7)}`);
      } catch (e) {
          console.warn('Could not fetch branch info', e);
      }
      
      const finalUrl = `https://${repoOwner}.github.io/${repoName}/`;
      let isBuilt = false;
      let attempts = 0;
      const MAX_ATTEMPTS = 60; // 3 minutes max

      while (!isBuilt && attempts < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 4000));
        attempts++;
        
        try {
            const builds = await github.getPagesBuilds(repoOwner, repoName);
            if (builds && builds.length > 0) {
              const latest = builds[0];
              
              const shaMatch = latestCommitSha ? latest.commit === latestCommitSha : true;
              
              if (latest.status === 'built' && shaMatch) {
                isBuilt = true;
                addLog('Build successful!', 'success');
              } else if (latest.status === 'errored' && shaMatch) {
                 if (attempts > 5) throw new Error('GitHub Pages build reported an error. Check repository Actions tab for details.');
              } else {
                if (attempts % 5 === 0) addLog(`Current status: ${latest.status}...`);
              }
            } else {
              if (attempts % 5 === 0) addLog('Waiting for build to be queued...');
            }
        } catch (e) {
            // Ignore
        }
      }

      if (isBuilt) {
          addLog('Verifying site availability...');
          await new Promise(r => setTimeout(r, 6000));
          setDeployedUrl(finalUrl);
          addLog(`Deployment process finished. Site live at ${finalUrl}`, 'success');
          setState(AppState.SUCCESS);
      } else {
          addLog('Build taking longer than expected. Check the repository "Actions" tab.', 'info');
          setDeployedUrl(finalUrl);
          setState(AppState.SUCCESS);
      }

    } catch (error: any) {
      addLog(`Error: ${error.message}`, 'error');
    }
  };

  const handleReset = () => {
    setState(AppState.SELECTION);
    setLogs([]);
    setDeployedUrl(null);
  };

  if (isCheckingToken) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-lg font-semibold text-slate-900">GitPage Deployer</h2>
        <p className="text-slate-500 text-sm mt-1">Restoring your session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:h-16 items-center justify-between py-3 md:py-0 gap-3 md:gap-0">
            {/* Top Row on Mobile: Logo + Sign Out */}
            <div className="flex items-center justify-between w-full md:w-auto">
                <div className="flex items-center space-x-2">
                    <Layout className="w-6 h-6 text-indigo-600" />
                    <span className="font-bold text-slate-900 text-lg">GitPage Deployer</span>
                </div>
                
                {/* Mobile Sign Out */}
                {user && (
                    <button 
                        onClick={handleSignOut}
                        className="md:hidden text-sm text-slate-500 hover:text-slate-900"
                    >
                        Sign Out
                    </button>
                )}
            </div>

            {user && (
                <div className="flex items-center w-full md:w-auto md:space-x-6">
                     {/* Navigation Tabs - Full width on mobile */}
                     <nav className="flex w-full md:w-auto space-x-2 md:space-x-4 bg-slate-50 md:bg-transparent p-1 md:p-0 rounded-lg md:rounded-none">
                         <button 
                            onClick={() => setView('deploy')}
                            className={`flex-1 md:flex-none text-center text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                                view === 'deploy' ? 'bg-white md:bg-indigo-50 text-indigo-700 shadow-sm md:shadow-none' : 'text-slate-500 hover:text-slate-900'
                            }`}
                         >
                            New Deployment
                         </button>
                         <button 
                            onClick={() => setView('manage')}
                            className={`flex-1 md:flex-none text-center text-sm font-medium px-3 py-2 rounded-md transition-colors ${
                                view === 'manage' ? 'bg-white md:bg-indigo-50 text-indigo-700 shadow-sm md:shadow-none' : 'text-slate-500 hover:text-slate-900'
                            }`}
                         >
                            My Sites
                         </button>
                     </nav>

                    {/* Desktop Sign Out */}
                    <button 
                        onClick={handleSignOut}
                        className="hidden md:block text-sm text-slate-500 hover:text-slate-900"
                    >
                        Sign Out
                    </button>
                </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        {state === AppState.AUTH && <AuthStep onAuth={handleAuth} />}
        
        {state !== AppState.AUTH && view === 'manage' && user && (
            <ManageStep user={user} onUpdate={handleUpdateRedirect} />
        )}

        {state !== AppState.AUTH && view === 'deploy' && (
            <>
                {state === AppState.SELECTION && user && (
                    <SelectionStep 
                        user={user} 
                        onDeploy={handleDeploy} 
                        initialRepoName={updateRepoName}
                    />
                )}
                {(state === AppState.DEPLOYING || state === AppState.SUCCESS) && (
                    <DeploymentStep logs={logs} url={deployedUrl} onReset={handleReset} />
                )}
            </>
        )}
      </main>

      {/* Ad Banner Integration */}
      <AdBanner />

      <footer className="py-6 text-center text-slate-400 text-sm">
        <p>Build beautiful things.</p>
      </footer>
    </div>
  );
};

export default App;