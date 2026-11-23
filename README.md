# interactive-tech-course

一个 Claude Code skill：把一项技术做成**故障驱动的互动课程**，输出单个可离线打开的 HTML 文件。

每课从一个真实的生产故障开始，读者在等距（isometric, 2.5D）动画里点按钮制造故障、切换方案，看系统怎么反应；然后是知识复盘和情境小测试。课程外壳自带目录、学习进度、深色模式、手机适配、打印和无障碍支持。

示例：[Kafka 互动课程（22 课）](https://bracken1022.github.io/course_3d/kafka/) 就是用这套引擎和方法做的。

## 安装

```bash
git clone https://github.com/bracken1022/interactive-tech-course.git ~/.claude/skills/interactive-tech-course
```

检查脚本需要 Node.js、`playwright-core` 和 Chromium（在课程目录里装一次即可）：

```bash
npm i playwright-core && npx playwright install chromium
```

## 使用

在 Claude Code 里直接说，例如：

> 帮我做一门 RabbitMQ 入门互动课程，面向初学者，大概 8 课，放在 ~/courses/rabbitmq。

或者输入 `/interactive-tech-course` 再写需求。Claude 会：

1. 先给出大纲（每课的开场故障、新概念、依赖关系），等你确认；
2. 一课一课地写内容和动画场景；
3. 构建并用检查脚本逐个按钮测试（标签重叠、文字遮挡、报错、定时器、手机宽度、小测试），看截图修布局，把截图发给你；
4. 全部做完后做一轮全课复查；
5. 你同意后再发布（比如 GitHub Pages）。

## 目录

| 路径 | 内容 |
|---|---|
| `SKILL.md` | 流程和规则（Claude 读这个） |
| `assets/template.html` | 页面外壳 + 等距动画引擎（纯 SVG + 原生 JS，无依赖） |
| `assets/starter/` | 起步课程，含一课完整示例 |
| `scripts/build.js` | 把 `course.json` + `lessons/*.js` 拼成单个 HTML |
| `scripts/check.js` | 自动检查并截图 |
| `references/` | 场景 API、课程数据格式、教学和写作规则 |
| `evals/` | skill 的测试用例（可用 `claude plugin eval` 运行） |

## 不用 Claude 也能用

引擎和脚本是普通的 Node / 浏览器代码：

```bash
cp -r assets/starter my-course
# 编辑 my-course/course.json 和 my-course/lessons/*.js（格式见 references/course-format.md）
node scripts/build.js my-course
cd my-course && node ../scripts/check.js dist/index.html
```
