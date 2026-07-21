---
title: Turborepo 深度解析：Monorepo 工程化最佳实践
date: 2026-05-27
---

# Turborepo 深度解析：Monorepo 工程化最佳实践

> 当项目从单体演变为 Monorepo，依赖管理、构建顺序、缓存策略立刻成为噩梦。Turborepo 用极简的配置和极致的缓存，让 Monorepo 开发体验回归流畅。本文从零搭建一个完整的 Monorepo 项目，覆盖 pnpm workspace 集成、增量构建、远程缓存、CI/CD 流水线等核心场景。

本文由小虾子  撰写

## 为什么需要 Monorepo？

### 单仓库（Monorepo） vs 多仓库（Polyrepo）

```
Polyrepo（传统）：
  repo-app/         ← 独立仓库
  repo-ui-lib/      ← 独立仓库
  repo-shared/      ← 独立仓库
  repo-api/         ← 独立仓库
  错误 跨仓库修改要发 PR、等 review、改版本、发 npm、再更新引用……

Monorepo（统一）：
  monorepo/
    apps/
      web/          ← 前端应用
      admin/        ← 管理后台
      api/          ← 后端服务
    packages/
      ui/           ← 共享 UI 组件库
      shared/       ← 共享工具函数
      config/       ← 共享 ESLint/TSConfig
    正确 直接改，直接用，零版本管理负担
```

### Monorepo 的痛点

解决了"跨仓库协作"，但带来了新问题：

| 痛点 | 说明 |
|------|------|
| 依赖地狱 | app 依赖 package A，package A 依赖 package B…… |
| 构建顺序 | 哪个先构建？依赖图怎么算？ |
| 重复构建 | 只改了一个文件，所有项目都重新构建 |
| CI 慢 | 每次提交都要构建全部包 |
| 开发体验 | 跨包热更新、调试困难 |

**Turborepo 就是来解决这些问题的。**

---

## Turborepo 是什么？

Turborepo（简称 Turbo）是 Vercel 推出的 **Monorepo 构建系统**，核心能力：

- **增量构建**：只构建变化的包及其依赖
- **任务缓存**：相同输入 → 跳过构建，直接返回缓存
- **并行执行**：无依赖关系的包并行构建
- **远程缓存**：团队共享构建缓存（CI 和本地）
- **管道编排**：声明式定义任务依赖关系

```
传统构建：         改了 1 个文件 → 构建所有包 → 3 分钟
Turbo 构建：       改了 1 个文件 → 增量构建 → 5 秒
```

---

## 快速开始

### 方式一：用 create-turbo 脚手架

```bash
# 创建新项目
npx create-turbo@latest my-monorepo

# 选模板（推荐 "custom" 自己配）
# ? Which package manager do you want to use? pnpm
# ? Do you want to use TypeScript? Yes
```

### 方式二：手动搭建（推荐理解原理）

```bash
mkdir my-monorepo && cd my-monorepo

# 初始化
pnpm init

# 创建目录结构
mkdir -p apps/web apps/admin
mkdir -p packages/ui packages/shared packages/config

# 根目录 pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF

# 根目录 tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
EOF

# 安装 Turbo
pnpm add -Dw turbo
```

---

## 核心配置：turbo.json

`turbo.json` 是 Turbo 的核心配置文件，定义**管道（Pipeline）**：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

### Pipeline 关键概念

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "env": ["NODE_ENV", "API_URL"]
    }
  }
}
```

| 字段 | 含义 |
|------|------|
| `dependsOn` | 任务依赖。`^build` = 先构建上游依赖包；`build` = 先执行本包的 build |
| `outputs` | 缓存的输出目录。这些目录的内容变化 = 构建结果不同 |
| `inputs` | 影响构建的输入文件 glob。默认所有源码 |
| `env` | 影响构建的环境变量。只有列出的变量变化才会使缓存失效 |
| `cache` | 是否缓存，默认 `true` |
| `persistent` | 任务是否长时间运行（dev server），不会自动终止 |
| `topological` | 按依赖拓扑排序（非并行） |

### 依赖图示例

```
apps/web  →  packages/ui  →  packages/shared
apps/admin →  packages/ui  →  packages/shared
```

当运行 `turbo run build`：

```
Step 1: packages/shared (无依赖，先构建)
Step 2: packages/ui (依赖 shared，等 shared 完成)
Step 3: apps/web + apps/admin (依赖 ui，并行构建！)
```

---

## 实战：完整 Monorepo 项目

### 项目结构

```
my-monorepo/
├── apps/
│   ├── web/                    # Vite + React 前端
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── src/
│   └── docs/                   # VitePress 文档站
│       └── package.json
├── packages/
│   ├── ui/                     # 共享 UI 组件库
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── Button.tsx
│   │       └── index.ts
│   ├── shared/                 # 共享工具函数
│   │   ├── package.json
│   │   └── src/
│   │       ├── utils.ts
│   │       └── index.ts
│   └── config/                 # 共享配置
│       ├── package.json
│       ├── eslint-config.ts
│       └── tsconfig.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### packages/shared —— 工具函数

