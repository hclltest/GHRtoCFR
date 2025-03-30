/**
 * GHRtoCFR - 从 GitHub Releases 同步文件到 Cloudflare R2
 */

// 存储上次检查时间的全局变量
let lastCheckTime = 0;

// 默认检查间隔（7天，单位：秒）
const DEFAULT_CHECK_INTERVAL = 604800;

// HTML 模板
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <title>GHRtoCFR - GitHub Releases to Cloudflare R2</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      color: #2563eb;
    }
    .action-bar {
      display: flex;
      justify-content: center;
      margin-bottom: 25px;
      gap: 15px;
    }
    .btn {
      background-color: #2563eb;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-weight: 600;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #1d4ed8;
    }
    .btn:disabled {
      background-color: #93c5fd;
      cursor: not-allowed;
    }
    .btn-sm {
      padding: 5px 10px;
      font-size: 0.9rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #2563eb;
      color: white;
      font-weight: 600;
    }
    tr:nth-child(even) {
      background-color: #f2f7ff;
    }
    tr:hover {
      background-color: #e6f0ff;
    }
    .status {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: 500;
    }
    .status-success {
      background-color: #dcfce7;
      color: #16a34a;
    }
    .status-pending {
      background-color: #fef3c7;
      color: #d97706;
    }
    .status-error {
      background-color: #fee2e2;
      color: #dc2626;
    }
    .sync-log {
      max-height: 200px;
      overflow-y: auto;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
      margin-top: 20px;
      font-family: monospace;
      font-size: 0.9rem;
      white-space: pre-wrap;
    }
    .error-message {
      background-color: #fee2e2;
      color: #dc2626;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
    }
    .info-message {
      background-color: #f0f9ff;
      color: #0369a1;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .last-check {
      font-size: 0.9rem;
      color: #666;
    }
    .api-info {
      font-size: 0.9rem;
      color: #666;
      padding: 8px 16px;
      background-color: #f8fafc;
      border-radius: 6px;
      display: inline-block;
    }
    .api-count {
      font-weight: 600;
      color: #2563eb;
    }
    .api-reset {
      font-style: italic;
    }
    .sync-status {
      display: none;
      align-items: center;
      gap: 10px;
      background-color: #dbeafe;
      color: #1e40af;
      padding: 15px;
      border-radius: 8px;
      margin: 20px auto;
      max-width: 600px;
      text-align: center;
    }
    .spinner {
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top: 3px solid #2563eb;
      width: 20px;
      height: 20px;
      animation: spin 1s linear infinite;
      display: inline-block;
    }
    .sync-row-status {
      display: none;
      font-size: 0.85rem;
      margin-top: 5px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .sync-complete {
      background-color: #dcfce7;
      color: #166534;
    }
    @media (max-width: 768px) {
      table {
        display: block;
        overflow-x: auto;
      }
    }
  </style>
</head>
<body>
  <h1>GitHub Releases to Cloudflare R2</h1>
  {{ERROR_MESSAGE}}
  {{INFO_MESSAGE}}
  
  <div class="action-bar">
    <button id="syncAllButton" class="btn" onclick="triggerSyncAll()">同步所有仓库</button>
  </div>
  
  <div id="syncStatus" class="sync-status">
    <div class="spinner"></div>
    <span>正在同步仓库，请稍候...</span>
  </div>
  
  <div id="syncLog" class="sync-log" style="display: none;"></div>
  
  <table>
    <thead>
      <tr>
        <th>仓库</th>
        <th>最新版本</th>
        <th>更新日期</th>
        <th>存储路径</th>
        <th>状态</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      {{TABLE_ROWS}}
    </tbody>
  </table>
  
  <div class="footer">
    <div class="last-check">最后检查时间: {{LAST_CHECK_TIME}}</div>
    <div class="api-info">{{API_RATE_LIMIT}}</div>
  </div>
  
  <script>
    function triggerSyncAll() {
      const syncAllButton = document.getElementById('syncAllButton');
      const syncStatus = document.getElementById('syncStatus');
      const syncLog = document.getElementById('syncLog');
      
      syncAllButton.disabled = true;
      syncStatus.style.display = 'flex';
      syncLog.style.display = 'block';
      syncLog.innerHTML = '开始同步所有仓库...\\n';
      
      fetch('/api/sync-logs', { method: 'GET' })
        .then(function(response) {
          if (!response.ok) throw new Error('同步日志轮询失败');
          return response.text();
        })
        .then(function() {
          // 连接日志事件流
          const evtSource = new EventSource('/api/sync-logs-stream');
          
          evtSource.onmessage = function(event) {
            const logEntry = event.data;
            syncLog.innerHTML += logEntry + '\\n';
            syncLog.scrollTop = syncLog.scrollHeight;
            
            // 检查是否同步完成
            if (logEntry.includes('同步完成') || logEntry.includes('同步失败')) {
              setTimeout(function() {
                evtSource.close();
                window.location.reload();
              }, 3000);
            }
          };
          
          evtSource.onerror = function() {
            evtSource.close();
          };
        })
        .catch(function(error) {
          syncStatus.innerHTML = '<span style="color: #dc2626;">' + error.message + '</span>';
          syncAllButton.disabled = false;
        });
      
      // 触发同步
      fetch('/sync', { method: 'POST' })
        .catch(function(error) {
          syncStatus.innerHTML = '<span style="color: #dc2626;">' + error.message + '</span>';
          syncAllButton.disabled = false;
        });
    }
    
    function triggerSyncRepo(repo) {
      const repoRow = document.getElementById('repo-' + repo.replace('/', '-'));
      const syncButton = document.getElementById('sync-' + repo.replace('/', '-'));
      const syncRowStatus = document.getElementById('sync-status-' + repo.replace('/', '-'));
      const syncLog = document.getElementById('syncLog');
      
      syncButton.disabled = true;
      syncRowStatus.style.display = 'block';
      syncLog.style.display = 'block';
      syncLog.innerHTML = '开始同步仓库: ' + repo + '...\\n';
      
      fetch('/api/sync-logs', { method: 'GET' })
        .then(function(response) {
          if (!response.ok) throw new Error('同步日志轮询失败');
          return response.text();
        })
        .then(function() {
          // 连接日志事件流
          const evtSource = new EventSource('/api/sync-logs-stream?repo=' + encodeURIComponent(repo));
          
          evtSource.onmessage = function(event) {
            const logEntry = event.data;
            syncLog.innerHTML += logEntry + '\\n';
            syncLog.scrollTop = syncLog.scrollHeight;
            
            // 检查是否同步完成
            if (logEntry.includes('同步完成') || logEntry.includes('同步失败')) {
              setTimeout(function() {
                evtSource.close();
                window.location.reload();
              }, 3000);
            }
          };
          
          evtSource.onerror = function() {
            evtSource.close();
          };
        })
        .catch(function(error) {
          syncRowStatus.innerHTML = '<span style="color: #dc2626;">' + error.message + '</span>';
          syncButton.disabled = false;
        });
      
      // 触发同步
      fetch('/sync?repo=' + encodeURIComponent(repo), { method: 'POST' })
        .catch(function(error) {
          syncRowStatus.innerHTML = '<span style="color: #dc2626;">' + error.message + '</span>';
          syncButton.disabled = false;
        });
    }
  </script>
</body>
</html>`;

/**
 * 处理 Workers 的所有请求
 */
export default {
  // 存储已经同步的仓库信息
  syncedRepos: [],
  
  // 存储 API 速率限制信息
  apiRateLimit: null,
  
  // 存储错误信息
  errorMessage: null,
  
  // 存储信息消息
  infoMessage: null,
  
  // 是否正在进行同步
  isSyncing: false,

  /**
   * 处理 HTTP 请求
   */
  async fetch(request, env, ctx) {
    try {
      // 检查 R2 绑定
      const hasR2Binding = typeof env.R2_BUCKET !== 'undefined';
      if (!hasR2Binding) {
        this.errorMessage = "注意: R2 存储桶未绑定，请在 Workers 设置中绑定 R2_BUCKET。当前仅可查看状态，无法执行同步操作。";
      } else {
        // 清除任何之前的错误
        this.errorMessage = null;
      }
      
      // 获取当前 URL
      const url = new URL(request.url);
      
      // 处理 favicon.svg 请求
      if (url.pathname === "/favicon.svg") {
        // 使用内联SVG直接提供favicon
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>`;
        
        return new Response(svgContent, {
          headers: { 
            "Content-Type": "image/svg+xml",
            "Cache-Control": "public, max-age=86400"
          }
        });
      }
      
      // 处理同步日志流
      if (url.pathname === "/api/sync-logs-stream") {
        // 创建一个流式响应
        const stream = new TransformStream();
        const writer = stream.writable.getWriter();
        
        // 获取可能的仓库参数
        const repoParam = url.searchParams.get('repo');
        
        // 设置环境变量来存储该流的writer，以便后续写入
        env.LOG_WRITER = writer;
        env.LOG_REPO = repoParam;
        
        // 返回EventSource兼容的响应
        return new Response(stream.readable, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
          }
        });
      }
      
      // 处理同步日志API
      if (url.pathname === "/api/sync-logs") {
        // 返回一个简单的确认响应
        return new Response("同步日志服务就绪", { status: 200 });
      }
      
      // 如果请求路径是 /sync，触发同步任务
      if (url.pathname === "/sync") {
        if (!hasR2Binding) {
          return new Response("错误: R2 存储桶未绑定，无法执行同步操作", { status: 400 });
        }
        
        // 检查是否已经有正在进行的同步任务
        if (this.isSyncing) {
          return new Response("同步任务已在进行中，请稍后再试", { status: 409 });
        }
        
        // 获取可能的仓库参数
        const repoParam = url.searchParams.get('repo');
        
        // 标记为正在同步
        this.isSyncing = true;
        
        // 使用 ctx.waitUntil 允许同步在后台继续完成
        ctx.waitUntil((async () => {
          try {
            await this.handleSync(env, repoParam);
          } finally {
            this.isSyncing = false;
          }
        })());
        
        return new Response("同步任务已触发", { status: 200 });
      }
      
      // 如果请求路径是 /api/status，返回 JSON 格式的状态信息
      if (url.pathname === "/api/status") {
        return new Response(JSON.stringify({
          repos: this.syncedRepos,
          lastCheck: lastCheckTime ? new Date(lastCheckTime * 1000).toISOString() : null,
          apiRateLimit: this.apiRateLimit,
          error: this.errorMessage,
          info: this.infoMessage,
          isSyncing: this.isSyncing
        }), {
          headers: { "Content-Type": "application/json" },
          status: 200
        });
      }
      
      // 如果请求路径是 /api/github-rate，获取 GitHub API 速率限制信息
      if (url.pathname === "/api/github-rate") {
        await this.fetchGitHubRateLimit(env);
        return new Response(JSON.stringify({
          apiRateLimit: this.apiRateLimit
        }), {
          headers: { "Content-Type": "application/json" },
          status: 200
        });
      }
      
      // 默认显示状态页面
      // 如果还没有 API 速率限制信息，先获取一次
      if (!this.apiRateLimit) {
        await this.fetchGitHubRateLimit(env);
      }
      
      // 如果还没有仓库信息，尝试获取配置的仓库
      if (this.syncedRepos.length === 0) {
        const repoConfigs = this.getRepoConfigs(env);
        if (repoConfigs.length > 0) {
          // 为每个配置的仓库创建一个临时显示记录
          this.syncedRepos = repoConfigs.map(config => ({
            repo: config.repo,
            version: "未同步",
            date: "-",
            path: config.path,
            status: "pending",
            message: "尚未同步，点击\"同步仓库\"按钮开始同步"
          }));
          // 移除已检测到仓库配置的提示
          this.infoMessage = null;
        } else {
          this.infoMessage = "未检测到有效的仓库配置，请确认已添加 REPO_1、REPO_2 等环境变量";
        }
      }
      
      return this.generateStatusPage();
    } catch (error) {
      console.error("处理请求时出错:", error);
      this.errorMessage = `错误: ${error.message}`;
      return this.generateStatusPage();
    }
  },

  /**
   * 处理定时任务触发
   */
  async scheduled(event, env, ctx) {
    try {
      // 检查 R2 绑定
      if (!env.R2_BUCKET) {
        console.error("R2 存储桶未绑定");
        return;
      }
      
      // 检查是否已经有正在进行的同步任务
      if (this.isSyncing) {
        console.log("已有同步任务正在进行，跳过本次定时触发");
        return;
      }
      
      const now = Math.floor(Date.now() / 1000);
      const checkInterval = parseInt(env.CHECK_INTERVAL || DEFAULT_CHECK_INTERVAL);
      
      // 检查是否到达检查间隔
      if (now - lastCheckTime >= checkInterval) {
        this.isSyncing = true;
        try {
          await this.handleSync(env);
          lastCheckTime = now;
        } finally {
          this.isSyncing = false;
        }
      }
    } catch (error) {
      console.error("定时任务执行出错:", error);
      this.isSyncing = false;
    }
  },

  /**
   * 处理同步任务
   */
  async handleSync(env, specificRepo = null) {
    try {
      // 清除之前的信息消息
      this.infoMessage = null;
      
      // 检查 R2 绑定
      const hasR2Binding = typeof env.R2_BUCKET !== 'undefined';
      if (!hasR2Binding) {
        this.errorMessage = "错误: R2 存储桶未绑定，请在 Workers 设置中绑定 R2_BUCKET";
        await this.sendLogMessage("错误: R2 存储桶未绑定，无法执行同步操作", env);
        return;
      }
      
      // 检查是否有配置仓库
      const repoConfigs = this.getRepoConfigs(env);
      if (repoConfigs.length === 0) {
        this.errorMessage = "未配置任何仓库，请添加 REPO_x 环境变量";
        await this.sendLogMessage("错误: 未配置任何仓库，请添加 REPO_x 环境变量", env);
        return;
      }
      
      // 如果指定了特定仓库，筛选配置
      const configsToProcess = specificRepo 
        ? repoConfigs.filter(config => config.repo === specificRepo)
        : repoConfigs;
        
      if (specificRepo && configsToProcess.length === 0) {
        await this.sendLogMessage(`错误: 未找到指定的仓库配置: ${specificRepo}`, env);
        return;
      }
      
      // 创建新的同步信息数组
      const newSyncedRepos = [...this.syncedRepos];
      
      // 用于跟踪处理过的仓库
      const processedRepos = new Set();
      
      // 处理每个仓库
      for (const config of configsToProcess) {
        try {
          const logPrefix = `[${config.repo}]`;
          await this.sendLogMessage(`${logPrefix} 开始处理仓库...`, env);
          console.log(`开始处理仓库: ${config.repo}`);
          
          // 获取最新版本信息
          await this.sendLogMessage(`${logPrefix} 正在获取最新版本信息...`, env);
          const releaseInfo = await this.fetchLatestRelease(config.repo, env);
          if (!releaseInfo) {
            throw new Error("无法获取最新版本信息");
          }
          
          const { tag_name, published_at, assets } = releaseInfo;
          await this.sendLogMessage(`${logPrefix} 最新版本: ${tag_name}, 发布于: ${published_at}`, env);
          console.log(`最新版本: ${tag_name}, 发布于: ${published_at}`);
          
          // 获取当前 R2 存储桶中的文件，检查是否需要更新
          await this.sendLogMessage(`${logPrefix} 检查是否需要更新...`, env);
          const needUpdate = await this.checkNeedUpdate(config.repo, tag_name, config.path, env);
          
          // 更新同步信息数组中的对应条目
          const repoIndex = newSyncedRepos.findIndex(r => r.repo === config.repo);
          processedRepos.add(config.repo);
          
          if (needUpdate) {
            await this.sendLogMessage(`${logPrefix} 需要更新到新版本: ${tag_name}`, env);
            console.log(`需要更新到新版本: ${tag_name}`);
            
            // 删除旧文件
            await this.sendLogMessage(`${logPrefix} 删除旧文件...`, env);
            await this.deleteOldFiles(config.repo, config.path, env);
            
            // 下载并上传新文件
            const validAssets = assets.filter(asset => {
              return !asset.name.includes("Source code") &&
                     !asset.name.endsWith(".sha256") &&
                     !asset.name.endsWith(".asc");
            });
            
            await this.sendLogMessage(`${logPrefix} 找到 ${validAssets.length} 个有效资源文件`, env);
            
            // 跟踪平台文件上传情况
            const platformCounts = {
              Windows: 0,
              macOS: 0,
              Linux: 0,
              Android: 0,
              Other: 0
            };
            
            for (let i = 0; i < validAssets.length; i++) {
              const asset = validAssets[i];
              await this.sendLogMessage(`${logPrefix} 处理资源 (${i+1}/${validAssets.length}): ${asset.name}`, env);
              
              try {
                const platform = this.determineOSType(asset.name);
                await this.downloadAndUploadAsset(asset, config.repo, config.path, platform, env);
                platformCounts[platform]++;
                await this.sendLogMessage(`${logPrefix} 成功上传: ${asset.name} → ${platform}`, env);
              } catch (assetError) {
                await this.sendLogMessage(`${logPrefix} 资源处理失败: ${asset.name} - ${assetError.message}`, env);
              }
            }
            
            // 记录各平台上传情况
            const platformSummary = Object.entries(platformCounts)
              .filter(([_, count]) => count > 0)
              .map(([platform, count]) => `${platform}: ${count}个文件`)
              .join(', ');
            
            await this.sendLogMessage(`${logPrefix} 上传完成，共 ${validAssets.length} 个文件 (${platformSummary})`, env);
            
            // 记录版本信息
            await this.saveVersionInfo(config.repo, tag_name, config.path, env);
            
            // 记录同步结果
            if (repoIndex >= 0) {
              newSyncedRepos[repoIndex] = {
                ...newSyncedRepos[repoIndex],
                version: tag_name,
                date: published_at,
                status: "updated",
                message: "已更新到最新版本"
              };
            } else {
              newSyncedRepos.push({
                repo: config.repo,
                version: tag_name,
                date: published_at,
                path: config.path,
                status: "updated",
                message: "已更新到最新版本"
              });
            }
            
            await this.sendLogMessage(`${logPrefix} 同步完成：已更新到最新版本 ${tag_name}`, env);
          } else {
            await this.sendLogMessage(`${logPrefix} 无需更新，当前已是最新版本: ${tag_name}`, env);
            console.log(`无需更新，当前已是最新版本: ${tag_name}`);
            
            // 记录同步结果
            if (repoIndex >= 0) {
              newSyncedRepos[repoIndex] = {
                ...newSyncedRepos[repoIndex],
                version: tag_name,
                date: published_at,
                status: "latest",
                message: "当前已是最新版本"
              };
            } else {
              newSyncedRepos.push({
                repo: config.repo,
                version: tag_name,
                date: published_at,
                path: config.path,
                status: "latest",
                message: "当前已是最新版本"
              });
            }
            
            await this.sendLogMessage(`${logPrefix} 同步完成：当前已是最新版本 ${tag_name}`, env);
          }
        } catch (error) {
          console.error(`处理仓库 ${config.repo} 时出错:`, error);
          await this.sendLogMessage(`[${config.repo}] 同步失败: ${error.message}`, env);
          
          // 记录错误信息
          const repoIndex = newSyncedRepos.findIndex(r => r.repo === config.repo);
          if (repoIndex >= 0) {
            newSyncedRepos[repoIndex] = {
              ...newSyncedRepos[repoIndex],
              date: new Date().toISOString(),
              status: "error",
              message: error.message
            };
          } else {
            newSyncedRepos.push({
              repo: config.repo,
              version: "未知",
              date: new Date().toISOString(),
              path: config.path,
              status: "error",
              message: error.message
            });
          }
        }
      }
      
      // 对于没有处理的仓库，保持其原有状态
      if (specificRepo) {
        // 更新同步信息，只处理指定的仓库
        this.syncedRepos = newSyncedRepos;
      } else {
        // 全部更新，这是原始行为
        this.syncedRepos = newSyncedRepos;
        await this.sendLogMessage(`所有仓库同步完成`, env);
      }
      
    } catch (error) {
      console.error("同步任务执行出错:", error);
      await this.sendLogMessage(`同步任务执行出错: ${error.message}`, env);
      this.errorMessage = `同步任务执行出错: ${error.message}`;
    }
  },

  /**
   * 从环境变量中获取仓库配置
   */
  getRepoConfigs(env) {
    const configs = [];
    
    try {
      // 遍历所有环境变量，查找仓库配置
      for (const key in env) {
        if (key.startsWith("REPO_")) {
          const value = env[key];
          
          // 解析配置格式: 用户名/仓库名:存储路径
          const parts = value.split(":");
          const repo = parts[0];
          const path = parts.length > 1 ? parts.slice(1).join(":") : "";
          
          if (repo) {
            configs.push({ repo, path });
          }
        }
      }
    } catch (error) {
      console.error("获取仓库配置出错:", error);
    }
    
    return configs;
  },

  /**
   * 获取仓库的最新 Release 信息
   */
  async fetchLatestRelease(repo, env) {
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;
    
    const headers = {
      "User-Agent": "GHRtoCFR-Worker",
      "Accept": "application/vnd.github.v3+json"
    };
    
    // 如果配置了 GitHub Token，添加到请求头中
    if (env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${env.GITHUB_TOKEN}`;
    }
    
    const response = await fetch(apiUrl, { headers });
    
    // 保存 API 速率限制信息
    this.saveRateLimitInfo(response.headers);
    
    if (!response.ok) {
      throw new Error(`获取 GitHub Release 失败: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  },

  /**
   * 检查是否需要更新
   */
  async checkNeedUpdate(repo, newVersion, path, env) {
    try {
      // 检查版本信息文件
      const versionKey = this.getVersionKey(repo, path);
      const versionObj = await env.R2_BUCKET.get(versionKey);
      
      if (versionObj) {
        const versionInfo = await versionObj.json();
        return versionInfo.version !== newVersion;
      }
      
      // 没有版本信息，需要更新
      return true;
    } catch (error) {
      console.error("检查更新时出错:", error);
      // 出错时默认需要更新
      return true;
    }
  },

  /**
   * 获取版本信息文件的 key
   */
  getVersionKey(repo, path) {
    const basePath = path.startsWith("/") ? path.slice(1) : path;
    const repoId = repo.replace(/\//g, "-");
    return basePath ? `${basePath}/${repoId}-version.json` : `${repoId}-version.json`;
  },

  /**
   * 删除旧文件
   */
  async deleteOldFiles(repo, path, env) {
    try {
      const prefix = path.startsWith("/") ? path.slice(1) : path;
      
      // 列出存储桶中的文件
      const options = prefix ? { prefix: `${prefix}/` } : undefined;
      const listed = await env.R2_BUCKET.list(options);
      
      // 删除所有匹配的文件
      const promises = [];
      for (const object of listed.objects) {
        // 跳过版本信息文件
        if (object.key.endsWith(`${repo.replace(/\//g, "-")}-version.json`)) {
          continue;
        }
        
        // 如果文件在指定路径下，则删除
        if (!prefix || object.key.startsWith(`${prefix}/`)) {
          promises.push(env.R2_BUCKET.delete(object.key));
        }
      }
      
      await Promise.all(promises);
      console.log(`已删除旧文件`);
    } catch (error) {
      console.error("删除旧文件时出错:", error);
      throw new Error(`删除旧文件时出错: ${error.message}`);
    }
  },

  /**
   * 下载并上传单个资源文件
   */
  async downloadAndUploadAsset(asset, repo, path, platform, env) {
    try {
      const response = await fetch(asset.browser_download_url);
      if (!response.ok) {
        throw new Error(`下载文件失败: ${response.status} ${response.statusText}`);
      }
      
      // 构建存储路径
      let storagePath = path.startsWith("/") ? path.slice(1) : path;
      if (storagePath && !storagePath.endsWith("/")) {
        storagePath += "/";
      }
      
      // 按平台分类
      if (platform !== "Other") {
        storagePath += `${platform}/`;
      }
      
      // 添加文件名
      storagePath += asset.name;
      
      // 上传到 R2 存储桶
      await env.R2_BUCKET.put(storagePath, response.body);
      
      return storagePath;
    } catch (error) {
      console.error(`下载上传资源文件失败: ${asset.name}`, error);
      throw error;
    }
  },

  /**
   * 下载并上传资源文件
   */
  async downloadAndUploadAssets(repo, assets, path, env) {
    try {
      // 过滤出有效的资源文件（排除源代码、校验文件等）
      const validAssets = assets.filter(asset => {
        return !asset.name.includes("Source code") &&
               !asset.name.endsWith(".sha256") &&
               !asset.name.endsWith(".asc");
      });
      
      if (validAssets.length === 0) {
        console.warn("未找到有效资源文件");
        return;
      }
      
      // 处理每个资源文件
      for (const asset of validAssets) {
        const platform = this.determineOSType(asset.name);
        await this.downloadAndUploadAsset(asset, repo, path, platform, env);
      }
    } catch (error) {
      console.error("下载上传资源文件时出错:", error);
      throw error;
    }
  },

  /**
   * 根据文件名确定操作系统类型
   */
  determineOSType(filename) {
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes("windows") || 
        lowerName.includes("win") || 
        lowerName.endsWith(".exe") || 
        lowerName.endsWith(".msi") || 
        lowerName.includes("win64") || 
        lowerName.includes("win32")) {
      return "Windows";
    }
    
    if (lowerName.includes("macos") || 
        lowerName.includes("darwin") || 
        lowerName.includes("mac") || 
        lowerName.endsWith(".dmg") || 
        lowerName.endsWith(".pkg")) {
      return "macOS";
    }
    
    if (lowerName.includes("linux") || 
        lowerName.endsWith(".deb") || 
        lowerName.endsWith(".rpm") || 
        lowerName.endsWith(".appimage")) {
      return "Linux";
    }
    
    if (lowerName.includes("android") || 
        lowerName.endsWith(".apk")) {
      return "Android";
    }
    
    // 如果无法确定，返回 Other
    return "Other";
  },

  /**
   * 保存版本信息
   */
  async saveVersionInfo(repo, version, path, env) {
    try {
      const versionKey = this.getVersionKey(repo, path);
      const versionInfo = {
        repo,
        version,
        updatedAt: new Date().toISOString()
      };
      
      await env.R2_BUCKET.put(versionKey, JSON.stringify(versionInfo), {
        httpMetadata: {
          contentType: "application/json"
        }
      });
    } catch (error) {
      console.error("保存版本信息时出错:", error);
      throw new Error(`保存版本信息时出错: ${error.message}`);
    }
  },

  /**
   * 保存 API 速率限制信息
   */
  saveRateLimitInfo(headers) {
    try {
      const remaining = headers.get('x-ratelimit-remaining');
      const limit = headers.get('x-ratelimit-limit');
      const reset = headers.get('x-ratelimit-reset');
      
      console.log("GitHub API Headers:", { remaining, limit, reset });
      
      if (remaining && limit && reset) {
        const resetTimestamp = parseInt(reset);
        console.log("Reset timestamp:", resetTimestamp, "Date:", new Date(resetTimestamp * 1000).toISOString());
        
        this.apiRateLimit = {
          remaining: parseInt(remaining),
          limit: parseInt(limit),
          reset: resetTimestamp
        };
      }
    } catch (error) {
      console.error("保存API速率限制信息时出错:", error);
    }
  },

  /**
   * 获取 GitHub API 速率限制信息
   */
  async fetchGitHubRateLimit(env) {
    const apiUrl = "https://api.github.com/rate_limit";
    
    const headers = {
      "User-Agent": "GHRtoCFR-Worker",
      "Accept": "application/vnd.github.v3+json"
    };
    
    // 如果配置了 GitHub Token，添加到请求头中
    if (env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${env.GITHUB_TOKEN}`;
    }
    
    try {
      const response = await fetch(apiUrl, { headers });
      this.saveRateLimitInfo(response.headers);
      
      if (response.ok) {
        const data = await response.json();
        console.log("GitHub API 速率限制信息:", data.rate);
      } else {
        console.error("获取 GitHub API 速率限制失败:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("获取 GitHub API 速率限制出错:", error);
    }
  },

  /**
   * 生成状态页面
   */
  async generateStatusPage() {
    let tableRows = "";
    
    if (this.syncedRepos.length === 0) {
      tableRows = `<tr><td colspan="6" style="text-align: center">暂无同步数据</td></tr>`;
    } else {
      for (const repo of this.syncedRepos) {
        let statusClass = "";
        let statusText = "";
        
        if (repo.status === "error") {
          statusClass = "status-error";
          statusText = "失败";
        } else if (repo.status === "updated") {
          statusClass = "status-success";
          statusText = "已更新";
        } else if (repo.status === "latest") {
          statusClass = "status-success";
          statusText = "最新";
        } else if (repo.status === "pending") {
          statusClass = "status-pending";
          statusText = "待同步";
        } else {
          statusClass = "status-pending";
          statusText = "未知";
        }
        
        // 处理日期显示
        let dateStr = repo.date;
        if (repo.date && repo.date !== "-") {
          try {
            // 使用中国时区格式化日期
            dateStr = new Date(repo.date).toLocaleString('zh-CN', {
              year: 'numeric',
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
              timeZone: 'Asia/Shanghai'
            });
          } catch (e) {
            console.error("日期格式化错误:", e);
          }
        }
        
        const repoId = repo.repo.replace(/\//g, '-');
        
        tableRows += `
          <tr id="repo-${repoId}">
            <td>${repo.repo}</td>
            <td>${repo.version}</td>
            <td>${dateStr}</td>
            <td>${repo.path || "/"}</td>
            <td><span class="status ${statusClass}" title="${repo.message || ''}">${statusText}</span></td>
            <td>
              <button id="sync-${repoId}" class="btn btn-sm" onclick="triggerSyncRepo('${repo.repo}')">同步</button>
              <div id="sync-status-${repoId}" class="sync-row-status">
                <div class="spinner" style="width: 12px; height: 12px;"></div>
                <span>同步中...</span>
              </div>
            </td>
          </tr>
        `;
      }
    }
    
    // 添加错误信息
    let errorMessageHtml = '';
    if (this.errorMessage) {
      errorMessageHtml = `<div class="error-message">${this.errorMessage}</div>`;
    }
    
    // 添加信息消息
    let infoMessageHtml = '';
    if (this.infoMessage) {
      infoMessageHtml = `<div class="info-message">${this.infoMessage}</div>`;
    }
    
    // 添加 API 速率限制信息
    let apiRateLimitInfo = "GitHub API 速率: 未知";
    if (this.apiRateLimit) {
      try {
        // 确保重置时间是时间戳（秒）
        const resetTimestamp = this.apiRateLimit.reset;
        
        // 正确格式化重置时间（使用中国时区）
        const resetDate = new Date(resetTimestamp * 1000);
        const resetTime = resetDate.toLocaleString('zh-CN', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Shanghai'
        });
        
        apiRateLimitInfo = `GitHub API 速率: <span class="api-count">${this.apiRateLimit.remaining}/${this.apiRateLimit.limit}</span> 次 (<span class="api-reset">重置时间: ${resetTime}</span>)`;
      } catch (e) {
        console.error("API速率时间格式化错误:", e, this.apiRateLimit);
        apiRateLimitInfo = `GitHub API 速率: <span class="api-count">${this.apiRateLimit.remaining}/${this.apiRateLimit.limit}</span> 次 (重置时间: 格式化错误)`;
      }
    }
    
    // 处理最后检查时间
    let lastCheckTimeStr = "未检查";
    if (lastCheckTime) {
      try {
        // 使用中国时区格式化最后检查时间
        lastCheckTimeStr = new Date(lastCheckTime * 1000).toLocaleString('zh-CN', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'Asia/Shanghai'
        });
      } catch (e) {
        console.error("最后检查时间格式化错误:", e);
        lastCheckTimeStr = new Date(lastCheckTime * 1000).toLocaleString();
      }
    }
    
    // 替换模板中的占位符
    let html = HTML_TEMPLATE
      .replace("{{ERROR_MESSAGE}}", errorMessageHtml)
      .replace("{{INFO_MESSAGE}}", infoMessageHtml)
      .replace("{{TABLE_ROWS}}", tableRows)
      .replace("{{LAST_CHECK_TIME}}", lastCheckTimeStr)
      .replace("{{API_RATE_LIMIT}}", apiRateLimitInfo);
    
    // 如果正在同步，添加额外的脚本使同步状态可见
    if (this.isSyncing) {
      html = html.replace('</script>', `
        document.addEventListener('DOMContentLoaded', function() {
          document.getElementById('syncAllButton').disabled = true;
          document.getElementById('syncStatus').style.display = 'flex';
          document.getElementById('syncLog').style.display = 'block';
        });
      </script>`);
    }
    
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  },

  /**
   * 向同步日志流发送消息
   */
  async sendLogMessage(message, env) {
    try {
      if (env.LOG_WRITER) {
        // 检查是否有仓库过滤
        if (env.LOG_REPO && !message.includes(env.LOG_REPO)) {
          // 如果指定了仓库过滤且消息与该仓库无关，则不发送
          return;
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(`data: ${message}\n\n`);
        await env.LOG_WRITER.write(data);
      }
    } catch (error) {
      console.error("发送日志消息失败:", error);
    }
  }
}; 