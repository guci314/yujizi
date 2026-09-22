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

  var API = (mount.getAttribute("data-api") || "").replace(/\/$/, "");
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

  function load() {
    if (!API) { fail("留言板未配置接口地址。"); return; }
    fetch(API + "/api/comments?page=" + encodeURIComponent(PAGE), {
      headers: { accept: "application/json" }
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
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
      .catch(function () { fail("留言载入失败，请稍后再试。"); });
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
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { say(res.d && res.d.error ? res.d.error : "提交失败。", "error"); return; }
        contentEl.value = "";
        say("已留言。", "ok");
        load();
      })
      .catch(function () { say("网络异常，请稍后再试。", "error"); })
      .then(function () { busy = false; submitEl.disabled = false; });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
