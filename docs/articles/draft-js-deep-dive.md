---
title: Draft.js 深度解析：React 富文本编辑器的工程实践
date: 2026-07-01
---

# Draft.js 深度解析：React 富文本编辑器的工程实践

> 富文本编辑器是 Web 应用中最复杂的组件之一。从简单的文本输入到支持格式化、多媒体、协作编辑的复杂编辑器，每一步都需要精心的架构设计。Draft.js 是 Facebook 推出的 React 富文本编辑器框架，以 Immutable.js 为核心，提供了强大的可扩展性。本文深入解析 Draft.js 的架构设计、核心 API、实战技巧与常见陷阱。

本文由小虾子 🦐 撰写

## 为什么需要 Draft.js？

### 富文本编辑器的困境

```
传统方案的问题：
─────────────────────────────────
contenteditable（浏览器原生）：
  ❌ API 复杂（document.execCommand 已废弃）
  ❌ 浏览器行为不一致
  ❌ 状态管理困难（DOM 即状态）
  ❌ XSS 安全风险高

其他框架（Quill、Summernote）：
  ❌ 非 React 原生（操作 DOM）
  ❌ 定制化受限
  ❌ 状态与视图耦合

Draft.js 的设计理念：
─────────────────────────────────
"让编辑器像 React 组件一样工作"
  ✅ 状态即数据（EditorState = ContentState + SelectionState）
  ✅ Immutable.js 数据模型（不可变、方便撤销/重做）
  ✅ React 渲染（组件化的自定义渲染）
  ✅ 丰富的 API（快捷键、装饰器、拼写检查）
```

### Draft.js vs Slate.js

```
功能对比：
─────────────────────────────────
| 特性 | Draft.js | Slate.js |
|------|---------|---------|
| 数据模型 | Immutable.js | 普通 JS 对象 |
| React 版本 | React 16+ | React 18+ |
| 撤销/重做 | 内置（immutable） | 需插件 |
| 插件系统 | Decorator | 插件化 |
| 快捷键 | 内置 Key Commands | 需自己实现 |
| 移动端 | 支持 | 支持 |
| 维护状态 | Meta（Meta 维护） | 活跃 |
| 文档质量 | 完整但略旧 | 文档较新 |
| 生态 | 中等 | 活跃（最新）|
```

---

## 快速上手

### 安装

```bash
npm install draft-js react react-dom
```

### 基础示例

```tsx
import React, { useState } from "react";
import { Editor, EditorState } from "draft-js";

export default function SimpleEditor() {
  const [editorState, setEditorState] = useState(
    () => EditorState.createEmpty()
  );

  return (
    <div className="editor-wrapper">
      <Editor
        editorState={editorState}
        onChange={setEditorState}
        placeholder="输入内容..."
      />
    </div>
  );
}
```

### 添加样式

```css
/* index.css */
.editor-wrapper {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 16px;
  min-height: 200px;
}

.public-DraftEditorPlaceholder-root {
  color: #999;
}

.public-DraftStyleDefault-block {
  /* 控制段落间距 */
  margin-bottom: 8px;
}
```

---

## 核心概念：EditorState

### EditorState 的三层结构

```
EditorState = ContentState + SelectionState + Undo/Redo Stack
─────────────────────────────────
ContentState：编辑器内容
  → blocks：内容块列表（每个段落/行是一个 Block）
  → entityMap：实体映射（链接、图片、mention 等）

SelectionState：光标/选区状态
  → anchorKey / focusKey：选区起点/终点所在 Block
  → anchorOffset / focusOffset：选区在 Block 中的位置
  → isCollapsed：是否折叠（无选区）

Decorator：装饰器（自定义高亮/渲染）
  → 匹配正则表达式或自定义函数
  → 渲染自定义 React 组件
```

### 创建带初始内容的 EditorState

```tsx
import { Editor, EditorState, ContentState } from "draft-js";

function EditorWithContent() {
  const [editorState, setEditorState] = useState(() => {
    // 方式 1：从 HTML 创建
    const html = "<p>Hello <strong>World</strong>!</p>";
    const contentFromHTML = convertFromHTML(html);
    const contentState = ContentState.createFromBlockArray(
      contentFromHTML.contentBlocks,
      contentFromHTML.entityMap
    );

    // 方式 2：从纯文本创建
    const plainText = "Hello World";
    const contentState = ContentState.createFromText(plainText);

    return EditorState.createWithContent(contentState);
  });

  return <Editor editorState={editorState} onChange={setEditorState} />;
}
```

