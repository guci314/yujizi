// 获取 DOM 元素
const musicSelect = document.getElementById('music-select');
const musicPlayer = document.getElementById('music-player');
const musicDownload = document.getElementById('music-download');

// 初始化下拉框
function initSelect() {
  musicList.forEach((music, index) => {
    const option = document.createElement('option');
    option.value = index;
    option.textContent = music.name;
    musicSelect.appendChild(option);
  });
}

// 监听下拉框选择事件
musicSelect.addEventListener('change', (e) => {
  // 清除存储的音乐
  localStorage.removeItem(`${pageid}_currentMusic`);
  localStorage.removeItem(`${pageid}_currentTime`);
  const selectedIndex = e.target.value;
  plog('select-change', selectedIndex);
  if (ptrans) pDiscardTransition('user-select');
  if (selectedIndex) {
    const selectedMusic = musicList[selectedIndex];
    pPlayIntent = true;
    pErrHeal = 0;
    musicPlayer.src = selectedMusic.url;
    tryPlay('select');
    pSetSessionMeta(selectedMusic.name);
    pArmZeroDur(selectedIndex);   // 手动选曲同样可能撞上「时长 0」,一并纳入看门狗
    // 更新下载链接
    musicDownload.href = selectedMusic.url;
    musicDownload.download = selectedMusic.name;
    musicDownload.style.display = 'inline';
    // 存储当前播放的音乐
    localStorage.setItem(`${pageid}_currentMusic`, selectedIndex);
  } else {
    pPlayIntent = false;
    pExpectedPause = 'select-clear';
    musicPlayer.pause();
    musicPlayer.src = '';
    // 隐藏下载链接
    musicDownload.style.display = 'none';

  }
});


// 监听播放器的时间更新事件
musicPlayer.addEventListener('timeupdate', () => {
  // 转场成功判定:新曲目实际推进了播放头
  if (ptrans && !musicPlayer.paused && musicPlayer.currentTime > 0.5) {
    pCloseTransition(true);
  }
  localStorage.setItem(`${pageid}_currentTime`, musicPlayer.currentTime);
  // 「剩余」实时走字:定时关闭和播完停止都靠这里刷新,不用等 10 秒兜底 interval
  updateRemainTime();
  // 预加载下一首音乐, 仅在最后 5 分钟时预加载
  // (原 <link rel=preload as=audio> 方案 Safari/Chrome 都基本不执行,换成真实 fetch 暖缓存)
  if (musicPlayer.duration - musicPlayer.currentTime < 300) {
    let nextMusicIndex = parseInt(musicSelect.value) + 1;
    if (nextMusicIndex < musicList.length) {
      pPrefetch(musicList[nextMusicIndex].url);
    }
  }
});

// 监听播放器的 loadedmetadata 事件
musicPlayer.addEventListener('loadedmetadata', () => {
  const savedTime = localStorage.getItem(`${pageid}_currentTime`);
  if (savedTime) {
    musicPlayer.currentTime = parseFloat(savedTime);
  }
});

// 初始化
initSelect();

// 恢复上次播放的音乐和时间
function restoreMusic() {
  const currentMusic = localStorage.getItem(`${pageid}_currentMusic`);
  if (currentMusic !== null) {
    const selectedMusic = musicList[currentMusic];
    musicSelect.value = currentMusic;
    musicPlayer.src = selectedMusic.url;

    // 更新下载链接
    musicDownload.href = selectedMusic.url;
    musicDownload.download = selectedMusic.name;
    musicDownload.style.display = 'inline';
  }
}

