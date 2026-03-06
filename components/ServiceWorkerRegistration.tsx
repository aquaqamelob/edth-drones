'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered:', registration.scope);
          
          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000); // Every hour
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    }
  }, []);

  return null;
}
