import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';
import compression from 'compression';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import dns from 'dns';

dotenv.config();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());

const allowedOrigins = [
  'https://homemadefoodsmadurai.com',
  'https://www.homemadefoodsmadurai.com',
  'https://homemadefoodsmd.com',
  'https://www.homemadefoodsmd.com',
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'hf-jwt-access-secret-2026-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'hf-jwt-refresh-secret-2026-key';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login or signup attempts. Please try again in 15 minutes.' }
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many checkout attempts. Please try again in 1 hour.' }
});

const syncLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many synchronization requests. Please try again in a moment.' }
});

const userExistenceCache = new Map<number, { exists: boolean; lastChecked: number }>();

async function verifyUserExists(customerId: number): Promise<boolean> {
  const now = Date.now();
  const cached = userExistenceCache.get(customerId);
  if (cached && (now - cached.lastChecked < 60000)) { // 1-minute cache TTL
    return cached.exists;
  }

  try {
    const res = await wcFetch(`customers/${customerId}`);
    if (res.ok && res.data && res.data.id) {
      userExistenceCache.set(customerId, { exists: true, lastChecked: now });
      return true;
    }
  } catch (err: any) {
    console.error(`[User Existence check] failed for customer #${customerId}:`, err.message);
  }

  userExistenceCache.set(customerId, { exists: false, lastChecked: now });
  return false;
}

async function verifyEmailDomain(email: string): Promise<boolean> {
  const domain = email.split('@')[1];
  if (!domain) return false;

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.warn(`[Email Validation Guard] DNS lookup timed out for domain: ${domain}. Falling back to pass.`);
        resolve(true); // Fail-open on timeout
      }
    }, 1500);

    dns.resolveMx(domain, (err, addresses) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      if (err) {
        const errCode = (err as any).code;
        if (errCode === 'ENOTFOUND' || errCode === 'ENODATA') {
          console.warn(`[Email Validation Guard] DNS check failed: domain ${domain} has no mail server records (code: ${errCode}).`);
          resolve(false); // Definitely invalid domain
        } else {
          console.warn(`[Email Validation Guard] DNS query errored for ${domain} (${err.message}). Falling back to pass.`);
          resolve(true); // Fail-open on network/DNS server errors
        }
      } else {
        resolve(addresses && addresses.length > 0);
      }
    });
  });
}

// Middleware to authenticate JWT access tokens
async function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Session token required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email: string };

    if (decoded && decoded.customerId) {
      const exists = await verifyUserExists(decoded.customerId);
      if (!exists) {
        console.warn(`[Auth Guard] Customer #${decoded.customerId} does not exist in WooCommerce database. Rejecting access token.`);
        return res.status(401).json({
          success: false,
          code: 'ACCOUNT_DELETED',
          message: 'Your account has been deleted or deactivated.'
        });
      }
    }

    res.locals.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid', isExpired: true });
  }
}

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'hf_default_secret_encryption_key_32';

function encryptData(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(12);
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, 'a').substring(0, 32));
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err: any) {
    console.error('[Encryption] Failed to encrypt:', err.message);
    return text;
  }
}

function decryptData(encryptedText: string): string {
  if (!encryptedText) return '';
  if (!encryptedText.includes(':')) return encryptedText;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, 'a').substring(0, 32));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.warn('[Decryption] Failed to decrypt, returning raw:', err.message);
    return encryptedText;
  }
}

