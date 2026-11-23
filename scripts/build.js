#!/usr/bin/env node
/*
 * 把一个课程目录拼成单个离线 HTML。
 *
 * 用法：node build.js <课程目录> [-o 输出文件]
 *
 * 课程目录结构：
 *   course.json        标题、品牌、系列名、存储键、页脚（见 references/course-format.md）
 *   raw/*.js           可选：按文件名顺序原样插入，用于多课共享的常量 / 函数
 *   lessons/*.js       每个文件调用一次 lesson({...})；按文件名排序，
 *                      每个文件被包进独立的作用域，辅助函数不会和别的课冲突
 *
 * 默认输出：<课程目录>/dist/index.html
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const dir = args.find(a => !a.startsWith('-'));
if (!dir) { console.error('用法：node build.js <课程目录> [-o 输出文件]'); process.exit(1); }
const oi = args.indexOf('-o');
const out = oi >= 0 ? args[oi + 1] : path.join(dir, 'dist', 'index.html');

const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'course.json'), 'utf8'));
for (const k of ['title', 'brand', 'subtitle', 'series', 'storageKey']) {
  if (!cfg[k]) { console.error(`course.json 缺少字段：${k}`); process.exit(1); }
}
const course = {
  storageKey: cfg.storageKey,
  darkKey: cfg.darkKey,
  series: cfg.series,
  footer: cfg.footer || '本课程为单个 HTML 文件，离线可用。答题进度只保存在本浏览器中。'
};

const list = sub => {
  const d = path.join(dir, sub);
  return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.js')).sort().map(f => path.join(d, f)) : [];
};
const raw = list('raw').map(f => `/* ---- ${path.basename(f)} ---- */\n${fs.readFileSync(f, 'utf8')}`);
const lessons = list('lessons');
if (!lessons.length) { console.error('lessons/ 里没有 .js 文件'); process.exit(1); }
const wrapped = lessons.map(f => `/* ---- lessons/${path.basename(f)} ---- */\n(()=>{\n${fs.readFileSync(f, 'utf8')}\n})();`);

// 不能出现 </script>，否则会提前结束脚本
for (const f of [...list('raw'), ...lessons]) {
  if (/<\/script/i.test(fs.readFileSync(f, 'utf8'))) { console.error(`${f} 含有 </script>，请改写成 <\\/script>`); process.exit(1); }
}

const tplPath = path.join(__dirname, '..', 'assets', 'template.html');
let html = fs.readFileSync(tplPath, 'utf8');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// 课数在运行时由 LESSONS.length 决定；这里先按 lesson( 调用次数估一个，用于页头的静态文字
const count = cfg.count || lessons.reduce((n, f) => n + (fs.readFileSync(f, 'utf8').match(/\blesson\(\{/g) || []).length, 0) || lessons.length;
const rep = {
  '%%TITLE%%': esc(cfg.title),
  '%%BRAND%%': esc(cfg.brand),
  '%%BRAND_ACCENT%%': esc(cfg.brandAccent || '互动课程'),
  '%%SUBTITLE%%': esc(cfg.subtitle),
  '%%COUNT%%': String(count),
  '%%COURSE%%': `const COURSE=${JSON.stringify(course)};`,
  '%%LESSONS%%': [...raw, ...wrapped].join('\n')
};
for (const [k, v] of Object.entries(rep)) {
  if (!html.includes(k)) { console.error(`模板里找不到占位符 ${k}`); process.exit(1); }
  html = html.split(k).join(v);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`已生成 ${out}（${(html.length / 1024).toFixed(0)} KB，${lessons.length} 个课程文件）`);
