/* ==================================================================
   息屏保活层 — 2026-09-29
   ------------------------------------------------------------------
   要解决的问题:Android(尤其小米/澎湃OS)息屏后,浏览器被系统当成
   「可丢弃的后台页面」冻结,JS 定时器被降到每分钟一次,连续播放的
   转场逻辑就此瘫痪 —— 表现为卡在下一首开头、时长 0 秒。

   为什么两个浏览器都一样:Chrome 和 Firefox 内核无关,却同样中招,
   说明拦截发生在 Android 系统层(后台管控/省电),不是各自的 JS 节流。

   关键机制(Chrome 官方 chrome88 定时器节流文档):
     豁免条件之一是「页面最近 30 秒内发过声」,原文附注
     「a silent audio track doesn't count」。
     也就是说 —— 只要播放器在转场瞬间处于完全静音,豁免立刻失效,
     定时器从每秒一次掉到每分钟一次。转场卡住恰恰就是静音状态,
     于是形成死锁:越卡越静音,越静音越被节流。
     小米社区有同类报告(音频在静音数秒后被断开,建议发射听不见的导频)。

   这里的做法:播放期间常驻一条极低电平的振荡器。它对人耳不可闻,
   但对系统来说是「有声音输出」,从而保住豁免资格,让 JS 定时器
   继续按秒级运行,转场逻辑得以存活。

   为什么不用 APK:原生 MediaSession 能真正免疫冻结,但要求用户改用
   App、且 1.48GB 音频仍要走网络流式拉取。这一层是纯 Web 增强,
   零安装成本,若它已足够就不必做原生。

   安全边界:
     · 音量 -60dB,远低于人耳阈值,不产生可听噪音
     · 只在「有播放意图且实际在播」时存在,停止即释放
     · 不经过扬声器输出路径之外的任何处理,不会污染下载的音频文件
     · 全程 try/catch 包裹:不支持 Web Audio 的老浏览器直接跳过,
       绝不影响原有播放功能
   ================================================================== */

var pKeepAlive = {
  ctx: null,          // AudioContext
  osc: null,          // 振荡器
  gain: null,         // 音量节点
  on: false,          // 当前是否在跑
  running: false,     // AudioContext 是否真的 running(suspended 就不算保活)
  failed: false       // 构造失败过就不再重试(避免反复报错)
};

// 屏幕常亮锁的状态。声明放在 pKeepAliveSync 之前:该函数会读它,
// 而 var 只提升为 undefined —— 后声明会导致首次调用抛 TypeError。
var pWake = { lock: null, want: false, fails: 0 };

// 人耳阈值约 -60dB 就几乎听不到;再低怕被系统当静音,稍高怕真出声。
// 取 -58dB:足以让系统判定「有声」,又确实听不见。
var KEEPALIVE_DB = -58;

function pKeepAliveBuild() {
  if (pKeepAlive.failed || pKeepAlive.on) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { pKeepAlive.failed = true; plog('keepalive-skip', 'no AudioContext'); return; }
  try {
    var ctx = new AC();
    // 18kHz:人耳最敏感的频段(1~4k)完全避开,即便漏出来也只是一声「嘶」,
    // 而且音量在 -58dB。选高频是为了让它在系统音量分析里明确算作信号。
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 18000;
    gain.gain.value = Math.pow(10, KEEPALIVE_DB / 20);   // ≈0.00126

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    pKeepAlive.ctx = ctx;
    pKeepAlive.osc = osc;
    pKeepAlive.gain = gain;
    pKeepAlive.on = true;

    // ⚠️ 关键:浏览器自动播放策略会让「非用户手势创建的 AudioContext」直接
    // 处于 suspended,此时振荡器根本不发声 —— 保活层等于没建,白忙一场。
    // 必须显式 resume,并确认真的变成 running。
    if (ctx.state === 'suspended') {
      var pr = ctx.resume();
      if (pr && pr.then) {
        pr.then(function () {
          pKeepAlive.running = (ctx.state === 'running');
          plog('keepalive-on', '18kHz @' + KEEPALIVE_DB + 'dB state=' + ctx.state);
        }).catch(function (e) {
          pKeepAlive.failed = true;
          pKeepAlive.on = false;
          plog('keepalive-fail', 'resume ' + e.name);
        });
        return;
      }
    }
    pKeepAlive.running = (ctx.state === 'running');
    plog('keepalive-on', '18kHz @' + KEEPALIVE_DB + 'dB state=' + ctx.state);
  } catch (e) {
    pKeepAlive.failed = true;
    plog('keepalive-fail', e.name + ':' + e.message);
  }
}

function pKeepAliveStop() {
  if (!pKeepAlive.on) return;
  try {
    // 淡出 100ms 再断开,避免突然中断产生「咔」声
    var g = pKeepAlive.gain, t = pKeepAlive.ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.00001, t + 0.1);
    } catch (e) { }
    var osc = pKeepAlive.osc, ctx = pKeepAlive.ctx;
    setTimeout(function () {
      try { osc.stop(); osc.disconnect(); g.disconnect(); ctx.close(); } catch (e) { }
    }, 160);
    plog('keepalive-off', '');
  } catch (e) { }
  pKeepAlive.on = false;
  pKeepAlive.ctx = pKeepAlive.osc = pKeepAlive.gain = null;
}

