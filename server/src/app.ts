import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { productsRouter } from './routes/products.js';
import { authRouter } from './routes/auth.js';
import { cartRouter } from './routes/cart.js';
import { checkoutRouter } from './routes/checkout.js';
import { webhooksRouter } from './routes/webhooks.js';

dotenv.config();

export const app = express();

// Security Headers
app.use(helmet({ contentSecurityPolicy: false }));

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Preserve raw body stream for webhook HMAC signature checks
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// API Endpoint Routing
app.use('/api/v1/products', productsRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/cart', cartRouter);
app.use('/api/v1/checkout', checkoutRouter);
app.use('/api/v1/webhooks', webhooksRouter);

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Homemade Foods Headless WooCommerce API Proxy',
  });
});
