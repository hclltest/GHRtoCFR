# GHRtoCFR

GHRtoCFR (GitHub Releases to Cloudflare R2) 是一个 Cloudflare Workers 项目，可以自动监控 GitHub 仓库的 Releases 并将文件同步到 Cloudflare R2 存储桶中。

## 功能特点

- ✅ 自动监控 GitHub 仓库的最新版本
- ✅ 按操作系统类型自动分类文件 (Windows, macOS, Linux, Android)
- ✅ 支持自定义存储路径
- ✅ 自动删除旧版本文件
- ✅ 支持自定义检查更新时间间隔
- ✅ 美观的状态页面，显示监控的仓库和同步状态

## 在线部署教程

### 手动部署

#### 前置条件

- 拥有 Cloudflare 账号
- 在 Cloudflare 中创建了 R2 存储桶
- 在 Cloudflare 中创建一个 KV 命名空间

#### 部署步骤

1. **Fork 本项目到你自己的github仓库**

2. **创建 R2 存储桶**

   - 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
   - 进入 **R2 对象存储** 服务
   - 点击 **创建存储桶**，输入存储桶名称（例如 `github-releases`）
   - 记下存储桶名称，后续配置需要用到

3. **创建 KV 命名空间**
   - 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
   - 进入 **存储和数据库** 服务
   - 选择 **KV** 再点击 **创建**，输入一个自定义名称
   - 记下对应命名空间的 **ID**，后续配置需要用到

4. **修改 wrangler.toml 配置文件**
   - 安装这个配置文件中的注释，修改你的配置文件，填写之前创建的**R2**和**KV**的相关信息

5.  **测试服务**

   - 访问你的 Worker URL（例如 `https://ghrtocfr.your-account.workers.dev`）
   - 如果配置正确，你将看到一个状态页面显示正在监控的仓库
   - 要手动触发同步，访问 `/sync` 路径（例如 `https://ghrtocfr.your-account.workers.dev/sync`）

## API 接口

Worker 提供以下 API 端点：

| 端点 | 描述 |
|------|------|
| `/` | 默认状态页面，显示监控的仓库和同步状态 |
| `/sync` | 手动触发同步操作 |
| `/api/status` | 获取 JSON 格式的同步状态信息 |
| `/api/github-rate` | 获取 GitHub API 速率限制信息 |

## 环境变量详解

| 变量名 | 描述 | 示例 |
|--------|------|------|
| `REPO_x` | 监控的仓库配置 (x 为数字编号) | `2dust/v2rayN:/apps/v2ray` |
| `CHECK_INTERVAL` | 检查更新的间隔时间（秒）| `604800` (7天) |
| `GITHUB_TOKEN` | GitHub 个人访问令牌，用于提高 API 请求限制 | `ghp_xxxxxxxxxxxx` |

### GitHub Token 说明

未使用 GitHub Token 的情况下，GitHub API 对匿名请求的限制为每小时 60 次。当您监控多个仓库或频繁检查更新时，可能会超出此限制。

配置 GitHub Token 可以将此限制提高到每小时 5000 次，大大降低被限制的可能性。

如何获取 GitHub Token:
1. 登录 GitHub 账号
2. 点击右上角头像 → Settings → Developer settings → Personal access tokens → Tokens (classic)
3. 点击 "Generate new token" → "Generate new token (classic)"
4. 为令牌起一个名称，例如 "GHRtoCFR"
5. 选择 `public_repo` 权限（如果只需读取公开仓库的发布）
6. 点击 "Generate token"，复制生成的令牌
7. 在 Cloudflare Workers 的环境变量中添加 `GITHUB_TOKEN`，值为刚才复制的令牌

**安全提示**: GitHub Token 具有访问您 GitHub 账户的权限，请妥善保管，不要分享给他人。

### 触发器与检查间隔说明

Worker 配置的 Cron 触发器（默认为每分钟执行一次）与 `CHECK_INTERVAL` 环境变量的关系：

- **Cron 触发器**：定义 Worker 被 Cloudflare 平台唤醒执行的频率
- **CHECK_INTERVAL**：定义实际检查 GitHub 仓库是否有更新的间隔

虽然 Worker 可能每分钟被触发一次，但它会在内部检查距离上次执行同步任务的时间是否已经达到 `CHECK_INTERVAL` 设定的秒数。如果未达到，则不会执行实际的同步操作。

您可以根据需求修改 Cron 触发频率：
- `0 * * * *` - 每小时触发一次
- `0 0 * * *` - 每天触发一次

无论如何设置触发频率，实际执行同步的间隔仍由 `CHECK_INTERVAL` 控制。

### 仓库配置格式

`REPO_x` 环境变量的值采用以下格式：`用户名/仓库名:存储路径`

- **用户名/仓库名**：GitHub 仓库的用户名和仓库名
- **存储路径**：文件在 R2 存储桶中的存储路径（可选，默认为根目录）

工作器会根据文件名自动判断不同平台的版本，并将它们存放在对应的子目录中：
- Windows 版本 → `存储路径/Windows/`
- macOS 版本 → `存储路径/macOS/`
- Linux 版本 → `存储路径/Linux/`
- Android 版本 → `存储路径/Android/`

## 许可证

MIT