/*
 * 示例课（取自 Kafka 课程第 16 课）：完整展示一课需要的所有部分。
 * 新课程可以照这个结构写；场景函数、常量都写在本文件里，构建时会被包进独立作用域。
 */
function lesson16Scene(mode){
const A=mode==='A',PX=1,PY=3.2,PS=1.1,LX=2.8,CELL=.6,NC=11,LEND=LX+NC*CELL,CX=LEND+2.3,JX=LEND+.8,STEP=100,LS=200,
GY=A?[2.1,4.3]:[PY],SY=.35;
const readR=i=>[[LEND+.12,PY],[JX,PY],[JX,GY[i]],[CX-.45,GY[i]]];
const CASES={old:'notification-group（有 Offset）',fresh:'新 group.id',expired:'Offset 已被清理',copy:'新 group.id + 先设好 Offset'};
const GN={old:'notification-group',fresh:'notification-v2',expired:'notification-group',copy:'notification-v2'};
function decide(s){const cm=s.cs==='old'?600:s.cs==='expired'?100:s.cs==='copy'?600:null;
 if(cm!==null&&cm>=LS&&cm<=s.leo)return{cm,start:cm,why:'valid'};
 const why=cm===null?'none':'out';if(s.reset==='none')return{cm,start:null,why,err:why==='none'?'NoOffsetForPartitionException':'OffsetOutOfRangeException'};
 return{cm,start:s.reset==='earliest'?LS:s.leo,why}}
const fresh=prev=>{const s={t:0,leo:1000,cs:prev?prev.cs:'fresh',reset:prev?prev.reset:'latest',old:600,v2:null,deployAt:-999,skipFrom:0,skipTo:0,acc:0};
 if(!A){const d=decide(s);s.d=d;s.c=d.start;s.skipFrom=d.start===null?0:Math.max(LS,d.cm!==null&&d.cm>=LS?d.cm:LS);s.skipTo=d.start===null?0:d.start}return s};
const fmt=v=>Math.round(v).toLocaleString();
return{title:A?'改了 group.id，积压的通知全跳过了':'Consumer 启动时从哪里开始读',width:A?840:880,height:A?450:450,origin:[260,A?60:70],pathZ:4,ground:{gx:[-.3,CX+1],gy:[A?1.2:-.2,A?5.1:4.4]},
platforms:[{x:[.2,1.8],y:[PY-.8,PY+.8]},{x:[LX-.12,LEND+.12],y:[PY-.38,PY+.38]},...GY.map((g,i)=>({x:[CX-.45,CX+.45],y:[g-.45,g+.45],layer:A&&i===1?'v2':undefined})),...(A?[]:[{x:[CX-.45,CX+.45],y:[SY-.4,SY+.4]}])],
texts:[{at:[.2,PY+1.25],text:'Producer'},{at:[LX-.1,PY+.85],text:'order-events · Partition 0（格子下面是 Offset）'}],
logs:[{id:'p0',from:[LX,PY],n:NC,cell:CELL,label:false,name:'Partition 0',msgSize:CELL*.34,msgH:12,numOff:.32}],
paths:[{pts:[[PX+PS/2,PY],[LX-.2,PY]],arrow:true},...GY.map((g,i)=>({pts:A?readR(i):[[LEND+.12,PY],[CX-.6,PY]],arrow:true,layer:A&&i===1?'v2':undefined})),...(A?[]:[{pts:[[CX,PY-.5],[CX,SY+.5]],arrow:true,kind:'hb'}])],
nodes:[{id:'prod',at:[PX,PY],size:PS,h:44,label:'Order Service',state:'prod'},
 ...(A?[{id:'old',at:[CX,GY[0]],size:.7,h:30,label:'notification-group',badge:true,state:'normal'},{id:'v2',at:[CX,GY[1]],size:.7,h:30,label:'notification-v2',badge:true,state:'ana',layer:'v2'}]
 :[{id:'cons',at:[CX,PY],size:.7,h:30,label:'Consumer',badge:true,state:'normal'},{id:'store',at:[CX,SY],size:.6,h:26,label:'__consumer_offsets',badge:true,state:'inv',rack:true}])],
note:A?'Committed Offset 是按 <b>group.id</b> 保存的（第 3、4 课）。换了 group.id，在 Kafka 眼里就是一个全新的组，老组的位置不会自动继承。Java Consumer 的 <code>auto.offset.reset</code> 默认是 <code>latest</code>。':'左端灰色格子已被保留规则清理（第 9 课），能读的范围是 [log start 200, LEO)。<code>auto.offset.reset</code> 是 Consumer 端配置，只在「找不到有效的 Committed Offset」时才起作用。',
init:prev=>fresh(prev),
tick(s,api){s.t++;if(s.t%2===0){s.leo++;if(s.t%6===0)api.emit([[PX+PS/2,PY],[LX+(NC-.5)*CELL,PY]],'prod')}
 if(A){const deployed=s.v2!==null;if(!deployed&&s.old<s.leo){s.old+=.75;if(s.t%6===0)api.emit(readR(0),'noti')}
  if(deployed&&s.v2<s.leo){s.v2=Math.min(s.leo,s.v2+1.5);if(s.t%6===3)api.emit(readR(1),'ana')}}
 else if(s.c!==null&&s.c<s.leo){s.c=Math.min(s.leo,s.c+2.5);if(s.t%5===0)api.emit([[LEND+.12,PY],[CX-.5,PY]],'noti')}},
view(s,api){const top=Math.ceil(s.leo/STEP)*STEP,base=Math.max(0,top-NC*STEP),pos=o=>Math.max(0,Math.min(NC,(o-base)/STEP)),cells=[],nums=[];
 for(let i=0;i<NC;i++){const lo=base+i*STEP,mid=Math.min(lo+STEP/2,s.leo-1);nums.push(i%2===0?String(lo):'');let k;
  if(A){if(s.v2===null)k=mid<s.old?'done':'lag';else k=mid<s.skipFrom?'done':mid<s.skipTo?'dup':mid<s.v2?'done':'lag'}
  else{if(mid<LS)k='miss';else if(s.c===null)k=s.d.cm!==null&&mid<s.d.cm?'done':'lag';else if(mid<s.skipFrom)k='done';else if(mid<s.skipTo)k=s.d.why==='valid'?'done':'dup';else k=mid<s.c?'done':'lag'}
  cells.push(k)}
 api.log('p0',cells,nums);
 const mk=[];
 if(A){const dep=s.v2!==null;mk.push({pos:pos(s.old),cls:dep?'mk-pause':'mk-noti',text:`notification-group ${Math.floor(s.old)}`,h:86});
  if(dep)mk.push({pos:pos(s.v2),cls:'mk-ana',text:`notification-v2 ${Math.floor(s.v2)}`,h:58});
  mk.push({pos:pos(s.leo),cls:'mk-leo',text:`LEO ${s.leo}`,h:100,right:true});
  api.logMarks('p0',mk);api.layer('v2',dep?'on':'off');
  api.node('old',dep?'idle':'normal');api.badge('old',dep?`已下线 · Lag ${fmt(s.leo-s.old)}`:`Lag ${fmt(s.leo-s.old)}`,dep?'red':'orange');
  if(dep){api.badge('v2',`Lag ${fmt(s.leo-s.v2)}`,'green')}
  const skipped=s.skipTo-s.skipFrom,recent=s.t-s.deployAt<170;let N;
  if(!dep)N=['① 大促过后，还有积压','orange',`第 15 课的大促过去了，notification-group 还有约 ${fmt(s.leo-s.old)} 条积压正在慢慢追（真实环境里可能是几十万条）。这时团队发布新版本，顺手把 group.id 从 notification-group 改成了 notification-v2。点「部署新版本」。`];
  else if(recent)N=['② 新组从末尾开始，积压全被跳过','red',`notification-v2 是第一次出现，Kafka 里没有它的 Committed Offset。找不到位置，Consumer 就按 auto.offset.reset 决定从哪里读，Java 默认是 latest：直接从 LEO ${s.skipTo} 开始。中间 ${fmt(skipped)} 条订单（红色）的通知永远不会发出，而且没有任何报错。`];
  else N=['③ 问题被掩盖了','red',`新组的 Lag 接近 0，看起来一切正常。老组的 Offset 还留在 Kafka 里：用 kafka-consumer-groups.sh --describe 能看到 notification-group 没有成员，Lag 越来越大（${fmt(s.leo-s.old)}），告警可能响个不停，也可能被当成「旧组，不用管」；直到停用超过 offsets.retention.minutes（默认 7 天）才被清理。被跳过的 ${fmt(skipped)} 条，只能靠重置 Offset 补回来（第 9 课），前提是还在保留期内。`];
  api.narrate(N[0],N[2],N[1]);
  api.metrics(`<div class="iso-kv c4">${kv('LEO',s.leo)}${kv('notification-group 已提交',Math.floor(s.old),dep?'warn':'')}${kv('notification-v2 起点',dep?s.skipTo:'—（还没部署）')}${kv('被跳过的通知',dep?fmt(skipped):0,dep?'warn':'')}</div>`);return}
 const d=s.d,gn=GN[s.cs];
 if(d.cm!==null)mk.push({pos:pos(d.cm),cls:d.why==='out'?'mk-pause':'mk-noti',text:d.why==='out'?`已提交 ${d.cm}（已被清理）`:`已提交 ${d.cm}`,h:70,right:true});
 mk.push({pos:pos(LS),cls:'mk-pos',text:'log start 200',h:20,right:d.why==='out'});
 if(s.c!==null)mk.push({pos:pos(s.c),cls:'mk-ana',text:`读到 ${Math.floor(s.c)}`,h:44,right:true});
 mk.push({pos:pos(s.leo),cls:'mk-leo',text:`LEO ${s.leo}`,h:96,right:true});
 api.logMarks('p0',mk);
 api.node('cons',d.err?'down':'normal');api.badge('cons',d.err?d.err:`从 ${d.start} 开始`,d.err?'red':d.why==='valid'?'green':d.start===LS?'orange':'red');
 api.badge('store',d.cm===null?`${gn}：没有记录`:`${gn}：${d.cm}`,d.cm===null||d.why==='out'?'orange':'green');
 const skipped=d.start===null?0:d.why!=='valid'&&d.start>LS?d.start-(d.cm!==null&&d.why!=='out'?d.cm:LS):0,lost=d.why==='out'?LS-d.cm:0,re=d.start===LS&&d.why==='none'?d.start:0;
 let N;
 if(s.cs==='old')N=['① 有有效的 Committed Offset：reset 配置不起作用','green',`notification-group 在 __consumer_offsets 里有记录 600，而且 600 还在 [log start, LEO] 范围内，于是从 600 接着读。auto.offset.reset 改成 earliest、latest 还是 none，结果都一样：它只是「找不到有效位置时」的兜底规则。`];
 else if(s.cs==='copy')N=['④ 推荐的迁移做法：先把位置设好','green',`非改 group.id 不可时：先停掉老组，在新组第一次启动前执行 kafka-consumer-groups.sh --group notification-v2 --reset-offsets --to-offset 600 --execute，给它写好位置。新组启动时就有了有效 Offset，从 600 接着读，不跳过、也不重发。多个 Partition 要逐个对齐（可以用 --export 导出老组位置，再用 --from-file 导入）。`];
 else{const pre=s.cs==='fresh'?`${gn} 是新的 group.id，__consumer_offsets 里没有它的记录。`:`notification-group 提交的位置 100 已经被保留规则清理（第 9 课），读取时会遇到 OffsetOutOfRange，中间 ${lost} 条已经没了。`;
  N=s.reset==='earliest'?[s.cs==='fresh'?'② earliest：从最早还在的位置读':'③ earliest：跳到 log start',s.cs==='fresh'?'orange':'red',`${pre}按 earliest 从 log start 200 开始，把保留期内的历史${s.cs==='fresh'?`全部读一遍（${fmt(s.leo-LS)} 条）。新服务补历史适合这样做（第 9 课）；可对通知服务来说，意味着把老组已经发过的 400 条通知再发一遍，除非处理逻辑幂等（第 5 课）。`:'从头接着读。被清理的那段补不回来，而且不报错。'}`]
  :s.reset==='latest'?[s.cs==='fresh'?'② latest：从末尾开始，跳过历史':'③ latest：跳到 LEO','red',`${pre}按 latest 直接从 LEO ${d.start} 开始，之前的 ${fmt(skipped)} 条（红色）全部跳过，不报错。这就是第一张图的事故。`]
  :[s.cs==='fresh'?'② none：找不到位置就报错':'③ none：位置失效就报错','orange',`${pre}auto.offset.reset=none 不替你猜，直接抛 ${d.err}，Consumer 启动失败。适合关键业务：宁可报错告警，也不要静默跳过或重发；由人确认从哪里开始，再用 --reset-offsets 设好位置。`]}
 api.narrate(N[0],N[2],N[1]);
 const L1=`<span class="cmd"># Consumer 启动：group.id = ${gn}，auto.offset.reset = ${s.reset}</span>`,
 L2=`1. 查 __consumer_offsets：有没有 ${gn} 在 P0 的 Committed Offset？ → ${d.cm===null?'没有':d.cm}`,
 L3=d.cm===null?'':`2. ${d.cm} 还在 [log start ${LS}, LEO ${s.leo}] 范围内吗？ → ${d.why==='valid'?'在':'不在（OffsetOutOfRange）'}`,
 L4=d.why==='valid'?`→ 从 ${d.cm} 接着读（auto.offset.reset 不起作用）`:d.err?`→ auto.offset.reset = none：抛出 ${d.err}`:`→ auto.offset.reset = ${s.reset}：从 ${d.start} 开始${s.reset==='latest'?`（跳过 ${fmt(skipped)} 条）`:''}`;
 api.metrics(`<div class="iso-term">${[L1,L2,L3,L4].filter(Boolean).join('\n')}</div><div class="iso-kv c4" style="margin-top:10px">${kv('起点',d.start===null?'启动失败':d.start,d.err?'warn':'')}${kv('被跳过',fmt(skipped),skipped?'warn':'')}${kv('重新处理（老组已处理过）',s.cs==='fresh'&&s.reset==='earliest'?400:0,s.cs==='fresh'&&s.reset==='earliest'?'hl':'')}${kv('已被清理、补不回来',lost,lost?'warn':'')}</div>`)},
toolbar:s=>A?`<button type="button" class="iso-btn danger" data-act="deploy" ${s.v2!==null?'disabled':''}>${s.v2!==null?'✓ 已部署（group.id = notification-v2）':'🚀 部署新版本（group.id 改成 notification-v2）'}</button>`
 :`<span class="iso-seg" role="group" aria-label="启动的组">${Object.keys(CASES).map(k=>`<button type="button" data-act="cs" data-v="${k}" aria-pressed="${s.cs===k}">${CASES[k]}</button>`).join('')}</span><span class="iso-seg" role="group" aria-label="auto.offset.reset">${['earliest','latest','none'].map(v=>`<button type="button" data-act="reset" data-v="${v}" aria-pressed="${s.reset===v}">${v}</button>`).join('')}</span>`,
actions:{deploy:s=>{if(s.v2!==null)return;s.skipFrom=Math.floor(s.old);s.skipTo=s.leo;s.v2=s.leo;s.deployAt=s.t},
 cs:(s,api,d)=>d.v===s.cs?undefined:fresh({cs:d.v,reset:s.reset}),reset:(s,api,d)=>d.v===s.reset?undefined:fresh({cs:s.cs,reset:d.v})},
card(id,s){if(id==='prod')return{title:'Order Service',ok:true,rows:[['LEO',s.leo]]};
 if(id==='p0')return{title:'Partition 0',ok:true,rows:[['log start',A?0:LS],['LEO',s.leo]]};
 if(id==='old')return{title:'notification-group',ok:s.v2===null,rows:[['成员',s.v2===null?'3 个实例':'无（已下线）'],['Committed Offset',Math.floor(s.old)],['Lag',fmt(s.leo-s.old)]]};
 if(id==='v2')return{title:'notification-v2',ok:true,rows:[['第一次启动时','没有 Committed Offset'],['auto.offset.reset','latest（默认）'],['起点',s.skipTo]]};
 if(id==='store')return{title:'__consumer_offsets',ok:true,rows:[['作用','按 group.id + Topic + Partition 保存 Committed Offset'],[GN[s.cs],s.d.cm===null?'没有记录':s.d.cm]]};
 return{title:'Notification（Consumer）',ok:!s.d.err,rows:[['group.id',GN[s.cs]],['auto.offset.reset',s.reset],['起点',s.d.start===null?'启动失败':s.d.start]]}}
}}

