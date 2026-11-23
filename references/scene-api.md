# 场景 API：createIsoScene(container, spec)

每张场景图是一个函数返回的 `spec` 对象。引擎负责画图、动画、暂停 / 重置 / 速度、只在可见时运行、减少动效、卡片和缩放；你只写**画什么**和**状态怎么变**。完整的真实例子见 `assets/starter/lessons/01-example.js`。

## 目录
1. 坐标系
2. spec 字段
3. api（在 tick / view / actions 里调用）
4. 颜色和状态取值
5. 常用写法
6. 布局避坑（重叠最常见的原因和解法）

---

## 1. 坐标系
- 网格坐标 `[gx, gy]`，投影：`x = OX + (gx − gy) × 42`，`y = OY + (gx + gy) × 21 − z`。
- **gx 增大 → 屏幕右下；gy 增大 → 屏幕左下；gy 减小 → 屏幕右上（「后面」）。**
- 一条主链路通常放在同一个 gy 上、沿 gx 排开（生产者 → 日志带 → 消费者）。辅助节点（数据库、协调者）放到 gy 更小（右上）或更大（左下）的空地。
- `origin:[OX, OY]` 决定整张图在画布里的位置；`width/height` 是画布大小（一般 700–900 × 380–470）。画布在窄屏会等比缩小到 0.7，再窄就横向滚动。

## 2. spec 字段

| 字段 | 说明 |
|---|---|
| `title` | 场景标题（用作无障碍名称） |
| `width`, `height`, `origin` | 画布尺寸和投影原点 |
| `pathZ` | 路径和粒子的高度（默认 4） |
| `ground: {gx:[a,b], gy:[c,d]}` | 地面网格范围，要盖住所有节点 |
| `frames: [{x:[a,b], y:[c,d], layer?}]` | 虚线分组框（比如一个 Consumer Group、一个窗口） |
| `platforms: [{x:[a,b], y:[c,d], h?, layer?}]` | 节点和日志带下面的白色平台 |
| `texts: [{at:[gx,gy], text, dir?:'gy', z?, layer?}]` | 贴地斜体文字，默认沿 gx 方向；`dir:'gy'` 沿 gy 方向 |
| `logs: [{id, from:[gx,gy], n, cell, label?, badge?, name, msgSize, msgH, numOff?, z?, layer?}]` | 一条「日志带」：n 个格子，每格宽 `cell`。`label:false` 不显示标签；`numOff` 是格子下方编号离格子的距离（编号会挡住时调大） |
| `paths: [{pts:[[gx,gy],...], arrow?, kind?:'sync'\|'back'\|'hb', layer?}]` | 折线。只走水平 / 垂直段最好看。`sync` 橙色虚线，`hb` 心跳虚线，`back` 回程 |
| `nodes: [{id, at, size, h, label, hideLabel?, badge?, rack?, state?, top?, z0?, layer?}]` | 立方体节点。`rack:true` 画机架线（服务器 / 数据库）；`badge:true` 预留一个状态徽章；`hideLabel:true` 时徽章仍显示在顶上 |
| `note` | 场景下方的说明（可含少量 HTML，如 `<code>`） |
| `init(prev)` | 返回初始状态；重置时传入上一个状态，可以保留用户选的模式 |
| `tick(s, api)` | 每 80 ms ÷ 速度调用一次，推进状态、发射粒子 |
| `view(s, api)` | 每次 tick / 操作后调用，把状态画出来（格子、徽章、旁白、指标） |
| `toolbar(s)` | 返回工具栏 HTML 字符串（按钮带 `data-act`，可选 `data-v`） |
| `actions: {name:(s, api, dataset, el) => 新状态\|undefined}` | 按钮处理。返回新对象会替换状态（并清掉粒子）；返回 undefined 表示原地修改 |
| `card(id, s)` | 点节点 / 日志带时的弹出卡片：`{title, ok, rows:[[k,v],...], progress?:{label,value}}` |

内置按钮（暂停、重置、0.5× / 1× / 2×）由引擎自动加，`data-act` 以 `__` 开头，不要占用这个前缀。

## 3. api

| 方法 | 作用 |
|---|---|
| `api.emit(route, kind)` | 沿 `[[gx,gy],...]` 飞一个小方块。减少动效时自动不画 |
| `api.node(id, state)` | 改节点状态（颜色） |
| `api.badge(id, text, tone)` | 改徽章文字和颜色；`text` 为空则隐藏 |
| `api.layer(name, 'on'\|'dim'\|'off')` | 显示 / 变暗 / 隐藏带 `layer:name` 的元素 |
| `api.log(id, kinds, nums?)` | 设置日志带每格的类型（数组长度 = n），可选格子下方编号 |
| `api.logMarks(id, [{pos, cls, text, h, right?}])` | 日志带上的小旗。`pos` 是格子位置（可以是小数），`h` 是旗杆高度，文字默认在左，`right:true` 在右 |
| `api.narrate(title, body, tone)` | 旁白（图下方）：标题 + 正文，tone 决定左边条颜色 |
| `api.metrics(html)` | 旁白下方的指标区（终端、指标卡、看板），内容不变时不会重绘 |

