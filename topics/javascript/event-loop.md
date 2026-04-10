# Event Loop 事件循环机制

### 标准答案

1. **调用栈（Call Stack）**：同步代码按顺序压栈执行
2. **宏任务（Macro Task）**：setTimeout、setInterval、I/O、UI 渲染
3. **微任务（Micro Task）**：Promise.then、MutationObserver、queueMicrotask
4. **执行顺序**：同步代码 → 清空微任务队列 → 取一个宏任务 → 清空微任务队列 → 循环

### 经典输出题

```javascript
console.log(1);
setTimeout(() => console.log(2));
Promise.resolve().then(() => console.log(3));
console.log(4);
// 输出：1, 4, 3, 2
```

### 追问点

- Node.js Event Loop 和浏览器的区别：Node 有 6 个阶段（timers、pending、idle、poll、check、close）
- async/await 本质是 Promise 语法糖，await 后面的代码相当于 .then 回调
