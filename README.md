# GHRtoCFR (GitHub Releases to Cloudflare R2)

GHRtoCFR 是一个 Cloudflare Workers 项目，可以自动监控 GitHub 仓库的 Releases 并将文件同步到 Cloudflare R2 存储桶中。

## 功能特点

- ✅ 自动监控 GitHub 仓库的最新版本
- ✅ 按操作系统类型自动分类文件 (Windows, macOS, Linux, Android)
- ✅ 支持自定义存储路径
- ✅ 自动删除旧版本文件
- ✅ 支持自定义检查更新时间间隔
- ✅ 美观的状态页面，显示监控的仓库和同步状态

## 在线部署教程

### 前置条件

- 拥有 Cloudflare 账号
- 在 Cloudflare 中创建了 R2 存储桶

### 部署步骤

1. **创建 R2 存储桶**

   - 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)
   - 进入 **R2** 服务
   - 点击 **创建存储桶**，输入存储桶名称（例如 `github-releases`）
   - 记下存储桶名称，后续配置需要用到

2. **部署 Worker**

   - 在 Cloudflare 控制台左侧菜单选择 **Workers & Pages**
   - 点击 **创建应用程序**
   - 选择 **创建 Worker**
   - 为 Worker 起一个名字（例如 `ghrtocfr`）
   - 部署成功后，点击右上角的 **编辑代码** 按钮
   - 将本项目 `src/index.js` 中的代码复制到编辑器中，点击 **保存并部署**

3. **绑定 R2 存储桶**

   - 在 Worker 详情页面，点击 **设置** 标签
   - 找到 **变量** 部分，点击 **R2 存储桶** 标签
   - 点击 **添加绑定**
   - **变量名称** 填写 `R2_BUCKET`（必须使用这个名称）
   - **存储桶** 选择你之前创建的存储桶
   - 点击 **保存**

4. **配置触发器**

   - 在 Worker 详情页面，点击 **触发器** 标签
   - 在 **Cron 触发器** 部分，点击 **添加 Cron 触发器**
   - 选择 **自定义** 并输入 `* * * * *`（每分钟执行一次）
   - 点击 **保存**

5. **配置环境变量**

   - 回到 **设置** 标签，找到 **变量** 部分，点击 **环境变量** 标签
   - 点击 **添加变量**
   - 添加以下变量：
     - `REPO_1`：配置第一个要监控的仓库，格式为 `用户名/仓库名:存储路径`（例如 `2dust/v2rayN:/v2ray`）
     - `REPO_2`：配置第二个要监控的仓库（如果需要）
     - ... 可以继续添加更多仓库
     - `CHECK_INTERVAL`：检查更新的间隔时间（秒），默认为 604800（7天）
   - 点击 **保存**

6. **测试服务**

   - 访问你的 Worker URL（例如 `https://ghrtocfr.your-account.workers.dev`）
   - 如果配置正确，你将看到一个状态页面显示正在监控的仓库
   - 要手动触发同步，访问 `/sync` 路径（例如 `https://ghrtocfr.your-account.workers.dev/sync`）

## 环境变量详解

| 变量名 | 描述 | 示例 |
|--------|------|------|
| `REPO_x` | 监控的仓库配置 (x 为数字编号) | `2dust/v2rayN:/apps/v2ray` |
| `CHECK_INTERVAL` | 检查更新的间隔时间（秒）| `86400` (1天) |

### 仓库配置格式

`REPO_x` 环境变量的值采用以下格式：`用户名/仓库名:存储路径`

- **用户名/仓库名**：GitHub 仓库的用户名和仓库名
- **存储路径**：文件在 R2 存储桶中的存储路径（可选，默认为根目录）

工作器会根据文件名自动判断不同平台的版本，并将它们存放在对应的子目录中：
- Windows 版本 → `存储路径/Windows/`
- macOS 版本 → `存储路径/macOS/`
- Linux 版本 → `存储路径/Linux/`
- Android 版本 → `存储路径/Android/`

### 示例

1. 配置监控 v2rayN 仓库，并将文件存储在 `/v2ray` 目录下：
   ```
   REPO_1=2dust/v2rayN:/v2ray
   ```

2. 配置监控 v2rayNG 仓库，并将文件存储在 `/v2ray/Android` 目录下：
   ```
   REPO_2=2dust/v2rayNG:/v2ray/Android
   ```

3. 配置每 3 天检查一次更新（259200 秒）：
   ```
   CHECK_INTERVAL=259200
   ```

## 本地开发

1. 克隆项目
2. 安装依赖：`npm install`
3. 修改 `wrangler.toml` 文件中的配置
4. 本地开发：`npm run dev`
5. 部署：`npm run deploy`

## 许可证

MIT 