lesson({
 "n": 1,
 "title": "group.id 与 auto.offset.reset：Consumer 从哪里开始读",
 "topics": "group.id · __consumer_offsets · earliest / latest / none",
 "problem": "大促过后 notification-group 还有积压，新版本上线时顺手把 group.id 改成了 notification-v2。新组没有 Committed Offset，按默认的 latest 从末尾开始读，积压的几十万条通知全部被跳过，没有任何报错。",
 "original": "在第一张图里点「部署新版本」：新组的小旗直接出现在 LEO，中间的格子变红。新组的 Lag 接近 0，看起来一切正常；老组没有成员，Lag 却一直涨。",
 "solution": "Consumer 启动时，先查 __consumer_offsets 里这个 group.id 的 Committed Offset：有记录、而且还在 [log start, LEO] 范围内，就从那里接着读；找不到有效位置时，才按 auto.offset.reset 决定：earliest 从 log start 开始，latest 从 LEO 开始，none 直接报错。非改 group.id 不可时，先用 --reset-offsets 给新组设好位置。",
 "failure": "earliest 会把保留期内的历史全部再处理一遍，处理逻辑必须幂等；latest 会静默跳过历史；none 会让 Consumer 启动失败，需要有人介入。已有有效 Offset 的组，改 auto.offset.reset 不会改变起点，要调整位置得用 --reset-offsets 或 seek()。",
 "key": "改 auto.offset.reset 不会覆盖已有的有效 Group Offset；换 group.id 等于从零开始。",
  "quiz": [{question:"老组 notification-group 的 Committed Offset 是 600，LEO 是 1000。新部署的 notification-v2 用了新的 group.id，配置 auto.offset.reset=latest。它第一次启动从哪里读？",options:[
  "从 600 开始，自动继承老组的位置",
  "从最早还在的消息开始，读全部历史",
  "从 1000 开始，600–999 这 400 条被跳过",
  "启动失败，因为找不到 Offset"
 ],answer:2,explain:"Offset 按 group.id 保存，新组没有记录，只能按 auto.offset.reset 决定：latest 从 LEO 开始。从最早开始是 earliest，启动失败是 none。要继承老组的位置，得先用 --reset-offsets 给新组设好。"},
  {question:"notification-group 已经正常运行了半年，有有效的 Committed Offset。运维把它的 auto.offset.reset 从 latest 改成 earliest 后重启，它会从哪里开始读？",options:["从最早还在的消息开始，把历史重读一遍","从 LEO 开始，只读新消息","从原来提交的位置接着读，这个改动不起作用","启动失败，因为配置变了"],answer:2,explain:"auto.offset.reset 只在找不到有效 Committed Offset 时才起作用。这个组有有效的位置，改成 earliest 对它没有影响；真要重读历史，得先停组，再用 --reset-offsets --to-earliest。"}],
 scenes:{problem:()=>lesson16Scene('A'),solution:()=>lesson16Scene('B')},
 review:{compareTitle:'三种取值在不同情况下的起点',comparePlain:true,
terms:[
{name:'group.id 是 Offset 的「身份」',tone:'kafka',tag:'位置跟着组走',what:'Committed Offset 存在 Kafka 内部的 <code>__consumer_offsets</code> Topic 里，按「group.id + Topic + Partition」保存。',points:['同一个 group.id：分工读、共用一份位置（第 3 课）。','换一个 group.id：Kafka 把它当成全新的组，老组的位置不会自动继承。','组里没有成员超过 <code>offsets.retention.minutes</code>（默认 7 天），它的位置也会被清理（第 9 课）。'],scene:'本课画面：第二张图上方的 __consumer_offsets。'},
{name:'auto.offset.reset',tone:'cons',tag:'找不到位置时的兜底',what:'Consumer 端配置，三个常用取值：',points:['<b>earliest：</b>从 log start（最早还在的消息）开始。','<b>latest：</b>从 LEO 开始，只读以后的新消息。Java Consumer 的默认值。','<b>none：</b>不猜，直接抛异常，让人来决定。','命令行 <code>kafka-console-consumer.sh</code> 加 <code>--from-beginning</code> 相当于 earliest；Kafka 4.0 起还可以用 <code>by_duration:PT1H</code> 这样的写法，从一段时间之前开始读。'],scene:'本课画面：第二张图右边的 earliest / latest / none。'},
{name:'什么时候才会用到它',tone:'part',tag:'只在没有有效位置时',what:'只有这几种情况：',points:['新的 group.id 第一次启动。','组的 Offset 过期被删了（offsets.retention.minutes）。','提交的位置已经被保留规则清理，读取时遇到 OffsetOutOfRange（第 9 课）。','已有有效 Offset 的组，改这个配置不会改变起点。要调整位置，先停掉组，再用 <code>kafka-consumer-groups.sh --reset-offsets</code>，或在代码里 <code>seek()</code>。'],scene:'本课画面：终端里的判断过程。'},
{name:'怎么选、怎么迁移',tone:'prod',tag:'别让它替你猜',what:'按业务对「漏」和「重」的容忍度来选：',points:['关键业务（订单、支付、通知）：用 none，或者上线前把位置设好，再启动。','新服务补历史：earliest，处理逻辑要幂等（第 5 课）。','只关心实时数据（比如实时大盘）：latest 可以接受。','尽量不要改 group.id。非改不可：先停掉老组，用 <code>--reset-offsets --to-offset</code>（多个 Partition 用 <code>--export</code> / <code>--from-file</code>）给新组设好位置；上线后用 <code>--describe</code> 确认新组的起点。'],scene:'本课画面：「新 group.id + 先设好 Offset」。'}],
compare:{head:['情况','earliest','latest','none'],rows:[['有有效的 Committed Offset','从 Committed 接着读','从 Committed 接着读','从 Committed 接着读'],['新 group.id（没有记录）','从 log start 读全部历史，可能重复处理','从 LEO 开始，跳过全部历史','抛 NoOffsetForPartitionException'],['提交的位置已被清理','跳到 log start，被清理的已经没了','跳到 LEO，丢得更多','抛 OffsetOutOfRangeException']]},
key:'auto.offset.reset 只在找不到有效 Committed Offset 时才起作用，改它不会覆盖已有的 Group Offset。换 group.id 等于从零开始，迁移前先把位置设好。'}
});