// 播放下一首音乐
function playNext() {
  let nextIndex = parseInt(musicSelect.value) + 1;
  if (nextIndex >= musicList.length) {
    nextIndex = 0;
  }
  musicSelect.value = nextIndex;
  const nextMusic = musicList[nextIndex];
  pPlayIntent = true;
  pErrHeal = 0;
  musicPlayer.src = nextMusic.url;
  tryPlay('next');
  pSetSessionMeta(nextMusic.name);
  pArmZeroDur(nextIndex);   // 换曲后开「时长 0 看门狗」:10 秒后元数据还没到就重载

  // 更新下载链接
  musicDownload.href = nextMusic.url;
  musicDownload.download = nextMusic.name;

  // 存储当前播放的音乐
  localStorage.setItem(`${pageid}_currentMusic`, nextIndex);
  localStorage.setItem(`${pageid}_currentTime`, 0);

  // 如果是播放完停止模式，停止播放
  if (playModeSelect.value === 'stop-after') {
    stopAudio('stop-after');
    return;
  }

}

const playModeSelect = document.getElementById('play-mode');
let isLoopMode = false;

// 监听播放模式选择事件
playModeSelect.addEventListener('change', (e) => {
  isLoopMode = e.target.value === 'loop';
  plog('mode-change', e.target.value);
  // 立刻重算剩余:切到「播放完停止」应马上显示曲目剩余,切走则复位成「—」
  updateRemainTime();
});

// 监听播放器的 ended 事件
musicPlayer.addEventListener('ended', () => {
  plog('ended');
  if (isLoopMode) {
    musicPlayer.currentTime = 0;
    pPlayIntent = true;
    tryPlay('loop');
  } else {
    // 连续播放:开一个转场,后续靠 timeupdate/看门狗裁定成败
    if (playModeSelect.value !== 'stop-after') {
      var pFrom = parseInt(musicSelect.value);
      var pTo = (pFrom + 1 >= musicList.length) ? 0 : pFrom + 1;
      pOpenTransition(pFrom, pTo);
    }
    playNext();
  }
});


// 恢复音乐
restoreMusic();

var stopAudioTimeOut;
var theTime;

setInterval(() => updateRemainTime(), 10000);

// 更新「剩余」显示 —— 剩余 = 距离本次自动停止还有多久。
// 停止源有两个,取先到的那个:
//   ① 定时关闭(myselect)         → 停止点 = theTime
//   ② 播完停止(play-mode=stop-after) → 停止点 = 当前曲目末尾
// 2026-09-27 修:原来只认 ①。选「播放完停止」时 theTime 恒为 null,
// 于是 #remainTime 永远挂着初始的「—」,用户看不出还剩多久会停。
function updateRemainTime() {
  var remainMs = null;   // 距停止还有多少毫秒;null = 当前没有在倒计时的事
  // ① 定时关闭
  if (theTime) {
    var x = theTime - new Date();
    if (x < 0) x = 0;
    remainMs = x;
    // 兜底:后台节流导致 setTimeout 没按时触发,由本函数补刀
    if (x <= 0) {
      window.clearTimeout(stopAudioTimeOut);
      stopAudio('timer-sweep');
    }
  }
  // ② 播完停止。只在「确实在播」时算 —— 暂停/已停之后曲目不再倒计时,
  //    此时显示「—」比冻结一个数字更诚实。
  //    (duration 为 NaN/0 时是元数据还没到,先不显示,loadedmetadata 后会接上)
  if (playModeSelect && playModeSelect.value === 'stop-after'
    && !musicPlayer.paused && !musicPlayer.ended
    && isFinite(musicPlayer.duration) && musicPlayer.duration > 0) {
    var trackMs = (musicPlayer.duration - musicPlayer.currentTime) * 1000;
    if (trackMs < 0) trackMs = 0;
    remainMs = (remainMs === null) ? trackMs : Math.min(remainMs, trackMs);
  }
  var remainEl = document.getElementById("remainTime");
  if (remainEl) {
    if (remainMs === null) {
      remainEl.innerText = '—';
    } else {
      var min = Math.floor(remainMs / 60000);
      var sec = Math.floor((remainMs - min * 60000) / 1000);
      remainEl.innerText = min + "分钟" + sec + "秒";
    }
  }
  pWatchdog();
}

