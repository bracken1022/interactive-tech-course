# 课程目录和数据格式

```text
my-course/
  course.json
  raw/            可选：多课共享的常量或函数，原样插入（按文件名顺序）
  lessons/
    01-sync-call.js
    02-partition.js
    ...
  dist/index.html 构建产物（单文件，可离线打开）
```

## course.json
```json
{
  "title": "RabbitMQ 互动课程 · 第 1–12 课",
  "brand": "RabbitMQ",
  "brandAccent": "互动课程",
  "subtitle": "订单系统场景 · 故障驱动学习 · 离线可用",
  "series": "订单系统场景",
  "storageKey": "rabbitmq-course-v1",
  "footer": "本课程为单个 HTML 文件，离线可用。答题进度只保存在本浏览器中。"
}
```
- `storageKey` 每门课不同，否则不同课程的答题进度会互相覆盖。
- `series` 出现在每课顶部（「第 3 课 / 共 12 课 · 订单系统场景」），写课程统一的场景名。
- 可选 `count`：页头「第 1–N 课」里的 N；不写时按 `lesson({` 的个数自动算。
- 界面文字（目录、按钮、小测试）是中文的；要做英文课程，需要改 `assets/template.html` 里的这些字符串。

## lesson({...})
每个 `lessons/*.js` 调用一次。构建时每个文件都包在独立作用域里，场景函数和常量可以随便起名。

| 字段 | 必填 | 显示在哪里 |
|---|---|---|
| `n` | ✓ | 课号，从 1 连续编号 |
| `title` | ✓ | 标题，建议「概念：一个具体的问题？」 |
| `topics` | ✓ | 标题下的标签，用 ` · ` 分隔 |
| `problem` | ✓ | 标题下的引言：这一课要解决的真实故障（一两句话） |
| `original` | ✓ | 「01 故障现场」的说明，告诉读者在图里点什么、看什么 |
| `solution` | ✓ | 「02 引入核心机制」的说明 |
| `failure` | ✓ | 「03 故障模拟与处理边界」：这个机制管不到什么、还会怎么坏 |
| `key` | ✓ | 一句话总结（没有 review 时显示在 03） |
| `quiz` |  | 小测试数组：`[{question, options, answer, explain}, ...]`。每题 4 个选项，`answer` 是正确选项的下标（0–3），`explain` 是这一题自己的解析。一课 1–3 题，全部答对才算这一课完成。第 1 课可以不设小测试（见 review.quiz） |
| `question`, `options`, `answer`, `explain` |  | 旧写法：只有一道题时也可以直接写在顶层，效果等同于只有一项的 `quiz` |
| `scenes` |  | `{problem: () => spec, solution: () => spec, extra?: {...}}` |
| `review` |  | 「04 知识复盘」，见下 |

### scenes.extra（可选的「进阶」卡）
放在 03 之后、04 之前，用来补进阶内容而不打乱课号：
```js
extra: { title: '扩容与集群监控', lead: '一段引言', scene: () => spec,
         points: ['要点（可含 <code>）', ...], key: '一句话' }
```

### review
```js
review: {
  terms: [ // 3–4 张卡；4 张时排成两列
    { name: 'Offset', tone: 'kafka', tag: '位置', what: '一句话定义',
      points: ['要点，可含 <code>/<b>', ...], scene: '本课画面：…（指回图里的元素）' },
  ],
  compareTitle: '三种做法对比', comparePlain: true,      // 可选
  compare: { head: ['做法','结果','评价'], rows: [['…','…','…']] },
  extra: '<div class="rv-formula">…</div>',             // 可选：算账、公式
  key: '本课一句话（复盘末尾）',
  quiz: false                                            // 可选：本课不设小测试，改为「标记完成」按钮
}
```
- `tone` 只是卡片顶边颜色：`kafka`（紫）、`prod`（橙）、`cons`（靛蓝）、`part`（橙黄）。名字沿用自 Kafka 课程，和主题无关，按「概念 / 问题 / 做法 / 边界」随意分配即可。
- 每张卡的 `scene` 一定要指回图里的东西（「本课画面：灰色的 log start 小旗」），把文字和画面连起来。

## 哪些字段可以写 HTML
页面会把大多数文字字段**当作纯文本转义**，在里面写 `<code>`、`<b>` 会原样显示成尖括号。

| 纯文本（会被转义，不要写标签） | 可以写 HTML |
|---|---|
| `title` `topics` `problem` `original` `solution` `failure` `key`，以及小测试的 `question` `options` `explain` | `review.terms[].points[]`（要点列表） |
| `review.terms[].name` `tag` `what` `scene`、`review.key`、`review.compareTitle`、`compare` 表格的每一格 | `review.extra`（算账、公式块） |
|  | `scenes.extra.title` `lead` `points[]` `key`（进阶卡） |
|  | 场景里的 `note`、旁白正文、`metrics` HTML、`toolbar` HTML |

纯文本字段里要强调参数名时，直接写参数名（`auto.offset.reset`），或用「」括起来。
