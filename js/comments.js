/* ============================================================================
   玉机子站点 · 留言板前端
   零依赖，不引任何外部 CDN —— 与 style.css 的「墙内秒开」原则一致。
   列表用 createElement + textContent 构建，**全程不用 innerHTML 拼字符串**，
   所以留言内容里的 < > & 不需要依赖转义正确性，从根本上没有 XSS 面。
   ============================================================================ */
(function () {
  "use strict";

  var mount = document.getElementById("talk");
  if (!mount) return;

  /* data-api 留空 = **同源**（生产就是这个模式）：/api/* 由 Cloudflare Worker 路由
     接管，前端走相对路径。同源不触发 OPTIONS 预检、不需要 CORS 头、中间代理也剥不掉
     跨域头 —— 移动端出过的「网络异常」整类问题由此消失。
     填绝对地址（如 https://comments.yujizi.org）则回退到跨域模式，调试时可用。 */
  var API = (mount.getAttribute("data-api") || "").replace(/\/+$/, "");
  var PAGE = mount.getAttribute("data-page") || "/";

  var listEl = document.getElementById("talk-list");
  var formEl = document.getElementById("talk-form");
  var msgEl = document.getElementById("talk-msg");
  var contentEl = document.getElementById("talk-content");
  var nameEl = document.getElementById("talk-name");
  var hpEl = document.getElementById("talk-website");
  var submitEl = document.getElementById("talk-submit");

  // 渲染时刻。后端用它判断「提交太快 = 机器人」。
  // 页面停留很久后再发也不会被拒 —— 后端只卡下限，上限是 2 小时。
  var RENDERED_AT = Date.now();
  var busy = false;

  function say(text, kind) {
    msgEl.textContent = text || "";
    msgEl.className = "talk-msg" + (kind ? " is-" + kind : "");
  }

  function fmtTime(ms) {
    var d = new Date(ms);
    var p = function (n) { return n < 10 ? "0" + n : String(n); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  /* 用 DOM API 建节点。内容一律走 textContent，不解析为 HTML。 */
  function buildItem(c) {
    var li = document.createElement("li");
    li.className = "talk-item";

    var head = document.createElement("div");
    head.className = "talk-head";

    var who = document.createElement("span");
    who.className = "talk-who";
    who.textContent = c.name || "无名";
    if (!c.name) who.classList.add("is-anon");

    var when = document.createElement("time");
    when.className = "talk-when";
    when.dateTime = new Date(c.created_at).toISOString();
    when.textContent = fmtTime(c.created_at);

    head.appendChild(who);
    head.appendChild(when);

    var body = document.createElement("p");
    body.className = "talk-text";
    body.textContent = c.content;

    li.appendChild(head);
    li.appendChild(body);
    return li;
  }

  function render(list) {
    listEl.textContent = "";
    if (!list.length) {
      var empty = document.createElement("p");
      empty.className = "talk-empty";
      empty.textContent = "还没有人留言。";
      listEl.appendChild(empty);
      return;
    }
    var ul = document.createElement("ul");
    ul.className = "talk-items";
    for (var i = 0; i < list.length; i++) ul.appendChild(buildItem(list[i]));
    listEl.appendChild(ul);
  }

  function fail(text) {
    listEl.textContent = "";
    var p = document.createElement("p");
    p.className = "talk-empty is-error";
    p.textContent = text;
    listEl.appendChild(p);
  }

  /* 把响应读成 JSON。**先取文本再解析** —— 被边缘防护拦下时返回的是 HTML 错误页，
     直接 r.json() 会抛异常，把「被拦」误报成「网络不通」，误导排查方向。 */
  function readJson(r) {
    return r.text().then(function (txt) {
      var data = null;
      try { data = JSON.parse(txt); } catch (e) { /* 不是 JSON，保持 null */ }
      return { ok: r.ok, status: r.status, data: data };
    });
  }

  /* fetch 被拒时分两种情况，必须分辨，否则用户和我们都不知道该查哪儿：
       ① 网络真的不通；
       ② 主机通、但响应缺少 CORS 头（被边缘防护拦下时就会这样，浏览器一律
          把这种响应当成网络失败报出来）。
     用 no-cors 探一次 /api/health：opaque 响应不可读内容，但只要不抛异常，
     就说明主机可达 —— 那问题就出在②。 */
  function diagnose() {
    return fetch(API + "/api/health?probe=" + Date.now(), { mode: "no-cors", cache: "no-store" })
      .then(function () {
        return "接口拒绝了这次请求（可能触发了访问频率限制），请稍后再试。";
      })
      .catch(function () {
        return "连不上留言接口，请检查网络后重试。";
      });
  }

  function load() {
    fetch(API + "/api/comments?page=" + encodeURIComponent(PAGE), {
      headers: { accept: "application/json" }
    })
      .then(readJson)
      .then(function (res) {
        if (!res.ok) {
          fail("留言载入失败（HTTP " + res.status + "）。");
          return;
        }
        var data = res.data || {};
        var list = data.comments || [];
        render(list);
        // 后端上限 200 条。超出时明说，不要让旧留言无声消失
        if (data.truncated) {
          var note = document.createElement("p");
          note.className = "talk-note";
          note.textContent = "仅显示最近 " + list.length + " 条，共 " + data.total + " 条。";
          listEl.appendChild(note);
        }
      })
      .catch(function () {
        diagnose().then(function (m) { fail(m); });
      });
  }

  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;

    var content = contentEl.value.trim();
    if (content.length < 2) { say("请至少写两个字。", "error"); contentEl.focus(); return; }

    busy = true;
    submitEl.disabled = true;
    say("正在提交…");

    fetch(API + "/api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        page: PAGE,
        content: content,
        name: nameEl.value.trim(),
        // 蜜罐字段：正常用户看不见这个输入框，值必然为空。
        // 机器人按字段名盲填，填了就被后端拒。
        website: hpEl ? hpEl.value : "",
        t: RENDERED_AT
      })
    })
      .then(readJson)
      .then(function (res) {
        if (!res.ok) {
          say(res.data && res.data.error ? res.data.error : "提交失败（HTTP " + res.status + "）。", "error");
          return;
        }
        contentEl.value = "";
        say("已留言。", "ok");
        load();
      })
      .catch(function () {
        return diagnose().then(function (m) { say(m, "error"); });
      })
      .then(function () { busy = false; submitEl.disabled = false; });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