//停止播放
function stopAudio(reason) {
  reason = reason || 'unknown';
  var pRemain = theTime ? Math.round((theTime - new Date()) / 1000) : null;
  plog('stop-audio', reason + (pRemain !== null ? ' 剩余' + pRemain + 's' : ''));
  // 定时器提前 60 秒以上触发 = 定时异常,单独计数
  if (reason === 'timer' && pRemain !== null && pRemain > 60) {
    pstats.earlyTimer++;
    psave();
  }
  // 停止是终态:撤销播放意图,取消一切自愈重试
  pPlayIntent = false;
  window.clearTimeout(pRetry.timer);
  pRetry.deadline = 0;
  window.clearTimeout(pZeroDur.timer);   // 定时到点停播,不该再被「时长 0」看门狗复活
  pZeroDur.idx = -1;
  if (ptrans) pDiscardTransition('stopped-by-' + reason);
  pExpectedPause = reason;
  musicPlayer.pause();
  theTime = null
  document.getElementById("myselect").value = -1;
  updateRemainTime();   // 停止即无倒计时,把「剩余」复位成「—」,别挂着旧数字
};

//date 加法的扩展函数
Date.dateAdd = function (currentDate, value, timeUnit) {

  timeUnit = timeUnit.toLowerCase();
  var multiplyBy = {
    w: 604800000,
    d: 86400000,
    h: 3600000,
    m: 60000,
    s: 1000
  };
  var updatedDate = new Date(currentDate.getTime() + multiplyBy[timeUnit] * value);

  return updatedDate;
};

//定时下拉框的响应函数
function timingChange() {
  window.clearTimeout(stopAudioTimeOut);
  var t = parseInt(document.getElementById("myselect").value);
  if (t != -1) {
    stopAudioTimeOut = window.setTimeout(function () { stopAudio('timer'); }, t);
    var d = new Date();
    theTime = Date.dateAdd(d, t / 1000, "s");
    plog('timer-set', (t / 60000) + 'min');
  } else {
    theTime = null;
    plog('timer-set', 'off');
  }
}


document.getElementById("myselect").onchange = timingChange;

//后退三十秒
function back30sec() {
  if (musicPlayer.currentTime > 0 && !musicPlayer.paused && !musicPlayer.ended && musicPlayer.readyState > 2) {
    musicPlayer.currentTime = musicPlayer.currentTime - 30
  }
};

//前进三十秒
function forward30sec() {
  if (musicPlayer.currentTime > 0 && !musicPlayer.paused && !musicPlayer.ended && musicPlayer.readyState > 2) {
    musicPlayer.currentTime = musicPlayer.currentTime + 30
  }
}

/* ==================================================================
   测量 + 自愈层 — 2026-06-13
   修复目标:连续播放+定时关闭时,切到下一首在手机上(尤其锁屏)
   静默停止。手段:
   ① play() 拒绝不再静默 → 重试阶梯(0.6s/2s/5s/10s/20s/30s)
   ② 真实 fetch 预取下一首,消掉转场时的网络间隙
   ③ 解锁屏幕时若仍在播放意图内且 10 分钟内失败过 → 自动续播
   ④ 看门狗:转场卡死 45 秒 → 记失败并重载 src 自救一次
   ⑤ 定时器后台漏触发 → 10 秒 interval 兜底补刀
   ⑥ MediaSession:锁屏面板可控,前进/后退映射 ±30 秒
   黑匣子照旧记录一切(localStorage,页面加 ?debug 可看面板),
   ?fast=N 复现台保留,便于日后诊断。
   ================================================================== */

var PQS = new URLSearchParams(location.search);
var PFAST = PQS.has('fast') ? (parseInt(PQS.get('fast')) || 20) : 0;
var PKEY_LOG = pageid + '_plog';
var PKEY_STATS = pageid + '_pstats';
var PKEY_TRANS = pageid + '_ptrans';

