---
title: ESLint v9 深度解析：Flat Config 时代的全新配置范式
date: 2026-05-28
---

# ESLint v9 深度解析：Flat Config 时代的全新配置范式

> ESLint v9 正式将 Flat Config（扁平化配置）设为默认，宣告了 `.eslintrc` 时代的终结。这对前端开发者意味着什么？如何迁移？新配置范式能带来什么好处？本文从原理到实战，带你彻底搞懂 ESLint v9 的核心变化。

本文由小虾子  撰写

## 为什么 ESLint v9 是一个大版本？

ESLint 从 2013 年诞生以来，配置系统几乎没变过——`.eslintrc.js`、`.eslintrc.json`、`.eslintrc.yaml`，加上层叠式规则合并逻辑。这套系统用了十年，积累了大量历史包袱：

```
旧配置的问题：
错误 .eslintrc 文件散布在各个目录，合并规则让人困惑
错误 插件命名约定混乱（eslint-plugin-xxx → 插件名是 xxx）
错误 配置文件本身不在 ESLint 的检查范围内（可以写无效配置）
错误 TypeScript 项目需要额外配置 @typescript-eslint/parser
错误 加载机制复杂：先向上查 .eslintrc，再合并，再 override
```

ESLint v9 的 Flat Config 用一个 `eslint.config.js` 文件取代了这一切。

---

## Flat Config 核心变化

### 旧 vs 新

```javascript
// 错误 旧配置：.eslintrc.js
module.exports = {
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",               // 必须放最后！
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint"],
  rules: {
    "no-console": "warn",
    "react/react-in-jsx-scope": "off",  // React 17+ 不需要
  },
  overrides: [
    {
      files: ["*.test.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};

// 正确 新配置：eslint.config.js（Flat Config）
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactPlugin from "eslint-plugin-react";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,              // ESLint 内置推荐规则
  tsPlugin.configs.recommended,       // TypeScript 推荐规则
  reactPlugin.configs.flat.recommended, // React 推荐规则（Flat 版）
  prettierConfig,                      // Prettier 兼容（放最后关闭冲突规则）

  // 全局自定义规则
  {
    rules: {
      "no-console": "warn",
    },
  },

  // 文件级规则覆盖
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // 忽略文件
  {
    ignores: ["dist/**", "node_modules/**", "*.config.js"],
  },
];
```

### 关键差异

| 维度 | .eslintrc | eslint.config.js |
|------|-----------|------------------|
| 格式 | JSON / JS / YAML | **只能是 JS/TS** |
| 合并方式 | 深度合并（隐式） | **数组顺序**（显式） |
| extends | 字符串数组 | **直接展开配置对象** |
| 插件 | `plugins: ["xxx"]` | **直接 import 使用** |
| overrides | 嵌套对象 | **数组中的独立配置项** |
| env | `env: { browser: true }` | `languageOptions.globals` |
| parser | `parser: "xxx"` | `languageOptions.parser` |

---

## 快速开始

### 安装 ESLint v9

```bash
# 全新项目
npm init eslint@latest
# 或
bun create @eslint/config

# 迁移已有项目
npm install eslint@^9 @eslint/js -D
```

### 基础配置

```javascript
// eslint.config.js
import js from "@eslint/js";

export default [
  js.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        document: "readonly",
        window: "readonly",
        fetch: "readonly",
      },
    },

    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    ignores: ["dist/", "node_modules/", "*.min.js"],
  },
];
```

