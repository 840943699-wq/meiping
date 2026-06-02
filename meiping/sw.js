/* 美评 — Service Worker */

const CACHE_NAME = 'meiping-v10';

const ASSETS = [
  './',
  './manifest.json',
  './icon.png',
  './logo.png',
  './brand_text.png'
];

// 安装：预缓存核心资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        // 某个资源失败不影响整体
        console.warn('SW: 部分资源缓存失败', err);
      });
    })
  );
  // 立即激活，不等待旧 SW
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：缓存优先
self.addEventListener('fetch', event => {
  // 跳过 API 代理请求
  if (event.request.url.includes('/api/')) return;
  // HTML 始终走网络（确保拿到最新版本）
  if (event.request.mode === 'navigate' || event.request.url.endsWith('/') || event.request.url.endsWith('.html')) {
    return fetch(event.request).catch(() => caches.match(event.request));
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // 缓存成功的 GET 请求
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // 离线时返回缓存（如果有的话）
        return cached;
      });
    })
  );
});
