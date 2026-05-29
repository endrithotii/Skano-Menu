// SkanoMenu Waiter Service Worker – handles Web Push notifications
// This file is intentionally plain JS (no imports) so it can run as a SW.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Table Call", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "🔔 Table Call";
  const options = {
    body: data.body || "A customer needs your attention",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "waiter-call-" + (data.callId || Date.now()),
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [300, 100, 300, 100, 300],
    data: { url: data.url || "/waiter", callId: data.callId },
    actions: [
      { action: "open", title: "Open App" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/waiter";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing waiter tab if open
        for (const client of clientList) {
          if (client.url.includes("/waiter") && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