var plogBuf = [];
var pstats = { trans: 0, ok: 0, fail: 0, earlyTimer: 0, oddPause: 0, zeroDur: 0, reasons: {} };
var ptrans = null;          // 进行中的转场 {start, from, to}
var plastErr = '';          // 最近一次媒体/play() 错误
var pExpectedPause = '';    // 预期内 pause 的原因(stopAudio/清空选择)
var pFastSeeked = false;
var pPlayIntent = false;    // 用户意图:此刻应当在播放
var pPlayId = 0;            // play() 尝试序号,用于忽略被换曲作废的旧拒绝
var pRetry = { timer: null, count: 0, deadline: 0 };
var pFailedAt = 0;          // 最近一次 play() 失败时刻(解锁续播窗口用)
var pHealDone = false;      // 本次转场是否已做过看门狗自救
var pErrHeal = 0;           // 当前曲目媒体错误自救次数
var pPrefetched = {};
// 「时长 0」看门狗的状态。声明放在 stopAudio() 之前:var 会提升但值是 undefined,
// 若 stopAudio() 在下面 pZeroDur 初始化之前被调用,`pZeroDur.timer` 会抛
// TypeError 而打断 stopAudio 本身。提前声明让 stopAudio 任何时候都安全。
var pZeroDur = { timer: null, idx: -1, at: 0 };

try { plogBuf = JSON.parse(localStorage.getItem(PKEY_LOG)) || []; } catch (e) { }
try {
  var pSaved = JSON.parse(localStorage.getItem(PKEY_STATS));
  if (pSaved) pstats = Object.assign(pstats, pSaved);
} catch (e) { }

function plog(ev, detail) {
  try {
    plogBuf.push({
      ts: Date.now(),
      e: ev,
      d: String(detail || ''),
      vis: document.visibilityState,
      idx: musicSelect.value,
      ct: Math.round(musicPlayer.currentTime * 10) / 10,
      rs: musicPlayer.readyState,
      paused: musicPlayer.paused
    });
    if (plogBuf.length > 600) plogBuf = plogBuf.slice(-500);
    localStorage.setItem(PKEY_LOG, JSON.stringify(plogBuf));
  } catch (e) { }
}

function psave() {
  try {
    localStorage.setItem(PKEY_STATS, JSON.stringify(pstats));
    if (ptrans) localStorage.setItem(PKEY_TRANS, JSON.stringify(ptrans));
    else localStorage.removeItem(PKEY_TRANS);
  } catch (e) { }
}

function pOpenTransition(from, to) {
  if (ptrans) pCloseTransition(false, 'superseded');
  ptrans = { start: Date.now(), from: from, to: to };
  pstats.trans++;
  plastErr = '';
  pHealDone = false;
  plog('trans-open', from + '->' + to);
  psave();
}

function pCloseTransition(ok, reason) {
  if (!ptrans) return;
  var dur = Date.now() - ptrans.start;
  if (ok) {
    pstats.ok++;
    plog('trans-ok', ptrans.from + '->' + ptrans.to + ' ' + dur + 'ms');
  } else {
    pstats.fail++;
    var r = reason || 'unknown';
    pstats.reasons[r] = (pstats.reasons[r] || 0) + 1;
    plog('trans-fail', ptrans.from + '->' + ptrans.to + ' ' + r + ' ' + dur + 'ms');
  }
  ptrans = null;
  psave();
}

// 用户主动换曲/停止时,进行中的转场不算成败,撤销计数
function pDiscardTransition(reason) {
  if (!ptrans) return;
  pstats.trans--;
  plog('trans-discard', reason);
  ptrans = null;
  psave();
}

// play() 包装:拒绝必留错误名,且按阶梯重试而非静默放弃
function tryPlay(ctx) {
  plog('play-call', ctx);
  var myId = ++pPlayId;
  var p = musicPlayer.play();
  if (p && p.then) {
    p.then(function () { plog('play-resolved', ctx); })
      .catch(function (e) {
        if (myId !== pPlayId) { plog('play-rejected-stale', ctx + ' ' + e.name); return; }
        plastErr = e.name;
        pFailedAt = Date.now();
        plog('play-rejected', ctx + ' ' + e.name + ':' + e.message);
        pScheduleRetry(ctx);
      });
  }
  return p;
}