function parseCookie(req: any, name: string): string | null {
  const rawCookies = req.headers.cookie || '';
  const match = rawCookies.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function getSavedSessionHashes(customerObj: any): any[] {
  if (!customerObj || !Array.isArray(customerObj.meta_data)) return [];
  const meta = customerObj.meta_data.find((m: any) => m.key === 'hf_refresh_tokens');
  if (!meta || !meta.value) return [];
  try {
    const rawVal = typeof meta.value === 'string' ? meta.value : JSON.stringify(meta.value);
    const decrypted = decryptData(rawVal);
    const list = JSON.parse(decrypted);
    return Array.isArray(list) ? list : [];
  } catch {
    try {
      const list = typeof meta.value === 'string' ? JSON.parse(meta.value) : meta.value;
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }
}

async function saveSessionHashes(customerId: string | number, sessions: any[]): Promise<boolean> {
  try {
    const now = new Date();
    let pruned = sessions.filter(s => new Date(s.expiresAt) > now);

    if (pruned.length > 5) {
      pruned.sort((a, b) => new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime());
      pruned = pruned.slice(pruned.length - 5);
    }

    const encryptedVal = encryptData(JSON.stringify(pruned));

    const res = await wcFetch(`customers/${customerId}`, {
      method: 'PUT',
      body: {
        meta_data: [
          { key: 'hf_refresh_tokens', value: encryptedVal }
        ]
      }
    });
    return res.ok;
  } catch (err: any) {
    console.error('[Session] Failed to save session hashes:', err.message);
    return false;
  }
}

async function getProductFromWooCommerceOrCache(productId: string): Promise<any | null> {
  if (cachedProductsResponse && Array.isArray(cachedProductsResponse)) {
    const found = cachedProductsResponse.find(p => p.id === productId);
    if (found) return found;
  }
  try {
    const res = await wcFetch(`products/${productId}`);
    if (res.ok && res.data) {
      const p = res.data;
      const basePrice = parseFloat(p.price || p.regular_price || '70');
      const weightAttr = p.attributes?.find((a: any) => a.name?.toLowerCase() === 'weight')?.options || [];
      let variants: { weight: string; basePrice: number }[] = [];
      if (weightAttr.length > 0) {
        variants = weightAttr.map((opt: string, idx: number) => ({
          weight: decodeHtmlEntities(opt.trim()),
          basePrice: idx === 0 ? basePrice : Math.round(basePrice * (idx === 1 ? 1.8 : 3.4)),
        }));
      } else if (p.weight) {
        variants = [{ weight: decodeHtmlEntities(p.weight), basePrice }];
      } else {
        variants = [{ weight: '250gms', basePrice }];
      }
      return {
        id: p.id.toString(),
        name: decodeHtmlEntities(p.name),
        gstPercentage: 5,
        isAvailable: p.stock_status === 'instock',
        stockQuantity: p.stock_quantity ?? 100,
        variants,
        images: p.images && p.images.length > 0
          ? p.images.map((img: any) => ({
              id: img.id,
              src: img.src,
              alt: decodeHtmlEntities(img.alt || p.name)
            }))
          : [{ id: 0, src: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80', alt: decodeHtmlEntities(p.name) }]
      };
    }
  } catch (err: any) {
    console.error(`Failed to get product ${productId} from WooCommerce:`, err.message);
  }
  return null;
}

async function getReservedQuantities(): Promise<Record<number, number>> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const reservedMap: Record<number, number> = {};
  
  try {
    const res = await wcFetch('orders', {
      params: {
        status: 'pending',
        after: tenMinutesAgo,
        per_page: 100
      }
    });
    
    if (res.ok && Array.isArray(res.data)) {
      for (const order of res.data) {
        if (order.line_items && Array.isArray(order.line_items)) {
          for (const item of order.line_items) {
            const pid = parseInt(item.product_id, 10);
            if (!isNaN(pid)) {
              reservedMap[pid] = (reservedMap[pid] || 0) + parseInt(item.quantity || '0', 10);
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Inventory Reservation] Failed to fetch recent pending orders:', err.message);
  }
  
  return reservedMap;
}

async function validateCouponCode(couponCode: string, cartSubtotal: number): Promise<{
  isValid: boolean;
  discountAmount: number;
  message: string;
} | null> {
  if (!couponCode) return null;
  try {
    const res = await wcFetch('coupons', { params: { code: couponCode.trim().toUpperCase() } });
    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      const coupon = res.data[0];
      
      if (coupon.date_expires) {
        const expiry = new Date(coupon.date_expires);
        if (expiry < new Date()) {
          return { isValid: false, discountAmount: 0, message: 'Coupon has expired' };
        }
      }

      const minSpend = parseFloat(coupon.minimum_amount || '0');
      if (minSpend > 0 && cartSubtotal < minSpend) {
        return { isValid: false, discountAmount: 0, message: `Minimum spend of ₹${minSpend} required` };
      }

      const maxSpend = parseFloat(coupon.maximum_amount || '0');
      if (maxSpend > 0 && cartSubtotal > maxSpend) {
        return { isValid: false, discountAmount: 0, message: `Coupon only valid for spend below ₹${maxSpend}` };
      }

      const amount = parseFloat(coupon.amount || '0');
      let discountAmount = 0;
      if (coupon.discount_type === 'percent') {
        discountAmount = Math.round(cartSubtotal * (amount / 100));
      } else {
        discountAmount = Math.round(amount);
      }

      return {
        isValid: true,
        discountAmount: Math.min(discountAmount, cartSubtotal),
        message: 'Coupon applied successfully'
      };
    } else {
      return { isValid: false, discountAmount: 0, message: 'Invalid coupon code' };
    }
  } catch (err: any) {
    console.error('Coupon validation failed:', err.message);
    return { isValid: false, discountAmount: 0, message: 'Error validating coupon code' };
  }
}

function validatePincodeAndShipping(pincode: string, subtotal: number): {
  isValid: boolean;
  deliveryAvailable: boolean;
  estimatedDays: string;
  shippingCharge: number;
  message: string;
} {
  const pin = pincode.trim();
  if (!/^\d{6}$/.test(pin)) {
    return { isValid: false, deliveryAvailable: false, estimatedDays: '', shippingCharge: 0, message: 'Invalid 6-digit pincode format' };
  }

  const pinVal = parseInt(pin, 10);

  if (pinVal >= 625001 && pinVal <= 625020) {
    const charge = subtotal >= 499 ? 0 : 40;
    return {
      isValid: true,
      deliveryAvailable: true,
      estimatedDays: 'Same Day',
      shippingCharge: charge,
      message: 'Local express delivery available'
    };
  }

  if (pinVal >= 625021 && pinVal <= 625100) {
    return {
      isValid: true,
      deliveryAvailable: true,
      estimatedDays: '1-2 Days',
      shippingCharge: 40,
      message: 'Madurai district delivery available'
    };
  }

  const prefix = pin.substring(0, 2);
  const prefixNum = parseInt(prefix, 10);
  if (prefixNum >= 60 && prefixNum <= 64) {
    return {
      isValid: true,
      deliveryAvailable: true,
      estimatedDays: '3-5 Days',
      shippingCharge: 80,
      message: 'Standard Tamil Nadu shipping'
    };
  }

  if (prefixNum >= 11 && prefixNum <= 85) {
    return {
      isValid: true,
      deliveryAvailable: true,
      estimatedDays: '5-7 Days',
      shippingCharge: 120,
      message: 'Standard Domestic shipping'
    };
  }

  return {
    isValid: false,
    deliveryAvailable: false,
    estimatedDays: '',
    shippingCharge: 0,
    message: 'Delivery not supported for this location'
  };
}

const processedOperationsMap = new Map<string, number>();
function isOperationProcessed(opId: string): boolean {
  if (!opId) return false;
  const timestamp = processedOperationsMap.get(opId);
  if (timestamp && Date.now() - timestamp < 10 * 60 * 1000) {
    return true;
  }
  return false;
}

function markOperationProcessed(opId: string) {
  if (opId) {
    processedOperationsMap.set(opId, Date.now());
    if (processedOperationsMap.size > 2000) {
      const now = Date.now();
      for (const [key, val] of processedOperationsMap.entries()) {
        if (now - val > 10 * 60 * 1000) {
          processedOperationsMap.delete(key);
        }
      }
    }
  }
}

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// In-Memory & File Persistent Caches
let cachedProductsResponse: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15 * 1000; // 15 seconds product cache TTL
const userCartsMap = new Map<string, any[]>();
const userCartLocks = new Map<string, number>();
const globalPasswordMap = new Map<string, string>();
const recentCreatedOrdersMap = new Map<string, { wcOrderId: number; orderRefCode: string; razorpayOrderId: string; amount: number; amountInPaise: number; keyId: string; timestamp: number }>();

const PASS_FILE = path.join('/tmp', 'hf_passwords.json');

function getSavedPassword(email: string): string | undefined {
  const clean = (email || '').toLowerCase().trim();
  if (!clean) return undefined;
  if (globalPasswordMap.has(clean)) return globalPasswordMap.get(clean);
  try {
    if (fs.existsSync(PASS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PASS_FILE, 'utf-8'));
      if (data && data[clean]) {
        globalPasswordMap.set(clean, data[clean]);
        return data[clean];
      }
    }
  } catch {}
  return undefined;
}

function setSavedPassword(email: string, pass: string) {
  const clean = (email || '').toLowerCase().trim();
  if (!clean || !pass) return;
  globalPasswordMap.set(clean, pass);
  try {
    let data: Record<string, string> = {};
    if (fs.existsSync(PASS_FILE)) {
      data = JSON.parse(fs.readFileSync(PASS_FILE, 'utf-8')) || {};
    }
    data[clean] = pass;
    fs.writeFileSync(PASS_FILE, JSON.stringify(data), 'utf-8');
  } catch {}
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

let cachedSecurityCookie = 'humans_21909=1';

// Native Node fetch wrapper for WooCommerce REST API (Zero external CJS module issues on Vercel)
async function wcFetch(endpoint: string, options: { method?: string; body?: any; params?: Record<string, any> } = {}) {
  const storeUrl = (process.env.WC_STORE_URL || 'https://admin.homemadefoodsmadurai.com').replace(/\/$/, '');
  const consumerKey = process.env.WC_CONSUMER_KEY || 'ck_48a6c149fa81c87736460d25a0af0c9b439d8a49';
  const consumerSecret = process.env.WC_CONSUMER_SECRET || 'cs_77c182f6d49a3626a55a57da825c54231ae3fb43';

  const queryParams = new URLSearchParams({
    consumer_key: consumerKey,
    consumer_secret: consumerSecret,
    ...(options.params || {}),
  });

  const url = `${storeUrl}/wp-json/wc/v3/${endpoint.replace(/^\//, '')}?${queryParams.toString()}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (cachedSecurityCookie) {
    headers['Cookie'] = cachedSecurityCookie;
  }

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    let response = await fetch(url, fetchOptions);
    let text = await response.text();

    // Check for DDoS cookie challenge: e.g. <script>document.cookie = "humans_21909=1"; ...
    if (text.includes('document.cookie =') && text.includes('reload')) {
      const match = text.match(/document\.cookie\s*=\s*"([^"]+)"/);
      if (match && match[1]) {
        cachedSecurityCookie = match[1];
        console.log('[wcFetch] Detected new DDoS cookie wall challenge. Retrying with:', cachedSecurityCookie);

        // Update headers and retry once
        headers['Cookie'] = cachedSecurityCookie;
        response = await fetch(url, fetchOptions);
        text = await response.text();
      }
    }

    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      console.warn(`[wcFetch] Failed to parse JSON response from ${endpoint}. Response length: ${text.length}`);
    }

    return { ok: response.ok, status: response.status, data };
  } catch (err: any) {
    console.error(`wcFetch network error for ${endpoint}:`, err.message);
    return { ok: false, status: 500, data: null, error: err.message };
  }
}

function getRazorpayClient() {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'mw34w1wZGXkKlbZYTEDcMKu7';

    return new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  } catch (err: any) {
    console.warn('Razorpay init warning:', err.message);
    return null;
  }
}

// Helper to generate secure, unguessable Order Reference Code (e.g. HF-84921-B4)
function generateOrderRefCode(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `HF-${randomNum}-${randomSuffix}`;
}

function getOrderStatusDetails(status: string): { stage: number; label: string } {
  const s = (status || '').toLowerCase().trim().replace(/^wc-/, '');

  if (s === 'completed' || s === 'delivered') {
    return { stage: 4, label: 'Successfully Delivered' };
  }
  if (s === 'dispatched' || s === 'shipped' || s === 'out_for_delivery' || s === 'out-for-delivery' || s.includes('dispatch') || s.includes('ship')) {
    return { stage: 3, label: 'Dispatched & Out for Delivery' };
  }
  if (s === 'kitchen' || s === 'on-hold' || s === 'on_hold' || s.includes('kitchen')) {
    return { stage: 2, label: 'Kitchen Preparation' };
  }
  if (s === 'confirmed' || s === 'processing' || s === 'auto-draft' || s.includes('process')) {
    return { stage: 1, label: 'Order Confirmed' };
  }
  if (s === 'pending' || s === 'pending-payment' || s === 'cancelled' || s === 'refunded' || s === 'failed') {
    let label = 'Payment Pending';
    if (s === 'failed') label = 'Payment Failed';
    if (s === 'cancelled') label = 'Order Cancelled';
    if (s === 'refunded') label = 'Order Refunded';
    return { stage: 0, label };
  }

  return { stage: 2, label: status || 'Order Confirmed' };
}

// Retroactive Guest Order Linker: Links unassigned guest orders matching user email to WooCommerce customer account
async function linkGuestOrdersToCustomer(email: string, customerId: string | number) {
  if (!email || !customerId || !/^\d+$/.test(customerId.toString())) return;
  try {
    const ordersRes = await wcFetch('orders', { params: { per_page: 100 } });
    if (ordersRes.ok && Array.isArray(ordersRes.data)) {
      const cleanEmail = email.toLowerCase().trim();
      const guestOrders = ordersRes.data.filter((o: any) => {
        const oEmail = (o.billing?.email || '').toLowerCase().trim();
        return oEmail === cleanEmail && (!o.customer_id || o.customer_id === 0);
      });

      for (const order of guestOrders) {
        await wcFetch(`orders/${order.id}`, {
          method: 'PUT',
          body: { customer_id: parseInt(customerId.toString()) },
        });
      }
    }
  } catch (err: any) {
    console.warn('Guest order linking warning:', err.message);
  }
}

// Transactional Email Dispatcher for Order Confirmation & Tracking
async function sendOrderTrackingEmail(options: {
  toEmail: string;
  customerName: string;
  orderRefCode: string;
  wcOrderId: number | string;
  totalAmount: number;
  items?: Array<{ name: string; quantity: number; pricePerUnit?: number; weight?: string }>;
  shippingAddress?: string;
  phone?: string;
  trackingLink: string;
}) {
  try {
    const { toEmail, customerName, orderRefCode, wcOrderId, totalAmount, items = [], shippingAddress = '', phone = '', trackingLink } = options;
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';

    if (!smtpUser || !smtpPass) {
      console.log(`✉️ Email notification logged (SMTP credentials not configured): Order ${orderRefCode} (#${wcOrderId}) for ${toEmail}. Track Link: ${trackingLink}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const itemsHtml = items.length > 0
      ? items.map((item) => `
        <tr style="border-bottom: 1px solid #f0f0f0;">
          <td style="padding: 12px 8px; font-weight: bold; color: #1F2937;">${item.name}</td>
          <td style="padding: 12px 8px; text-align: center; color: #6B7280;">${item.weight || 'Standard'}</td>
          <td style="padding: 12px 8px; text-align: center; font-weight: bold; color: #1F2937;">${item.quantity}</td>
          <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: #95CD1A;">₹${(item.pricePerUnit || 0) * item.quantity}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #6B7280;">Authentic Homemade South Indian Food Package</td></tr>`;

    const mailOptions = {
      from: `"Homemade Foods" <${smtpUser}>`,
      to: toEmail,
      subject: `🎉 Order Confirmed! Reference: ${orderRefCode}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation - Homemade Foods</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F7FCE8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1F2937;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
            <tr>
              <td align="center" style="padding: 20px 10px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #ECF9CA;">
                  <tr>
                    <td align="center" style="background-color: #95CD1A; padding: 32px 24px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">Homemade Foods</h1>
                      <p style="color: #ffffff; margin: 6px 0 0 0; font-size: 14px; font-weight: 600; opacity: 0.95;">A taste of tradition in every bite.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 32px 28px;">
                      <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px 0; color: #1F2937;">
                        Thank you for your order, ${customerName}! 🎉
                      </h2>
                      <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 16px 0;">
                        We have received your payment and our kitchen team has started preparing your fresh, traditional South Indian delicacies.
                      </p>
                      <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0; background-color: #FAFBF6; padding: 14px; border-left: 4px solid #95CD1A; border-radius: 8px;">
                        💡 <strong>Order Tracking Info:</strong> You can track this order anytime on our website using your <strong>Order ID: <span style="font-family: monospace; font-size: 15px; color: #95CD1A;">${orderRefCode}</span></strong>.
                      </p>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAFBF6; border: 1px solid #ECF9CA; border-radius: 14px; padding: 18px; margin-bottom: 24px;">
                        <tr>
                          <td>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                              <tr>
                                <td style="padding-bottom: 8px; font-size: 13px; color: #6B7280;">Order Reference:</td>
                                <td style="padding-bottom: 8px; font-size: 15px; font-weight: 900; color: #95CD1A; text-align: right;">${orderRefCode}</td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 8px; font-size: 13px; color: #6B7280;">Store Order ID:</td>
                                <td style="padding-bottom: 8px; font-size: 13px; font-weight: 800; color: #1F2937; text-align: right;">#${wcOrderId}</td>
                              </tr>
                              <tr>
                                <td style="padding-bottom: 8px; font-size: 13px; color: #6B7280;">Payment Status:</td>
                                <td style="padding-bottom: 8px; font-size: 13px; font-weight: 800; color: #10B981; text-align: right;">✓ Paid via Razorpay</td>
                              </tr>
                              <tr>
                                <td style="font-size: 13px; color: #6B7280;">Current Status:</td>
                                <td style="font-size: 13px; font-weight: 800; color: #1F2937; text-align: right;">🍳 Kitchen Prep & Packing</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      <h3 style="font-size: 15px; font-weight: 800; margin: 0 0 12px 0; color: #1F2937; text-transform: uppercase; letter-spacing: 0.5px;">Order Items Summary</h3>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px; font-size: 13px;">
                        <thead>
                          <tr style="background-color: #F9FAFB; border-bottom: 2px solid #E5E7EB;">
                            <th align="left" style="padding: 10px 8px; font-weight: 800; color: #374151;">Food Item</th>
                            <th align="center" style="padding: 10px 8px; font-weight: 800; color: #374151;">Pack</th>
                            <th align="center" style="padding: 10px 8px; font-weight: 800; color: #374151;">Qty</th>
                            <th align="right" style="padding: 10px 8px; font-weight: 800; color: #374151;">Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${itemsHtml}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colspan="3" align="right" style="padding: 12px 8px 4px 8px; font-size: 13px; color: #6B7280; font-weight: 600;">Delivery Charge:</td>
                            <td align="right" style="padding: 12px 8px 4px 8px; font-size: 13px; font-weight: 800; color: #1F2937;">₹40</td>
                          </tr>
                          <tr>
                            <td colspan="3" align="right" style="padding: 4px 8px 12px 8px; font-size: 16px; font-weight: 900; color: #1F2937;">Total Amount Paid:</td>
                            <td align="right" style="padding: 4px 8px 12px 8px; font-size: 18px; font-weight: 900; color: #95CD1A;">₹${totalAmount}</td>
                          </tr>
                        </tfoot>
                      </table>
                      ${shippingAddress ? `
                      <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
                        <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 800; color: #374151; text-transform: uppercase;">Shipping Address</h4>
                        <p style="margin: 0; font-size: 13px; color: #4B5563; line-height: 1.5;">
                          <strong>${customerName}</strong> (${phone})<br/>
                          ${shippingAddress}
                        </p>
                      </div>
                      ` : ''}
                      <div style="text-align: center; margin: 32px 0 24px 0;">
                        <a href="${trackingLink}" style="background-color: #95CD1A; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 14px; font-weight: 900; font-size: 15px; display: inline-block; box-shadow: 0 6px 20px rgba(149, 205, 26, 0.35);">
                          🚚 Track Your Order Live →
                        </a>
                      </div>
                      <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin: 0;">
                        Tracking link: <a href="${trackingLink}" style="color: #95CD1A;">${trackingLink}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="background-color: #F9FAFB; padding: 20px 24px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; text-align: center;">
                      <p style="margin: 0 0 4px 0; font-weight: 700; color: #374151;">Homemade Foods Madurai</p>
                      <p style="margin: 0;">Handcrafted traditional delicacies • Madurai, Tamil Nadu, India</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✉️ Professional order confirmation email sent to ${toEmail} for Order Ref ${orderRefCode}`);
  } catch (err: any) {
    console.warn('Email sending warning:', err.message);
  }
}

function filterProducts(list: any[], category?: any, search?: any, inStock?: any) {
  let filtered = [...list];
  if (category && category !== 'all') {
    const rawCat = String(category).toLowerCase().trim();
    const catQuery = rawCat.endsWith('s') ? rawCat.slice(0, -1) : rawCat;
    filtered = filtered.filter((p: any) => {
      const cId = (p.categoryId || '').toLowerCase();
      const cName = (p.categoryName || '').toLowerCase();
      return cId.includes(catQuery) || catQuery.includes(cId) || cName.includes(catQuery);
    });
  }
  if (search) {
    const sQuery = String(search).toLowerCase().trim();
    filtered = filtered.filter((p: any) =>
      (p.name || '').toLowerCase().includes(sQuery) ||
      (p.categoryName || '').toLowerCase().includes(sQuery) ||
      (p.description || '').toLowerCase().includes(sQuery)
    );
  }
  if (inStock === 'true') {
    filtered = filtered.filter((p: any) => p.isAvailable);
  }
  return filtered;
}

// GET /api/v1/products & /products
app.get(['/api/v1/products', '/api/products', '/v1/products', '/products'], async (req, res) => {
  try {
    const { category, search, inStock, forceRefresh } = req.query;
    const now = Date.now();

    if (!forceRefresh && !search && cachedProductsResponse && (now - lastCacheTime < CACHE_TTL_MS)) {
      const filtered = filterProducts(cachedProductsResponse, category, search, inStock);
      return res.json({ success: true, source: 'cache', count: filtered.length, data: filtered });
    }

    let formattedProducts: any[] = [];
    try {
      const wcRes = await wcFetch('products', { params: { per_page: 100 } });
      if (wcRes.ok && Array.isArray(wcRes.data) && wcRes.data.length > 0) {
        formattedProducts = wcRes.data.map((p: any) => {
          const primaryCategory = p.categories && p.categories.length > 0 ? p.categories[0] : {};
          const basePrice = parseFloat(p.price || p.regular_price || '70');

          const weightAttr = p.attributes?.find((a: any) => a.name?.toLowerCase() === 'weight')?.options || [];
          let variants: { weight: string; basePrice: number }[] = [];

          if (weightAttr.length > 0) {
            variants = weightAttr.map((opt: string, idx: number) => ({
              weight: decodeHtmlEntities(opt.trim()),
              basePrice: idx === 0 ? basePrice : Math.round(basePrice * (idx === 1 ? 1.8 : 3.4)),
            }));
          } else if (p.weight) {
            variants = [{ weight: decodeHtmlEntities(p.weight), basePrice }];
          } else {
            variants = [{ weight: '250gms', basePrice }];
          }

          return {
            id: p.id.toString(),
            name: decodeHtmlEntities(p.name),
            slug: p.slug || `prod-${p.id}`,
            categoryId: primaryCategory.slug || 'general',
            categoryName: decodeHtmlEntities(primaryCategory.name || 'Traditional Delicacies'),
            description: decodeHtmlEntities(p.description?.replace(/<[^>]*>?/gm, '') || p.short_description?.replace(/<[^>]*>?/gm, '') || ''),
            ingredients: decodeHtmlEntities(p.attributes?.find((a: any) => a.name?.toLowerCase() === 'ingredients')?.options?.join(', ') || ''),
            shelfLife: decodeHtmlEntities(p.attributes?.find((a: any) => a.name?.toLowerCase() === 'shelf life')?.options?.join(', ') || '6 Months'),
            storageInstructions: 'Store in a cool dry place.',
            imageUrl: p.images && p.images.length > 0 ? p.images[0].src : 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
            images: p.images && p.images.length > 0
              ? p.images.map((img: any) => ({
                  id: img.id,
                  src: img.src,
                  alt: decodeHtmlEntities(img.alt || p.name)
                }))
              : [{ id: 0, src: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80', alt: decodeHtmlEntities(p.name) }],
            gstPercentage: 5,
            isAvailable: p.stock_status === 'instock',
            stockQuantity: p.stock_quantity ?? 100,
            variants,
          };
        });
      }
    } catch (wcErr: any) {
      console.warn('WooCommerce products fetch warning:', wcErr?.message || wcErr);
    }

    if (formattedProducts.length > 0) {
      cachedProductsResponse = formattedProducts;
      lastCacheTime = now;
    } else if (cachedProductsResponse && cachedProductsResponse.length > 0) {
      formattedProducts = cachedProductsResponse;
    }

    const filtered = filterProducts(formattedProducts, category, search, inStock);
    return res.json({ success: true, source: formattedProducts === cachedProductsResponse ? 'cache' : 'woocommerce', count: filtered.length, data: filtered });
  } catch (error: any) {
    console.error('Error in /products endpoint:', error?.message || error);
    const fallback = cachedProductsResponse || [];
    const filtered = filterProducts(fallback, req.query.category, req.query.search, req.query.inStock);
    return res.json({ success: true, source: 'fallback', count: filtered.length, data: filtered });
  }
});

// GET /api/v1/products/categories
app.get(['/api/v1/products/categories', '/products/categories'], async (_req, res) => {
  try {
    const wcRes = await wcFetch('products/categories', { params: { per_page: 100, hide_empty: false } });
    const categories = wcRes.ok && Array.isArray(wcRes.data) ? wcRes.data : [];
    return res.json({ success: true, data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

function getDeterministicUserId(email: string): string {
  const clean = email.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString();
}

function extractPassFromUser(userObj: any): string | undefined {
  if (!userObj) return undefined;
  const bComp = userObj.billing?.company || '';
  if (bComp.startsWith('HF_PASS:')) return bComp.replace('HF_PASS:', '');
  const sComp = userObj.shipping?.company || '';
  if (sComp.startsWith('HF_PASS:')) return sComp.replace('HF_PASS:', '');
  const bAddr2 = userObj.billing?.address_2 || '';
  if (bAddr2.startsWith('HF_PASS:')) return bAddr2.replace('HF_PASS:', '');
  const meta = (userObj.meta_data || []).find((m: any) =>
    m.key === 'hf_account_pass' || m.key === 'customer_auth_pass' || m.key === '_customer_auth_pass'
  );
  return meta?.value;
}

const loginSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  phone: z.string().optional(),
  deviceId: z.string().min(1),
  deviceName: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  deviceId: z.string().min(1),
  deviceName: z.string().optional()
});

async function sendEmailOtp(email: string, otp: string) {
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn('[Mail] SMTP credentials not set. OTP is:', otp);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 587,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const mailOptions = {
    from: `"Homemade Foods Support" <${smtpUser}>`,
    to: email,
    subject: `Password Reset Verification Code: ${otp}`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #1F2937; margin-bottom: 20px;">Password Reset Request</h2>
        <p style="color: #4B5563; font-size: 14px;">We received a request to reset your password. Use the following verification code to complete the process:</p>
        <div style="padding: 16px; background-color: #FAFBF6; border: 1px solid #ECF9CA; border-radius: 8px; font-size: 24px; font-weight: bold; color: #95CD1A; text-align: center; margin: 20px 0; letter-spacing: 4px;">
          ${otp}
        </div>
        <p style="color: #9CA3AF; font-size: 11px;">This code will expire in 15 minutes. If you did not make this request, you can safely ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err: any) {
    console.error('[Mail] Failed to send OTP email:', err.message);
  }
}

// POST /api/v1/auth/login-signup (Instant Auto-Registration & Customer Login)
app.post(['/api/v1/auth/login-signup', '/api/auth/login-signup', '/v1/auth/login-signup', '/auth/login-signup'], authLimiter, async (req, res) => {
  try {
    const parsed = loginSignupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid request fields', errors: parsed.error.format() });
    }

    const { email, password, name, phone, deviceId, deviceName } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    const fullName = (name || 'Customer').trim();
    const firstName = fullName.split(' ')[0] || 'Customer';
    const lastName = fullName.split(' ').slice(1).join(' ') || '';
    const cleanPhone = (phone || '').trim();

    let customerId = '';
    let customerUser: any = null;

    try {
      const searchRes = await wcFetch('customers', { params: { email: cleanEmail } });
      if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        const found = searchRes.data[0];
        customerId = found.id.toString();
        try {
          const fullCustRes = await wcFetch(`customers/${customerId}`);
          customerUser = (fullCustRes.ok && fullCustRes.data) ? fullCustRes.data : found;
        } catch {
          customerUser = found;
        }
      }
    } catch {}

    const storedPass = getSavedPassword(cleanEmail) || extractPassFromUser(customerUser);
    const isExistingUser = !!customerUser || !!storedPass;

    if (isExistingUser) {
      if (storedPass) {
        if (cleanPassword !== storedPass) {
          return res.status(401).json({
            success: false,
            message: 'Incorrect password. An account already exists for this email address. Please enter the correct password linked to your account.',
          });
        }
      } else if (cleanPassword) {
        setSavedPassword(cleanEmail, cleanPassword);
        if (customerUser && customerId) {
          try {
            await wcFetch(`customers/${customerId}`, {
              method: 'PUT',
              body: {
                billing: { company: `HF_PASS:${cleanPassword}`, address_2: `HF_PASS:${cleanPassword}` },
                shipping: { company: `HF_PASS:${cleanPassword}` },
                meta_data: [
                  { key: 'hf_account_pass', value: cleanPassword },
                  { key: 'customer_auth_pass', value: cleanPassword },
                  { key: '_customer_auth_pass', value: cleanPassword },
                ],
              },
            });
          } catch {}
        }
      }
    }

    if (!customerUser) {
      const username = `${cleanEmail.split('@')[0]}_${Math.floor(1000 + Math.random() * 9000)}`;
      const customerPayload = {
        email: cleanEmail,
        first_name: firstName,
        last_name: lastName,
        username,
        billing: {
          first_name: firstName,
          last_name: lastName,
          email: cleanEmail,
          phone: cleanPhone,
          company: `HF_PASS:${cleanPassword}`,
          address_2: `HF_PASS:${cleanPassword}`,
        },
        shipping: {
          first_name: firstName,
          last_name: lastName,
          company: `HF_PASS:${cleanPassword}`,
        },
        meta_data: [
          { key: 'hf_account_pass', value: cleanPassword },
          { key: 'customer_auth_pass', value: cleanPassword },
          { key: '_customer_auth_pass', value: cleanPassword },
          { key: 'hf_cart_revision', value: '1' },
          { key: 'hf_wishlist_revision', value: '1' },
          { key: 'hf_profile_revision', value: '1' },
          { key: 'hf_address_revision', value: '1' }
        ],
      };

      try {
        const wcRes = await wcFetch('customers', { method: 'POST', body: customerPayload });
        if (wcRes.ok && wcRes.data && wcRes.data.id) {
          customerUser = wcRes.data;
          customerId = wcRes.data.id.toString();
        }
      } catch {
        customerId = getDeterministicUserId(cleanEmail);
        customerUser = { id: customerId, email: cleanEmail, first_name: firstName, last_name: lastName };
      }

      setSavedPassword(cleanEmail, cleanPassword);
    }

    if (!customerId) {
      customerId = getDeterministicUserId(cleanEmail);
    }

    // Retroactively claim guest orders
    linkGuestOrdersToCustomer(cleanEmail, customerId);

    // Create session & JWTs
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const accessToken = jwt.sign({ customerId: parseInt(customerId, 10), email: cleanEmail }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ customerId: parseInt(customerId, 10), sessionId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    const activeSessions = getSavedSessionHashes(customerUser);
    activeSessions.push({
      hash: sha256(refreshToken),
      deviceId: deviceId,
      deviceName: deviceName || 'Web Browser',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: new Date().toISOString()
    });

    await saveSessionHashes(customerId, activeSessions);

    res.cookie('jid', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      isNewUser: !isExistingUser,
      user: {
        id: customerId,
        email: cleanEmail,
        firstName: customerUser?.first_name || firstName,
        lastName: customerUser?.last_name || lastName,
        displayName: `${customerUser?.first_name || firstName} ${customerUser?.last_name || lastName}`.trim(),
        phone: customerUser?.billing?.phone || cleanPhone,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Authentication failed' });
  }
});

// POST /api/v1/auth/login
app.post(['/api/v1/auth/login', '/api/auth/login', '/v1/auth/login', '/auth/login'], authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Invalid request fields', errors: parsed.error.format() });
    }

    const { email, password, deviceId, deviceName } = parsed.data;
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    let customerUser: any = null;
    let customerId = '';
    try {
      const searchRes = await wcFetch('customers', { params: { email: cleanEmail } });
      if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        const found = searchRes.data[0];
        customerId = found.id.toString();
        try {
          const fullRes = await wcFetch(`customers/${customerId}`);
          customerUser = fullRes.ok && fullRes.data ? fullRes.data : found;
        } catch {
          customerUser = found;
        }
      }
    } catch {}

    const storedPass = getSavedPassword(cleanEmail) || extractPassFromUser(customerUser);
    const isExistingUser = !!customerUser || !!storedPass;

    if (isExistingUser) {
      if (storedPass) {
        if (cleanPassword !== storedPass) {
          return res.status(401).json({
            success: false,
            message: 'Incorrect password. An account already exists for this email address. Please enter the correct password linked to your account.',
          });
        }
      } else if (cleanPassword) {
        setSavedPassword(cleanEmail, cleanPassword);
        if (customerUser && customerId) {
          try {
            await wcFetch(`customers/${customerId}`, {
              method: 'PUT',
              body: {
                billing: { company: `HF_PASS:${cleanPassword}`, address_2: `HF_PASS:${cleanPassword}` },
                shipping: { company: `HF_PASS:${cleanPassword}` },
                meta_data: [
                  { key: 'hf_account_pass', value: cleanPassword },
                  { key: 'customer_auth_pass', value: cleanPassword },
                  { key: '_customer_auth_pass', value: cleanPassword },
                ],
              },
            });
          } catch {}
        }
      }
    } else {
      return res.status(404).json({ success: false, message: 'Account not found. Please sign up.' });
    }

    const id = customerId || `usr_${Date.now()}`;
    const fn = customerUser?.first_name || cleanEmail.split('@')[0];
    const ln = customerUser?.last_name || '';

    // Create session & JWTs
    const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const accessToken = jwt.sign({ customerId: parseInt(id, 10), email: cleanEmail }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ customerId: parseInt(id, 10), sessionId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    const activeSessions = getSavedSessionHashes(customerUser);
    activeSessions.push({
      hash: sha256(refreshToken),
      deviceId: deviceId,
      deviceName: deviceName || 'Web Browser',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: new Date().toISOString()
    });

    await saveSessionHashes(id, activeSessions);

    res.cookie('jid', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id,
        email: cleanEmail,
        firstName: fn,
        lastName: ln,
        displayName: `${fn} ${ln}`.trim(),
        phone: customerUser?.billing?.phone || '',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/auth/refresh
app.post(['/api/v1/auth/refresh', '/api/auth/refresh', '/v1/auth/refresh', '/auth/refresh'], async (req, res) => {
  try {
    const tokenFromCookie = parseCookie(req, 'jid');
    const { refreshToken: tokenFromBody, deviceId, deviceName } = req.body;
    const token = tokenFromCookie || tokenFromBody;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const { customerId } = decoded;
    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      userExistenceCache.set(customerId, { exists: false, lastChecked: Date.now() });
      return res.status(401).json({ success: false, code: 'ACCOUNT_DELETED', message: 'Customer account not found' });
    }

    const customerUser = custRes.data;
    const sessions = getSavedSessionHashes(customerUser);
    const tokenHash = sha256(token);

    const sessionIdx = sessions.findIndex(s => s.hash === tokenHash);
    if (sessionIdx === -1) {
      return res.status(401).json({ success: false, message: 'Session invalid or revoked' });
    }

    const session = sessions[sessionIdx];
    if (new Date(session.expiresAt) < new Date()) {
      sessions.splice(sessionIdx, 1);
      await saveSessionHashes(customerId, sessions);
      return res.status(401).json({ success: false, message: 'Session expired' });
    }

    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const newAccessToken = jwt.sign({ customerId, email: customerUser.email }, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ customerId, sessionId: newSessionId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
    const newHash = sha256(newRefreshToken);

    sessions[sessionIdx] = {
      hash: newHash,
      deviceId: deviceId || session.deviceId || 'unknown_device',
      deviceName: deviceName || session.deviceName || 'Web Browser',
      createdAt: session.createdAt,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: new Date().toISOString()
    };

    await saveSessionHashes(customerId, sessions);

    res.cookie('jid', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/auth/logout
app.post(['/api/v1/auth/logout', '/api/auth/logout', '/v1/auth/logout', '/auth/logout'], async (req, res) => {
  try {
    const tokenFromCookie = parseCookie(req, 'jid');
    const { refreshToken: tokenFromBody } = req.body;
    const token = tokenFromCookie || tokenFromBody;

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { customerId: number };
        const { customerId } = decoded;
        const custRes = await wcFetch(`customers/${customerId}`);
        if (custRes.ok && custRes.data) {
          const sessions = getSavedSessionHashes(custRes.data);
          const hashVal = sha256(token);
          const filtered = sessions.filter(s => s.hash !== hashVal);
          await saveSessionHashes(customerId, filtered);
        }
      } catch {}
    }

    res.clearCookie('jid', { httpOnly: true, secure: true, sameSite: 'none' });
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/auth/logout-all
app.post(['/api/v1/auth/logout-all', '/api/auth/logout-all', '/v1/auth/logout-all', '/auth/logout-all'], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;
    await saveSessionHashes(customerId, []);
    res.clearCookie('jid', { httpOnly: true, secure: true, sameSite: 'none' });
    return res.json({ success: true, message: 'Logged out of all sessions' });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/auth/forgot-password
app.post(['/api/v1/auth/forgot-password', '/api/auth/forgot-password', '/v1/auth/forgot-password', '/auth/forgot-password'], authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const searchRes = await wcFetch('customers', { params: { email: cleanEmail } });
    if (!searchRes.ok || !Array.isArray(searchRes.data) || searchRes.data.length === 0) {
      return res.status(404).json({ success: false, message: 'No account found with this email address' });
    }

    const customer = searchRes.data[0];
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await wcFetch(`customers/${customer.id}`, {
      method: 'PUT',
      body: {
        meta_data: [
          { key: 'hf_reset_otp', value: otp },
          { key: 'hf_reset_otp_expiry', value: expiry }
        ]
      }
    });

    await sendEmailOtp(cleanEmail, otp);

    return res.json({
      success: true,
      message: 'Verification code sent to your email address',
      testOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/auth/reset-password
app.post(['/api/v1/auth/reset-password', '/api/auth/reset-password', '/v1/auth/reset-password', '/auth/reset-password'], authLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();
    const cleanPassword = (newPassword || '').trim();

    if (!cleanEmail || !cleanOtp || !cleanPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const searchRes = await wcFetch('customers', { params: { email: cleanEmail } });
    if (!searchRes.ok || !Array.isArray(searchRes.data) || searchRes.data.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const customer = searchRes.data[0];
    const metaList = Array.isArray(customer.meta_data) ? customer.meta_data : [];

    const savedOtp = metaList.find((m: any) => m.key === 'hf_reset_otp')?.value;
    const otpExpiry = metaList.find((m: any) => m.key === 'hf_reset_otp_expiry')?.value;

    if (!savedOtp || savedOtp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    if (!otpExpiry || new Date(otpExpiry) < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification code has expired' });
    }

    setSavedPassword(cleanEmail, cleanPassword);

    await wcFetch(`customers/${customer.id}`, {
      method: 'PUT',
      body: {
        billing: { company: `HF_PASS:${cleanPassword}`, address_2: `HF_PASS:${cleanPassword}` },
        shipping: { company: `HF_PASS:${cleanPassword}` },
        meta_data: [
          { key: 'hf_account_pass', value: cleanPassword },
          { key: 'customer_auth_pass', value: cleanPassword },
          { key: '_customer_auth_pass', value: cleanPassword },
          { key: 'hf_refresh_tokens', value: JSON.stringify([]) },
          { key: 'hf_reset_otp', value: '' },
          { key: 'hf_reset_otp_expiry', value: '' }
        ]
      }
    });

    const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const accessToken = jwt.sign({ customerId: customer.id, email: cleanEmail }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ customerId: customer.id, sessionId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

    await saveSessionHashes(customer.id, [{
      hash: sha256(refreshToken),
      deviceId: 'reset_device',
      deviceName: 'Password Reset Device',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: new Date().toISOString()
    }]);

    res.cookie('jid', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: customer.id,
        email: cleanEmail,
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        displayName: `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || cleanEmail.split('@')[0],
        phone: customer.billing?.phone || '',
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/sync/bootstrap
app.get(['/api/v1/sync/bootstrap', '/api/sync/bootstrap', '/v1/sync/bootstrap', '/sync/bootstrap'], authenticateToken, async (req, res) => {
  try {
    const { customerId, email } = res.locals.user;

    const [custRes, ordersRes] = await Promise.all([
      wcFetch(`customers/${customerId}`),
      wcFetch('orders', { params: { customer: customerId, per_page: 50 } })
    ]);

    if (!custRes.ok || !custRes.data) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = custRes.data;
    const metaList = Array.isArray(customer.meta_data) ? customer.meta_data : [];

    const cartMeta = metaList.find((m: any) => m.key === 'hf_saved_cart');
    const cartItems = cartMeta && cartMeta.value ? JSON.parse(cartMeta.value) : [];

    const wishlistMeta = metaList.find((m: any) => m.key === 'hf_saved_wishlist');
    const wishlistItems = wishlistMeta && wishlistMeta.value ? JSON.parse(wishlistMeta.value) : [];

    const addressMeta = metaList.find((m: any) => m.key === 'hf_saved_addresses');
    let savedAddresses = [];
    if (addressMeta && addressMeta.value) {
      try {
        const decrypted = decryptData(addressMeta.value);
        savedAddresses = JSON.parse(decrypted);
      } catch {
        try {
          savedAddresses = JSON.parse(addressMeta.value);
        } catch {}
      }
    }

    const prefMeta = metaList.find((m: any) => m.key === 'hf_user_preferences');
    const preferences = prefMeta && prefMeta.value ? JSON.parse(prefMeta.value) : {};

    const cartRevision = parseInt(metaList.find((m: any) => m.key === 'hf_cart_revision')?.value || '0', 10);
    const wishlistRevision = parseInt(metaList.find((m: any) => m.key === 'hf_wishlist_revision')?.value || '0', 10);
    const profileRevision = parseInt(metaList.find((m: any) => m.key === 'hf_profile_revision')?.value || '0', 10);
    const addressRevision = parseInt(metaList.find((m: any) => m.key === 'hf_address_revision')?.value || '0', 10);

    const orders = (ordersRes.ok && Array.isArray(ordersRes.data))
      ? ordersRes.data
          .filter((o: any) => o.status !== 'trash')
          .map((order: any) => {
            const stageInfo = getOrderStatusDetails(order.status);
            const refMeta = Array.isArray(order.meta_data) ? order.meta_data.find((m: any) => m.key === '_order_ref_code') : null;
            return {
              id: order.id,
              orderRefCode: refMeta?.value || `HF-${order.id}`,
              status: order.status,
              statusLabel: stageInfo.label,
              stage: stageInfo.stage,
              total: order.total,
              currency: '₹',
              dateCreated: order.date_created,
              items: order.line_items?.map((item: any) => ({ name: item.name, quantity: item.quantity })),
              shippingAddress: `${order.shipping?.address_1 || order.billing?.address_1 || ''}, ${order.shipping?.city || order.billing?.city || ''}`,
            };
          })
      : [];

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        displayName: `${customer.first_name} ${customer.last_name}`.trim() || customer.username,
        phone: customer.billing?.phone || '',
        billing: customer.billing,
        shipping: customer.shipping
      },
      cart: { items: cartItems, revision: cartRevision },
      wishlist: { items: wishlistItems, revision: wishlistRevision },
      addresses: savedAddresses,
      revisions: { cartRevision, wishlistRevision, profileRevision, addressRevision },
      preferences,
      orders
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/sync/revision
app.get(['/api/v1/sync/revision', '/api/sync/revision', '/v1/sync/revision', '/sync/revision'], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;

    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const metaList = Array.isArray(custRes.data.meta_data) ? custRes.data.meta_data : [];
    const cartRevision = parseInt(metaList.find((m: any) => m.key === 'hf_cart_revision')?.value || '0', 10);
    const wishlistRevision = parseInt(metaList.find((m: any) => m.key === 'hf_wishlist_revision')?.value || '0', 10);
    const profileRevision = parseInt(metaList.find((m: any) => m.key === 'hf_profile_revision')?.value || '0', 10);
    const addressRevision = parseInt(metaList.find((m: any) => m.key === 'hf_address_revision')?.value || '0', 10);

    const revisions = { cartRevision, wishlistRevision, profileRevision, addressRevision };
    const etag = `W/"rev-${cartRevision}-${wishlistRevision}-${profileRevision}-${addressRevision}"`;
    
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    return res.json({ success: true, revisions });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/cart/validate
app.post(['/api/v1/cart/validate', '/api/cart/validate', '/v1/cart/validate', '/cart/validate'], async (req, res) => {
  try {
    const { items, pincode, couponCode } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Invalid items payload' });
    }

    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const p = await getProductFromWooCommerceOrCache(item.productId);
      if (!p) {
        continue;
      }
      const variant = p.variants?.find((v: any) => v.weight === item.weight) || p.variants?.[0];
      const verifiedPrice = variant ? variant.basePrice : 70;
      subtotal += verifiedPrice * item.quantity;
      validatedItems.push({
        ...item,
        pricePerUnit: verifiedPrice,
        name: p.name,
      });
    }

    const gst = Math.round(subtotal * 0.05);
    const pincodeVal = pincode ? pincode.toString() : '625001';
    const shipping = validatePincodeAndShipping(pincodeVal, subtotal);
    
    let couponDiscount = 0;
    let appliedCouponInfo = null;
    if (couponCode) {
      const couponRes = await validateCouponCode(couponCode, subtotal);
      if (couponRes && couponRes.isValid) {
        couponDiscount = couponRes.discountAmount;
        appliedCouponInfo = { code: couponCode.toUpperCase(), discount: couponDiscount };
      }
    }

    const grandTotal = Math.max(0, subtotal - couponDiscount + gst + shipping.shippingCharge);

    return res.json({
      success: true,
      summary: {
        subtotal,
        gst,
        shippingCharge: shipping.shippingCharge,
        discountAmount: couponDiscount,
        grandTotal,
        appliedCoupon: appliedCouponInfo,
        freeShippingThresholdMet: shipping.shippingCharge === 0,
        delivery: {
          deliveryAvailable: shipping.deliveryAvailable,
          estimatedDays: shipping.estimatedDays,
          message: shipping.message,
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/sync/cart
app.post(['/api/v1/sync/cart', '/api/sync/cart', '/v1/sync/cart', '/sync/cart'], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;
    const { items, revision: clientRevision, operationId } = req.body;

    if (isOperationProcessed(operationId)) {
      return res.json({ success: true, duplicate: true, message: 'Operation already processed' });
    }

    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = custRes.data;
    const metaList = Array.isArray(customer.meta_data) ? customer.meta_data : [];

    const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_cart_revision')?.value || '0', 10);
    const cartMeta = metaList.find((m: any) => m.key === 'hf_saved_cart');
    const serverItems = cartMeta && cartMeta.value ? JSON.parse(cartMeta.value) : [];

    let mergedItems = [];
    let finalRevision = serverRevision;

    if (clientRevision >= serverRevision) {
      mergedItems = items;
      finalRevision = clientRevision + 1;

      await wcFetch(`customers/${customerId}`, {
        method: 'PUT',
        body: {
          meta_data: [
            { key: 'hf_saved_cart', value: JSON.stringify(mergedItems) },
            { key: 'hf_cart_revision', value: finalRevision.toString() }
          ]
        }
      });
    } else {
      const mergedMap = new Map<number, any>();
      for (const item of items) {
        mergedMap.set(item.id, { ...item });
      }
      for (const sItem of serverItems) {
        if (mergedMap.has(sItem.id)) {
          const existing = mergedMap.get(sItem.id);
          existing.quantity = Math.max(existing.quantity, sItem.quantity);
        } else {
          mergedMap.set(sItem.id, { ...sItem });
        }
      }
      mergedItems = Array.from(mergedMap.values());
      finalRevision = serverRevision + 1;

      await wcFetch(`customers/${customerId}`, {
        method: 'PUT',
        body: {
          meta_data: [
            { key: 'hf_saved_cart', value: JSON.stringify(mergedItems) },
            { key: 'hf_cart_revision', value: finalRevision.toString() }
          ]
        }
      });
    }

    markOperationProcessed(operationId);

    return res.json({
      success: true,
      revision: finalRevision,
      items: mergedItems
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/sync/wishlist
app.post(['/api/v1/sync/wishlist', '/api/sync/wishlist', '/v1/sync/wishlist', '/sync/wishlist'], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;
    const { items: clientItems, revision: clientRevision, operationId } = req.body;

    if (isOperationProcessed(operationId)) {
      return res.json({ success: true, duplicate: true });
    }

    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = custRes.data;
    const metaList = Array.isArray(customer.meta_data) ? customer.meta_data : [];

    const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_wishlist_revision')?.value || '0', 10);
    const wishlistMeta = metaList.find((m: any) => m.key === 'hf_saved_wishlist');
    const serverItems = wishlistMeta && wishlistMeta.value ? JSON.parse(wishlistMeta.value) : [];

    let mergedItems: number[] = [];
    let finalRevision = serverRevision;

    if (clientRevision >= serverRevision) {
      mergedItems = clientItems;
      finalRevision = clientRevision + 1;
    } else {
      mergedItems = Array.from(new Set([...clientItems, ...serverItems]));
      finalRevision = serverRevision + 1;
    }

    await wcFetch(`customers/${customerId}`, {
      method: 'PUT',
      body: {
        meta_data: [
          { key: 'hf_saved_wishlist', value: JSON.stringify(mergedItems) },
          { key: 'hf_wishlist_revision', value: finalRevision.toString() }
        ]
      }
    });

    markOperationProcessed(operationId);

    return res.json({
      success: true,
      revision: finalRevision,
      items: mergedItems
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/sync/profile
app.post(['/api/v1/sync/profile', '/api/sync/profile', '/v1/sync/profile', '/sync/profile'], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;
    const { firstName, lastName, phone, revision: clientRevision, operationId, updatedAt } = req.body;

    if (isOperationProcessed(operationId)) {
      return res.json({ success: true, duplicate: true });
    }

    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = custRes.data;
    const metaList = Array.isArray(customer.meta_data) ? customer.meta_data : [];

    const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_profile_revision')?.value || '0', 10);
    const serverUpdatedAt = metaList.find((m: any) => m.key === 'hf_profile_updated_at')?.value || '';

    let finalRevision = serverRevision;
    let finalFirstName = customer.first_name;
    let finalLastName = customer.last_name;
    let finalPhone = customer.billing?.phone || '';

    if (!serverUpdatedAt || new Date(updatedAt) >= new Date(serverUpdatedAt) || clientRevision >= serverRevision) {
      finalFirstName = firstName ?? customer.first_name;
      finalLastName = lastName ?? customer.last_name;
      finalPhone = phone ?? finalPhone;
      finalRevision = Math.max(clientRevision, serverRevision) + 1;

      await wcFetch(`customers/${customerId}`, {
        method: 'PUT',
        body: {
          first_name: finalFirstName,
          last_name: finalLastName,
          billing: {
            ...customer.billing,
            first_name: finalFirstName,
            last_name: finalLastName,
            phone: finalPhone
          },
          shipping: {
            ...customer.shipping,
            first_name: finalFirstName,
            last_name: finalLastName
          },
          meta_data: [
            { key: 'hf_profile_revision', value: finalRevision.toString() },
            { key: 'hf_profile_updated_at', value: updatedAt }
          ]
        }
      });
    }

    markOperationProcessed(operationId);

    return res.json({
      success: true,
      revision: finalRevision,
      firstName: finalFirstName,
      lastName: finalLastName,
      phone: finalPhone
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/sync/address
app.post(['/api/v1/sync/address', '/api/sync/address', '/v1/sync/address', '/sync/address'], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;
    const { addresses: clientAddresses, revision: clientRevision, operationId } = req.body;

    if (isOperationProcessed(operationId)) {
      return res.json({ success: true, duplicate: true });
    }

    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = custRes.data;
    const metaList = Array.isArray(customer.meta_data) ? customer.meta_data : [];

    const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_address_revision')?.value || '0', 10);
    const addressMeta = metaList.find((m: any) => m.key === 'hf_saved_addresses');
    let serverAddresses = [];
    if (addressMeta && addressMeta.value) {
      try {
        const decrypted = decryptData(addressMeta.value);
        serverAddresses = JSON.parse(decrypted);
      } catch {
        try {
          serverAddresses = JSON.parse(addressMeta.value);
        } catch {}
      }
    }

    let mergedAddresses = [];
    let finalRevision = serverRevision;

    if (clientRevision >= serverRevision) {
      mergedAddresses = clientAddresses;
      finalRevision = clientRevision + 1;
    } else {
      const addrMap = new Map<string, any>();
      for (const addr of serverAddresses) {
        addrMap.set(addr.id, addr);
      }
      for (const cAddr of clientAddresses) {
        if (addrMap.has(cAddr.id)) {
          const sAddr = addrMap.get(cAddr.id);
          const cTime = new Date(cAddr.updatedAt || 0).getTime();
          const sTime = new Date(sAddr.updatedAt || 0).getTime();
          if (cTime >= sTime) {
            addrMap.set(cAddr.id, cAddr);
          }
        } else {
          addrMap.set(cAddr.id, cAddr);
        }
      }
      mergedAddresses = Array.from(addrMap.values());
      finalRevision = serverRevision + 1;
    }

    const defaultShipping = mergedAddresses.find((a: any) => a.isDefaultShipping);
    const defaultBilling = mergedAddresses.find((a: any) => a.isDefaultBilling) || defaultShipping;

    const updateBody: any = {
      meta_data: [
        { key: 'hf_saved_addresses', value: encryptData(JSON.stringify(mergedAddresses)) },
        { key: 'hf_address_revision', value: finalRevision.toString() }
      ]
    };

    if (defaultShipping) {
      updateBody.shipping = {
        first_name: defaultShipping.firstName,
        last_name: defaultShipping.lastName || '',
        address_1: defaultShipping.address1,
        city: defaultShipping.city,
        state: defaultShipping.state || 'TN',
        postcode: defaultShipping.postcode,
        country: 'IN'
      };
    }
    if (defaultBilling) {
      updateBody.billing = {
        first_name: defaultBilling.firstName,
        last_name: defaultBilling.lastName || '',
        address_1: defaultBilling.address1,
        city: defaultBilling.city,
        state: defaultBilling.state || 'TN',
        postcode: defaultBilling.postcode,
        country: 'IN',
        phone: defaultBilling.phone || customer.billing?.phone || ''
      };
    }

    await wcFetch(`customers/${customerId}`, {
      method: 'PUT',
      body: updateBody
    });

    markOperationProcessed(operationId);

    return res.json({
      success: true,
      revision: finalRevision,
      addresses: mergedAddresses
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/sync/full
app.post(['/api/v1/sync/full', '/api/sync/full', '/v1/sync/full', '/sync/full'], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;
    const { cart, wishlist, profile, addresses, preferences, operationId } = req.body;

    if (isOperationProcessed(operationId)) {
      return res.json({ success: true, duplicate: true });
    }

    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = custRes.data;
    const metaList = Array.isArray(customer.meta_data) ? customer.meta_data : [];

    const metaUpdates: any[] = [];
    const updateBody: any = {};

    if (cart) {
      const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_cart_revision')?.value || '0', 10);
      const cartMeta = metaList.find((m: any) => m.key === 'hf_saved_cart');
      const serverItems = cartMeta && cartMeta.value ? JSON.parse(cartMeta.value) : [];
      let mergedItems = [];
      let finalRevision = serverRevision;
      if (cart.revision >= serverRevision) {
        mergedItems = cart.items;
        finalRevision = cart.revision + 1;
      } else {
        const mergedMap = new Map<number, any>();
        for (const item of cart.items) mergedMap.set(item.id, { ...item });
        for (const sItem of serverItems) {
          if (mergedMap.has(sItem.id)) {
            const existing = mergedMap.get(sItem.id);
            existing.quantity = Math.max(existing.quantity, sItem.quantity);
          } else {
            mergedMap.set(sItem.id, { ...sItem });
          }
        }
        mergedItems = Array.from(mergedMap.values());
        finalRevision = serverRevision + 1;
      }
      metaUpdates.push({ key: 'hf_saved_cart', value: JSON.stringify(mergedItems) });
      metaUpdates.push({ key: 'hf_cart_revision', value: finalRevision.toString() });
    }

    if (wishlist) {
      const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_wishlist_revision')?.value || '0', 10);
      const wishlistMeta = metaList.find((m: any) => m.key === 'hf_saved_wishlist');
      const serverItems = wishlistMeta && wishlistMeta.value ? JSON.parse(wishlistMeta.value) : [];
      let mergedItems: number[] = [];
      let finalRevision = serverRevision;
      if (wishlist.revision >= serverRevision) {
        mergedItems = wishlist.items;
        finalRevision = wishlist.revision + 1;
      } else {
        mergedItems = Array.from(new Set([...wishlist.items, ...serverItems]));
        finalRevision = serverRevision + 1;
      }
      metaUpdates.push({ key: 'hf_saved_wishlist', value: JSON.stringify(mergedItems) });
      metaUpdates.push({ key: 'hf_wishlist_revision', value: finalRevision.toString() });
    }

    if (profile) {
      const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_profile_revision')?.value || '0', 10);
      const serverUpdatedAt = metaList.find((m: any) => m.key === 'hf_profile_updated_at')?.value || '';
      let finalRevision = serverRevision;
      if (!serverUpdatedAt || new Date(profile.updatedAt) >= new Date(serverUpdatedAt) || profile.revision >= serverRevision) {
        finalRevision = Math.max(profile.revision, serverRevision) + 1;
        updateBody.first_name = profile.firstName ?? customer.first_name;
        updateBody.last_name = profile.lastName ?? customer.last_name;
        updateBody.billing = {
          ...customer.billing,
          first_name: updateBody.first_name,
          last_name: updateBody.last_name,
          phone: profile.phone ?? customer.billing?.phone ?? ''
        };
        updateBody.shipping = {
          ...customer.shipping,
          first_name: updateBody.first_name,
          last_name: updateBody.last_name
        };
        metaUpdates.push({ key: 'hf_profile_revision', value: finalRevision.toString() });
        metaUpdates.push({ key: 'hf_profile_updated_at', value: profile.updatedAt });
      }
    }

    if (addresses) {
      const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_address_revision')?.value || '0', 10);
      const addressMeta = metaList.find((m: any) => m.key === 'hf_saved_addresses');
      let serverAddresses = [];
      if (addressMeta && addressMeta.value) {
        try {
          const decrypted = decryptData(addressMeta.value);
          serverAddresses = JSON.parse(decrypted);
        } catch {
          try {
            serverAddresses = JSON.parse(addressMeta.value);
          } catch {}
        }
      }
      let mergedAddresses = [];
      let finalRevision = serverRevision;
      if (addresses.revision >= serverRevision) {
        mergedAddresses = addresses.items;
        finalRevision = addresses.revision + 1;
      } else {
        const addrMap = new Map<string, any>();
        for (const addr of serverAddresses) addrMap.set(addr.id, addr);
        for (const cAddr of addresses.items) {
          if (addrMap.has(cAddr.id)) {
            const sAddr = addrMap.get(cAddr.id);
            if (new Date(cAddr.updatedAt || 0).getTime() >= new Date(sAddr.updatedAt || 0).getTime()) {
              addrMap.set(cAddr.id, cAddr);
            }
          } else {
            addrMap.set(cAddr.id, cAddr);
          }
        }
        mergedAddresses = Array.from(addrMap.values());
        finalRevision = serverRevision + 1;
      }
      metaUpdates.push({ key: 'hf_saved_addresses', value: encryptData(JSON.stringify(mergedAddresses)) });
      metaUpdates.push({ key: 'hf_address_revision', value: finalRevision.toString() });

      const defaultShipping = mergedAddresses.find((a: any) => a.isDefaultShipping);
      const defaultBilling = mergedAddresses.find((a: any) => a.isDefaultBilling) || defaultShipping;
      if (defaultShipping) {
        updateBody.shipping = {
          ...updateBody.shipping,
          first_name: defaultShipping.firstName,
          last_name: defaultShipping.lastName || '',
          address_1: defaultShipping.address1,
          city: defaultShipping.city,
          state: defaultShipping.state || 'TN',
          postcode: defaultShipping.postcode,
          country: 'IN'
        };
      }
      if (defaultBilling) {
        updateBody.billing = {
          ...updateBody.billing,
          first_name: defaultBilling.firstName,
          last_name: defaultBilling.lastName || '',
          address_1: defaultBilling.address1,
          city: defaultBilling.city,
          state: defaultBilling.state || 'TN',
          postcode: defaultBilling.postcode,
          country: 'IN',
          phone: defaultBilling.phone || customer.billing?.phone || ''
        };
      }
    }

    if (preferences) {
      metaUpdates.push({ key: 'hf_user_preferences', value: JSON.stringify(preferences) });
    }

    if (metaUpdates.length > 0) {
      await wcFetch(`customers/${customerId}`, {
        method: 'PUT',
        body: {
          ...updateBody,
          meta_data: metaList.map((m: any) => {
            const match = metaUpdates.find(up => up.key === m.key);
            return match ? { key: m.key, value: match.value } : m;
          }).concat(
            metaUpdates.filter(up => !metaList.some((m: any) => m.key === up.key))
          )
        }
      });
    }

    markOperationProcessed(operationId);

    const [finalCustRes, ordersRes] = await Promise.all([
      wcFetch(`customers/${customerId}`),
      wcFetch('orders', { params: { customer: customerId, per_page: 50 } })
    ]);

    const finalCustomer = finalCustRes.ok ? finalCustRes.data : customer;
    const finalMetaList = Array.isArray(finalCustomer.meta_data) ? finalCustomer.meta_data : [];

    const finalCartItems = JSON.parse(finalMetaList.find((m: any) => m.key === 'hf_saved_cart')?.value || '[]');
    const finalWishlistItems = JSON.parse(finalMetaList.find((m: any) => m.key === 'hf_saved_wishlist')?.value || '[]');
    const finalSavedAddressesMeta = finalMetaList.find((m: any) => m.key === 'hf_saved_addresses');
    let finalSavedAddresses = [];
    if (finalSavedAddressesMeta && finalSavedAddressesMeta.value) {
      try {
        const decrypted = decryptData(finalSavedAddressesMeta.value);
        finalSavedAddresses = JSON.parse(decrypted);
      } catch {
        try {
          finalSavedAddresses = JSON.parse(finalSavedAddressesMeta.value);
        } catch {}
      }
    }
    const finalPreferences = JSON.parse(finalMetaList.find((m: any) => m.key === 'hf_user_preferences')?.value || '{}');

    const finalRevisions = {
      cartRevision: parseInt(finalMetaList.find((m: any) => m.key === 'hf_cart_revision')?.value || '0', 10),
      wishlistRevision: parseInt(finalMetaList.find((m: any) => m.key === 'hf_wishlist_revision')?.value || '0', 10),
      profileRevision: parseInt(finalMetaList.find((m: any) => m.key === 'hf_profile_revision')?.value || '0', 10),
      addressRevision: parseInt(finalMetaList.find((m: any) => m.key === 'hf_address_revision')?.value || '0', 10)
    };

    return res.json({
      success: true,
      cart: { items: finalCartItems, revision: finalRevisions.cartRevision },
      wishlist: { items: finalWishlistItems, revision: finalRevisions.wishlistRevision },
      addresses: finalSavedAddresses,
      revisions: finalRevisions,
      preferences: finalPreferences
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/webhooks/customer-updated
app.post(['/api/v1/webhooks/customer-updated', '/webhooks/customer-updated'], async (req, res) => {
  try {
    const customer = req.body;
    if (customer && customer.id) {
      const metaList = Array.isArray(customer.meta_data) ? customer.meta_data : [];
      const profileRev = parseInt(metaList.find((m: any) => m.key === 'hf_profile_revision')?.value || '0', 10);
      const addressRev = parseInt(metaList.find((m: any) => m.key === 'hf_address_revision')?.value || '0', 10);

      await wcFetch(`customers/${customer.id}`, {
        method: 'PUT',
        body: {
          meta_data: [
            { key: 'hf_profile_revision', value: (profileRev + 1).toString() },
            { key: 'hf_address_revision', value: (addressRev + 1).toString() }
          ]
        }
      });
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/webhooks/order-updated
app.post(['/api/v1/webhooks/order-updated', '/webhooks/order-updated'], async (req, res) => {
  try {
    const order = req.body;
    if (order && order.customer_id) {
      const custRes = await wcFetch(`customers/${order.customer_id}`);
      if (custRes.ok && custRes.data) {
        const metaList = Array.isArray(custRes.data.meta_data) ? custRes.data.meta_data : [];
        const profileRev = parseInt(metaList.find((m: any) => m.key === 'hf_profile_revision')?.value || '0', 10);
        
        await wcFetch(`customers/${order.customer_id}`, {
          method: 'PUT',
          body: {
            meta_data: [
              { key: 'hf_profile_revision', value: (profileRev + 1).toString() }
            ]
          }
        });
      }
    }
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/auth/me
app.get(['/api/v1/auth/me', '/api/auth/me', '/v1/auth/me', '/auth/me'], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;
    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      return res.status(401).json({
        success: false,
        accountDeleted: true,
        message: 'Account not found or deleted from database.',
      });
    }

    const customerUser = custRes.data;
    const fn = customerUser.first_name || '';
    const ln = customerUser.last_name || '';

    return res.json({
      success: true,
      user: {
        id: customerUser.id,
        email: customerUser.email,
        firstName: fn,
        lastName: ln,
        displayName: `${fn} ${ln}`.trim() || customerUser.username,
        phone: customerUser.billing?.phone || '',
        billing: customerUser.billing,
        shipping: customerUser.shipping
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/auth/my-orders
app.get(['/api/v1/auth/my-orders', '/api/auth/my-orders', '/v1/auth/my-orders', '/auth/my-orders'], authenticateToken, async (req, res) => {
  try {
    const { customerId, email } = res.locals.user;
    
    linkGuestOrdersToCustomer(email, customerId.toString()).catch(() => {});

    const ordersRes = await wcFetch('orders', { params: { customer: customerId, per_page: 50 } });
    if (!ordersRes.ok || !Array.isArray(ordersRes.data)) {
      return res.json({ success: true, data: [] });
    }

    const formattedOrders = ordersRes.data
      .filter((o: any) => o.status !== 'trash')
      .map((order: any) => {
        const stageInfo = getOrderStatusDetails(order.status);
        const refMeta = Array.isArray(order.meta_data)
          ? order.meta_data.find((m: any) => m.key === '_order_ref_code' || m.key === 'order_ref_code')
          : null;
        const refCode = refMeta?.value || `HF-${order.id}`;

        return {
          id: order.id,
          orderRefCode: refCode,
          status: order.status,
          statusLabel: stageInfo.label,
          stage: stageInfo.stage,
          total: order.total,
          currency: '₹',
          dateCreated: order.date_created,
          items: order.line_items?.map((item: any) => ({ name: item.name, quantity: item.quantity })),
          shippingAddress: `${order.shipping?.address_1 || order.billing?.address_1 || ''}, ${order.shipping?.city || order.billing?.city || ''}`,
        };
      });

    return res.json({ success: true, data: formattedOrders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const checkoutSchema = z.object({
  customerDetails: z.object({
    name: z.string().min(2, "Full name must be at least 2 characters").regex(/^[a-zA-Z\s]+$/, "Full name must contain only letters"),
    email: z.string().email("Please enter a valid email address"),
    phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian mobile number"),
  }),
  shippingAddress: z.object({
    address: z.string().min(10, "Address must be at least 10 characters long"),
    city: z.string().min(2, "City must be at least 2 characters long"),
    state: z.string().optional(),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
  }),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1),
    weight: z.string().optional(),
    pricePerUnit: z.number().optional(),
  })).min(1, "Cart cannot be empty"),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
  cartRevision: z.number().optional(),
});

app.post(['/api/v1/checkout/create-order', '/api/checkout/create-order', '/v1/checkout/create-order', '/checkout/create-order'], async (req, res) => {
  if (req.body.customerDetails && typeof req.body.customerDetails.phone === 'string') {
    req.body.customerDetails.phone = req.body.customerDetails.phone.replace(/\D/g, '').replace(/^91/, '');
  }

  const validation = checkoutSchema.safeParse(req.body);
  if (!validation.success) {
    const errorMsg = validation.error.issues.map(i => i.message).join('. ');
    console.warn('[Checkout Validation Failed]:', errorMsg);
    return res.status(400).json({ success: false, code: 'VALIDATION_FAILED', message: errorMsg });
  }

  const emailDomainValid = await verifyEmailDomain(req.body.customerDetails.email);
  if (!emailDomainValid) {
    const errorMsg = `The email domain '${req.body.customerDetails.email.split('@')[1]}' does not exist or cannot receive mail. Please check for typos.`;
    console.warn('[Checkout Domain Check Failed]:', errorMsg);
    return res.status(400).json({ success: false, code: 'INVALID_EMAIL_DOMAIN', message: errorMsg });
  }

  let existingCustomerId = 0;
  try {
    const { customerDetails, billingAddress, shippingAddress, items, couponCode, notes, cartRevision } = req.body;
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(500).json({ success: false, message: 'Razorpay integration is currently offline' });
    }

    let authUserEmail = '';
    let authCustomerId = 0;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { customerId: number; email: string };
        if (decoded && decoded.customerId) {
          authCustomerId = decoded.customerId;
        }
        if (decoded && decoded.email) {
          authUserEmail = decoded.email.trim().toLowerCase();
        }
      } catch {}
    }

    const rawEmail = (customerDetails?.email || billingAddress?.email || authUserEmail || '').trim();
    const customerEmail = rawEmail && rawEmail.includes('@') ? rawEmail : (authUserEmail || 'customer@homemadefoods.in');
    const customerPhone = (customerDetails?.phone || billingAddress?.phone || '9876543210').trim();
    const fullName = (customerDetails?.name || billingAddress?.firstName || 'Customer').trim();
    const firstName = fullName.split(' ')[0] || 'Customer';
    const lastName = fullName.split(' ').slice(1).join(' ') || 'Order';

    let orderRefCode = 'HF-PENDING';

    existingCustomerId = authCustomerId;
    if (!existingCustomerId && customerEmail) {
      try {
        const custRes = await wcFetch('customers', { params: { email: customerEmail } });
        if (custRes.ok && Array.isArray(custRes.data) && custRes.data.length > 0) {
          existingCustomerId = custRes.data[0].id;
        }
      } catch {}
    }

    if (existingCustomerId) {
      try {
        const lockFetch = await wcFetch(`customers/${existingCustomerId}`);
        if (lockFetch.ok && lockFetch.data) {
          const metaList = Array.isArray(lockFetch.data.meta_data) ? lockFetch.data.meta_data : [];

          // Monotonic Cart Revision Validation
          const serverCartRevision = parseInt(metaList.find((m: any) => m.key === 'hf_cart_revision')?.value || '0', 10);
          const clientRevInt = cartRevision !== undefined ? parseInt(cartRevision, 10) : undefined;
          if (clientRevInt !== undefined && clientRevInt < serverCartRevision) {
            console.warn(`[Checkout Sync Guard] Mismatch: Client Rev ${clientRevInt} < Server Rev ${serverCartRevision} for Customer #${existingCustomerId}. Rejecting checkout.`);
            return res.status(409).json({
              success: false,
              code: 'CART_OUT_OF_SYNC',
              message: 'Your shopping cart has been modified on another device. We have refreshed it before checkout.',
              serverRevision: serverCartRevision
            });
          }

          // Active Lock Verification
          const activeLock = metaList.find((m: any) => m.key === 'hf_checkout_lock')?.value;
          if (activeLock) {
            const lockTime = new Date(activeLock).getTime();
            if (Date.now() - lockTime < 15 * 1000) {
              console.warn(`[Checkout Lock] Active lock found for Customer #${existingCustomerId}. Rejecting concurrent transaction.`);
              return res.status(409).json({ success: false, message: 'Another transaction is already in progress for your account. Please wait 15 seconds.' });
            }
          }
        }
      } catch (err: any) {
        console.warn('[Checkout Guard] Failed to read lock or revisions:', err.message);
      }

      try {
        await wcFetch(`customers/${existingCustomerId}`, {
          method: 'PUT',
          body: {
            meta_data: [
              { key: 'hf_checkout_lock', value: new Date().toISOString() }
            ]
          }
        });
      } catch (err: any) {
        console.warn('[Checkout Lock] Failed to set lock:', err.message);
      }
    }

    const releaseLock = async () => {
      if (existingCustomerId) {
        try {
          await wcFetch(`customers/${existingCustomerId}`, {
            method: 'PUT',
            body: {
              meta_data: [
                { key: 'hf_checkout_lock', value: '' }
              ]
            }
          });
        } catch {}
      }
    };

    const reservedQuantities = await getReservedQuantities();

    let subtotal = 0;
    const lineItems = [];

    for (const item of items) {
      const pid = parseInt(item.productId, 10);
      const qty = parseInt(item.quantity || 1, 10);
      
      const p = await getProductFromWooCommerceOrCache(item.productId);
      if (!p) {
        await releaseLock();
        return res.status(400).json({ success: false, message: `Product #${item.productId} was not found in our database.` });
      }

      // Stock Check with Active Reservations
      if (p.stockQuantity !== undefined && p.stockQuantity !== null) {
        const reservedQty = reservedQuantities[pid] || 0;
        const availableStock = Math.max(0, p.stockQuantity - reservedQty);
        
        if (qty > availableStock) {
          console.warn(`[Inventory Reservation Mismatch] Product #${pid} has total stock ${p.stockQuantity}, reserved ${reservedQty}, available ${availableStock}. Requested ${qty}. Rejecting.`);
          await releaseLock();
          return res.status(400).json({
            success: false,
            code: 'OUT_OF_STOCK',
            message: `Sorry, we only have ${availableStock} units of "${p.name}" available in stock right now (other units are currently reserved in checkouts). Please adjust your quantity.`
          });
        }
      }
      
      const variant = p.variants?.find((v: any) => v.weight === item.weight) || p.variants?.[0];
      const verifiedPrice = variant ? variant.basePrice : 70;
      const lineTotal = (verifiedPrice * qty).toFixed(2);
      
      subtotal += verifiedPrice * qty;

      lineItems.push({
        product_id: !isNaN(pid) && pid > 0 ? pid : 35,
        quantity: qty,
        subtotal: lineTotal,
        total: lineTotal,
        meta_data: [
          { key: 'weight', value: item.weight || '250gms' }
        ]
      });
    }

    const gst = Math.round(subtotal * 0.05);
    const pincodeVal = (shippingAddress?.pincode || billingAddress?.pincode || '625001').toString();
    const shipping = validatePincodeAndShipping(pincodeVal, subtotal);
    if (!shipping.isValid) {
      return res.status(400).json({ success: false, message: `Delivery unserviceable: ${shipping.message}` });
    }

    let couponDiscount = 0;
    if (couponCode) {
      const couponRes = await validateCouponCode(couponCode, subtotal);
      if (couponRes && couponRes.isValid) {
        couponDiscount = couponRes.discountAmount;
      }
    }

    let totalAmountInRupees = Math.max(0, subtotal - couponDiscount + gst + shipping.shippingCharge);
    const amountInPaise = Math.round(totalAmountInRupees * 100);

    // 45-Second Order Idempotency Deduplication Key
    const idempotencyKey = `${customerEmail.toLowerCase()}_${amountInPaise}_${lineItems.map((i: any) => `${i.product_id}x${i.quantity}`).join('_')}`;
    const now = Date.now();
    const existingRecentOrder = recentCreatedOrdersMap.get(idempotencyKey);

    if (existingRecentOrder && now - existingRecentOrder.timestamp < 45000) {
      console.log(`⚡ Idempotency match: Reusing recently created Order #${existingRecentOrder.wcOrderId} for ${customerEmail}`);
      return res.json({
        success: true,
        wcOrderId: existingRecentOrder.wcOrderId,
        orderRefCode: existingRecentOrder.orderRefCode,
        razorpayOrderId: existingRecentOrder.razorpayOrderId,
        amount: existingRecentOrder.amount,
        amountInPaise: existingRecentOrder.amountInPaise,
        currency: 'INR',
        keyId: existingRecentOrder.keyId,
      });
    }

    const wcOrderPayload: any = {
      payment_method: 'razorpay',
      payment_method_title: 'Razorpay (UPI/Cards/NetBanking)',
      set_paid: false,
      status: 'pending',
      ...(existingCustomerId > 0 ? { customer_id: existingCustomerId } : {}),
      meta_data: [
        { key: '_order_ref_code', value: orderRefCode },
        { key: '_customer_phone', value: customerPhone },
      ],
      billing: {
        first_name: firstName,
        last_name: lastName,
        email: customerEmail,
        phone: customerPhone,
        address_1: shippingAddress?.address || billingAddress?.address || 'Main Road',
        city: shippingAddress?.city || billingAddress?.city || 'Madurai',
        state: 'TN',
        postcode: shippingAddress?.pincode || billingAddress?.pincode || '625001',
        country: 'IN',
      },
      shipping: {
        first_name: firstName,
        last_name: lastName,
        address_1: shippingAddress?.address || billingAddress?.address || 'Main Road',
        city: shippingAddress?.city || billingAddress?.city || 'Madurai',
        state: 'TN',
        postcode: shippingAddress?.pincode || billingAddress?.pincode || '625001',
        country: 'IN',
      },
      line_items: lineItems,
      shipping_lines: [
        {
          method_id: 'flat_rate',
          method_title: shipping.message || 'Flat Delivery Charge',
          total: shipping.shippingCharge.toFixed(2),
        },
      ],
      coupon_lines: couponCode ? [
        {
          code: couponCode.trim().toLowerCase(),
          discount: couponDiscount.toFixed(2),
        }
      ] : [],
      customer_note: notes || 'Order placed via Headless Storefront',
    };

    let wcOrderId = Date.now();
    orderRefCode = `HF-${wcOrderId}`;
    try {
      const wcRes = await wcFetch('orders', { method: 'POST', body: wcOrderPayload });
      if (wcRes.ok && wcRes.data && wcRes.data.id) {
        wcOrderId = wcRes.data.id;
        
        // Construct the custom time//date//ordernumber reference code in IST (UTC+5:30)
        const nowIst = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
        const pad = (n: number) => n.toString().padStart(2, '0');
        const HHMM = `${pad(nowIst.getUTCHours())}${pad(nowIst.getUTCMinutes())}`;
        const DDMMYY = `${pad(nowIst.getUTCDate())}${pad(nowIst.getUTCMonth() + 1)}${nowIst.getUTCFullYear().toString().slice(-2)}`;
        orderRefCode = `${HHMM}//${DDMMYY}//${wcOrderId}`;
        
        totalAmountInRupees = parseFloat(wcRes.data.total) || totalAmountInRupees;
        
        // Save the correct reference code to WooCommerce metadata
        await wcFetch(`orders/${wcOrderId}`, {
          method: 'PUT',
          body: {
            meta_data: [
              { key: '_order_ref_code', value: orderRefCode },
              { key: '_customer_phone', value: customerPhone },
            ],
          },
        }).catch(() => {});
      }
    } catch {}

    const keyId = (process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E').trim();

    let rzpOrderId = `order_mock_${wcOrderId}`;
    try {
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${wcOrderId}`,
        notes: {
          wc_order_id: wcOrderId.toString(),
          order_ref_code: orderRefCode,
          customer_phone: customerPhone,
          customer_email: customerEmail,
        },
      });
      if (rzpOrder && rzpOrder.id) {
        rzpOrderId = rzpOrder.id;
      }
    } catch {}

    recentCreatedOrdersMap.set(idempotencyKey, {
      wcOrderId,
      orderRefCode,
      razorpayOrderId: rzpOrderId,
      amount: totalAmountInRupees,
      amountInPaise,
      keyId,
      timestamp: now,
    });

    await releaseLock();

    return res.json({
      success: true,
      wcOrderId,
      orderRefCode,
      razorpayOrderId: rzpOrderId,
      amount: totalAmountInRupees,
      amountInPaise,
      currency: 'INR',
      keyId,
      expiresAt: now + 10 * 60 * 1000 // 10-minute reservation countdown
    });
  } catch (error: any) {
    if (existingCustomerId) {
      try {
        await wcFetch(`customers/${existingCustomerId}`, {
          method: 'PUT',
          body: {
            meta_data: [
              { key: 'hf_checkout_lock', value: '' }
            ]
          }
        });
      } catch {}
    }
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/checkout/cancel-order (Manually Cancel Unpaid Pending Order/Reservation)
app.post(['/api/v1/checkout/cancel-order', '/api/checkout/cancel-order', '/v1/checkout/cancel-order', '/checkout/cancel-order'], async (req, res) => {
  try {
    const { wcOrderId } = req.body;
    if (!wcOrderId) {
      return res.status(400).json({ success: false, message: 'wcOrderId parameter is required' });
    }

    console.log(`[Inventory Reservation Cleanup] Cancelling pending order #${wcOrderId} to release stock...`);
    const cancelRes = await wcFetch(`orders/${wcOrderId}`, {
      method: 'PUT',
      body: {
        status: 'cancelled',
        customer_note: 'Checkout abandoned by customer. Stock reservation released.'
      }
    });

    if (!cancelRes.ok) {
      return res.status(400).json({ success: false, message: 'Failed to cancel order in WooCommerce' });
    }

    return res.json({ success: true, message: 'Reservation cancelled and stock released.' });
  } catch (error: any) {
    console.error('[Inventory Reservation Cleanup] Error cancelling order:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/checkout/verify-payment
app.post(['/api/v1/checkout/verify-payment', '/api/checkout/verify-payment', '/v1/checkout/verify-payment', '/checkout/verify-payment'], async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, wcOrderId, orderRefCode, customerEmail, customerName, totalAmount, items, shippingAddress, phone } = req.body;
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || 'mw34w1wZGXkKlbZYTEDcMKu7').trim();

    if (razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ success: false, message: 'Invalid payment signature' });
      }
    }

    try {
      await wcFetch(`orders/${wcOrderId}`, {
        method: 'PUT',
        body: { set_paid: true, status: 'processing', transaction_id: razorpay_payment_id || `tx_${Date.now()}` },
      });
    } catch {}

    const cleanEmail = (customerEmail || '').trim().toLowerCase();
    if (cleanEmail) {
      userCartsMap.set(cleanEmail, []);
      userCartLocks.set(cleanEmail, Date.now() + 5000);
      wcFetch('customers', { params: { email: cleanEmail } }).then((searchRes) => {
        if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          const wcId = searchRes.data[0].id;
          wcFetch(`customers/${wcId}`, {
            method: 'PUT',
            body: {
              meta_data: [
                { key: 'hf_saved_cart', value: '[]' },
                { key: '_saved_cart', value: '[]' },
              ],
            },
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    const displayOrderCode = orderRefCode || `HF-${wcOrderId}`;
    const trackingLink = `https://homefoods-lac.vercel.app/#track?id=${encodeURIComponent(displayOrderCode)}`;

    if (customerEmail && customerEmail.includes('@')) {
      sendOrderTrackingEmail({
        toEmail: customerEmail,
        customerName: customerName || 'Valued Customer',
        orderRefCode: displayOrderCode,
        wcOrderId,
        totalAmount: totalAmount || 0,
        items: items || [],
        shippingAddress: shippingAddress || '',
        phone: phone || '',
        trackingLink,
      });
    }

    return res.json({ success: true, message: 'Payment verified', wcOrderId, orderRefCode: displayOrderCode, trackingLink });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/checkout/track/*id
app.get(['/api/v1/checkout/track/*id', '/api/checkout/track/*id', '/v1/checkout/track/*id', '/checkout/track/*id'], async (req, res) => {
  try {
    const idParam = req.params.id;
    const rawInput = Array.isArray(idParam) ? idParam.join('/') : (idParam || '').trim();
    const cleanId = rawInput.replace(/^#/, '').trim();
    const searchCore = cleanId.replace(/^HF-/i, '').trim();
    const searchLower = cleanId.toLowerCase();

    let order: any = null;

    // Strategy 1: Direct numeric order ID fetch
    let numericId = '';
    if (searchCore.includes('/')) {
      const parts = searchCore.split('/');
      const lastPart = parts[parts.length - 1];
      if (/^\d+$/.test(lastPart)) {
        numericId = lastPart;
      }
    } else {
      const splitId = searchCore.split('-')[0];
      if (/^\d+$/.test(splitId)) {
        numericId = splitId;
      }
    }

    if (numericId) {
      try {
        const wcRes = await wcFetch(`orders/${numericId}`);
        if (wcRes.ok && wcRes.data && wcRes.data.id) {
          if (wcRes.data.status !== 'trash') {
            order = wcRes.data;
          }
        }
      } catch {}
    }

    // Strategy 2: WooCommerce Native Search Query API (Searches billing names, addresses, emails, phones, etc.)
    if (!order) {
      try {
        const searchRes = await wcFetch('orders', { params: { search: cleanId, per_page: 5 } });
        if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
          order = searchRes.data.find((o: any) => o && o.status !== 'trash');
        }
      } catch {}
    }

    // Strategy 3: Scan recent 100 orders as a fallback (for older custom metadata reference codes)
    if (!order) {
      try {
        const recentOrdersRes = await wcFetch('orders', { params: { per_page: 100 } });
        if (recentOrdersRes.ok && Array.isArray(recentOrdersRes.data)) {
          order = recentOrdersRes.data.find((o: any) => {
            if (o.status === 'trash') return false;
            const oIdStr = o.id.toString();
            if (oIdStr === cleanId || oIdStr === searchCore) return true;
            
            const refMeta = (o.meta_data || []).find((m: any) => m.key === '_order_ref_code');
            const refVal = (refMeta?.value || '').toLowerCase().trim();
            const normRefVal = refVal.replace(/\/+/g, '/');
            const normSearchLower = searchLower.replace(/\/+/g, '/');

            if (normRefVal && (normRefVal === normSearchLower || normRefVal.includes(normSearchLower) || normSearchLower.includes(normRefVal))) return true;

            const bEmail = (o.billing?.email || '').toLowerCase().trim();
            if (bEmail && (bEmail === searchLower || (searchLower.includes('@') && bEmail.includes(searchLower)))) return true;

            const bPhone = (o.billing?.phone || '').replace(/\D/g, '');
            const searchPhone = searchLower.replace(/\D/g, '');
            if (searchPhone && searchPhone.length >= 10 && bPhone.includes(searchPhone)) return true;

            return false;
          });
        }
      } catch {}
    }

    if (!order) {
      return res.status(404).json({ success: false, message: `Order #${rawInput} not found. Please check Order ID.` });
    }

    const refCodeMeta = (order.meta_data || []).find((m: any) => m.key === '_order_ref_code');
    const orderRefCode = refCodeMeta?.value || `HF-${order.id}`;

    const currentStatus = getOrderStatusDetails(order.status);

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        orderRefCode,
        status: order.status,
        statusLabel: currentStatus.label,
        stage: currentStatus.stage,
        total: order.total,
        currency: order.currency_symbol || '₹',
        dateCreated: order.date_created,
        customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
        phone: order.billing?.phone || '',
        shippingAddress: `${order.shipping?.address_1 || order.billing?.address_1 || ''}, ${order.shipping?.city || order.billing?.city || ''}`,
        items: order.line_items?.map((item: any) => ({ name: item.name, quantity: item.quantity })),
      },
    });
  } catch (error: any) {
    return res.status(404).json({ success: false, message: 'Order not found', error: error.message });
  }
});

// GET /health & /api/v1/health
app.get(['/health', '/api/health', '/api/v1/health', '/v1/health'], (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Homemade Foods Headless WooCommerce Vercel API',
  });
});

// Express Error Handler Middleware
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled Express Error:', err);
  res.status(500).json({ success: false, message: err?.message || 'Internal Server Error' });
});

export default (req: any, res: any) => {
  return app(req, res);
};

// Start local Express server if executed directly
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5001;
  app.listen(PORT, () => {
    console.log(`🚀 [Local API Server] Running on http://localhost:${PORT}`);
  });
}
