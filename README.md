# 函数图像实验室

这是一个数学辅助理解工具，借助 AI 实现，**目前尚未完成**。本仓库包含网页端源码及加载同一页面的 Electron 桌面壳，不包含 Python 桌面版、构建产物或安装包。

## 当前已有功能

- 在 MathLive 公式域中直接输入排版公式，并通过屏幕数学键盘插入分数、根号、求和、连乘、定积分等符号。
- 绘制二维函数曲线、三维曲面和随时间变化的曲面；比较两个函数的交点、重合区间或曲面交线。
- 输入变量值求数值结果。支持隐式乘法，以及有限求和、连乘和数值定积分。
- 查看有限时间窗傅里叶变换、单边截断拉普拉斯变换、离散傅里叶变换和有限序列的 z 平面图像。

图像、交点和变换结果均为有限范围内的数值近似，不能视为符号证明或无限区间的解析结果。

## 目录结构

```text
src/
  core/          与界面无关的 JavaScript 计算内核。index.js 提供 evaluate(input, workspace)
  app.js         函数图像页：收集输入、调用内核、展示结果
  graph.js       Plotly 图像呈现
  signal.js      变换与频域页：收集输入、调用内核、展示结果
  math-input.js  MathLive 输入与错误提示
  keyboard.js    屏幕数学键盘
  *.html, *.css  页面结构与样式
scripts/build.mjs  将页面和依赖资源构建到 dist/
desktop/           Electron 桌面壳与两页面的启动检查；只加载构建后的 dist/
tests/             计算内核与命令的回归测试
```

`src/core/index.js` 的 `evaluate(input, workspace)` 返回 `{type, value}`。`createWorkspace()` 创建变量工作区；绘图、交点、傅里叶、拉普拉斯、DFT 和 z 变换通过命令调用。页面脚本只传入当前输入并展示内核结果。

## 本地运行

需要 Node.js 22.12 或更新版本及 npm。进入仓库根目录后运行：

```bash
npm ci
npm run check
npm test
npm run build
python -m http.server 4173 --directory dist
```

浏览器打开 `http://localhost:4173/`。最后一行仅用 Python 启动本地静态文件服务器；网页计算仍由浏览器中的 JavaScript 完成。

运行桌面窗口：

```bash
npm run desktop
```

该命令先构建 `dist/`，再启动 Electron。两个页面仍使用原有的 HTML、CSS、JavaScript 和计算内核；桌面壳通过 `mathgraph://app/` 本地协议提供资源，不需要启动 HTTP 服务。可以用 `npm run desktop:smoke` 检查两页的主要功能。`dist/` 是可重新生成的构建目录，不提交到代码仓库；目前不提供安装包。

直接使用 `file://` 加载的实测结果：在 Electron 45.2.2 中，当前两个页面的 ES 模块和相对资源均正常加载，没有观察到功能错误。正式桌面入口仍采用标准、安全的自定义协议，使页面具有一致的来源和资源路径，并避免依赖 `file://` 的特殊权限行为。

## 后续计划

- 持续补充公式边界、数值精度和页面交互的测试。
- 整理计算命令的输入输出文档，降低复用内核的门槛。
- 逐步改善大范围采样时的性能与错误提示。

## 许可证与第三方依赖

本项目自有代码采用 [PolyForm Noncommercial License 1.0.0](LICENSE)，允许其条款规定的非商用用途，商用须另行获得授权。这是**源码可见、限制商用**的许可，不属于 OSI 意义上的开源许可证。第三方依赖仍按各自许可证使用；本项目许可证不改变它们的许可条件。

| 网页端直接依赖 | 用途 | 许可证 |
| --- | --- | --- |
| MathLive | 可编辑数学公式 | MIT |
| CortexJS Compute Engine | LaTeX 解析与计算 | MIT |
| KaTeX | 公式排版 | MIT |
| Plotly.js | 图像绘制 | MIT |
| Electron（开发依赖） | 桌面窗口 | MIT |

这些依赖的 MIT 条款允许与本项目的非商用许可并用；再次分发依赖时仍须保留其原有版权和许可声明。具体版本见 `package-lock.json`，其余间接依赖的许可证也以安装包所附文本为准。