### 读取编辑器内容

```tsx
import {
  EditorState,
  ContentState,
  convertToRaw,
  convertFromRaw,
} from "draft-js";

function saveContent(editorState: EditorState) {
  // 方式 1：转为 Raw JS 对象（方便存储到数据库）
  const rawContent = convertToRaw(editorState.getCurrentContent());
  localStorage.setItem("draft-content", JSON.stringify(rawContent));

  // 方式 2：转为纯文本
  const plainText = editorState.getCurrentContent().getPlainText();
  console.log("纯文本：", plainText);

  // 方式 3：从 localStorage 恢复
  const savedRaw = JSON.parse(localStorage.getItem("draft-content")!);
  const restoredContent = convertFromRaw(savedRaw);
  const restoredEditorState = EditorState.createWithContent(restoredContent);
}
```

---

## 富文本样式：RichUtils

### 内联样式（Bold / Italic / Code）

```tsx
import {
  Editor,
  EditorState,
  RichUtils,
  Modifier,
} from "draft-js";

// 切换样式（Bold / Italic / Underline）
function toggleInlineStyle(editorState: EditorState, style: string) {
  return RichUtils.toggleInlineStyle(editorState, style);
}

// 切换代码块
function toggleCodeBlock(editorState: EditorState) {
  return RichUtils.toggleBlockType(
    editorState,
    "code-block"
  );
}

// 组件中使用
function RichEditor() {
  const [editorState, setEditorState] = useState(
    () => EditorState.createEmpty()
  );

  const handleKeyCommand = (command: string, editorState: EditorState) => {
    const newState = RichUtils.handleKeyCommand(editorState, command);
    if (newState) {
      setEditorState(newState);
      return "handled";
    }
    return "not-handled";
  };

  return (
    <div>
      {/* 工具栏 */}
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          setEditorState(toggleInlineStyle(editorState, "BOLD"));
        }}
      >
        Bold
      </button>
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          setEditorState(toggleCodeBlock(editorState));
        }}
      >
        Code Block
      </button>

      <Editor
        editorState={editorState}
        onChange={setEditorState}
        handleKeyCommand={handleKeyCommand}
      />
    </div>
  );
}
```

### 快捷键绑定

```tsx
// 完整快捷键实现
const styleTypes = [
  { label: "B", style: "BOLD" },
  { label: "I", style: "ITALIC" },
  { label: "U", style: "UNDERLINE" },
  { label: "<>", style: "CODE" },
];

function handleKeyCommand(
  command: string,
  editorState: EditorState
): "handled" | "not-handled" {
  if (command === "bold") {
    const newState = RichUtils.toggleInlineStyle(editorState, "BOLD");
    if (newState) {
      setEditorState(newState);
      return "handled";
    }
  }

  if (command === "italic") {
    const newState = RichUtils.toggleInlineStyle(editorState, "ITALIC");
    if (newState) {
      setEditorState(newState);
      return "handled";
    }
  }

  // 代码块：Ctrl/Cmd + `
  if (command === "codeblock") {
    const newState = RichUtils.toggleBlockType(editorState, "code-block");
    if (newState) {
      setEditorState(newState);
      return "handled";
    }
  }

  return "not-handled";
}

// Ctrl/Cmd + Z：撤销
// Ctrl/Cmd + Shift + Z：重做
// Tab：缩进（需自定义实现）
```

---

## Entity：链接、图片、提及

### 什么是 Entity？

```
Entity（实体）是 Draft.js 中存储元数据的机制：
─────────────────────────────────
内置类型：
  → LINK：链接
  → IMAGE：图片
  → DOC：文档

自定义类型：
  → MENTION：@提及用户
  → HASHTAG：#话题
  → IMAGE：带 Caption 的图片
  → VIDEO：视频
  → FORMULA：数学公式（LaTeX）

Entity 存储在 EntityMap 中，通过 key 引用
```

### 添加链接（Entity）

```tsx
import {
  Editor,
  EditorState,
  Entity,
  EntityInstance,
  RichUtils,
  Modifier,
  SelectionState,
} from "draft-js";
import { RichEditor } from "./RichEditor";

