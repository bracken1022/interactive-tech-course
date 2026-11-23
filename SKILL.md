---
name: interactive-tech-course
description: Build a failure-driven, interactive technical course as a single offline HTML file — isometric (2.5D) animated scenes where learners trigger outages and watch the system react, plus lesson text, knowledge-review cards and scenario quizzes, with automated quality checks. Use this whenever the user wants to learn, teach or explain a technology (message queues like Kafka or RabbitMQ, AWS Lambda, Redis, Kubernetes, databases, distributed-systems concepts) through an interactive course, tutorial series, visual explainer or "互动课程 / 课程 / 教程 / 动画讲解", or asks to add lessons to, review or extend such a course — even if they don't say "isometric" or "skill".
---

# 交互式技术课程（等距动画 · 故障驱动）

把一项技术做成一门可以离线打开的单文件课程：每课从一个真实故障开始，读者在等距动画里点按钮制造故障、切换方案，看系统怎么反应；然后是知识复盘和情境小测试。

这套做法来自一门 22 课的 Kafka 课程。引擎、页面外壳和检查脚本都已经现成，你的工作是**设计大纲、写每课的内容和场景脚本、用脚本检查、按用户反馈修改**。

## 资源
- `assets/template.html`：页面外壳 + 动画引擎（不要改，除非要改界面文字或全局样式）。
- `assets/starter/`：可以直接复制的起步课程，内含一课完整示例（`lessons/01-example.js`）。**写第一课前先读这个文件**，它用到了大多数引擎功能。
- `scripts/build.js`：把课程目录拼成 `dist/index.html`。
- `scripts/check.js`：逐课点击每个按钮，检查标签重叠、文字被方块遮挡、报错、定时器、手机宽度、小测试（每课可多题），并截图。
- `references/course-format.md`：course.json 和 `lesson({...})` 的字段。
- `references/scene-api.md`：场景 spec、api、颜色取值、常用写法、**布局避坑**。
- `references/pedagogy.md`：大纲、每课结构、写作和小测试规则、准确性要求、全课复查清单。

## 流程

### 1. 弄清需求，出大纲（先停下来等确认）
问清楚（能从对话推断的就不问）：主题、读者水平（默认初学者）、大概几课、贯穿全课的业务场景（默认订单系统）、放在哪个目录。
然后读 `references/pedagogy.md` 第 1 节，给出大纲表格：

| 课 | 标题 | 开场故障 | 新概念 | 依赖 |
|---|---|---|---|---|

**等用户确认或修改大纲后再写课**。大纲决定了概念的先后顺序，事后调整代价很大。

如果没有人能回答（自动运行、用户明确说「不用等我确认」），就按 pedagogy.md 自己定大纲，把大纲和你做的取舍写进交付说明，然后继续。后面「每课发截图给用户」的步骤也改为写进说明。

### 2. 搭课程目录
```bash
cp -r <本 skill 目录>/assets/starter <课程目录>
```
改 `course.json`（标题、品牌、系列名、**独一无二的 storageKey**），删掉 `lessons/01-example.js`（读完之后）。

检查脚本需要 `playwright-core` 和一个 Chromium：
```bash
cd <课程目录> && npm i playwright-core
```
已经装在别处时不用重装，给检查脚本加 `--pw /path/to/node_modules`（或设 `NODE_PATH`）。没有 Chromium 时运行 `npx playwright install chromium`，或设 `CHROME_PATH` 指向本机 Chrome。

### 3. 逐课制作
每课一个文件 `lessons/NN-slug.js`。按这个顺序：
1. **写内容**：problem → 01 → 02 → 03 → review → 小测试（规则见 pedagogy.md 第 2、4、5 节）。注意大多数文字字段会被当作纯文本转义，只有少数字段能写 HTML，见 course-format.md 最后一节。
2. **写场景**：一个 `lessonXScene(mode)` 生成 A / B 两张图（参考示例课和 scene-api.md）。先画静态布局，再加 tick / view / 按钮 / 旁白。
3. **构建并检查**（在课程目录里运行，检查脚本从这里找 `node_modules/playwright-core`）：
   ```bash
   cd <课程目录>
   node <skill>/scripts/build.js .
   node <skill>/scripts/check.js dist/index.html --lessons N
   ```
   检查不通过（重叠、遮挡、报错）就按 scene-api.md 第 6 节改布局，直到通过。
4. **看截图**：读 `dist/check/` 里本课的截图，确认画面不挤、旁白和画面对得上、按钮点了有明显变化。检查脚本能发现重叠和遮挡，但看不出「挤」和「乱」。
5. **把截图发给用户**，简短说明本课讲了什么、和上一课怎么衔接。

用户说「继续下一课」时直接做；用户想先讨论时，先说思路再动手。每做完一课就确保整门课仍能构建。

### 4. 全课复查
全部写完后，按 pedagogy.md 第 7 节复查，并跑一次全课检查：
```bash
node <skill>/scripts/check.js <课程目录>/dist/index.html
node <skill>/scripts/check.js <课程目录>/dist/index.html --dark --quick
```
把发现的问题分级列给用户，确认后再改。版本号、默认值这类说法，能查证就查证，查不到要明确告诉用户。

### 5. 发布（可选，先问用户）
单文件可以直接放到 GitHub Pages：把 `dist/index.html` 放进仓库（多门课时每门一个子目录），在仓库 Settings → Pages 里从 `main` 分支根目录发布。推送和开启 Pages 都是对外发布，**先征得用户同意**。

## 为什么要这样做
- **故障驱动**：读者先看到系统坏掉，才会关心机制。直接讲定义，初学者记不住。
- **同一套布局的 A / B 两张图**：读者靠对比理解「这个机制改变了什么」。
- **自动检查 + 看截图**：等距图里标签很容易互相压住，人眼一张张看很累，脚本先筛一遍，你再看截图判断美观。
- **先确认大纲**：概念顺序错了，后面每课的衔接和交叉引用都要返工。