/* ==================================================================
   载入顺序(重要):本文件必须排在 musicplayer.js 之后。
   它依赖 musicplayer.js 提供的全局符号:plog / pPlayIntent / musicPlayer /
   playModeSelect / playNext。放前面会导致首次 plog() 就 ReferenceError,
   整层静默失效 —— 且不会有任何报错冒到控制台,极难察觉。
   为此下面所有入口都先确认 musicplayer.js 已就绪,未就绪则安静退出。
   ================================================================== */

function pKeepAliveReady() {
  return (typeof plog === 'function') && (typeof musicPlayer !== 'undefined')
    && (typeof pPlayIntent !== 'undefined');
}

// 按当前意图开关:在播才挂,停了就收
function pKeepAliveSync() {
  if (!pKeepAliveReady()) return;
  var want = pPlayIntent && !musicPlayer.paused;
  if (want && !pKeepAlive.on) pKeepAliveBuild();
  else if (!want && pKeepAlive.on) pKeepAliveStop();

  // 常亮锁的释放只认「确定不该在播」这一种情况。
  //
  // 2026-09-29 修复:原来这里无条件执行 `pWake.want = false` + 释放,
  // 但本函数也会被播放中触发(playing、以及页面加载后的 1.5 秒兜底同步)。
  // 于是 playing 事件里「pKeepAliveSync → pWakeLockSync」刚把锁拿到手,
  // 紧接着的兜底同步又把它清掉 —— 实测播放中 pWake.lock 恒为 false。
  if (want) return;
  pWake.want = false;
  if (pWake.lock) {
    var l = pWake.lock; pWake.lock = null;
    try { l.release().catch(function () { }); } catch (e) { }
    plog('wakelock-off', '');
  }
}

document.addEventListener('visibilitychange', function () {
  if (!pKeepAliveReady()) return;
  var v = document.visibilityState;
  // 从后台回来:如果 AudioContext 被系统挂起,这里试着唤醒
  if (v === 'visible' && pKeepAlive.ctx && pKeepAlive.ctx.state === 'suspended') {
    var pr = pKeepAlive.ctx.resume();
    if (pr && pr.then) pr.then(function () { plog('keepalive-resume', ''); })
      .catch(function () { plog('keepalive-resume-fail', ''); });
  }
});

// 播放/暂停的权威信号:playing 与 pause 都同步一次。
// musicPlayer 若还没被 musicplayer.js 建出来(载入顺序错了),安静退出,
// 不要让这一层把整个页面的脚本搞崩。
if (typeof musicPlayer !== 'undefined') {
  musicPlayer.addEventListener('playing', function () {
    pKeepAliveSync();
    pWakeLockSync();
  });
  musicPlayer.addEventListener('pause', function () {
    pKeepAliveSync();
  });
  musicPlayer.addEventListener('ended', function () {
    // 播完的那一瞬间音频元素是暂停态,但转场马上开始 —— 此时不能拆保活,
    // 否则恰好在转场窗口露出静音,豁免失效。
    // 所以 ended 不拆,交给 playNext 之后的 playing 再决定。
    if (pKeepAliveReady()) plog('keepalive-ended-keep', '');
  });
}

/* ---------- 屏幕常亮(辅助手段,可选) ---------- */
// pWake 的声明已在文件上方(pKeepAliveSync 之前)完成,这里不要重复 var,
// 否则第二次赋值会把刚拿到的 lock 冲掉,导致恒亮锁一建好就丢。

function pWakeLockSync() {
  if (!pKeepAliveReady()) return;
  var want = pPlayIntent && !musicPlayer.paused && pWake.fails < 3;
  if (want === pWake.want && (!want || pWake.lock)) return;
  pWake.want = want;
  if (!navigator.wakeLock || !navigator.wakeLock.request) {
    if (want) pWake.fails++;
    return;
  }
  try {
    if (want) {
      navigator.wakeLock.request('screen').then(function (lock) {
        pWake.lock = lock;
        pWake.fails = 0;
        plog('wakelock-on', '');
        lock.addEventListener('release', function () { pWake.lock = null; });
      }).catch(function (e) { pWake.fails++; plog('wakelock-fail', e.name); });
    } else if (pWake.lock) {
      var l = pWake.lock; pWake.lock = null;
      l.release().catch(function () { });
    }
  } catch (e) { pWake.fails++; }
}

// 页面重新可见时唤醒锁(锁会在息屏/切后台后被系统释放)
document.addEventListener('visibilitychange', function () {
  if (!pKeepAliveReady()) return;
  if (document.visibilityState === 'visible' && pWake.want && !pWake.lock) {
    plog('wakelock-reacquire', '');
    pWake.fails = 0;
    pWakeLockSync();
  }
});

// 兜底:页面刚加载完可能已处于「续播中」(restoreMusic 只设 src 不自动播放,
// 但若浏览器恢复了会话播放,playing 可能早于本脚本绑定而错过一次)。
// 延迟一拍再同步一次,确保首次播放也能挂上保活。
setTimeout(function () { pKeepAliveSync(); }, 1500);