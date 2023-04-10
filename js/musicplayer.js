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
  const selectedIndex = e.target.value;
  if (selectedIndex) {
    const selectedMusic = musicList[selectedIndex];
    musicPlayer.src = selectedMusic.url;
    musicPlayer.play();
    // 更新下载链接
    musicDownload.href = selectedMusic.url;
    musicDownload.download = selectedMusic.name;
    musicDownload.style.display = 'inline';
    // 存储当前播放的音乐
    localStorage.setItem(`${pageid}_currentMusic`, selectedIndex);
  } else {
    musicPlayer.pause();
    musicPlayer.src = '';
    // 隐藏下载链接
    musicDownload.style.display = 'none';
    // 清除存储的音乐
    localStorage.removeItem(`${pageid}_currentMusic`);
    localStorage.removeItem(`${pageid}_currentTime`);
  }
});


// 监听播放器的时间更新事件
musicPlayer.addEventListener('timeupdate', () => {
    localStorage.setItem(`${pageid}_currentTime`, musicPlayer.currentTime);
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
    if (currentMusic) {
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
    musicPlayer.src = nextMusic.url;
    musicPlayer.play();
  
    // 更新下载链接
    musicDownload.href = nextMusic.url;
    musicDownload.download = nextMusic.name;
  
    // 存储当前播放的音乐
    localStorage.setItem(`${pageid}_currentMusic`, nextIndex);
    localStorage.setItem(`${pageid}_currentTime`, 0);
  }
  
// 监听播放器的 ended 事件
musicPlayer.addEventListener('ended', () => {
    playNext();
});
  
    
// 恢复音乐
restoreMusic();

var stopAudioTimeOut;
var theTime;

setInterval("updateRemainTime()",10000);

//更新定时停止的剩余时间
function updateRemainTime() {
    if (theTime){
        var d=new Date();
        var x=theTime-d;//Math.floor((theTime-d)/60000)
        if (x<0) x=0;
        if (x>=0){
            var min=Math.floor(x/60000);
            var sec=Math.floor((x-min*60000)/1000);
            document.getElementById("remainTime").innerText=min+"分钟"+sec+"秒";
        }
    };
}

//停止播放
function stopAudio(){
    musicPlayer.pause();
    document.getElementById("myselect").value=-1;
};

//date 加法的扩展函数
Date.dateAdd = function(currentDate, value, timeUnit) {

    timeUnit = timeUnit.toLowerCase();
    var multiplyBy = { w:604800000,
                     d:86400000,
                     h:3600000,
                     m:60000,
                     s:1000 };
    var updatedDate = new Date(currentDate.getTime() + multiplyBy[timeUnit] * value);

    return updatedDate;
};

//定时下拉框的响应函数
function timingChange(){
    window.clearTimeout(stopAudioTimeOut);
    var t=parseInt(this.value);
    if(t != -1){
        stopAudioTimeOut=window.setTimeout(stopAudio,t);
        var d=new Date();
        theTime=Date.dateAdd(d,t/1000,"s");
    }
};

document.getElementById("myselect").onchange=timingChange;

//后退三十秒
function back30sec(){
    if (musicPlayer.currentTime>0 && !musicPlayer.paused && !musicPlayer.ended && musicPlayer.readyState>2){
        musicPlayer.currentTime=musicPlayer.currentTime-30
    }
};
