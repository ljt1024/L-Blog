# Temporal API 深度解析：JavaScript 日期时间处理的终极方案

> `Date` 对象是 JavaScript 最古老也最令人诟病的内置对象之一。时区混乱、不可变缺失、解析不一致……这些问题困扰了开发者二十多年。TC39 的 Temporal 提案终于要终结这一切了。

## 为什么我们需要 Temporal？

先看一段"经典"的 Date 陷阱：

```javascript
// 月份从 0 开始 —— 多少人踩过这个坑？
const date = new Date(2026, 6, 24); // 2026年7月24日，不是6月！

// 时区陷阱：parse 结果取决于运行环境
const parsed = Date.parse('2026-06-24'); // UTC? 本地? 取决于实现

// 修改是可变的 —— 你永远不知道谁改了你的 date
const d = new Date();
const d2 = d;
d2.setFullYear(2025);
console.log(d.getFullYear()); // 2025 —— 原对象也被改了！

// 没有时区信息的歧义
const meeting = new Date('2026-06-24T09:00:00');
// 这是北京