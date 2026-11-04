// 보안 약속을 깨는 코드가 들어오지 않았는지 훑는다. 걸리면 이유를 적고 1로 끝난다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) files.push(path);
  }
};
walk(join(root, "app"));
files.push(join(root, "public", "sw.js"));

const rules = [
  {
    why: "암호화 열쇠를 꺼낼 수 있게(extractable: true) 만들면 안 된다.",
    test: (text) => /importKey\([^;]*?,\s*true\s*,\s*\[/s.test(text),
  },
  {
    why: "서버(app/api, app/lib/server)에서 console.log로 요청 내용을 남기면 안 된다.",
    only: /app[\/](api|lib[\/]server)[\/]/,
    test: (text) => /console\.log\(/.test(text),
  },
  {
    why: "비밀번호·확인값을 localStorage/sessionStorage에 두면 안 된다. 열쇠는 IndexedDB의 CryptoKey로만 둔다.",
    test: (text) => /(localStorage|sessionStorage)\.setItem\([^)]*(passphrase|password|auth)/i.test(text),
  },
  {
    why: "비밀값을 URL(쿼리)에 실으면 안 된다.",
    test: (text) => /[?&](passphrase|password|auth|token)=/i.test(text),
  },
  {
    why: "오프라인 저장(sw.js)은 /api/ 응답을 저장하지 않아야 한다.",
    only: /sw\.js$/,
    test: (text) => !text.includes('startsWith("/api/")'),
  },
];

const problems = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const rule of rules) {
    if (rule.only && !rule.only.test(file)) continue;
    if (rule.test(text)) problems.push(`${relative(root, file)}: ${rule.why}`);
  }
}

if (problems.length > 0) {
  console.error(`보안 점검 실패 ${problems.length}건\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`보안 점검 통과 (${files.length}개 파일)`);