function pScheduleRetry(ctx) {
  if (!pPlayIntent) return;
  if (!pRetry.deadline) pRetry.deadline = Date.now() + 90000;
  if (Date.now() > pRetry.deadline || pRetry.count >= 6) {
    plog('retry-giveup', ctx + ' count=' + pRetry.count);
    return;
  }
  pRetry.count++;
  var delay = [600, 2000, 5000, 10000, 20000, 30000][pRetry.count - 1];
  window.clearTimeout(pRetry.timer);
  pRetry.timer = setTimeout(function () {
    if (pPlayIntent && musicPlayer.paused) tryPlay('retry' + pRetry.count + ':' + ctx);
  }, delay);
}

// 预取下一首:2026-09-29 修
// 原实现用 fetch() 把整个文件读完(实测 66~88MB 的 mp3 = 抢走约 90MB 带宽),
// 真正的 <audio> element 拿不到首字节,于是转场后冻在开头(readyState 0 / duration NaN),
// 界面时长显示 0 秒 —— 正是「连续播放卡在下个音频开始处 + 时长 0 秒」的原因。
// A/B(生产实测):预取照常 平均出声 14331ms、42/130 采样点时长读不出;
// 掐断预取 平均 334ms、2/130。同样的转场次数,成败差别只在这一条。
//
// 现在的做法:只预取「头部一小段」暖缓存(range 请求),不与播放器抢带宽;
// 换曲真正常见的慢点(m4a 索引表在文件尾)交给播放器自己 range 拉,那本来就是它该做的。
// 保留 Range 支持的探测,服务端若不支持就整个放弃预取(退化成 2026-09-27 之前的行为)。
var P_PREFETCH_MAX = 512 * 1024;   // 预取上限 512KB:m4a/moov-在头部时够用,又不会抢带宽
function pPrefetch(url) {
  if (pPrefetched[url]) return;
  pPrefetched[url] = true;
  plog('prefetch-start', decodeURIComponent(url).split('/').pop().slice(0, 30));
  fetch(url, { headers: { Range: 'bytes=0-' + (P_PREFETCH_MAX - 1) } })
    .then(function (res) {
      // 206 = 服务端认了 range,只回一段 → 正是要的
      // 200 = 服务端无视 range,把整个 88MB 灌回来 → 立刻 abort,不能要
      if (res.status !== 206) {
        plog('prefetch-skip', 'http ' + res.status + '(no range)');
        pPrefetched[url] = false;
        if (res.body) res.body.cancel();
        return;
      }
      plog('prefetch-done', res.headers.get('content-range') || '');
      if (res.body) res.body.cancel();   // 数据已在缓存里,不必在 JS 里过一遍
    }).catch(function (e) {
      plog('prefetch-fail', e.name);
      pPrefetched[url] = false;
    });
}

