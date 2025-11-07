import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import webPush from 'web-push';
import { readFileSync } from 'fs';

// Load VAPID keys
const vapidKeys = JSON.parse(readFileSync('./vapid-keys.json'));

webPush.setVapidDetails(
  'mailto:admin@flashstore.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

const app = express();

// Mock database
let subscriptions = [];
let products = [
  { id: 1, name: 'Smartphone', price: 599, category: 'electronics' },
  { id: 2, name: 'Laptop', price: 999, category: 'electronics' },
  { id: 3, name: 'Headphones', price: 199, category: 'electronics' },
  { id: 4, name: 'Smart Watch', price: 299, category: 'electronics' },
  { id: 5, name: 'Tablet', price: 449, category: 'electronics' },
  { id: 6, name: 'Camera', price: 799, category: 'electronics' }
];

// Middleware
app.use(compression());
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/products', (req, res) => {
  res.json(products);
});

app.post('/api/subscriptions', (req, res) => {
  const { subscription, preferences = {} } = req.body;
  
  // Remove if exists
  subscriptions = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
  
  // Add new subscription
  subscriptions.push({
    id: Date.now().toString(),
    subscription,
    preferences: {
      flashSales: true,
      quietHours: { enabled: false, start: '22:00', end: '08:00' },
      categories: ['electronics'],
      ...preferences
    },
    createdAt: new Date(),
    userAgent: req.get('User-Agent')
  });
  
  res.json({ success: true, message: 'Subscription saved' });
});

app.delete('/api/subscriptions', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(sub => sub.endpoint !== endpoint);
  res.json({ success: true, message: 'Subscription removed' });
});

app.put('/api/subscriptions/preferences', (req, res) => {
  const { endpoint, preferences } = req.body;
  const sub = subscriptions.find(s => s.endpoint === endpoint);
  if (sub) {
    sub.preferences = { ...sub.preferences, ...preferences };
  }
  res.json({ success: true, message: 'Preferences updated' });
});

app.post('/api/notifications/test', async (req, res) => {
  try {
    const { endpoint } = req.body;
    const subscription = subscriptions.find(s => s.endpoint === endpoint);
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const payload = JSON.stringify({
      title: '🚀 Flash Sale Started!',
      body: '50% OFF on all electronics! Limited time offer!',
      icon: '/icons/icon-192x192.png',
      image: '/images/flash-sale.jpg',
      badge: '/icons/badge-72x72.png',
      data: {
        url: '/',
        productId: '1',
        action: 'flash-sale'
      },
      actions: [
        { action: 'view', title: 'View Deal' },
        { action: 'dismiss', title: 'Dismiss' }
      ],
      tag: 'flash-sale'
    });

    await webPush.sendNotification(subscription.subscription, payload);
    res.json({ success: true, message: 'Test notification sent' });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    subscriptions: subscriptions.length,
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(0, () => {
  const port = server.address().port;
  console.log(`🚀 Backend running on http://localhost:${port}`);
});