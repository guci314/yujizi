/* ==================================================================
   屏幕常亮 — 2026-09-29 验证通过
   ------------------------------------------------------------------
   解决:小米 Android 息屏后系统暂停音频,连续播放就此中断。
   真机验证(2026-10-03,小米 Android + Chrome):连续播放 + 定时 1 小时,
   息屏放置,音频不再中断。

   做法:播放期间申请 navigator.wakeLock('screen'),让屏幕不熄灭。
   这不是「对抗」息屏后的各种后果(音频焦点丢失、定时器节流、进程冻结),
   而是让「息屏」这个触发条件根本不发生 —— 一个 API 调用删掉整个故障面。

   ⚠️ 曾删掉的东西(别再加回来):
   早期版本常驻一条 Web Audio 静音导频(18kHz @ −58dB),想欺骗平台的
   「最近 30 秒发过声」豁免。实测证明它对本次故障无效,已移除。
   结论见 docs/播放器息屏播放-已验证版本.md

   载入顺序:本文件必须排在 musicplayer.js 之后(依赖 plog /
   pPlayIntent / musicPlayer)。放前面会 ReferenceError 且无任何报错冒头。
   ================================================================== */

// 屏幕常亮锁的状态。
var pWake = { lock: null, want: false, fails: 0, retryTimer: null };
var pWakePollTimer = null;

function pWakeReady() {
  return (typeof plog === 'function') && (typeof musicPlayer !== 'undefined')
    && (typeof pPlayIntent !== 'undefined');
}

/* ---------- 锁的申请与释放 ---------- */

function pWakeLockSync() {
  if (!pWakeReady()) return;
  var want = pPlayIntent && !musicPlayer.paused && pWake.fails < 3;

  if (!want) {
    // 确定不该亮屏:释放并复位 want,下次播放才会重新申请
    pWake.want = false;
    if (pWake.lock) {
      var l = pWake.lock; pWake.lock = null;
      try { l.release().catch(function () { }); } catch (e) { }
      plog('wakelock-off', '');
    }
    pWakeRetryStop();
    return;
  }

  pWake.want = true;

  if (!navigator.wakeLock || !navigator.wakeLock.request) {
    if (pWake.fails++ > 0) plog('wakelock-fail', 'no API');
    return;
  }

  // 已持有就直接返回;没有就立刻申请一次
  if (!pWake.lock) pWakeRequest();
  // 息屏期间页面不派发 visibilitychange,锁会被系统静默收回。
  // 用轮询复查,发现锁掉了就补申请。
  pWakeRetryStart();
}

function pWakeRequest() {
  navigator.wakeLock.request('screen').then(function (lock) {
    pWake.lock = lock;
    pWake.fails = 0;
    plog('wakelock-on', pWake.want ? '' : '迟到的锁');
    lock.addEventListener('release', function () { pWake.lock = null; });
  }).catch(function (e) {
    pWake.fails++;
    plog('wakelock-fail', e.name);
  });
}

function pWakeRetryStart() {
  if (pWake.retryTimer) return;
  pWake.retryTimer = setInterval(function () {
    if (!pWake.want || pWake.lock || !pWakeReady()) return;
    if (!pPlayIntent || musicPlayer.paused) return;
    if (pWake.fails >= 3) { pWakeRetryStop(); return; }
    pWakeRequest();
  }, 5000);
}

function pWakeRetryStop() {
  if (pWake.retryTimer) { clearInterval(pWake.retryTimer); pWake.retryTimer = null; }
}

// 页面重新可见时补申请(锁会在息屏/切后台后被系统释放)
document.addEventListener('visibilitychange', function () {
  if (!pWakeReady()) return;
  if (document.visibilityState === 'visible' && pWake.want && !pWake.lock) {
    plog('wakelock-reacquire', '');
    pWake.fails = 0;
    pWakeLockSync();
  }
});

/* ---------- 驱动:事件 + 轮询双路 ---------- */

// playing / pause 都同步。pause 必须也同步,否则停播后屏幕还亮着。
// musicPlayer 若还没建出来(载入顺序错了),安静退出。
if (typeof musicPlayer !== 'undefined') {
  musicPlayer.addEventListener('playing', function () { pWakeLockSync(); });
  musicPlayer.addEventListener('pause', function () { pWakeLockSync(); });

  // 关键补充:只有 playing/pause 事件是不够的。
  // 息屏期间系统会直接暂停,有时 playing 事件还没来得及派发就被冻结;
  // 而选曲后 pPlayIntent 已经为 true,但 audio 还在缓冲,迟迟不 playing。
  // 这时若只等 playing,want 永远是 false,长亮锁根本不会去申请。
  // 所以额外用低频轮询兜底:意图在 + 正在播 → 申请锁;都不在 → 释放。
  pWakePollTimer = setInterval(function () {
    if (!pWakeReady()) return;
    if (!pPlayIntent || musicPlayer.paused) { pWakeRetryStop(); return; }
    pWakeLockSync();
  }, 3000);
}

// 兜底:页面刚加载完可能已处于「续播中」(restoreMusic 只设 src 不自动播放,
// 但若浏览器恢复了会话播放,playing 可能早于本脚本绑定而错过一次)。
// 延迟一拍再同步一次,确保首次播放也能挂上锁。
setTimeout(function () { pWakeLockSync(); }, 1500);