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

//更新定时停止的剩余时间
function updateRemainTime() {
  if (theTime) {
    var d = new Date();
    var x = theTime - d;//Math.floor((theTime-d)/60000)
    if (x < 0) x = 0;
    if (x >= 0) {
      var min = Math.floor(x / 60000);
      var sec = Math.floor((x - min * 60000) / 1000);
      document.getElementById("remainTime").innerText = `${min}分钟${sec}秒`;
    }
    // 兜底:后台节流导致 setTimeout 没按时触发,由本 interval 补刀
    if (x <= 0) {
      window.clearTimeout(stopAudioTimeOut);
      stopAudio('timer-sweep');
    }
  };
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
  if (ptrans) pDiscardTransition('stopped-by-' + reason);
  pExpectedPause = reason;
  musicPlayer.pause();
  theTime = null
  document.getElementById("myselect").value = -1;
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
var pstats = { trans: 0, ok: 0, fail: 0, earlyTimer: 0, oddPause: 0, reasons: {} };
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

// 真实预取:整文件 fetch 暖 HTTP 缓存,流式读完即弃,内存占用恒小
function pPrefetch(url) {
  if (pPrefetched[url]) return;
  pPrefetched[url] = true;
  plog('prefetch-start', decodeURIComponent(url).split('/').pop().slice(0, 30));
  fetch(url).then(function (res) {
    if (!res.ok || !res.body) { plog('prefetch-fail', 'http ' + res.status); pPrefetched[url] = false; return; }
    var reader = res.body.getReader();
    function pump() {
      return reader.read().then(function (r) {
        if (!r.done) return pump();
        plog('prefetch-done');
      });
    }
    return pump();
  }).catch(function (e) {
    plog('prefetch-fail', e.name);
    pPrefetched[url] = false;
  });
}

// 看门狗:挂在已有的 10 秒 interval 上(后台被节流也终会触发)
function pWatchdog() {
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
      pstats = { trans: 0, ok: 0, fail: 0, earlyTimer: 0, oddPause: 0, reasons: {} };
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
        ' | 异常暂停 ' + pstats.oddPause + ' | 定时提前 ' + pstats.earlyTimer + '\n';
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
