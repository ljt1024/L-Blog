# l-blog

一个基于 VitePress 搭建的中文技术博客与学习知识库，主要用于沉淀前端开发、后端基础、AI 应用与工程交付过程中的学习记录和实践文章。

## 项目简介

这个项目围绕“长期积累、持续整理、可反复查阅”来组织内容，当前主要包含两类内容：

- `学习记录`：按前端、后端、工具与部署等主题系统化整理知识点
- `技术文章`：围绕具体问题、实践经验和工程话题输出可直接参考的文章

站点首页、导航、侧边栏和部分文档交互已经做了自定义扩展，比如：

- 本地搜索
- 文档返回目录按钮
- 返回顶部组件
- 自定义主题样式

## 技术栈

- `VitePress 1.6.4`
- `Vue 3`
- `oh-my-live2d`（已安装依赖，当前仓库中暂未发现实际接入代码）

## 本地运行

建议使用 `Node.js 18+`。

安装依赖：

```bash
npm install
```

启动本地开发环境：

```bash
npm run docs:dev
```

构建静态站点：

```bash
npm run docs:build
```

本地预览构建结果：

```bash
npm run docs:preview
```

## 目录结构

```text
.
├── docs/                        # 站点文档内容
│   ├── index.md                 # 首页
│   ├── articles.md              # 技术文章导航页
│   ├── articles/                # 技术文章
│   ├── study/                   # 学习记录
│   └── .vitepress/              # VitePress 配置与主题扩展
│       ├── config.mts           # 站点配置
│       └── theme/               # 自定义主题、布局、组件、样式
├── package.json                 # 项目脚本与依赖
├── package-lock.json            # npm 锁文件
├── vue-advanced-outline.md      # 写作大纲草稿
├── react-advanced-outline.md    # 写作大纲草稿
└── express-advanced-outline.md  # 写作大纲草稿
```

## 内容维护说明

新增或修改内容时，通常会用到下面这些位置：

- 首页内容：`docs/index.md`
- 学习记录导航：`docs/study/index.md`
- 文章导航：`docs/articles.md`
- 学习记录正文：`docs/study/**`
- 技术文章正文：`docs/articles/**`
- 站点导航与侧边栏：`docs/.vitepress/config.mts`
- 自定义布局与组件：`docs/.vitepress/theme/**`

## 当前内容方向

- 前端基础与进阶：HTML、CSS、JavaScript、Vue、React、TypeScript
- 后端与服务：Node.js、Express、Go、Gin、Nginx
- 数据库与中间件：MySQL、MongoDB、Redis
- 工具与部署：Git、Docker、PM2
- AI 相关实践：AI 智能体、前端结合 LLM、RAG 等主题

## 备注

- `docs/.vitepress/dist/` 为构建产物目录，如需重新生成可执行 `npm run docs:build`
- 仓库中存在部分大纲草稿文件，可作为后续文章扩展的写作基础

