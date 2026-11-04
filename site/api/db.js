// 함께 기록판 서버(Vercel 함수). claude.ai 아티팩트의 db·user 기능을 같은 모양으로 흉내 낸다.
// 저장은 Upstash Redis(REST). 비밀값은 모두 환경변수에만 둔다.
//   KV_REST_API_URL, KV_REST_API_TOKEN : Vercel Storage(Upstash) 연결 때 자동으로 생김
//   AX_CLASS_CODE : 직원에게 알려 주는 교실 코드(비우면 코드 없이 참여)
//   AX_ADMIN_KEY  : AI혁신팀 관리자 키(검수함·FAQ 고르기)
//   AX_SECRET     : 참여 토큰 서명용(비우면 KV_REST_API_TOKEN으로 서명)
// 키 구조: crew(해시, uid→기록 JSON) · team(해시, 검수·FAQ) · prof(해시, uid→{name,dept}) · ver(숫자, 바뀔 때마다 +1)
const crypto = require("crypto");

const URL_ = process.env.KV_REST_API_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || "";
const SECRET = process.env.AX_SECRET || TOKEN;
const CODE = String(process.env.AX_CLASS_CODE || "").trim();
const ADMIN = String(process.env.AX_ADMIN_KEY || "").trim();
const NS = process.env.AX_NS || "ax"; // 같은 DB에 다른 교실을 둘 때 앞머리를 바꾼다
const k = (x) => NS + ":" + x;
const MAX_DOC = 120 * 1024;
const MAX_PEOPLE = 5000;

async function redis(cmds) {
  const r = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw Object.assign(new Error("저장소 응답 오류 " + r.status), { status: 502 });
  const j = await r.json();
  return j.map((x) => {
    if (x.error) throw Object.assign(new Error(x.error), { status: 502 });
    return x.result;
  });
}
const sign = (s) => crypto.createHmac("sha256", SECRET).update(s).digest("base64url");
const same = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const okUser = (b) => typeof b.uid === "string" && /^v_[A-Za-z0-9_-]{8,32}$/.test(b.uid) && same(b.token, sign("u:" + b.uid));
const okAdmin = (b) => okUser(b) && !!ADMIN && same(b.akey, sign("a:" + b.uid + ":" + ADMIN));
const pairs = (arr) => {
  const o = {};
  for (let i = 0; i + 1 < (arr || []).length; i += 2) {
    try { o[arr[i]] = JSON.parse(arr[i + 1]); } catch (e) {}
  }
  return o;
};
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);
const fail = (status, error, code) => Object.assign(new Error(error), { status, code: code || status });

async function handle(b) {
  if (!URL_ || !TOKEN) throw fail(503, "함께 기록판 저장소가 아직 연결되지 않았습니다", "nostore");
  const op = b.op;

  if (op === "join") {
    if (CODE && !same(clean(b.code, 40), CODE)) throw fail(403, "교실 코드가 맞지 않습니다", "code");
    const name = clean(b.name, 20), dept = clean(b.dept, 24);
    if (!name) throw fail(400, "이름을 적어 주세요", "name");
    const [n] = await redis([["HLEN", k("prof")]]);
    if (n >= MAX_PEOPLE) throw fail(429, "참여 인원이 가득 찼습니다. AI혁신팀에 알려 주세요", "full");
    const uid = "v_" + crypto.randomBytes(12).toString("base64url");
    await redis([["HSET", k("prof"), uid, JSON.stringify({ name, dept, at: Date.now() })]]);
    return { uid, token: sign("u:" + uid), name, dept };
  }

  if (!okUser(b)) throw fail(401, "참여 정보가 맞지 않습니다. 다시 참여해 주세요", "auth");

  if (op === "admin") {
    if (!ADMIN || !same(clean(b.key, 80), ADMIN)) throw fail(403, "관리자 키가 맞지 않습니다", "key");
    return { akey: sign("a:" + b.uid + ":" + ADMIN) };
  }

  if (op === "me") {
    const [p] = await redis([["HGET", k("prof"), b.uid]]);
    if (!p) throw fail(401, "참여 기록을 찾지 못했습니다", "auth");
    const j = JSON.parse(p);
    return { uid: b.uid, name: j.name, dept: j.dept, admin: okAdmin(b) };
  }

  if (op === "snap") {
    const [v] = await redis([["GET", k("ver")]]);
    const ver = String(v || "0");
    if (b.ver != null && String(b.ver) === ver) return { same: true, ver };
    const [crew, team] = await redis([["HGETALL", k("crew")], ["HGETALL", k("team")]]);
    return { ver, crew: pairs(crew), team: pairs(team) };
  }

  if (op === "profiles") {
    const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x) => typeof x === "string").slice(0, 500);
    if (!ids.length) return { profiles: {} };
    const [arr] = await redis([["HMGET", k("prof"), ...ids]]);
    const out = {};
    ids.forEach((id, i) => {
      try { const j = JSON.parse(arr[i]); out[id] = { name: j.name, dept: j.dept }; } catch (e) { out[id] = { name: "" }; }
    });
    return { profiles: out };
  }

  if (op === "set") {
    const col = b.col, id = String(b.id || "");
    if (!["crew", "team"].includes(col)) throw fail(400, "알 수 없는 기록", "col");
    if (!id || id.length > 200) throw fail(400, "기록 이름이 맞지 않습니다", "id");
    if (col === "crew" && id !== b.uid) throw fail(403, "내 기록만 고칠 수 있습니다", "perm");
    if (col === "team" && !okAdmin(b)) throw fail(403, "AI혁신팀 권한이 필요합니다", "perm");
    if (!b.data || typeof b.data !== "object" || Array.isArray(b.data)) throw fail(400, "기록 형식이 맞지 않습니다", "data");
    const data = col === "crew" ? { ...b.data, uid: b.uid } : { ...b.data, by: b.uid };
    const s = JSON.stringify(data);
    if (s.length > MAX_DOC) throw fail(413, "기록이 너무 큽니다", "size");
    const cmds = [["HSET", k(col), id, s], ["INCR", k("ver")]];
    if (col === "crew" && typeof data.dept === "string") {
      const [p] = await redis([["HGET", k("prof"), b.uid]]);
      try { const j = JSON.parse(p); const d = clean(data.dept, 24); if (j && j.dept !== d) cmds.push(["HSET", k("prof"), b.uid, JSON.stringify({ ...j, dept: d })]); } catch (e) {}
    }
    const r = await redis(cmds);
    return { ok: true, ver: String(r[1]) };
  }

  if (op === "del") {
    // AI혁신팀 전용 정리: 시험 기록·외부 글 지우기. who=uid면 그 사람의 crew·prof를 함께 지운다
    if (!okAdmin(b)) throw fail(403, "AI혁신팀 권한이 필요합니다", "perm");
    const cmds = [];
    if (typeof b.who === "string" && b.who) cmds.push(["HDEL", k("crew"), b.who], ["HDEL", k("prof"), b.who]);
    if (b.col === "team" && typeof b.id === "string" && b.id) cmds.push(["HDEL", k("team"), b.id]);
    if (!cmds.length) throw fail(400, "지울 대상이 없습니다", "id");
    cmds.push(["INCR", k("ver")]);
    await redis(cmds);
    return { ok: true };
  }

  throw fail(400, "알 수 없는 요청", "op");
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "POST only" })); }
  try {
    let b = req.body;
    if (typeof b === "string") b = JSON.parse(b || "{}");
    const out = await handle(b || {});
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = e.status || 500;
    res.end(JSON.stringify({ error: e.status ? e.message : "서버 오류", code: e.code || "err" }));
  }
};
