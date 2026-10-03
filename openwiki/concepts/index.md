# 文件

- [讲经页内容模型（pageid / musicList）](audio-page-model.md)
- [水墨清静设计系统与主题机制](design-system.md) - 解释 style.css 的令牌体系（--paper/--ink/--cinnabar/--line/kai 字体栈、[data-theme="dark"] 覆盖）、明暗主题的读取与持久化（localStorage yjz-theme + prefers-color-scheme，布局内联脚本防闪）、纸纹噪声与动效降级（prefers-reduced-motion），以及为兼容旧页面而保留的 Bootstrap 中和层与「零外部字体/CDN、墙内秒开」的约束。
- [遗留层：jQuery、yujizi.js 与失效的旧播放器假设](legacy-multi-audio-player.md) - 记录仓库里仍被加载却已与当前架构脱节的代码（js/yujizi.js 的多音频假设、无人引用的 js/js.cookie.js、只作 CSS 引入的 Bootstrap 与 jquery slim、孤儿 album.css），逐个给出「被加载」与「有效执行」的证据，并给出删除或迁移的定性结论。
- [播放记忆与黑匣子日志（localStorage 键）](player-persistence-and-diagnostics.md) - 集中记录播放器持久化的全部 localStorage 键与语义（`<pageid>_currentMusic`、`_currentTime`、`_plog`、`_pstats`、`_ptrans`）、各自的写入与读取时机、?debug / plogCopy / plogReset / ?fast=N 等读取入口与 try/catch 边界，并指出「清空播放记忆」按钮清不掉这些键的遗留不一致。
- [播放器状态机：播放意图、转场与暂停归因](player-state-machine.md) - 讲清 js/musicplayer.js 里那台没有类、没有枚举、散落在十几个模块级变量中的隐式状态机：pPlayIntent 是唯一权威的「此刻应当播放」，ptrans 是转场的开/关与成败裁定，pExpectedPause 与 pUserPausedUntil 负责给暂停归因，三种播放模式各自选择不同分支；并逐条记下已知的反向守卫（paused 不能当正常判据、!pUserPausedUntil、pZeroDur.idx 类型归一、声明顺序）。