// 添加链接
function addLink(editorState: EditorState, url: string) {
  const contentState = editorState.getCurrentContent();
  const selection = editorState.getSelection();

  // 创建 Entity（存储链接数据）
  const entityKey = Entity.create("LINK", "MUTABLE", {
    url,
    target: "_blank",
  });

  // 在选区插入链接
  const newContentState = Modifier.applyEntity(
    contentState,
    selection,
    entityKey
  );

  const newEditorState = EditorState.push(
    editorState,
    newContentState,
    "apply-entity"
  );

  return EditorState.forceSelection(
    newEditorState,
    newContentState.getSelectionAfter()
  );
}

// 移除链接
function removeLink(editorState: EditorState) {
  const selection = editorState.getSelection();
  const contentState = editorState.getCurrentContent();

  // 获取当前选区的 Entity
  const startKey = selection.getStartKey();
  const startOffset = selection.getStartOffset();
  const entityKey = contentState.getBlockForKey(startKey).getEntityAt(startOffset);

  if (!entityKey) return editorState;

  const entity = Entity.get(entityKey);
  if (entity.getType() !== "LINK") return editorState;

  // 移除 Entity
  const newContentState = Modifier.applyEntity(
    contentState,
    selection,
    null  // null 表示移除
  );

  return EditorState.push(
    editorState,
    newContentState,
    "apply-entity"
  );
}

// 自定义链接渲染（通过 Decorator）
function Link(props: { entityKey: string; contentState: ContentState }) {
  const { url, target } = props.contentState.getEntity(props.entityKey).getData();
  return (
    <a href={url} target={target} style={{ color: "blue" }}>
      {props.children}
    </a>
  );
}
```

### 自定义实体（@提及用户）

```tsx
// 创建 Mention Entity
function addMention(editorState: EditorState, user: { id: string; name: string }) {
  const entityKey = Entity.create("MENTION", "SEGMENTED", {
    mention: user,
  });

  const selection = editorState.getSelection();
  const newContentState = Modifier.applyEntity(
    editorState.getCurrentContent(),
    selection,
    entityKey
  );

  return EditorState.push(editorState, newContentState, "apply-entity");
}

// Mention 组件
function MentionItem({ mention }: { mention: { id: string; name: string } }) {
  return (
    <span
      data-offset-key={props.offsetKey}
      data-mention-id={mention.id}
      className="mention"
    >
      @{mention.name}
    </span>
  );
}
```

---

## Decorator：自定义高亮渲染

### 什么是 Decorator？

```
Decorator 的作用：
─────────────────────────────────
把编辑器中的文本片段（matches）与 React 组件绑定

使用场景：
  → 高亮 #话题（HashtagDecorator）
  → 高亮 @提及（MentionDecorator）
  → 高亮 URL
  → 代码块语法高亮
  → 自定义格式（如 [[双括号]] 渲染为链接）

工作原理：
  Strategy 函数：扫描 ContentState，返回匹配片段的起止索引
  Component：渲染匹配片段的 React 组件
```

### 实现 Hashtag 高亮

```tsx
import React from "react";
import {
  Editor,
  EditorState,
  CompositeDecorator,
  ContentBlock,
  ContentState,
} from "draft-js";

// 匹配策略
const hashtagStrategy = (
  contentBlock: ContentBlock,
  callback: (start: number, end: number) => void,
  contentState: ContentState
) => {
  const text = contentBlock.getText();
  // 匹配 #话题（字母、数字、下划线）
  const regex = /#[a-zA-Z0-9_\u4e00-\u9fa5]+/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    callback(match.index, match.index + match[0].length);
  }
};

// Hashtag 组件
const HashtagSpan = (props: any) => {
  return (
    <span
      style={{ color: "#1da1f2", fontWeight: "bold" }}
      data-offset-key={props.offsetKey}
    >
      {props.children}
    </span>
  );
};

// 组合多个 Decorator
const compositeDecorator = new CompositeDecorator([
  {
    strategy: hashtagStrategy,
    component: HashtagSpan,
  },
]);

function HashtagEditor() {
  const [editorState, setEditorState] = useState(
    () => new EditorState.createEmpty(compositeDecorator)
  );

  return (
    <Editor
      editorState={editorState}
      onChange={setEditorState}
      placeholder="输入 #话题 试试..."
    />
  );
}
```

### 多层 Decorator（URL + Hashtag + Mention）

```tsx
// URL 匹配
const urlStrategy = (
  contentBlock: ContentBlock,
  callback: (start: number, end: number) => void
) => {
  const text = contentBlock.getText();
  const regex = /https?:\/\/[^\s]+/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    callback(match.index, match.index + match[0].length);
  }
};

