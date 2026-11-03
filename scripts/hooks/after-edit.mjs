// Claude 훅: app/·worker/의 ts·tsx를 고친 뒤 타입 검사와 보안 점검을 돌린다.
// 실패하면 exit 2로 이유를 Claude에게 돌려준다.
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const file = String(input.tool_input?.file_path ?? input.tool_response?.filePath ?? "").split("\\").join("/");
if (!/\/(app|worker)\/.+\.(ts|tsx)$/.test(file) && !/\/public\/sw\.js$/.test(file)) process.exit(0);

const cwd = fileURLToPath(new URL("../..", import.meta.url));
const run = (command) => {
  try {
    execSync(command, { cwd, stdio: "pipe", encoding: "utf8" });
    return "";
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n").slice(0, 30).join("\n");
  }
};

const failures = [run("npx tsc --noEmit"), run("node scripts/check-security.mjs")].filter(Boolean);
if (failures.length > 0) {
  console.error(`고친 뒤 점검에서 걸렸어요. 고쳐 주세요.\n${failures.join("\n\n")}`);
  process.exit(2);
}
