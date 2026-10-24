# 排序可视化 · SortSimple 中文版

把 [SortSimple](https://vishruth-s.github.io/SortSimple/) 重写为中文版：零构建的纯前端（原生 HTML/CSS/浏览器 ESM）+ Node 内置 http 静态服务器，无框架、无打包、无第三方依赖。

## 快速开始

```bash
node server.js          # 或 npm start，然后打开 http://localhost:3000
npm test                # 运行 81 个测试 / 5000+ 条断言
PORT=3001 node server.js  # 换端口
```

要求 Node >= 18，无需 `npm install`（没有任何依赖）。

## 配置

**所有可调参数集中在根目录 `config.json`**，改完刷新页面即生效（`server.port`、`server.staticRoot` 需要重启服务）。

```json
{
  "server":   { "port": 3000, "staticRoot": "public", "configUrl": "/config.json", "cacheControl": "no-cache" },
  "array":    { "minLength": 10, "maxLength": 100, "defaultLength": 25,
                "minValue": 30, "maxValue": 500, "defaultType": "random", "almostSortedRatio": 0.15 },
  "playback": { "frameMs": 16.7, "defaultIntervalMs": 80, "minIntervalMs": 0.5,
                "maxIntervalMs": 400, "backlogSteps": 4,
                "speedSlider": { "min": 1, "max": 100, "default": 55,
                                 "slowestMs": 400, "fastestMs": 0.5, "curve": 2 } },
  "display":  { "denseThreshold": 30, "compactBarWidth": 18 },
  "ui":       { "defaultAlgorithm": "bubble", "guideAutoOpen": true,
                "guideStorageKey": "sortsimple-zh-guide-seen" }
}
```

| 段 | 作用 |
| --- | --- |
| `server` | 服务端：监听端口（`PORT` 环境变量优先）、静态根目录、配置端点、缓存头 |
| `array` | 数据：数组长度范围与默认值、取值区间、默认分布、基本有序的扰动比例 |
| `playback` | 播放：每帧时基、步间隔上下限与默认值、突发保护积压步数 |
| `playback.speedSlider` | 速度滑杆 1–100 到步间隔的映射曲线：`fastestMs + (slowestMs-fastestMs) * (1-normalized)^curve` |
| `display` | 显示：超过多少个元素隐藏数值、单柱宽度低于多少像素隐藏数值 |
| `ui` | 界面：默认算法、引导是否自动弹出、引导状态的 localStorage 键名 |

实现方式：服务端在 `/config.json` 暴露根目录这一份配置（不放进 `public/`，避免两份各自漂移），前端启动时 `fetch` 一次并下发给数据生成器与播放器；读取失败时退回代码内置的同构默认值，页面不会白屏。`test/config.test.js` 校验其结构、数值区间与滑杆/播放器的边界一致性。

`public/index.html` 里滑杆的 `min/max/value` 只是 JS 未运行时的兜底，运行后统一由配置覆盖。

## 功能

- **8 种排序算法**：冒泡、选择、插入、归并、快速、鸡尾酒、奇偶、计数
- **逐步动画**：比较 / 交换 / 写入 / 已就位四种状态用不同颜色标注，同步高亮当前执行的伪代码行
- **复杂度表**：最差 / 平均 / 最好时间复杂度、空间复杂度、是否原地、是否稳定（数值与原站逐字一致）
- **4 种初始数据**：随机 / 基本有序 / 升序 / 降序；规模 10–100 可调
- **8 页中文引导**：首次访问自动弹出，之后可从右上角「操作指南」重新打开
- **响应式**：≥1200px 三栏、768–1199px 两栏、<768px 单栏

## 目录结构

```
server.js                       Node 内置 http 静态服务器（MIME、防目录穿越、GET/HEAD）
public/
  index.html                    页面骨架（33 个契约 id，无内联逻辑）
  css/styles.css                全部视觉：深色主题、三栏网格、条形图、伪代码、复杂度、引导
  js/
    app.js                      交互装配：状态、渲染、播放控制、图例、引导
    player.js                   播放器：按累计时间推进的 rAF 循环、暂停/停止/销毁
    arrayGen.js                 数组生成（4 种分布）
    pseudocode.js               伪代码面板渲染与行高亮
    complexity.js               复杂度表渲染
    guide.js                    8 页引导弹窗（文案 + 翻页 + 焦点管理）
    algorithms/
      index.js                  注册表：ALGORITHMS / byId
      bubble.js … counting.js   8 个算法，各自导出 meta 与 sort(array) -> Step[]
test/
  algorithms.test.js            81 个测试，5041 条断言
  helpers.mjs                   回放器、LCG 随机、带模拟时钟的假 rAF
```

## 步骤流契约

排序算法不直接操作 DOM，只产出步骤流，由播放器回放、由界面渲染：

```js
{ op: "compare", a, b, line }        // 比较下标 a、b
{ op: "swap",    a, b, line }        // 交换
{ op: "write",   index, value, line } // 覆写某下标（归并/计数）
{ op: "mark",    index, line }       // 标记已就位
{ op: "done",    line }              // 收尾，唯一且在末位
```

`line` 是 0-based 伪代码行号，界面据此高亮当前执行行。这个设计让算法可以脱离浏览器在 Node 里直接测——`test/` 正是靠它验证「回放后数组有序、下标不越界、行号不越界、入参未被修改」。

## 播放速度模型

速度滑杆 1–100 映射为每步间隔 `400 * (1 - (v-1)/99)^2 + 0.5` 毫秒，播放器按**累计时间**推进（而不是每帧固定步数）：

- 最慢 400ms/步 ≈ 2.5 步/秒，最快 0.5ms/步 ≈ 1900 步/秒
- 每帧可推进多步，帧内只回调一次，避免高速档拖垮渲染
- `play()` 预置一帧额度，点下「开始排序」立刻看到第一根柱子变色

## 与原站的差异

- 移除原站的 Google Analytics、GitHub fork ribbon 外链脚本、Bootstrap 与 font-awesome CDN 依赖，全部改为自带样式
- 条形图内数值在元素超过 30 个或柱宽不足时自动隐藏（原站在 100 个元素时数字挤成一团）
- 引导弹窗的插图改用 CSS 柱状装饰，不再引用原作者的图片素材
- 视觉整体现代化重做（深色主题、渐变柱、卡片式布局），功能一一对应

## 已知限制

- **归并排序的比较高亮**：比较发生在临时缓冲区，高亮的下标指向缓冲区位置而非数组当前值，仅影响高亮着色的精确度，不影响排序结果
- **mark 语义不完全统一**：冒泡/选择标记「已就位位」，归并只在整段合并完成后标记，奇偶/计数在末尾统一标记
- **计数排序的中间态**：计数阶段主数组不变，视觉上表现为该阶段无变化，回填阶段一次性写入（已保证每个写入值等于该位置的最终有序值）
- 未实现暂停按钮（播放器已支持 pause/resume，界面未接）
