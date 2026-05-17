import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'DluaChat';
    const options = {
        body: data.body || 'Bạn có thông báo mới',
        icon: '/favicon_io/logo.png',
        badge: '/favicon_io/logo.png',
        tag: 'call-notification',
        renotify: true,
        vibrate: [200, 100, 200],
        data: data.url,
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data));
});