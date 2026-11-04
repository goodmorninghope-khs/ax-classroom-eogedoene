/* 함께 기록판 연결(Vercel 통합판).
   claude.ai 아티팩트가 주는 window.claude.use("db"|"user")를 같은 모양으로 만들어, 템플릿을 고치지 않고
   일반 웹에서도 공유 기록·AI혁신팀 검수·과 대항·수료증이 돌게 한다. 서버는 /api/db.
   참여 전: 개인 연습판 + window.AX_JOIN(참여 창). 참여 후: 공유 모드. claude.ai 안에서는 아무것도 하지 않는다. */
(function () {
  if (window.claude && window.claude.use) return;
  var KEY = "axjoin1";
  var me = null;
  try { me = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (me && !(me.uid && me.token)) me = null;
  var saveMe = function () { try { me ? localStorage.setItem(KEY, JSON.stringify(me)) : localStorage.removeItem(KEY); } catch (e) {} };

  function api(op, body, cred) {
    var c = cred || me || {};
    var payload = Object.assign({ op: op, uid: c.uid, token: c.token, akey: c.akey }, body || {});
    return fetch("/api/db", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var e = new Error(j.error || "HTTP " + r.status); e.code = j.code || r.status; e.status = r.status; throw e; }
          return j;
        });
      });
  }

  /* ---------- 참여 창 ---------- */
  var css = "#axJoin{border:1px solid var(--line,#d5e0e0);border-radius:12px;padding:0;max-width:440px;width:calc(100% - 32px);background:var(--surface,#fff);color:var(--ink,#14282b)}" +
    "#axJoin::backdrop{background:rgba(10,20,22,.45)}#axJoin form{padding:20px 20px 16px;display:grid;gap:10px}" +
    "#axJoin h3{margin:0;font-family:var(--f-display,inherit);font-weight:400;font-size:22px}" +
    "#axJoin label{display:grid;gap:4px;font-size:13px;font-weight:700}#axJoin input{font:inherit;font-weight:400;padding:8px 10px;border:1px solid var(--line,#d5e0e0);border-radius:8px;background:var(--bg,#f3f6f6);color:inherit}" +
    "#axJoin p{margin:0;font-size:13px;color:var(--muted,#5b6f72)}#axJoin details{font-size:13px}#axJoin summary{cursor:pointer;color:var(--teal,#0f7c7a);font-weight:700}" +
    "#axJoin details>div{display:grid;gap:8px;margin-top:8px}#axJoin .axrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}#axJoin .axerr{color:var(--coral,#e2563f);font-weight:700}" +
    "#axWho{font-size:12.5px;color:var(--muted,#5b6f72);margin:6px 0 0;display:flex;gap:6px 10px;flex-wrap:wrap;align-items:center}#axWho b{color:var(--ink,#14282b)}" +
    "#axWho button{border:0;background:none;padding:0;color:var(--teal,#0f7c7a);font:inherit;font-weight:700;text-decoration:underline;cursor:pointer}";
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ensureStyle() { if (!document.getElementById("axJoinCss")) { var s = document.createElement("style"); s.id = "axJoinCss"; s.textContent = css; document.head.appendChild(s); } }

  function localRecord() {
    try { var s = JSON.parse(localStorage.getItem("axcrew4") || "null"); return s && typeof s === "object" ? s : null; } catch (e) { return null; }
  }

  function openJoin(focusAdmin) {
    ensureStyle();
    var dlg = document.getElementById("axJoin");
    if (dlg) dlg.remove();
    var rec = localRecord();
    var deptGuess = (rec && rec.dept) || "";
    dlg = el('<dialog id="axJoin" aria-labelledby="axJoinT"><form method="dialog" novalidate>' +
      '<h3 id="axJoinT">함께 기록판 참여</h3>' +
      '<p>이름과 소속 과는 동료에게 보이는 기록(레시피·질문·과 대항·수료증)에 쓰입니다. 업무 자료나 개인정보는 올리지 마세요.</p>' +
      '<label>이름<input name="name" autocomplete="name" maxlength="20" required></label>' +
      '<label>소속 과<input name="dept" maxlength="24" placeholder="예: 정책과" value="' + esc(deptGuess) + '"></label>' +
      '<label>교실 코드<input name="code" maxlength="40" autocomplete="off" placeholder="AI혁신팀이 알려 준 코드"></label>' +
      (rec ? '<p>이 브라우저의 연습 기록이 함께 옮겨집니다.</p>' : '') +
      '<details' + (focusAdmin === "resume" ? " open" : "") + '><summary>다른 기기에서 이어 하기</summary><div><label>이어 하기 코드<input name="resume" autocomplete="off" placeholder="참여한 기기에서 복사한 코드"></label><p>코드를 넣으면 이름·과·교실 코드 없이 내 기록을 그대로 이어 갑니다.</p></div></details>' +
      '<details' + (focusAdmin === true ? " open" : "") + '><summary>AI혁신팀 관리자</summary><div><label>관리자 키<input name="akey" type="password" autocomplete="off"></label><p>검수함과 FAQ 고르기가 열립니다.</p></div></details>' +
      '<p class="axerr" role="alert"></p>' +
      '<div class="axrow"><button class="btn watch" value="ok" type="submit">참여하기</button><button class="btn" value="cancel" type="button" data-x>닫기</button></div>' +
      '</form></dialog>');
    document.body.appendChild(dlg);
    var f = dlg.querySelector("form"), err = dlg.querySelector(".axerr");
    dlg.querySelector("[data-x]").onclick = function () { dlg.close(); };
    f.onsubmit = function (ev) {
      ev.preventDefault();
      err.textContent = "";
      var v = function (n) { return (f.elements[n].value || "").trim(); };
      var btn = f.querySelector("[type=submit]"); btn.disabled = true;
      var done = function (cred) {
        var ak = v("akey");
        var p = ak ? api("admin", { key: ak }, cred).then(function (j) { cred.akey = j.akey; }) : Promise.resolve();
        return p.then(function () { me = cred; saveMe(); }).then(function () { location.reload(); });
      };
      var job;
      if (v("resume")) {
        var parts = v("resume").split(".");
        var cred = { uid: parts[0], token: parts.slice(1).join(".") };
        job = api("me", {}, cred).then(function (j) { cred.name = j.name; cred.dept = j.dept; return done(cred); });
      } else {
        if (!v("name")) { err.textContent = "이름을 적어 주세요."; btn.disabled = false; return; }
        job = api("join", { name: v("name"), dept: v("dept"), code: v("code") }).then(function (j) {
          var cred = { uid: j.uid, token: j.token, name: j.name, dept: j.dept };
          var r = localRecord() || {};
          var data = {
            uid: j.uid, dept: j.dept || r.dept || "", stages: r.stages || {}, seen: r.seen || {}, likes: r.likes || {}, tried: r.tried || {},
            quiz: r.quiz || {}, exam: r.exam || null, weeks: r.weeks || {}, qs: r.qs || {}, ans: r.ans || {}, recs: r.recs || {}, cert: r.cert || null, updatedAt: Date.now()
          };
          return api("set", { col: "crew", id: j.uid, data: data }, cred).then(function () { return done(cred); });
        });
      }
      job.catch(function (e) { err.textContent = e.message || "참여하지 못했습니다."; btn.disabled = false; });
    };
    dlg.showModal();
    var first = f.elements[focusAdmin === true ? "akey" : focusAdmin === "resume" ? "resume" : "name"];
    first && first.focus();
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-axjoin],[data-axadmin],[data-axcont],[data-axleave]");
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    if (t.hasAttribute("data-axjoin")) return openJoin(false);
    if (t.hasAttribute("data-axadmin")) {
      var key = prompt("AI혁신팀 관리자 키");
      if (!key) return;
      api("admin", { key: key.trim() }).then(function (j) { me.akey = j.akey; saveMe(); location.reload(); }).catch(function (er) { alert(er.message); });
      return;
    }
    if (t.hasAttribute("data-axcont")) {
      var code = me.uid + "." + me.token;
      var ok = function () { t.textContent = "복사했어요"; setTimeout(function () { t.textContent = "다른 기기에서 이어 하기"; }, 2000); };
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(ok, function () { prompt("이어 하기 코드(남에게 주지 마세요)", code); });
      return;
    }
    if (t.hasAttribute("data-axleave")) {
      if (!confirm("이 기기에서 함께 기록판을 나갈까요? 기록은 지워지지 않고, 이어 하기 코드로 다시 들어올 수 있어요. 코드를 먼저 복사해 두세요.")) return;
      me = null; saveMe(); location.reload();
    }
  }, true);

  if (!me) {
    window.AX_JOIN = function () { openJoin(false); };
    if (/^#?(join|admin)$/.test(location.hash)) {
      var h = location.hash;
      document.addEventListener("DOMContentLoaded", function () { openJoin(h === "#admin"); });
    }
    return;
  }

  /* ---------- 공유 모드: db·user ---------- */
  var cache = { crew: {}, team: {} }, ver = null, subs = { crew: [], team: [] }, timer = null, inflight = null, again = false;
  var snapOf = function (c) { var o = cache[c] || {}; return { docs: Object.keys(o).map(function (id) { return { id: id, data: function () { return o[id]; } }; }) }; };
  var emit = function (c) { subs[c].forEach(function (s) { try { s.cb(snapOf(c)); } catch (e) {} }); };
  function poll(force) {
    if (!force && document.hidden) return Promise.resolve();
    if (inflight) { if (force) again = true; return inflight; }
    inflight = api("snap", { ver: force ? null : ver }).then(function (j) {
      if (!j.same) { ver = j.ver; cache.crew = j.crew || {}; cache.team = j.team || {}; emit("crew"); emit("team"); }
    }).catch(function (e) {
      if (e.status === 401) { me = null; saveMe(); location.reload(); return; }
      subs.crew.forEach(function (s) { s.err && s.err(e); });
    }).then(function () { inflight = null; if (again) { again = false; return poll(true); } });
    return inflight;
  }
  function start() {
    if (timer) return;
    timer = setInterval(poll, 20000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
  }
  var db = {
    collection: function (c) {
      return {
        doc: function (id) {
          return {
            set: function (data) {
              return api("set", { col: c, id: id, data: data }).then(function () {
                var n = {}; n[id] = c === "crew" ? Object.assign({}, data, { uid: me.uid }) : Object.assign({}, data, { by: me.uid });
                cache[c] = Object.assign({}, cache[c], n); emit(c); poll(true);
              });
            }
          };
        },
        onSnapshot: function (cb, err) {
          subs[c].push({ cb: cb, err: err }); start();
          if (ver != null) cb(snapOf(c)); else if (!inflight) poll(true);
          return function () { subs[c] = subs[c].filter(function (s) { return s.cb !== cb; }); };
        }
      };
    }
  };
  var meInfo = null;
  var getMe = function () { if (!meInfo) meInfo = api("me", {}).catch(function (e) { meInfo = null; throw e; }); return meInfo; };
  var user = {
    id: function () { return Promise.resolve(me.uid); },
    canEdit: function () { return me.akey ? getMe().then(function (j) { return !!j.admin; }, function () { return false; }) : Promise.resolve(false); },
    me: function () { return getMe().then(function (j) { return { name: j.name }; }); },
    profiles: function (ids) { return api("profiles", { ids: ids }).then(function (j) { return j.profiles || {}; }); }
  };
  window.claude = { use: function (what) { return Promise.resolve(what === "db" ? db : what === "user" ? user : null); } };

  /* 누구 이름으로 기록 중인지 보여 주는 줄 */
  window.addEventListener("ax:shared", function () {
    ensureStyle();
    getMe().then(function (j) {
      var n = document.getElementById("modeNote"); if (!n || document.getElementById("axWho")) return;
      n.insertAdjacentHTML("afterend", '<p id="axWho"><span><b>' + esc(j.name) + '</b>' + (j.dept ? " · " + esc(j.dept) : "") + ' 이름으로 함께 기록 중</span>' +
        '<button type="button" data-axcont>다른 기기에서 이어 하기</button>' + (j.admin ? "<span>AI혁신팀 권한</span>" : '<button type="button" data-axadmin>AI혁신팀 관리자</button>') +
        '<button type="button" data-axleave>이 기기에서 나가기</button></p>');
    }).catch(function () {});
  });
})();