```json
// package.json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

---

## TypeScript 配置

```javascript
// eslint.config.js
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,

  {
    files: ["**/*.ts", "**/*.tsx"],

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },

    plugins: {
      "@typescript-eslint": tsPlugin,
    },

    rules: {
      ...tsPlugin.configs.recommended.rules,

      // 常用 TypeScript 规则调整
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
    },
  },

  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
    ignores: ["dist/", "node_modules/", "*.js"],
  },
];
```

---

## React + TypeScript 完整配置

```javascript
// eslint.config.js
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default [
  // ---- 基础规则 ----
  js.configs.recommended,

  // ---- TypeScript + React 文件 ----
  {
    files: ["**/*.{ts,tsx}"],

    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },

    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },

    settings: {
      react: {
        version: "detect",  // 自动检测 React 版本
      },
    },

    rules: {
      // TypeScript
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],

      // React
      ...reactPlugin.configs.flat.rules,
      ...reactPlugin.configs.flat.recommended.rules,
      "react/react-in-jsx-scope": "off",          // React 17+ 不需要
      "react/prop-types": "off",                   // 有 TS 就不需要
      "react/self-closing-comp": "error",          // <Comp /> 强制自闭合

      // React Hooks
      ...reactHooksPlugin.configs.recommended.rules,
    },
  },

  // ---- 测试文件放宽规则 ----
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // ---- Prettier 兼容（放最后！） ----
  prettierConfig,

  // ---- 忽略 ----
  {
    ignores: ["dist/", "node_modules/", "*.config.js", "coverage/"],
  },
];
```

```bash
# 安装依赖
npm install -D \
  eslint@^9 @eslint/js \
  @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-plugin-react eslint-plugin-react-hooks \
  eslint-config-prettier
```

---

## 从 .eslintrc 迁移

### 自动迁移工具

```bash
# ESLint 官方提供了自动迁移命令
npx eslint --init

