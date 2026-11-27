// 통관 완료 알림 (11월 28일 요청): shows the push the server sends once customs cleared a number, and opens its result.
self.addEventListener("push", (event) => {
  let data = { title: "통관 알림", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    // An unreadable payload still shows the generic title.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, { body: data.body, icon: "/favicon.svg", data: { url: data.url } })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(self.clients.openWindow(target.href));
});
