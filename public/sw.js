// EDTH Drone Defense Network - Service Worker
const CACHE_NAME = 'edth-drone-v1';
const OFFLINE_URL = '/offline';

const STATIC_ASSETS = [
  '/',
  '/report',
  '/offline',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API calls - always go to network
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((response) => {
          return response || caches.match(OFFLINE_URL);
        });
      })
  );
});

// Background sync for queued reports
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncQueuedReports());
  }
});

async function syncQueuedReports() {
  // Get queued reports from IndexedDB and send them
  const db = await openReportDB();
  const tx = db.transaction('pending_reports', 'readonly');
  const store = tx.objectStore('pending_reports');
  const reports = await store.getAll();
  
  for (const report of reports) {
    try {
      await fetch('/api/report', {
        method: 'POST',
        body: report.data,
      });
      // Remove from queue on success
      const deleteTx = db.transaction('pending_reports', 'readwrite');
      await deleteTx.objectStore('pending_reports').delete(report.id);
    } catch (e) {
      console.error('Sync failed for report:', report.id);
    }
  }
}

function openReportDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EDTHDroneReports', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending_reports')) {
        db.createObjectStore('pending_reports', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Push notifications for alerts
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'New drone report',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'drone-alert',
    requireInteraction: true,
    data: data,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'EDTH Alert', options)
  );
});
