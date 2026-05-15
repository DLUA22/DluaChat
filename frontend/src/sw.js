import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'DluaChat';
    const options = {
        body: data.body || 'Bạn có thông báo mới',
        icon: '/favicon_io/android-chrome-192x192.png',
        badge: '/favicon_io/android-chrome-192x192.png',
        data: data.url,
        vibrate: [200, 100, 200, 100, 200, 100, 200] // Rung điện thoại
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data));
});