// URL 组件
const LinkSpan = (props: any) => {
  const { href } = props.children[0].props;
  return (
    <a href={href} target="_blank" style={{ color: "#551a8b" }}>
      {props.children}
    </a>
  );
};

const decorator = new CompositeDecorator([
  { strategy: hashtagStrategy, component: HashtagSpan },
  { strategy: mentionStrategy, component: MentionSpan },
  { strategy: urlStrategy, component: LinkSpan },
]);
```

---

## 进阶技巧

### 撤销/重做

```tsx
import {
  EditorState,
  undo,
  redo,
} from "draft-js";

// 撤销
function handleUndo(editorState: EditorState) {
  return EditorState.undo(editorState);
}

// 重做
function handleRedo(editorState: EditorState) {
  return EditorState.redo(editorState);
}

// 监听内容变化
function handleChange(editorState: EditorState) {
  setEditorState(editorState);
  // 自动保存（防抖）
  debouncedSave(editorState);
}
```

### 工具栏按钮状态同步

```tsx
function Toolbar({ editorState, onToggle }: {
  editorState: EditorState;
  onToggle: (style: string) => void;
}) {
  const currentStyle = editorState.getCurrentInlineStyle();

  return (
    <div className="toolbar">
      {["BOLD", "ITALIC", "UNDERLINE", "CODE"].map((style) => (
        <button
          key={style}
          className={currentStyle.has(style) ? "active" : ""}
          onMouseDown={(e) => {
            e.preventDefault();
            onToggle(style);
          }}
        >
          {style}
        </button>
      ))}

      {/* 块类型 */}
      <BlockStyleSelect editorState={editorState} />
    </div>
  );
}

// 获取当前选区的块类型
function getBlockStyle(block: ContentBlock): string {
  switch (block.getType()) {
    case "code-block": return "block-code";
    case "blockquote": return "block-quote";
    default: return "";
  }
}
```

### 粘贴板处理

```tsx
// 处理粘贴内容（清理格式/过滤 HTML）
function handlePastedFiles(files: File[]): "handled" | "not-handled" {
  // 如果有图片，插入图片
  const imageFile = files.find((f) => f.type.startsWith("image/"));
  if (imageFile) {
    insertImage(imageFile);
    return "handled";
  }

  return "not-handled";
}

// 处理粘贴文本（自定义格式转换）
const handlePastedText = (
  text: string,
  html: string | undefined,
  editorState: EditorState
): "handled" | "not-handled" => {
  // 方式 1：直接插入纯文本
  const newContentState = Modifier.insertText(
    editorState.getCurrentContent(),
    editorState.getSelection(),
    text
  );

  // 方式 2：转换 HTML 为 ContentState
  if (html) {
    const blocksFromHTML = convertFromHTML(html);
    const contentState = ContentState.createFromBlockArray(
      blocksFromHTML.contentBlocks,
      blocksFromHTML.entityMap
    );
    // 插入到当前光标位置
    const newContentState = Modifier.replaceWithFragment(
      editorState.getCurrentContent(),
      editorState.getSelection(),
      contentState.getBlockMap()
    );
  }

  return "not-handled";
};

<Editor
  editorState={editorState}
  onChange={setEditorState}
  handlePastedFiles={handlePastedFiles}
  handlePastedText={handlePastedText}
/>
```

---

## 与 React 18 / Next.js 集成

### SSR 注意事项

```tsx
// Draft.js 需要浏览器环境，必须在客户端渲染
"use client";  // Next.js App Router

import dynamic from "next/dynamic";

// 动态导入（禁用 SSR）
const EditorComponent = dynamic(
  () => import("@/components/RichEditor"),
  { ssr: false, loading: () => <div>Loading editor...</div> }
);

// RichEditor.tsx
"use client";
import React, { useState } from "react";
import { Editor, EditorState } from "draft-js";
import "draft-js/dist/Draft.css";  // 引入默认样式

export default function RichEditor() {
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty()
  );

  return (
    <Editor
      editorState={editorState}
      onChange={setEditorState}
    />
  );
}
```

### Next.js App Router 中的完整示例

```tsx
// app/editor/page.tsx
"use client";

import { useState, useCallback } from "react";
import {
  Editor,
  EditorState,
  RichUtils,
  convertToRaw,
  convertFromRaw,
} from "draft-js";
import { RichToolbar } from "@/components/RichToolbar";
import "@/styles/editor.css";