// ── 「时长 0」看门狗 ──────────────────────────────────────────────
// 2026-09-29 加。症状:连续播放切换到下一首后卡在开头不动,界面时长显示 0 秒。
//
// 为什么原来的 pWatchdog() 治不了这个:
//   它只在 ptrans 存在、且超过 45 秒、且 musicPlayer.paused 时才自救。
//   而这个故障的实际状态是 paused=false(play() 已 resolve)+ readyState 0,
//   于是只走 else 分支记一笔 'stuck-loading',ptrans 被关闭成 null ——
//   之后 ptrans 条件不再成立,再没有任何代码会回头看它。这就是漏网的原因。
//
// 这里不看 ptrans、不看 paused,只看「我刚换到这一首,10 秒后元数据还没到」。
// 条件从严,避免误伤:
//   ① 必须连续播放(loop/stop-after 不适用)
//   ② 必须仍在播放意图内且定时未到(用户主动停过就绝不复活)
//   ③ 必须仍是同一首 —— 换曲会被下一次 pArmZeroDur 覆盖,旧的定时器失效
//   ④ 播放头必须没推进:动过就说明真在播,元数据只是晚到而已
function pArmZeroDur(idx) {
  window.clearTimeout(pZeroDur.timer);
  // ⚠️ 必须归一成数字。下拉框 change 事件里 selectedIndex 是字符串("1"),
  // 而下面 pCheckZeroDur 拿它跟 parseInt(musicSelect.value)(数字)比 !==,
  // 类型不一致会让守卫永远成立 → 自救一次都不触发(测试实测日志为空)。
  pZeroDur.idx = parseInt(idx, 10);
  pZeroDur.at = Date.now();
  pZeroDur.timer = setTimeout(function () { pCheckZeroDur(); }, 10000);
}
function pCheckZeroDur() {
  // 已被后续换曲覆盖 → 本次任务作废
  if (pZeroDur.idx !== parseInt(musicSelect.value)) return;
  // 元数据到了 → 没事,不解重载
  if (isFinite(musicPlayer.duration) && musicPlayer.duration > 0) return;
  // 播放头在推进 → 只是在慢加载,别去打断它
  if (musicPlayer.currentTime > 0.5) return;
  // 用户意图之外的播放(主动暂停/定时已到/切了别的曲子)→ 尊重现状
  if (!pPlayIntent) { plog('zero-dur-skip', '无播放意图(idx=' + pZeroDur.idx + ')'); return; }
  if (theTime && theTime.getTime() <= Date.now()) { plog('zero-dur-skip', '定时已到'); return; }
  if (playModeSelect.value !== 'continuous') { plog('zero-dur-skip', '非连续播放'); return; }

  // ⚠️ 不能拿 paused 当「正常」判据:2026-09-29 生产实测,卡住的那一刻是
  //    paused=FALSE(play() 早已 resolve)+ readyState 0 + duration NaN。
  //    早先一版守卫写成 `if (!musicPlayer.paused) return;`,结果真实故障恰好
  //    落进「已在播放」分支被直接跳过 —— 自救永不触发(测试抓到了这个反转)。
  //    真正的判据是「有没有拿到元数据 / 播放头有没有动过」,上面两条已经查过。
  var pMusic = musicList[pZeroDur.idx];
  var pUrl = pMusic && pMusic.url;
  if (!pUrl) return;
  pstats.zeroDur++;
  psave();
  plog('zero-dur-heal', pZeroDur.idx + ' 重载 ' + decodeURIComponent(pUrl).split('/').pop().slice(0, 28));
  musicPlayer.load();          // 丢掉半截的缓冲,重新按 range 拉
  tryPlay('zero-dur-heal');
}

// 看门狗:挂在已有的 10 秒 interval 上(后台被节流也终会触发)
function pWatchdog() {
  // 「时长 0」看门狗不依赖 ptrans,独立于 45 秒阈值,靠自己的 10 秒定时器
  if (ptrans && Date.now() - ptrans.start > 45000) {
    if (musicPlayer.paused) {
      var pReason = 'stuck-paused' + (plastErr ? ':' + plastErr : '');
      pCloseTransition(false, pReason);
      // 自救一次:重载 src 再试(可能是部分加载损坏/会话被收回)
      if (pPlayIntent && !pHealDone) {
        pHealDone = true;
        plog('watchdog-heal', '重载 src');
        var pUrl = musicList[parseInt(musicSelect.value)] && musicList[parseInt(musicSelect.value)].url;
        if (pUrl) { musicPlayer.src = pUrl; tryPlay('watchdog-heal'); }
      }
    } else if (musicPlayer.readyState < 3) {
      pCloseTransition(false, 'stuck-loading');
    }
  }
}

