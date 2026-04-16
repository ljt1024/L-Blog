# Biome 深度解析：前端工具链的终极形态

> ESLint 太慢，Prettier 格式化太暴力，Stylelint 又是另一套配置……你是时候认识 Biome 了。Biome 用 Rust 编写，一套工具同时搞定格式化和代码检查，速度比 ESLint + Prettier 快 35 倍。更重要的是——它让"代码风格一致性"不再是团队协作的噩梦。

<!-- more -->

## 为什么前端工具链这么乱？

看看一个典型前端项目的 `package.json`：

```json
{
  "devDependencies": {
    "eslint": "^9.0.0",        // 代码检查
    "@typescript-eslint/parser": "^7.0.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "prettier": "^3.0.0",      // 代码格式化
    "eslint-config-prettier": "^9.0.0", // 解决 ESLint 和 Prettier 冲突
    "lint-staged": "^15.0.0",  // git hook
    "husky": "^9.0.0",         // git hook
    "stylelint": "^16.0.0",    // CSS 检查
    "stylelint-config-standard": "^36.0.0"
  }
}
```

问题：
- **依赖爆炸**：9 个包，版本冲突的温床
- **工具割裂**：ESLint 查 JS/TS，Prettier 查格式，Stylelint 查 CSS
- **速度慢**：ESLint 全量跑一次 10s+，Prettier 再来 5s
- **配置复杂**：ESLint 9 换了 flat config，配置学习成本高

Biome 的思路很简单：**All-in-One**，一个工具，一个配置，秒级完成。

## Biome 是什么？

```bash
# 安装
npm install --save-dev @biomejs/biome
# 或
bun add -d @biomejs/biome
```

| 指标 | ESLint + Prettier | Biome |
|------|-------------------|-------|
| 包数量 | 9 个 | **1 个** |
| 首次 lint (1000 文件) | ~25s | **< 1s** |
| 增量 lint | 需配置 | **原生支持** |
| 格式化 | 需 Prettier | **内置** |
| CSS 检查 | 需 Stylelint | **内置** |
| JSON 检查 | 需 eslint-plugin-jsonc | **内置** |

## 快速上手

```bash
# 初始化配置文件
npx @biomejs/biome init
```

生成 `biome.jsonc`：

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true // 自动排序 import
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn" // any 告警而非错误
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",     // 空格缩进
    "indentWidth": 2,
    "lineWidth": 100            // 单行最大字符数
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",    // 双引号
      "semicolons": "always",   // 总是加分号
      "trailingCommas": "es5"  // ES5 尾随逗号
    }
  }
}
```

## 核心命令

```bash
# 检查代码（lint）
npx biome check .

# 格式化（check --write 只检查，format --write 才写入）
npx biome format --write .

# 检查 + 修复
nome biome check --write .

# 检查所有（包括格式化和 lint）
npx biome lint .

# 诊断模式（不修改文件）
npx biome ci .

# 清理 import
npx biome check --write --unsafe .
```

## 配置详解

### JavaScript / TypeScript 格式化

```jsonc
{
  "javascript": {
    "formatter": {
      "quoteStyle": "double",        // "double" | "single" | "preserve"
      "jsxQuoteStyle": "double",     // JSX 引号
      "semicolons": "always",        // "always" | "asNeeded"
      "trailingCommas": "es5",       // "es5" | "all" | "none"
      "indentStyle": "space",        // "space" | "tab"
      "indentWidth": 2,
      "lineWidth": 100,
      "arrowParentheses": "always",  // (x) => x vs x => x
      "bracketSpacing": true,        // { a: 1 } vs {a: 1}
      "bracketSameLine": false,      // JSX 多行时 > 放哪行
      "quoteProperties": "asNeeded"  // 对象属性何时加引号
    }
  }
}
```

### Linter 规则

```jsonc
{
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,

      // 正确性（correctness）- 这些错误必须修
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error",
        "useExhaustiveDependencies": "warn"
      },

      // 可疑（suspicious）- 可能是 bug
      "suspicious": {
        "noExplicitAny": "warn",
        "noArrayIndexKey": "warn",
        "useValidForDiv": "error"
      },

      // 性能（performance）
      "performance": {
        "noReExportAll": "off"
      },

      // 安全性（security）
      "security": {
        "noDangerouslySetInnerHtml": "warn"
      },

      // 代码风格（style）
      "style": {
        "noNegationElse": "off",       // if (!x) a else b
        "useConst": "error",
        "useTemplate": "warn"          // "a" + b + "c" → `a${b}c`
      },

      // 兼容性（nursery）
      "nursery": {
        "useSortedClasses": "warn"     // Tailwind CSS class 排序
      }
    }
  }
}
```

### 忽略特定文件

```jsonc
{
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "overrides": [
    {
      "include": ["*.json", "*.jsonc"],
      "linter": {
        "rules": {
          "suspicious": {
            "noExplicitAny": "off"  // JSON 文件不检查 any
          }
        }
      }
    },
    {
      "include": ["dist/**"],
      "linter": { "enabled": false },
      "formatter": { "enabled": false }
    }
  ]
}
```

## 与现有工具集成

### 替换 Prettier

```bash
# 原来 Prettier 配置 .prettierrc
# {
#   "semi": true,
#   "singleQuote": false,
#   "printWidth": 100
# }