export default function EditorPage() {
  const [editorState, setEditorState] = useState(() => {
    const saved = localStorage.getItem("editor-content");
    if (saved) {
      const contentState = convertFromRaw(JSON.parse(saved));
      return EditorState.createWithContent(contentState);
    }
    return EditorState.createEmpty();
  });

  const handleChange = useCallback((newState: EditorState) => {
    setEditorState(newState);
    const raw = convertToRaw(newState.getCurrentContent());
    localStorage.setItem("editor-content", JSON.stringify(raw));
  }, []);

  return (
    <div className="editor-container">
      <RichToolbar editorState={editorState} onChange={handleChange} />
      <div className="editor">
        <Editor
          editorState={editorState}
          onChange={handleChange}
          placeholder="开始写作..."
        />
      </div>
    </div>
  );
}
```

---

## 常见问题与调试

### 常见错误

```tsx
// ❌ 错误 1：在装饰器中使用 props.children 为 undefined
const MyComponent = (props) => {
  // Draft.js 的 Decorator 组件
  // 如果直接在 RenderFn 中使用，必须返回 children
  return <span className="mention">{props.children}</span>;
};

// ❌ 错误 2：EditorState 引用相等性问题
function handleChange(editorState: EditorState) {
  // ❌ 不要这样做：每次都创建新引用
  setEditorState({ ...editorState });

  // ✅ 正确做法：直接传入
  setEditorState(editorState);
}

// ❌ 错误 3：Decorator 匹配导致性能问题
// 大量匹配（URL、Hashtag）时，正则要优化
const hashtagStrategy = (contentBlock, callback) => {
  // ❌ 不要这样：每次都创建新正则
  const regex = new RegExp(/#[a-zA-Z0-9_]+/g);

  // ✅ 正确：在组件外定义正则
};

// ❌ 错误 4：focusEditor 后光标位置错乱
function focusEditor() {
  editorRef.current.focus();
  // ✅ 强制将 Selection 设置到末尾
  const newState = EditorState.moveFocusToEnd(editorState);
  setEditorState(newState);
}
```

### 性能优化

```tsx
// 1. 使用 shouldDraftJsEntireSelectionUpdate
<Editor
  editorState={editorState}
  onChange={setEditorState}
  shouldDraftJsEntireSelectionUpdate={() => false}  // 提升性能
/>

// 2. 限制 Decorator 匹配范围
const hashtagStrategy = (contentBlock, callback) => {
  // 只在前 1000 个字符中匹配（避免大文本性能问题）
  const text = contentBlock.getText().slice(0, 1000);
  // ...
};

// 3. 内容变化时防抖保存
const debouncedSave = useMemo(
  () =>
    debounce((content: ContentState) => {
      const raw = convertToRaw(content);
      api.saveDraft(raw);
    }, 1000),
  []
);
```

---

## 总结

```
Draft.js 核心概念速查：
─────────────────────────────────
EditorState = ContentState + SelectionState + Undo/Redo Stack
ContentState：编辑器内容（blocks + entityMap）
Entity：链接/图片/提及等元数据（key 引用）
Decorator：正则匹配 + React 组件（高亮/自定义渲染）
RichUtils.toggleInlineStyle：切换 BOLD/ITALIC 等
RichUtils.toggleBlockType：切换代码块/引用等
convertToRaw / convertFromRaw：与 JSON 互转
CompositeDecorator：组合多个装饰器
```

```
Draft.js 工作流程：
─────────────────────────────────
1. 用户输入 → EditorState 更新
2. Decorator 扫描 → 匹配文本 + 组件绑定
3. React 渲染 → 自定义组件 + 默认文本
4. 内容变化 → convertToRaw → 保存到数据库
5. 恢复内容 → convertFromRaw → EditorState.createWithContent
```

```
选型建议：
─────────────────────────────────
✅ 选 Draft.js：
  → React 技术栈
  → 需要撤销/重做（内置）
  → 需要 Entity 存储复杂元数据
  → 需要 Decorator 自定义高亮
  → 内容需要持久化（JSON 存储）

✅ 选 Slate.js：
  → 需要更灵活的架构
  → 需要自定义规范（JSON 自己定义）
  → 需要插件化扩展
  → 项目较新（Draft.js 维护较慢）

❌ 不选两者：
  → 简单场景：contentEditable + Tiptap
  → 非 React：Quill / Prosemirror / TipTap
```

Draft.js 是 React 富文本编辑器的经典方案——Immutable 数据模型、内置撤销重做、Decorator 灵活渲染，是构建内容平台、博客编辑器的坚实基础 🦐

本文由小虾子 🦐 撰写
