# Deno 部署指南

本文档提供了将 Sora2API 部署到 Deno 平台的详细说明。

## 环境要求

- Deno 1.38.0 或更高版本
- 现代浏览器（用于管理界面）

## 快速开始

### 1. 克隆项目并切换到 Deno 分支

```bash
git clone https://github.com/TheSmallHanCat/sora2api.git
cd sora2api
git checkout deno
```

### 2. 安装 Deno

在本地安装 Deno：

```bash
# Linux / macOS
curl -fsSL https://deno.land/install.sh | sh

# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex
```

或者按照 [Deno 官方文档](https://deno.land/manual@v1.38.0/getting_started/installation) 中的说明安装。

### 3. 启动服务

```bash
# 开发模式
deno task dev

# 生产模式
deno task start
```

服务将在 http://localhost:8000 上启动。

## 配置说明

### 环境变量

你可以创建 `.env` 文件来配置环境变量：

```bash
# 服务器配置
HOST=0.0.0.0
PORT=8000

# 数据库配置
DATABASE_URL=sqlite:data/sora2api.db

# 认证配置
JWT_SECRET=your-secret-key

# API 配置
SORA_BASE_URL=https://sora.openai.com
API_KEY=your-sora-api-key
```

### 配置文件

项目的配置文件位于 `config/setting.toml`，可以在这里设置默认参数。

```toml
[global]
adminUsername = "admin"
adminPassword = "admin"

[sora]
baseUrl = "https://sora.openai.com"
timeout = 300

[server]
host = "0.0.0.0"
port = 8000
```

## 部署到 Deno Deploy

### 1. 准备代码

Deno Deploy 有一些特殊要求，我们需要对代码进行一些调整。创建一个新的 `deploy` 目录：

```bash
mkdir deploy
```

### 2. 创建部署专用的入口文件

创建 `deploy/main.ts`：

```typescript
// Deno Deploy 版本的入口文件
import { Application, Router } from "oak";
import { oakCors } from "cors";
import { apiRoutes } from "../src/api/routes.ts";
import { adminRoutes } from "../src/api/admin.ts";
import { GenerationHandler } from "../src/services/generation_handler.ts";

// 初始化 Oak 应用
const app = new Application();

// 启用 CORS
app.use(oakCors({
  origin: /^.+$/,
  optionsSuccessStatus: 200
}));

// 初始化服务
const generationHandler = new GenerationHandler(/* 传入必要的依赖 */);

// 设置依赖
apiRoutes.setGenerationHandler(generationHandler);
adminRoutes.setDependencies(/* 传入必要的依赖 */);

// API Router
const apiRouter = Router();
apiRouter.use("/v1/models", apiRoutes.listModels);
apiRouter.use("/v1/chat/completions", apiRoutes.chatCompletions);

// Admin Router
const adminRouter = Router();
adminRouter.get("/login", adminRoutes.loginPage);
adminRouter.get("/manage", adminRoutes.managePage);
// ... 其他路由

// 包含路由
app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());
app.use(adminRouter.routes());
app.use(adminRouter.allowedMethods());

// 错误处理
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
});

// 启动服务器
const port = parseInt(Deno.env.get("PORT") || "8000");
await app.listen({ port });
console.log(`📡 Server running on port ${port}`);
```

### 3. 部署到 Deno Deploy

1. 访问 [Deno Deploy](https://dash.deno.com/new)

2. 连接你的 GitHub 仓库并选择 `deno` 分支

3. 设置入口点为 `deploy/main.ts`

4. 设置环境变量：
   - `SORA_BASE_URL`: https://sora.openai.com
   - `API_KEY`: 你的 Sora API 密钥
   - `JWT_SECRET`: 一个随机的安全密钥

5. 点击 "Deploy" 按钮

部署完成后，Deno Deploy 会为你提供一个 URL，你可以通过这个 URL 访问你的 Sora2API 服务。

## 部署到自己的服务器

### 1. 使用 PM2 管理 Deno 进程

```bash
# 安装 PM2
npm install -g pm2

# 创建 ecosystem.config.js
cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: "sora2api-deno",
    script: "deno",
    args: "run --allow-net --allow-read --allow-write --allow-env --allow-run main.ts",
    env: {
      NODE_ENV: "development"
    },
    env_production: {
      NODE_ENV: "production"
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G"
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js --env production

# 查看日志
pm2 logs sora2api-deno

# 重启应用
pm2 restart sora2api-deno
```

### 2. 使用 Docker

创建 `Dockerfile.deno`：

```dockerfile
FROM denoland/deno:1.38.0

WORKDIR /app

COPY deno.json ./deno.json
COPY src ./src
COPY config ./config
COPY static ./static
COPY main.ts ./

EXPOSE 8000

CMD ["run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-run", "main.ts"]
```

构建和运行：

```bash
# 构建镜像
docker build -f Dockerfile.deno -t sora2api-deno .

# 运行容器
docker run -d \
  -p 8000:8000 \
  --name sora2api-deno \
  -e SORA_BASE_URL=https://sora.openai.com \
  -e API_KEY=your-api-key \
  sora2api-deno
```

## 使用说明

服务启动后，你可以：

1. 访问 http://localhost:8000/login 进入管理后台
2. 默认用户名和密码是 `admin`（请及时修改）
3. 在管理后台中配置你的 Sora API 密钥
4. 使用 OpenAI 兼容的 API 调用格式进行请求

### API 调用示例

```bash
# 文生图
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Authorization: Bearer han1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-image",
    "messages": [
      {
        "role": "user",
        "content": "一只可爱的小猫咪"
      }
    ]
  }'

# 文生视频
curl -X POST "http://localhost:8000/v1/chat/completions" \
  -H "Authorization: Bearer han1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sora-video-landscape-10s",
    "messages": [
      {
        "role": "user",
        "content": "一只小猫在草地上奔跑"
      }
    ],
    "stream": true
  }'
```

## 故障排除

### 1. 权限错误

确保你在运行 Deno 时提供了所有必要的权限：

```bash
deno run --allow-net --allow-read --allow-write --allow-env --allow-run main.ts
```

### 2. 端口占用

如果端口 8000 被占用，可以通过环境变量修改：

```bash
PORT=3000 deno run --allow-net --allow-read --allow-write --allow-env --allow-run main.ts
```

### 3. 数据库问题

确保 `data` 目录存在且有写入权限：

```bash
mkdir -p data
chmod 755 data
```

## 开发指南

### 1. 启用热重载

开发时使用 `--watch` 参数可以启用热重载：

```bash
deno task dev
```

这会在文件变化时自动重启服务。

### 2. 调试

使用 `--inspect` 参数启用调试：

```bash
deno run --allow-net --allow-read --allow-write --allow-env --allow-run --inspect main.ts
```

然后在 Chrome 中打开 `chrome://inspect` 进行调试。

### 3. 类型检查

运行类型检查：

```bash
deno check --remote main.ts
```

---

如有问题，请提交 [Issue](https://github.com/TheSmallHanCat/sora2api/issues)。