// MediaSession:锁屏/通知栏控制面板
function pSetSessionMeta(name) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: name,
      artist: '玉机子道长',
      album: document.title
    });
  } catch (e) { }
}
if ('mediaSession' in navigator) {
  try {
    navigator.mediaSession.setActionHandler('play', function () {
      pPlayIntent = true;
      tryPlay('ms-play');
    });
    navigator.mediaSession.setActionHandler('pause', function () {
      pPlayIntent = false;
      pExpectedPause = 'ms-pause';
      musicPlayer.pause();
    });
    navigator.mediaSession.setActionHandler('nexttrack', function () { playNext(); });
    navigator.mediaSession.setActionHandler('seekbackward', function () { back30sec(); });
    navigator.mediaSession.setActionHandler('seekforward', function () { forward30sec(); });
  } catch (e) { }
}

// 媒体与生命周期事件黑匣子
musicPlayer.addEventListener('playing', function () {
  plog('playing');
  // 播放成功:重试状态清零
  pRetry.count = 0;
  pRetry.deadline = 0;
  window.clearTimeout(pRetry.timer);
  pFailedAt = 0;
  // ?fast 复现台:每首跳到结尾前 N 秒,高频产生真实转场
  if (PFAST && !pFastSeeked && isFinite(musicPlayer.duration)
    && musicPlayer.duration - musicPlayer.currentTime > PFAST + 2) {
    pFastSeeked = true;
    plog('fast-seek', '->末尾前' + PFAST + 's (dur=' + Math.round(musicPlayer.duration) + 's)');
    musicPlayer.currentTime = musicPlayer.duration - PFAST;
  }
});

musicPlayer.addEventListener('loadstart', function () {
  pFastSeeked = false;
  plog('loadstart', decodeURIComponent(musicPlayer.currentSrc || musicPlayer.src || '').split('/').pop().slice(0, 30));
});

musicPlayer.addEventListener('pause', function () {
  updateRemainTime();   // 一暂停就不再倒计时,「剩余」立刻复位(不等 10 秒 interval)
  var why = pExpectedPause;
  pExpectedPause = '';
  if (musicPlayer.ended) { plog('pause', 'ended'); return; }
  if (why) { plog('pause', why); return; }
  // 无法归因的暂停:多半是用户在锁屏面板按了暂停 → 尊重之,不自动续播;
  // 但定时未到就停属于待解释事件,计数留证
  pPlayIntent = false;
  plog('pause-unattributed', theTime ? 'timer-active' : '');
  if (theTime) { pstats.oddPause++; psave(); }
});

musicPlayer.addEventListener('error', function () {
  if (!musicPlayer.currentSrc) return; // 清空选择触发的伪错误
  var c = musicPlayer.error ? musicPlayer.error.code : '?';
  plastErr = 'media-error-' + c;
  plog('media-error', 'code=' + c);
  if (ptrans) pCloseTransition(false, 'media-error-' + c);
  // 网络类错误自救:重载 src(续播位置由 loadedmetadata 从 localStorage 恢复)
  if (pPlayIntent && pErrHeal < 2) {
    pErrHeal++;
    setTimeout(function () {
      if (!pPlayIntent) return;
      plog('error-heal', '第' + pErrHeal + '次重载');
      var pUrl = musicList[parseInt(musicSelect.value)] && musicList[parseInt(musicSelect.value)].url;
      if (pUrl) { musicPlayer.src = pUrl; tryPlay('error-heal'); }
    }, 3000);
  }
});

['waiting', 'stalled', 'suspend', 'abort', 'emptied', 'seeked', 'canplaythrough'].forEach(function (ev) {
  musicPlayer.addEventListener(ev, function () { plog(ev); });
});

document.addEventListener('visibilitychange', function () {
  plog('visibility', document.visibilityState);
  // 解锁/回前台续播:10 分钟内有过播放失败且意图仍在 → 接上
  if (document.visibilityState === 'visible' && pPlayIntent && musicPlayer.paused
    && pFailedAt && Date.now() - pFailedAt < 600000) {
    plog('visible-resume', '');
    tryPlay('visible-resume');
  }
});
window.addEventListener('pageshow', function (e) { plog('pageshow', e.persisted ? 'bfcache' : 'fresh'); });
window.addEventListener('pagehide', function (e) { plog('pagehide', e.persisted ? 'bfcache' : 'unload'); });

