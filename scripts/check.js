#!/usr/bin/env node
/*
 * 自动检查一个已构建的课程 HTML，并给每张场景图截图。
 *
 * 用法：node check.js <index.html> [--out 截图目录] [--lessons 3,4] [--dark] [--quick] [--pw node_modules目录]
 *
 * 依赖：playwright-core（npm i playwright-core）和一个 Chromium。
 * 浏览器查找顺序：环境变量 CHROME_PATH → ~/Library/Caches/ms-playwright 或 ~/.cache/ms-playwright 里的 chromium
 *                 → 系统安装的 Google Chrome / Chromium。
 *
 * 对每一课：
 *   1. 打开课程，逐个滚到场景图（01 / 02 / 进阶），等动画跑一会儿，截图；
 *   2. 依次点击场景工具栏里的每个按钮（含每个分段选项），每次点击后检查一遍；
 *   3. 检查：标签 / 徽章互相重叠、SVG 文字被方块 / 格子 / 标签挡住或超出画布、控制台报错、390px 宽时页面横向溢出；
 *   4. 小测试：选标准答案，确认显示「回答正确」；题目 ≥ 8 道时检查正确答案在 A–D 的分布。
 * 最后来回切换课程，确认定时器没有泄漏。
 *
 * 结果写到 <out>/report.json，并在终端打印摘要；有问题时退出码为 1。
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// playwright-core 的查找顺序：--pw <node_modules 目录> → 正常 require（含 NODE_PATH）→ 当前目录及其上层的 node_modules
let chromium;
{
  const argv = process.argv, pi = argv.indexOf('--pw');
  const tries = [];
  if (pi >= 0) tries.push(path.join(argv[pi + 1], 'playwright-core'));
  tries.push('playwright-core');
  for (let d = process.cwd(); ; d = path.dirname(d)) { tries.push(path.join(d, 'node_modules', 'playwright-core')); if (path.dirname(d) === d) break; }
  for (const t of tries) { try { ({ chromium } = require(t)); break; } catch {} }
  if (!chromium) {
    console.error('找不到 playwright-core。任选一种：\n  1. 在课程目录运行 npm i playwright-core\n  2. 已经装在别处时：node check.js ... --pw /path/to/node_modules\n  3. 或设置环境变量 NODE_PATH=/path/to/node_modules');
    process.exit(2);
  }
}

const args = process.argv.slice(2);
const valued = new Set(['--out', '--lessons', '--pw']);
const file = args.find((a, i) => !a.startsWith('--') && !valued.has(args[i - 1]));
if (!file) { console.error('用法：node check.js <index.html> [--out 目录] [--lessons 1,2] [--dark] [--quick]'); process.exit(2); }
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const outDir = path.resolve(opt('--out') || path.join(path.dirname(file), 'check'));
const only = opt('--lessons') ? opt('--lessons').split(',').map(Number) : null;
const dark = args.includes('--dark'), quick = args.includes('--quick');
const url = 'file://' + path.resolve(file);

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const roots = [path.join(os.homedir(), 'Library/Caches/ms-playwright'), path.join(os.homedir(), '.cache/ms-playwright')];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter(x => /^chromium-\d+$/.test(x)).sort().reverse()) {
      for (const rel of ['chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
        'chrome-linux/chrome', 'chrome-linux64/chrome']) { const p = path.join(r, d, rel); if (fs.existsSync(p)) return p; }
    }
  }
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) if (fs.existsSync(p)) return p;
  return null;
}

const W = ms => new Promise(r => setTimeout(r, ms));
const hook = () => {
  const live = new Set(), si = setInterval, ci = clearInterval;
  window.setInterval = (...a) => { const id = si(...a); live.add(id); return id; };
  window.clearInterval = id => { live.delete(id); return ci(id); };
  window.__iv = () => live.size;
};
// 同一张场景图里，可见的标签 / 徽章两两比较；返回重叠对
const overlapJS = (rootId) => {
  const out = [];
  for (const sc of document.querySelectorAll(rootId ? `#${rootId} .iso-scene` : '.iso-scene')) {
    const r = [...sc.querySelectorAll('.iso-label,.iso-badge:not(:empty),.iso-mkt')]
      .filter(e => {
        if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
        let op = 1, a = e; while (a && a !== sc) { op *= +getComputedStyle(a).opacity || 1; a = a.parentElement; }
        return op > .5;
      })
      .map(e => ({ t: e.textContent.trim(), b: e.getBoundingClientRect() }))
      .filter(x => x.b.width > 0);
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const a = r[i].b, b = r[j].b;
      if (a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2) out.push(`${r[i].t} × ${r[j].t}`);
    }
  }
  return out;
};

// 遮挡：SVG 里的文字（贴地文字、格子编号、小旗文字）逐字检查最上层是什么；
// 超过 35% 的字被方块、格子、标签或别的文字盖住，或者落在画布外，就算被遮挡
const occlusionJS = (rootId) => {
  const st = document.createElement('style');
  st.textContent = '.iso-hit{visibility:hidden!important}.iso-particles{visibility:hidden!important}.iso-card{display:none!important}.iso-overlay *{pointer-events:auto!important}';
  document.head.appendChild(st);
  const out = [];
  try {
    for (const sc of document.querySelectorAll(rootId ? `#${rootId} .iso-scene` : '.iso-scene')) {
      const vpEl = sc.querySelector('.iso-viewport'); if (!vpEl) continue;
      const vp = vpEl.getBoundingClientRect();
      for (const t of sc.querySelectorAll('svg text')) {
        const cs = getComputedStyle(t); if (cs.display === 'none' || cs.visibility === 'hidden' || !t.textContent.trim()) continue;
        if (t.checkVisibility && !t.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        let op = 1, a = t; while (a && a !== sc) { op *= +getComputedStyle(a).opacity || 1; a = a.parentElement; } if (op < .5) continue;
        const M = t.getScreenCTM(), svg = t.ownerSVGElement; if (!M || !svg) continue;
        const n = t.getNumberOfChars(), fs = parseFloat(cs.fontSize) || 12, central = /central|middle/.test(t.getAttribute('dominant-baseline') || '');
        let hid = 0, tot = 0; const by = new Map(); const add = k => by.set(k, (by.get(k) || 0) + 1);
        for (let i = 0; i < n; i++) {
          let sp, ep; try { sp = t.getStartPositionOfChar(i); ep = t.getEndPositionOfChar(i); } catch { continue; }
          const pt = svg.createSVGPoint(); pt.x = (sp.x + ep.x) / 2; pt.y = (sp.y + ep.y) / 2 - (central ? 0 : fs * .32);
          const q = pt.matrixTransform(M);
          if (q.y < 0 || q.y > innerHeight || q.x < 0 || q.x > innerWidth) continue;
          tot++;
          if (q.x < vp.left || q.x > vp.right || q.y < vp.top || q.y > vp.bottom) { hid++; add('画布边缘'); continue; }
          const e = document.elementFromPoint(q.x, q.y);
          if (!e || e === t || t.contains(e) || !sc.contains(e)) continue;
          const g = e.closest('.iso-node,.iso-msg,.iso-label,.iso-badge,text');
          if (!g || g === t || (g.checkVisibility && !g.checkVisibility({ opacityProperty: true, visibilityProperty: true }))) continue;
          hid++;
          add(g.matches('.iso-label,.iso-badge') ? `标签「${g.textContent.trim().slice(0, 12)}」` : g.tagName.toLowerCase() === 'text' ? `文字「${g.textContent.trim().slice(0, 12)}」` : g.matches('.iso-node') ? `方块 ${g.dataset.node || ''}` : '日志格子');
        }
        if (tot >= 2 && hid / tot >= .35) out.push(`「${t.textContent.trim().slice(0, 20)}」被${[...by.keys()].join('、')}挡住 ${Math.round(hid / tot * 100)}%`);
      }
    }
  } finally { st.remove(); }
  return [...new Set(out)];
};

(async () => {
  const exe = findChrome();
  if (!exe) { console.error('找不到 Chromium。设置 CHROME_PATH，或运行 npx playwright install chromium'); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ executablePath: exe });
  const report = { file: path.resolve(file), lessons: {}, problems: [] };
  const P = (n, what) => { report.problems.push(`第 ${n} 课：${what}`); };

  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1.5 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && !/favicon/.test(m.text()) && errs.push(m.text()));
  await p.addInitScript(hook);
  if (dark) await p.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.endsWith('-dark')) localStorage.setItem(k, 'true'); } catch {} document.documentElement.dataset.forceDark = 1; });
  await p.goto(url + '#1'); await W(500);
  if (dark) await p.evaluate(() => document.body.classList.add('dark'));
  const total = await p.evaluate(() => LESSONS.length);
  const answers = [0, 0, 0, 0];

  for (let n = 1; n <= total; n++) {
    if (only && !only.includes(n)) continue;
    const L = { scenes: [], overlaps: [], occlusions: [], errors: [], quiz: null };
    const e0 = errs.length;
    await p.evaluate(n => go(n), n); await W(400);
    const ids = await p.evaluate(() => ['isoProblem', 'isoSolution', 'isoExtra'].filter(id => document.getElementById(id)));
    for (const id of ids) {
      const S = p.locator('#' + id); await S.scrollIntoViewIfNeeded(); await W(quick ? 900 : 1800);
      const shot = path.join(outDir, `L${String(n).padStart(2, '0')}-${id}-0.png`); await S.screenshot({ path: shot });
      const sc = { id, shots: [shot], steps: [] };
      const ov = await p.evaluate(overlapJS, id); if (ov.length) L.overlaps.push({ where: `${id} 初始`, ov });
      const oc = await p.evaluate(occlusionJS, id); if (oc.length) L.occlusions.push({ where: `${id} 初始`, oc });
      // 工具栏按钮：跳过内置的 __pause/__reset/__speed
      const btns = await S.locator('.iso-toolbar [data-act]:not([data-act^="__"])').evaluateAll(es => es.map((e, i) => ({ i, act: e.dataset.act, v: e.dataset.v || '', text: e.textContent.trim().slice(0, 24) })));
      let k = 0;
      for (const bt of btns.slice(0, quick ? 4 : 12)) {
        const sel = `.iso-toolbar [data-act="${bt.act}"]${bt.v ? `[data-v="${bt.v}"]` : ''}`;
        const el = S.locator(sel).first();
        if (!(await el.count()) || await el.isDisabled()) continue;
        await el.click(); await W(quick ? 700 : 1500); k++;
        const narr = await S.locator('.iso-narr-t').textContent().catch(() => '');
        const ov2 = await p.evaluate(overlapJS, id); if (ov2.length) L.overlaps.push({ where: `${id} 点击「${bt.text}」后`, ov: ov2 });
        const oc2 = await p.evaluate(occlusionJS, id); if (oc2.length) L.occlusions.push({ where: `${id} 点击「${bt.text}」后`, oc: oc2 });
        if (k <= 6) { const sh = path.join(outDir, `L${String(n).padStart(2, '0')}-${id}-${k}.png`); await S.screenshot({ path: sh }); sc.shots.push(sh); }
        sc.steps.push({ button: bt.text, narration: narr });
      }
      L.scenes.push(sc);
    }
    // 小测试（每课可以有多道）
    const qs = await p.evaluate(() => { const l = LESSONS[current - 1]; const list = Array.isArray(l.quiz) ? l.quiz : (l.question ? [{ answer: l.answer, options: l.options, explain: l.explain }] : []); return document.querySelector('#quiz') ? list.map(q => ({ answer: q.answer, n: q.options.length, explain: !!q.explain })) : []; });
    if (qs.length) {
      L.quiz = [];
      for (let qi = 0; qi < qs.length; qi++) {
        const q = qs[qi], B = (await p.locator('#quiz .qblock').count()) ? p.locator(`#quiz .qblock[data-q="${qi}"]`) : p.locator('#quiz');
        answers[q.answer]++;
        await B.locator('.choice').nth(q.answer).click(); await B.locator('.qcheck, #check').first().click();
        const ok = (await B.locator('.answer').textContent()).includes('回答正确');
        L.quiz.push({ answer: 'ABCD'[q.answer], ok, explain: q.explain });
        const tag = qs.length > 1 ? `第 ${qi + 1} 道小测试` : '小测试';
        if (!ok) P(n, `${tag}的标准答案没有判为正确`);
        if (!q.explain) P(n, `${tag}缺少 explain（每题自己的解析）`);
        if (q.n !== 4) P(n, `${tag}有 ${q.n} 个选项（建议 4 个）`);
      }
      const done = await p.evaluate(() => saved[current] === true);
      if (!done) P(n, '所有小测试都答对后，本课没有被标记为完成');
    }
    L.errors = errs.slice(e0);
    if (L.errors.length) P(n, `控制台报错：${L.errors.slice(0, 2).join(' / ')}`);
    if (L.overlaps.length) P(n, `标签重叠 ${L.overlaps.length} 处，例如 ${L.overlaps[0].where}：${L.overlaps[0].ov[0]}`);
    if (L.occlusions.length) P(n, `文字被遮挡 ${L.occlusions.length} 处，例如 ${L.occlusions[0].where}：${L.occlusions[0].oc[0]}`);
    report.lessons[n] = L;
    console.log(`第 ${n} 课：场景 ${L.scenes.length} 张，按钮 ${L.scenes.reduce((a, s) => a + s.steps.length, 0)} 次，重叠 ${L.overlaps.length}，遮挡 ${L.occlusions.length}，报错 ${L.errors.length}${L.quiz ? `，小测试 ${L.quiz.map(q => q.answer + (q.ok ? '✓' : '✕')).join(' ')}` : ''}`);
  }

  // 定时器泄漏：来回切 20 次后，只应剩下可见场景的定时器（≤ 场景数）
  const seq = [...Array(20)].map((_, i) => (i * 7) % total + 1);
  for (const n of seq) { await p.evaluate(n => go(n), n); await W(80); }
  await p.evaluate(() => go(1)); await W(600);
  const iv = await p.evaluate(() => __iv()), sc1 = await p.evaluate(() => document.querySelectorAll('.iso-scene').length);
  report.timers = { intervals: iv, scenesOnPage: sc1 };
  if (iv > sc1) report.problems.push(`定时器泄漏：切换课程后还有 ${iv} 个 interval，但页面只有 ${sc1} 张场景图`);

  // 手机宽度
  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  const merr = []; m.on('pageerror', e => merr.push(String(e)));
  const wide = [];
  for (let n = 1; n <= total; n++) {
    if (only && !only.includes(n)) continue;
    await m.goto(`${url}#${n}`); await W(300);
    const w = await m.evaluate(() => document.documentElement.scrollWidth); if (w > 392) wide.push(`${n}（${w}px）`);
  }
  if (wide.length) report.problems.push(`390px 宽时页面横向溢出：第 ${wide.join('、')} 课`);
  if (merr.length) report.problems.push(`手机宽度下报错：${merr[0]}`);

  report.quizAnswers = { A: answers[0], B: answers[1], C: answers[2], D: answers[3] };
  const qn = answers.reduce((a, b) => a + b, 0);
  if (qn >= 8 && answers.some(x => x === 0)) report.problems.push(`小测试正确答案分布不均：A ${answers[0]} / B ${answers[1]} / C ${answers[2]} / D ${answers[3]}`);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  await b.close();
  console.log(`\n正确答案分布：A ${answers[0]} / B ${answers[1]} / C ${answers[2]} / D ${answers[3]}；定时器 ${iv}（页面场景 ${sc1}）`);
  console.log(report.problems.length ? `\n发现 ${report.problems.length} 个问题：\n- ${report.problems.join('\n- ')}` : '\n全部通过。');
  console.log(`截图和 report.json 在：${outDir}`);
  process.exit(report.problems.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
