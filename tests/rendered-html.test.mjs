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

test("첫 화면(흐름)을 서버 렌더링한다", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/i);
  assert.match(html, /<title>둘이자산 \| 신혼부부 자산형성 플래너<\/title>/i);
  assert.match(html, /1년 뒤 모이는 돈/);
  assert.match(html, /이번 달 쓸 돈/);
  assert.match(html, /D-<!-- -->\d+|D-\d+|잔금일 지남/);
  for (const tab of ["흐름", "고정지출", "해볼까", "내 집", "설정"]) assert.match(html, new RegExp(tab));
  assert.match(html, /rel="manifest" href="[^"]*\/manifest\.webmanifest"/);
  assert.match(html, /serviceWorker/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});