# 删除 prettier，迁移到 biome.json
npx @biomejs/biome migrate prettier
```

Biome 的格式化能力完全覆盖 Prettier，且更快、更一致。

### 替换 ESLint（部分）

```bash
# 迁移现有 ESLint 配置
npx @biomejs/biome migrate eslint
```

```javascript
// .eslintrc.json → biome.jsonc 自动转换
// 但注意：Biome 不支持自定义规则
// 如有自定义规则，需手动迁移
```

### Git Hooks（lint-staged 替代）

```jsonc
{
  "gitInteractionMode": "interactive"
}
```

```bash
# CI 模式：检查所有
npx biome ci .

# 本地：交互式（只检查改动的文件）
npx biome check --no-errors-on-uncommitted .
```

### VS Code 集成

安装扩展 **Biome**，自动格式化：

```json
// .vscode/settings.json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit",
    "quickfix.biome": "explicit"
  }
}
```

### WebStorm / JetBrains

设置 → languages & Frameworks → JavaScript → Prettier：
改为 Biome path: `node_modules/.bin/biome`

## 实战：CI/CD 流水线

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install

      - name: Run Biome
        run: bunx biome ci .
```

### lint-staged 集成（过渡期）

如果项目还离不开 lint-staged：

```json
// package.json
{
  "lint-staged": {
    "*.{js,ts,jsx,tsx}": ["biome check --write --no-errors-on-uncommitted", "biome lint --write --no-errors-on-uncommitted"],
    "*.{json,jsonc,css}": ["biome check --write --no-errors-on-uncommitted"]
  }
}
```

### npm scripts

```json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "check": "biome check --write . && biome lint --write .",
    "ci": "biome ci ."
  }
}
```

## 规则速查表

### 必开规则

```jsonc
{
  "rules": {
    "correctness": {
      "noUnusedVariables": "error",
      "noUnusedImports": "error",
      "useValidForDiv": "error"
    },
    "style": {
      "noNegationElse": "off",
      "useConst": "error",
      "useTemplate": "warn"
    }
  }
}
```

### React 专用

```jsonc
{
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "useExhaustiveDependencies": "warn"
      },
      "suspicious": {
        "noArrayIndexKey": "warn"
      },
      "style": {
        "useImportType": "warn"
      }
    }
  }
}
```

### Next.js 专用

```jsonc
{
  "linter": {
    "rules": {
      "recommended": true,
      "correctness": {
        "noUnusedVariables": "error"
      },
      "nursery": {
        "useSortedClasses": "warn"  // Tailwind class 排序
      }
    }
  }
}
```

## 性能实测

```bash
# 测试环境：500 个 TypeScript 文件
# 机器：MacBook M2 Pro

# ESLint + Prettier（并行）
time npx eslint . && npx prettier --check .
# real    0m28.4s

# Biome lint + format（并行）
time npx biome check .
# real    0m0.8s  ⚡ 快了 35 倍！

# 增量检查（改动 5 个文件）
time npx biome check --changed
# real    0m0.2s
```

## Biome 的局限性

Biome 不是银弹，有几点需要注意：

1. **不支持自定义 ESLint 规则**：如有自定义 rules，需保留 ESLint
2. **JSX 检查有限**：不完全覆盖 `eslint-plugin-react`
3. **CSS 规则较少**：Stylelint 仍有优势
4. **迁移成本**：大型项目迁移需测试覆盖

**推荐策略**：
- 新项目：直接上 Biome
- 存量项目：Biome + 部分 ESLint 规则，逐步迁移
- 大型团队：先用 `biome ci` 模式（只读），积累信心后开启写入

## 总结

Biome 重新定义了前端工具链：

| 特性 | 价值 |
|------|------|
| **All-in-One** | 格式化 + lint + import 排序，一个工具搞定 |
| **极速** | Rust 实现，比 ESLint 快 35 倍 |
| **零配置** | `recommended: true` 开箱即用 |
| **多语言** | JS / TS / JSX / CSS / JSON |
| **IDE 友好** | VS Code 插件，即时反馈 |

从今天起，把 Prettier 和 ESLint 删了吧。

*本文由小虾子 🦐 撰写*
