// 둘이자산 · 오프라인 저장. 기록(/api)은 절대 저장하지 않고 앱 화면 파일만 저장한다.
const CACHE = "duri-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/apple-touch-icon.png", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const good = (response) => response && response.ok && response.type === "basic" && !response.redirected;

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // 새 화면을 먼저 시도하고, 3초 안에 안 오거나 끊겨 있으면 저장된 화면으로 연다.
    const network = fetch(request).then((response) => {
      if (good(response)) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put("/", copy));
      }
      return response;
    });
    const cached = () => caches.match("/");
    event.respondWith(
      Promise.race([
        network.catch(() => cached()),
        new Promise((resolve) => setTimeout(() => cached().then((hit) => hit && resolve(hit)), 3000)),
      ]).then((response) => response || network),
    );
    return;
  }

  // 화면 파일(js·css·그림)은 저장본을 먼저 쓰고 뒤에서 새로 받아 둔다.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (good(response)) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