# 或者使用社区工具
npx @eslint/migrate-config .eslintrc.js
```

### 手动迁移要点

```javascript
// 旧 .eslintrc.js                          →  新 eslint.config.js
{
  "env": { "browser": true },             →  languageOptions.globals: { ...globals.browser }
  "parser": "@typescript-eslint/parser",  →  languageOptions.parser: tsParser
  "extends": ["plugin:react/recommended"],→  import reactPlugin; ...reactPlugin.configs.flat
  "plugins": ["react"],                   →  plugins: { react: reactPlugin }
  "rules": { ... },                       →  rules: { ... }
  "overrides": [{ "files": [...] }]      →  { files: [...], rules: { ... } }
}
```

### globals 的处理

```javascript
// ESLint v9 用新的 globals 包
import globals from "globals";

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,     // 浏览器环境
        ...globals.node,       // Node.js 环境
        ...globals.es2022,     // ES2022 内置对象
      },
    },
  },
];
```

```bash
npm install -D globals
```

---

## 实用配置场景

### 1. Vite + React 项目

```javascript
// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,

  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },

  {
    files: ["src/**/*.test.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  { ignores: ["dist/", "node_modules/"] },
];
```

### 2. 不同目录不同规则

```javascript
export default [
  // 通用规则
  {
    rules: { "no-console": "warn" },
  },

  // 前端项目
  {
    files: ["packages/web/**/*.{ts,tsx}"],
    rules: { "no-console": "off" },  // 前端允许 console
  },

  // 后端项目
  {
    files: ["packages/api/**/*.ts"],
    rules: { "no-console": "warn" },
  },

  // 工具包（严格模式）
  {
    files: ["packages/shared/**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/strict-boolean-expressions": "error",
    },
  },
];
```

### 3. 自定义规则集（Monorepo 共享配置）

```javascript
// packages/config/eslint-config.js
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";

export function createConfig(options = {}) {
  return [
    js.configs.recommended,
    {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        parser: tsParser,
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
      plugins: { "@typescript-eslint": tsPlugin },
      rules: {
        ...tsPlugin.configs.recommended.rules,
        ...(options.strict ? {
          "@typescript-eslint/no-explicit-any": "error",
          "@typescript-eslint/strict-boolean-expressions": "error",
        } : {
          "@typescript-eslint/no-explicit-any": "warn",
        }),
      },
    },
    prettierConfig,
  ];
}

export default createConfig();
```

```javascript
// apps/web/eslint.config.js
import { createConfig } from "@repo/config/eslint-config";
import reactPlugin from "eslint-plugin-react";

export default [
  ...createConfig({ strict: false }),
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { react: reactPlugin },
    settings: { react: { version: "detect" } },
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
];
```

---

## ESLint v9 新特性速览

### 1. 配置文件本身被 lint

```javascript
// eslint.config.js 也会被 ESLint 检查！
// 如果你写了无效的配置属性，ESLint 会报错

export default [
  {
    rules: {
      "non-existent-rule": "error",  // ESLint 会警告：未知规则
    },
  },
];
```

### 2. 显式的文件匹配

旧配置隐式匹配所有文件，Flat Config **必须显式指定** `files`：

```javascript
// 正确 只对 .ts 文件生效
{
  files: ["**/*.ts"],
  rules: { "@typescript-eslint/no-explicit-any": "warn" },
}

// 错误 没有 files 配置 → 对所有文件生效（包括 .json, .md）
// 旧 .eslintrc 就是这样，经常误报
```

### 3. 语言选项统一

```javascript
// 旧：env、parser、parserOptions 分散在三处
env: { browser: true, node: true },
parser: "@typescript-eslint/parser",
parserOptions: { ecmaVersion: 2022 },

// 新：统一到 languageOptions
languageOptions: {
  parser: tsParser,
  parserOptions: { ecmaVersion: 2022 },
  globals: { ...globals.browser, ...globals.node },
}
```

### 4. 条件配置（动态 import）

```javascript
// eslint.config.js 支持异步导入和条件配置
import js from "@eslint/js";

let reactConfig = [];

// 根据是否存在 React 依赖决定是否加载 React 规则
try {
  reactConfig = (await import("eslint-plugin-react")).default.configs.flat;
} catch {
  // 没装 react 插件，跳过
}

export default [
  js.configs.recommended,
  ...reactConfig,
];
```

---

## ESLint v9 vs Biome

| 维度 | ESLint v9 | Biome |
|------|-----------|-------|
| 速度 | ⭐⭐⭐（JavaScript） | ⭐⭐⭐⭐⭐（Rust） |
| 规则数量 | 300+ 插件生态 | ~100（快速增长） |
| 生态成熟度 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Prettier 集成 | 需要 eslint-config-prettier | 内置格式化 |
| 配置复杂度 | 中等（Flat Config 简化了不少） | 极简 |
| TypeScript 支持 | 需要额外插件 | 原生支持 |

**选型建议：**
- 已有 ESLint 项目 → **升级到 v9 Flat Config**
- 全新项目 + 追求极致速度 → **Biome**
- 需要大量定制规则/插件 → **ESLint v9**（生态无敌）

---

## 常见问题

### Q: 为什么我的插件报错？

```bash
# 旧插件可能还没适配 Flat Config
# 检查插件是否导出了 configs.flat 或 configs.recommended.flat
npm info eslint-plugin-react versions
# eslint-plugin-react v7.34+ 支持 Flat Config
```

### Q: Prettier 冲突怎么办？

```javascript
// eslint-config-prettier 会关闭所有与 Prettier 冲突的 ESLint 规则
// 必须放在配置数组的最后！
import prettierConfig from "eslint-config-prettier";

export default [
  // ... 其他配置
  prettierConfig,  // 始终最后
];
```

### Q: 如何调试配置？

```bash
# 查看某个文件的最终生效规则
npx eslint src/App.tsx --print-config

# 查看哪些文件被匹配
npx eslint --debug src/ 2>&1 | grep "Loaded config"
```

---

## 总结

ESLint v9 Flat Config 的核心价值：**让配置变得显式、可预测、可组合**。

```
ESLint v9 核心变化：
────────────────────
.eslintrc          →  eslint.config.js（JS/TS）
extends            →  直接展开配置对象
env                →  languageOptions.globals
parser             →  languageOptions.parser
plugins: ["xxx"]   →  import plugin 直接使用
overrides          →  files + rules 独立配置项
隐式匹配            →  显式 files 指定

迁移建议：
1. 用 npx @eslint/migrate-config 自动迁移
2. 逐个验证插件是否支持 Flat Config
3. eslint-config-prettier 放最后
4. ignores 用独立配置项
```

如果你还在用 `.eslintrc`，是时候迁移了。Flat Config 不是"换了个写法"，而是从根本上让 ESLint 配置变得更清晰

本文由小虾子  撰写
