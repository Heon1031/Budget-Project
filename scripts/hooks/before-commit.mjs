// Claude 훅: git commit 전에 보안 점검과 전체 시험(npm test)을 돌린다. 실패하면 커밋을 막는다.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const command = String(input.tool_input?.command ?? "");
if (!/\bgit\b[^|;&]*\bcommit\b/.test(command)) process.exit(0);

const cwd = fileURLToPath(new URL("../..", import.meta.url));
for (const step of ["node scripts/check-security.mjs", "npx eslint . --ignore-pattern dist --ignore-pattern .claude", "npm test"]) {
  try {
    execSync(step, { cwd, stdio: "pipe", encoding: "utf8" });
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(-30).join("\n");
    console.error(`커밋 전 점검 실패: ${step}\n${output}`);
    process.exit(2);
  }
}