辅助函数：`kv(标签, 值, 'hl'|'warn'|'')` 生成一个指标小卡片，放进 `<div class="iso-kv c4">…</div>`（`c4` / `c5` 指每行几个）。

## 4. 颜色和状态取值
- 节点状态 `api.node`：`normal`（紫）、`prod`（橙，生产者）、`inv`（青）、`ana`（粉）、`wait`（橙色，忙 / 等待）、`idle`（灰，空闲 / 已下线）、`down`（红，故障）。
- 粒子 `api.emit`：`prod`（橙）、`noti`（紫）、`inv`（青）、`ana`（粉）、`cons`（绿）、`fail`（红）。
- 日志格子 `api.log`：`gap`（空格子）、`new`（橙，新写入）、`lag`（橙，待处理）、`done`（浅紫，已处理）、`cur`（蓝，正在处理 / Leader）、`unc`（浅紫，未确认）、`reread`（黄，重复 / 重读）、`dup`（红，出错 / 重复写入）、`miss`（灰，已删除 / 丢失）、`rep`、`off`、`o0`–`o5`（按 Key 区分的 6 种颜色）。
- 小旗 `logMarks.cls`：`mk-noti`（紫）、`mk-inv`（青）、`mk-ana`（粉）、`mk-leo`（深色，日志末尾）、`mk-pos`（灰，参考位置）、`mk-lead`（金色，Leader）、`mk-pause`（红，出问题的位置）。
- 徽章 / 旁白 tone：`green`、`orange`、`red`、`neutral`。
- 终端 `.iso-term` 里：`<span class="cmd">` 绿色（命令、当前行）、`<span class="note">` 灰色注释、`<span class="bad">` 红色（错误、缺失）、`<span class="warn">` 橙色（等待、警告）。**不要用 cmd 标错误。**
- 看板：`<div class="dash"><div class="dash-g">` + `<div class="dash-t ok|bad"><small>名字</small><b>值</b></div>`；柱状图用 `dash-bars`（见示例课）。

## 5. 常用写法

**一个场景函数生成两张图**：`function lessonXScene(mode){ const A = mode==='A'; ... }`，`A` 是故障现场，`B` 是引入机制后的版本；两张图共用坐标和画法，只是状态、工具栏、旁白不同。

**旁白按优先级选**：在 `view` 里从「最近发生的操作 / 故障」到「默认说明」依次判断，给每种情况写一段旁白：标题带圈号（①②③…），正文解释**看到了什么、为什么、意味着什么**，并引用前面的课（「第 4 课」）。

**最近发生的事**：在 action 里记 `s.act = 'crash'; s.actAt = s.t`，`view` 里用 `s.t - s.actAt < 150` 判断是否刚发生，过一会儿旁白回到常态。

**日志带滑动窗口**：消息越来越多时，`base = Math.max(0, total - n)`；如果要一直看到某个卡住的位置，用 `base = Math.max(0, Math.min(total - n, stuck - 1))`，并在超出窗口的小旗文字前加 `▸`。

**模式切换**：分段按钮 `<span class="iso-seg" role="group" aria-label="…"><button data-act="mode" data-v="a" aria-pressed="true">…</button>…</span>`；action 里 `(s,api,d)=>d.v===s.mode?undefined:fresh({...s, mode:d.v})`。

**故障按钮 + 恢复**：`s.down=true; s.downUntil=s.t+30`，tick 里到时间自动恢复；按钮在进行中时 `disabled`。

**真实规模的数字**：模拟按「每 tick 多少条」跑，指标按真实规模换算（比如每秒 12,000 条），并在 `note` 里写清楚换算关系。

## 6. 布局避坑
`scripts/check.js` 会报告两类问题：**重叠**（HTML 标签、徽章、小旗文字的外框互相压住）和**遮挡**（SVG 里的贴地文字、格子编号、小旗文字被后画的方块、格子、标签盖住超过三分之一，或者伸出画布）。最常见的原因和改法：
1. **节点挨得太近**：相邻节点在 gx 上至少隔 1.6–2；同一列竖着摆多个节点时，标签会盖住后面的方块 → 改用 `hideLabel:true` + 徽章，或把名称放到日志带末端的小旗文字里。
2. **同一位置的多个小旗**：给它们不同的 `h`（相差 ≥ 24），并把文字分到左右两侧（`right:true`）。
3. **格子太窄放不下编号**：`cell` 至少 0.5；4 位编号用 0.7；或只显示末两位。编号和贴地文字重叠时，把贴地文字往外挪（`gy + 1.2`）。
4. **辅助节点的标签压住主节点**：把辅助节点挪到右上方（gy 更小）的空地，路径用折线连过去。
5. **画布边缘裁切**：调大 `height` 或 `origin` 的 y；最上面的徽章离画布顶至少 20px。
6. **贴地文字 / 小旗文字被方块挡住**（报告里写「被方块 xxx 挡住」）：贴地文字放在日志带的近侧（gy 更大的一侧）；小旗文字换到另一侧（`right`）或调高 `h`，让它越过方块。
7. **文字伸出画布**（报告里写「画布边缘」）：调大 `width` / `height`，或移动 `origin`。

每次改完，重新跑 `build.js` + `check.js`，再看截图——检查脚本只能发现重叠，看不出「挤」和「乱」。