// 上次会话死在转场中(进程被系统杀掉):开局检查未关闭的转场
try {
  var pLeft = localStorage.getItem(PKEY_TRANS);
  if (pLeft) {
    var pLt = JSON.parse(pLeft);
    pstats.fail++;
    pstats.reasons['process-died'] = (pstats.reasons['process-died'] || 0) + 1;
    plog('trans-fail', (pLt && pLt.from !== undefined ? pLt.from + '->' + pLt.to + ' ' : '') + 'process-died(载入时发现未完成转场)');
    localStorage.removeItem(PKEY_TRANS);
    psave();
  }
} catch (e) { }

plog('init', (location.search || '(无参数)') + ' ' + navigator.userAgent.slice(0, 70));

// ?debug 统计面板
if (PQS.has('debug')) {
  (function () {
    var pPanel = document.createElement('div');
    pPanel.id = 'plog-panel';
    pPanel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:45vh;overflow:auto;' +
      'background:rgba(10,12,10,.88);color:#9fdf9f;font:11px/1.55 ui-monospace,monospace;' +
      'padding:8px 10px;z-index:99999;white-space:pre-wrap;word-break:break-all';
    document.body.appendChild(pPanel);

    function pfmt(ts) {
      var d = new Date(ts);
      return d.toTimeString().slice(0, 8) + '.' + ('00' + d.getMilliseconds()).slice(-3);
    }

    window.plogCopy = function () {
      var data = JSON.stringify({ stats: pstats, log: plogBuf });
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).then(function () { alert('日志已复制'); },
          function () { prompt('手动复制:', data); });
      } else { prompt('手动复制:', data); }
    };
    window.plogReset = function () {
      plogBuf = [];
      pstats = { trans: 0, ok: 0, fail: 0, earlyTimer: 0, oddPause: 0, zeroDur: 0, reasons: {} };
      ptrans = null;
      try {
        localStorage.removeItem(PKEY_LOG);
        localStorage.removeItem(PKEY_STATS);
        localStorage.removeItem(PKEY_TRANS);
      } catch (e) { }
      plog('stats-reset');
    };

    function pRender() {
      var head = '【转场】共 ' + pstats.trans + ' 次 | 成功 ' + pstats.ok + ' | 失败 ' + pstats.fail +
        ' | 异常暂停 ' + pstats.oddPause + ' | 定时提前 ' + pstats.earlyTimer +
        ' | 时长0自救 ' + (pstats.zeroDur || 0) + '\n';
      var rs = Object.keys(pstats.reasons);
      if (rs.length) head += '【失败原因】' + rs.map(function (k) { return k + '×' + pstats.reasons[k]; }).join(' , ') + '\n';
      if (ptrans) head += '【转场进行中】' + ptrans.from + '->' + ptrans.to + ' 已 ' + Math.round((Date.now() - ptrans.start) / 1000) + 's\n';
      head += PFAST ? '【fast 模式】结尾前 ' + PFAST + 's 起跳\n' : '';
      var tail = plogBuf.slice(-12).map(function (r) {
        return pfmt(r.ts) + ' [' + r.vis.slice(0, 3) + '] ' + r.e + (r.d ? ' ' + r.d : '') + ' (idx=' + r.idx + ' ct=' + r.ct + (r.paused ? ' paused' : '') + ')';
      }).join('\n');
      pPanel.innerHTML = '';
      var btns = document.createElement('div');
      btns.innerHTML = '<button onclick="plogCopy()" style="font-size:11px;margin-right:8px">复制日志</button>' +
        '<button onclick="plogReset()" style="font-size:11px">清零</button>';
      var txt = document.createElement('div');
      txt.textContent = head + '────────\n' + tail;
      pPanel.appendChild(btns);
      pPanel.appendChild(txt);
    }
    pRender();
    setInterval(pRender, 2000);
  })();
}
