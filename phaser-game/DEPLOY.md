# Netlify 部署说明

## 快速部署步骤

### 方法1：通过 Netlify 网站部署（推荐）

1. **访问 Netlify 官网**
   - 打开 https://www.netlify.com/
   - 使用 GitHub/GitLab/Bitbucket 账号登录

2. **连接 Git 仓库**
   - 点击 "Add new site" → "Import an existing project"
   - 选择你的 Git 提供商（GitHub/GitLab/Bitbucket）
   - 授权 Netlify 访问你的仓库
   - 选择 `fightmoney` 仓库

3. **配置构建设置**
   - Base directory: `phaser-game`
   - Build command: `npm run build`
   - Publish directory: `phaser-game/dist`
   - 点击 "Deploy site"

4. **等待构建完成**
   - Netlify 会自动安装依赖、构建项目并部署
   - 部署完成后会生成一个 `https://xxxxx.netlify.app` 的网址

### 方法2：通过 Netlify CLI 部署

1. **安装 Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **登录 Netlify**
   ```bash
   netlify login
   ```

3. **进入项目目录**
   ```bash
   cd e:\Unit3\html\game\fightmoney\phaser-game
   ```

4. **初始化 Netlify**
   ```bash
   netlify init
   ```
   - 选择 "Create & configure a new site"
   - 选择团队
   - 输入站点名称（可选）
   - Build command: `npm run build`
   - Publish directory: `dist`

5. **部署**
   ```bash
   netlify deploy --prod
   ```

### 方法3：手动上传构建文件

1. **本地构建项目**
   ```bash
   cd e:\Unit3\html\game\fightmoney\phaser-game
   npm run build
   ```

2. **登录 Netlify**
   - 访问 https://app.netlify.com/drop
   - 将 `phaser-game/dist` 文件夹拖拽到页面中
   - 自动部署

## 已配置文件

✅ `netlify.toml` - Netlify 配置文件
- 构建命令：`npm run build`
- 发布目录：`dist`
- SPA 路由支持
- 性能优化头部

✅ `vite.config.ts` - Vite 生产构建优化
- 启用代码压缩（Terser）
- Phaser 单独打包
- 静态资源优化

## 部署前检查

在部署前，请确保：

1. ✅ 代码已推送到 Git 仓库（GitHub/GitLab/Bitbucket）
2. ✅ `package.json` 包含正确的依赖
3. ✅ 本地测试构建成功：
   ```bash
   cd phaser-game
   npm install
   npm run build
   npm run preview
   ```

## 环境变量配置（如需要）

如果项目需要环境变量：

1. 在 Netlify 网站中，进入 Site settings → Environment variables
2. 添加需要的环境变量
3. 重新部署

## 自定义域名（可选）

部署成功后，可以绑定自定义域名：

1. 进入 Site settings → Domain management
2. 点击 "Add custom domain"
3. 输入你的域名
4. 按照提示配置 DNS

## 自动部署

一旦配置完成，每次推送代码到 Git 仓库，Netlify 都会自动：
- 拉取最新代码
- 执行构建命令
- 部署到生产环境

## 故障排查

如果部署失败：

1. 查看 Netlify 构建日志
2. 确保 Node 版本兼容（已配置为 Node 18）
3. 检查依赖是否完整
4. 本地测试 `npm run build` 是否成功

## 有用的命令

```bash
# 查看站点状态
netlify status

# 查看部署日志
netlify deploy --build

# 在浏览器中打开站点
netlify open

# 查看实时日志
netlify watch
```

## 注意事项

- 第一次部署可能需要 3-5 分钟
- 免费版 Netlify 有每月 100GB 流量限制
- 构建时间每月 300 分钟（免费版）
- 支持自动 HTTPS 证书
