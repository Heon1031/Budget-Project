import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("신혼부부 자산 플래너 첫 화면을 서버 렌더링한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>둘이자산 \| 신혼부부 자산형성 플래너<\/title>/i);
  assert.match(html, /우리 둘의 월급과 예산/);
  assert.match(html, /실수령액 100% 나누기/);
  assert.match(html, /투자·적금/);
  assert.match(html, /둘이 함께 내는 주거비/);
  assert.match(html, /이 속도로 모으면/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