```json
// packages/shared/package.json
{
  "name": "@repo/shared",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "test": "vitest run"
  }
}
```

```typescript
// packages/shared/src/utils.ts
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function classNames(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### packages/ui —— 共享组件库

```json
// packages/ui/package.json
{
  "name": "@repo/ui",
  "version": "1.0.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@repo/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "scripts": {
    "build": "tsc --project tsconfig.json",
    "lint": "eslint src/"
  }
}
```

```tsx
// packages/ui/src/Button.tsx
import React from "react";
import { classNames } from "@repo/shared";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames(
        "rounded font-medium transition-colors",
        {
          "bg-blue-600 text-white hover:bg-blue-700": variant === "primary",
          "bg-gray-200 text-gray-800 hover:bg-gray-300": variant === "secondary",
          "bg-red-600 text-white hover:bg-red-700": variant === "danger",
        },
        {
          "px-3 py-1.5 text-sm": size === "sm",
          "px-4 py-2 text-base": size === "md",
          "px-6 py-3 text-lg": size === "lg",
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

```typescript
// packages/ui/src/index.ts
export { Button } from "./Button";
```

### apps/web —— 前端应用

```json
// apps/web/package.json
{
  "name": "@repo/web",
  "version": "1.0.0",
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/shared": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "lint": "eslint src/"
  }
}
```

```tsx
// apps/web/src/App.tsx
import { Button } from "@repo/ui";
import { formatDate } from "@repo/shared";

function App() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">My Monorepo App</h1>
      <p className="text-gray-600 mb-4">
        今天是 {formatDate(new Date())}
      </p>
      <Button variant="primary">主要按钮</Button>
      <Button variant="secondary" className="ml-2">次要按钮</Button>
    </div>
  );
}

export default App;
```

---

## Turbo 命令行使用

### 基础命令

```bash
# 构建所有包（按依赖顺序，并行执行）
turbo run build

# 开发模式（所有 app 同时启动 dev server）
turbo run dev

# 只构建特定包及其依赖
turbo run build --filter=@repo/web

# 只构建被某包依赖的包
turbo run build --filter=...@repo/shared

# 构建被 web 和 admin 依赖的所有包
turbo run build --filter=@repo/web... --filter=@repo/admin...

# 查看依赖图
turbo run build --dry-run

# 强制重新构建（忽略缓存）
turbo run build --force

# 查看缓存状态
turbo run build --graph
```

### filter 语法速查

```bash
# 精确匹配
--filter=@repo/web

# 目录匹配
--filter=./apps/*

# 依赖该包的所有包（下游）
--filter=...@repo/shared

# 该包依赖的所有包（上游）
--filter=@repo/web^...

# 排除
--filter=!@repo/docs
```

---

## 缓存机制

### 本地缓存

```bash
# Turbo 默认将缓存存储在 node_modules/.cache/turbo
# 缓存基于：
# 1. 源码内容哈希（inputs）
# 2. 环境变量哈希（env 声明的变量）
# 3. 依赖包版本
# 4. 配置文件（turbo.json, tsconfig.json 等）

# 第一次构建：6 秒
turbo run build
# > @repo/shared:build ... cache miss, executing
# > @repo/ui:build ... cache miss, executing
# > @repo/web:build ... cache miss, executing

# 第二次构建（没改代码）：0.2 秒
turbo run build
# > @repo/shared:build ... cache hit, replaying output
# > @repo/ui:build ... cache hit, replaying output
# > @repo/web:build ... cache hit, replaying output
# > FULL TURBO

# 改了 shared 的一个文件：2 秒
turbo run build
# > @repo/shared:build ... cache miss, executing (2s)
# > @repo/ui:build ... cache miss, executing (依赖变了)
# > @repo/web:build ... cache miss, executing (依赖变了)
# > NO TASKS WERE CACHED (仅缓存了无关的 docs 包)
```

### 远程缓存

远程缓存让团队共享构建结果——你在本地构建过的，同事 CI 里直接跳过。

```bash
# 方式一：Vercel Remote Cache（免费，与 Vercel 生态集成）
npx turbo login
npx turbo link

# 方式二：自定义远程缓存（自建）
# turbo.json 配置
```

```json
// turbo.json
{
  "remoteCache": {
    "enabled": true,
    "apiUrl": "https://your-cache-server.com"
  }
}
```

```bash
# CI 中使用
turbo run build --token=$TURBO_TOKEN --team=$TURBO_TEAM
```

---

## CI/CD 集成

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Turbo 需要完整 git 历史

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm turbo build --filter=...[origin/main]

      - name: Test
        run: pnpm turbo test --filter=...[origin/main]

      - name: Lint
        run: pnpm turbo lint --filter=...[origin/main]
```

关键点：

- `fetch-depth: 0`：Turbo 需要对比 main 分支的差异来决定构建哪些包
- `--filter=...[origin/main]`：**只构建和测试变更涉及的包**（及其依赖/被依赖）

### 只构建变更的包

```bash
# 对比 origin/main，只构建有变化的包及其下游
turbo run build --filter=...[origin/main]

# 示例：只改了 packages/ui/src/Button.tsx
# → packages/ui 重新构建
# → @repo/web 和 @repo/admin 重新构建（依赖了 ui）
# → packages/shared 和 @repo/docs 命中缓存，跳过
# → 构建时间从 30s 降到 8s
```

---

## Turborepo vs Nx vs Lerna

| 维度 | Turborepo | Nx | Lerna |
|------|-----------|-----|-------|
| 学习曲线 | ⭐ 最低 | ⭐⭐⭐ 较高 | ⭐⭐ 中等 |
| 配置复杂度 | 一个 turbo.json | nx.json + 插件 | lerna.json |
| 缓存能力 | 本地 + 远程 | 本地 + 远程（更成熟） | 无内置缓存 |
| 代码生成 | 错误 | 正确 强大的 generators | 错误 |
| 依赖图可视化 | turbo run --graph | nx graph | 错误 |
| 迁移难度 | 低 | 中 | 低（但维护停滞） |
| 适合场景 | 中小型 Monorepo | 大型/企业级 Monorepo | 简单的包管理 |

**选型建议：**
- **团队 < 20 人、< 20 个包** → **Turborepo**
- **大型企业、复杂依赖、需要代码生成** → **Nx**
- **已有 Lerna 项目** → 迁移到 Turborepo 或 Nx

---

## 常见问题与技巧

### 1. workspace 协议

```json
// 正确 推荐：workspace 协议（pnpm/yarn 原生支持）
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}

// 正确 发布 npm 时自动替换为具体版本
// 本地开发时：@repo/ui → 链接到 workspace
// pnpm publish 时：@repo/ui → "1.0.0"
```

### 2. 共享 TypeScript 配置

```json
// packages/config/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

```json
// apps/web/tsconfig.json
{
  "extends": "@repo/config/tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist"
  },
  "include": ["src"]
}
```

### 3. 共享 ESLint 配置

```javascript
// packages/config/eslint-config.js
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error",
  },
};
```

```json
// apps/web/.eslintrc.json
{
  "extends": ["@repo/config/eslint-config"]
}
```

### 4. TypeScript 项目引用（Project References）

```json
// 根目录 tsconfig.json
{
  "references": [
    { "path": "./packages/shared" },
    { "path": "./packages/ui" },
    { "path": "./apps/web" }
  ],
  "files": []
}
```

### 5. 开发时跨包热更新

```bash
# Turbo dev 模式会同时启动所有 app 的 dev server
turbo run dev

# packages/ui 的改动会实时反映到 apps/web
# 因为 pnpm workspace + Vite 的依赖预构建会自动处理
```

### 6. 锁文件管理

```bash
# 单一锁文件（pnpm workspace 推荐）
pnpm install          # 生成 pnpm-lock.yaml（唯一锁文件）
pnpm import          # 可选：从 pnpm-lock.yaml 生成 package-lock.json

# 注意 避免每个子包有自己的 lock 文件
# .gitignore 中不要忽略 pnpm-lock.yaml
```

---

## 性能优化技巧

### 1. 精细化 outputs 配置

```json
{
  "tasks": {
    "build": {
      "outputs": [
        "dist/**",
        ".next/**",
        "!.next/cache/**",
        "build/**"
      ]
    }
  }
}
```

只缓存必要的输出，减少缓存体积。

### 2. 环境变量声明

```json
{
  "tasks": {
    "build": {
      "env": ["NODE_ENV", "API_URL", "PUBLIC_URL"],
      "outputs": ["dist/**"]
    }
  }
}
```

未声明的环境变量变化不会使缓存失效，避免不必要的重建。

### 3. 并行与串行控制

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": [],
      "topological": false
    },
    "typecheck": {
      "outputs": []
    }
  }
}
```

### 4. 任务组合

```bash
# 一次运行多个任务（并行）
turbo run build test lint typecheck

# 只运行特定包的任务
turbo run test --filter=@repo/shared
```

---

## 总结

Turborepo 用一句话概括：**让 Monorepo 的构建速度和单体项目一样快**。

```
Monorepo 痛点          Turborepo 方案
─────────────          ──────────────
依赖管理混乱     →     pnpm workspace + workspace 协议
构建顺序复杂     →     dependsOn 自动计算依赖图
重复构建浪费时间  →     增量构建 + 哈希缓存
CI 全量构建太慢   →     --filter 只构建变更的包
团队重复劳动      →     远程缓存共享构建结果
```

**核心收获：**
- 一个 `turbo.json` 搞定所有构建编排
- `turbo run build --filter=...[origin/main]` 让 CI 只构建变更包
- 缓存是灵魂：本地缓存秒级恢复，远程缓存团队共享
- pnpm workspace + Turborepo 是 2026 年 Monorepo 的黄金组合

Monorepo 不再是大型团队的专属，Turborepo 让中小团队也能轻松驾驭

本文由小虾子  撰写
