import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [products, setProducts] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState('default');
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [preferences, setPreferences] = useState({
    flashSales: true,
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
    categories: ['electronics']
  });
  const [vapidPublicKey, setVapidPublicKey] = useState('');

  useEffect(() => {
    initializeApp();
    loadProducts();
    checkInstallStatus();
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const initializeApp = async () => {
    // Service Worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.log('Service Worker failed:', error);
      }
    }

    setPermission(Notification.permission);
    
    // Get VAPID key
    try {
      const response = await fetch('/api/vapid-public-key');
      const data = await response.json();
      setVapidPublicKey(data.publicKey);
    } catch (error) {
      console.log('Failed to get VAPID key');
    }

    // Check existing subscription
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscription(sub);
      } catch (error) {
        console.log('Error checking subscription:', error);
      }
    }

    // Load saved preferences
    const savedPrefs = localStorage.getItem('pushPreferences');
    if (savedPrefs) setPreferences(JSON.parse(savedPrefs));
  };

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      setProducts(data);
      localStorage.setItem('cachedProducts', JSON.stringify(data));
    } catch (error) {
      const cached = localStorage.getItem('cachedProducts');
      if (cached) {
        setProducts(JSON.parse(cached));
      } else {
        setProducts([
          { id: 1, name: 'Smartphone', price: 599, category: 'electronics' },
          { id: 2, name: 'Laptop', price: 999, category: 'electronics' },
          { id: 3, name: 'Headphones', price: 199, category: 'electronics' },
          { id: 4, name: 'Smart Watch', price: 299, category: 'electronics' },
          { id: 5, name: 'Tablet', price: 449, category: 'electronics' },
          { id: 6, name: 'Camera', price: 799, category: 'electronics' }
        ]);
      }
    }
  };

  const checkInstallStatus = () => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });
  };

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator)) {
      alert('Push notifications not supported');
      return;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        alert('Permission denied for push notifications');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, preferences })
      });

      setSubscription(sub);
      alert('Push notifications enabled! 🎉');
    } catch (error) {
      alert('Failed to enable push notifications');
    }
  };

  const unsubscribeFromPush = async () => {
    if (subscription) {
      try {
        await subscription.unsubscribe();
        await fetch('/api/subscriptions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint })
        });
        setSubscription(null);
        alert('Push notifications disabled');
      } catch (error) {
        console.error('Error unsubscribing:', error);
      }
    }
  };

  const testNotification = async () => {
    if (!subscription) {
      alert('Please enable push notifications first');
      return;
    }

    try {
      await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      alert('Test notification sent!');
    } catch (error) {
      alert('Failed to send test notification');
    }
  };

  const promptInstall = async () => {
    if (!deferredPrompt) {
      alert('Check browser menu for "Add to Home Screen"');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const updatePreferences = (newPreferences) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    localStorage.setItem('pushPreferences', JSON.stringify(updated));

    if (subscription) {
      fetch('/api/subscriptions/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          preferences: updated
        })
      }).catch(error => console.error('Failed to sync preferences'));
    }
  };

  const addToCart = (product) => {
    alert(`Added ${product.name} to cart! 🛒\nPrice: $${product.price}`);
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cart.push({...product, addedAt: new Date()});
    localStorage.setItem('cart', JSON.stringify(cart));
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  return (
    <div className="app">
      {!isOnline && (
        <div className="offline-indicator">
          ⚠️ You are currently offline - App works in offline mode
        </div>
      )}

      <header className="header">
        <h1>🚀 FlashStore PWA</h1>
        <p>Your Complete Mobile Shopping Experience</p>
      </header>

      <div className="action-grid">
        <button className="btn btn-primary" onClick={testNotification} disabled={!subscription}>
          🔔 Test Notifications
        </button>
        <button className={`btn ${subscription ? 'btn-danger' : 'btn-success'}`} onClick={subscription ? unsubscribeFromPush : subscribeToPush}>
          {subscription ? '🔕 Disable Push' : '📱 Enable Push'}
        </button>
        <button className={`btn ${isInstalled ? 'btn-disabled' : 'btn-warning'}`} onClick={promptInstall} disabled={isInstalled || !deferredPrompt}>
          {isInstalled ? '✅ Installed' : '📲 Install App'}
        </button>
      </div>

      <div className="status-panel">
        <h3>📊 PWA Status</h3>
        <div className="status-grid">
          <div className="status-item">
            <span>Service Worker:</span>
            <span className="status-value success">✅ Active</span>
          </div>
          <div className="status-item">
            <span>Push Status:</span>
            <span className={`status-value ${subscription ? 'success' : permission === 'denied' ? 'error' : 'warning'}`}>
              {subscription ? '✅ Subscribed' : permission === 'denied' ? '❌ Denied' : '⚠️ Not Enabled'}
            </span>
          </div>
          <div className="status-item">
            <span>Install Status:</span>
            <span className={`status-value ${isInstalled ? 'success' : 'warning'}`}>
              {isInstalled ? '✅ Installed' : '📱 Installable'}
            </span>
          </div>
          <div className="status-item">
            <span>Network:</span>
            <span className={`status-value ${isOnline ? 'success' : 'warning'}`}>
              {isOnline ? '✅ Online' : '⚠️ Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <h3>⚡ Fast PWA</h3>
          <p>Lightning fast mobile experience with offline support</p>
        </div>
        <div className="feature-card">
          <h3>🔔 Push Alerts</h3>
          <p>Instant flash sale notifications</p>
        </div>
        <div className="feature-card">
          <h3>📱 Installable</h3>
          <p>Add to home screen like a native app</p>
        </div>
      </div>

      <div className="products-section">
        <h2>🎯 Flash Sale Products</h2>
        <div className="products-grid">
          {products.map(product => (
            <div key={product.id} className={`product-card ${!isOnline ? 'offline-product' : ''}`}>
              <div className="product-image">
                <div className="image-placeholder">📸</div>
              </div>
              <h3>{product.name}</h3>
              <p className="product-price">${product.price}</p>
              <button className="btn btn-primary" onClick={() => addToCart(product)}>
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </div>

      {subscription && (
        <div className="preferences-panel">
          <h3>⚙️ Notification Preferences</h3>
          <div className="preferences-grid">
            <label className="preference-item">
              <input type="checkbox" checked={preferences.flashSales} onChange={(e) => updatePreferences({ flashSales: e.target.checked })} />
              Flash Sales Notifications
            </label>
            <label className="preference-item">
              <input type="checkbox" checked={preferences.quietHours.enabled} onChange={(e) => updatePreferences({ quietHours: { ...preferences.quietHours, enabled: e.target.checked } })} />
              Quiet Hours
            </label>
            <div className="preference-item">
              <h4>Categories:</h4>
              {['electronics', 'fashion', 'home', 'sports'].map(category => (
                <label key={category} className="category-label">
                  <input type="checkbox" checked={preferences.categories.includes(category)} onChange={(e) => {
                    const categories = e.target.checked ? [...preferences.categories, category] : preferences.categories.filter(c => c !== category);
                    updatePreferences({ categories });
                  }} />
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;