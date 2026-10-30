// Vercel 빌드 때 함께 기록판 주소를 환경변수(AX_SHARED_URL)에서 받아 config.js로 만든다.
// 주소는 저장소에 두지 않는다. 비어 있으면 연습판은 링크 없이 동작한다.
const fs = require("fs");
const u = String(process.env.AX_SHARED_URL || "").trim();
const ok = /^https:\/\/[^\s"'<>]+$/.test(u) ? u : "";
fs.writeFileSync("config.js", "window.AX_SHARED_URL=" + JSON.stringify(ok) + ";\n");
console.log("config.js written, shared url " + (ok ? "set" : "empty"));
