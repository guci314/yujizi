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
    localStorage.setItem('currentMusic', selectedIndex);
  } else {
    musicPlayer.pause();
    musicPlayer.src = '';
    // 隐藏下载链接
    musicDownload.style.display = 'none';
    // 清除存储的音乐
    localStorage.removeItem('currentMusic');
    localStorage.removeItem('currentTime');
  }
});


// 监听播放器的时间更新事件
musicPlayer.addEventListener('timeupdate', () => {
    localStorage.setItem('currentTime', musicPlayer.currentTime);
  });
  
// 监听播放器的 loadedmetadata 事件
musicPlayer.addEventListener('loadedmetadata', () => {
const savedTime = localStorage.getItem('currentTime');
if (savedTime) {
    musicPlayer.currentTime = parseFloat(savedTime);
}
});

// 初始化
initSelect();

// 恢复上次播放的音乐和时间
function restoreMusic() {
    const currentMusic = localStorage.getItem('currentMusic');
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
  
  // 恢复音乐
  restoreMusic();
