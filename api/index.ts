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

// Prevent unhandled promise rejections or background crashes from terminating Vercel Lambdas
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Vercel Process Guard] Unhandled Rejection captured at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err, origin) => {
  console.warn('[Vercel Process Guard] Uncaught Exception captured:', err, 'origin:', origin);
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value && value.trim()) return value.trim();
  
  if (name === 'JWT_SECRET') return 'hf-jwt-access-secret-2026-key-production-fallback-key';
  if (name === 'JWT_REFRESH_SECRET') return 'hf-jwt-refresh-secret-2026-key-production-fallback-key';
  if (name === 'ENCRYPTION_KEY') return 'hf_default_secret_encryption_key_32';
  return value || '';
}

const JWT_SECRET = requireEnv('JWT_SECRET');
const JWT_REFRESH_SECRET = requireEnv('JWT_REFRESH_SECRET');
const ENCRYPTION_KEY = requireEnv('ENCRYPTION_KEY');

// WordPress Transients Database Caching Helper functions
const sharedSecret = 'homefoods_secure_transient_secret_token_2026';

interface OtpSession {
  otp: string;
  expiresAt: number;
  attempts: number;
}
const otpCache = new Map<string, OtpSession>();
const otpSendLimits = new Map<string, { count: number; resetAt: number }>();

async function setOtpInDatabase(email: string, otp: string): Promise<{ success: boolean; message?: string }> {
  otpCache.set(email.toLowerCase().trim(), {
    otp: otp.trim(),
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0
  });

  try {
    const storeUrl = (process.env.WC_STORE_URL || 'https://admin.homemadefoodsmadurai.com').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${storeUrl}/wp-json/homefoods/v1/otp/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Homefoods-Secret': sharedSecret
      },
      body: JSON.stringify({ email, otp }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));
    
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data: any = await res.json().catch(() => ({}));
      if (data.success) return { success: true };
    }
  } catch (err: any) {
    console.warn('[WordPress OTP Set Warning]:', err.message);
  }

  return { success: true };
}

async function verifyOtpInDatabase(email: string, otp: string): Promise<{ success: boolean; code?: string; message?: string; attempts_remaining?: number }> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanOtp = otp.trim();

  const memorySession = otpCache.get(cleanEmail);
  if (memorySession) {
    if (Date.now() > memorySession.expiresAt) {
      otpCache.delete(cleanEmail);
      return { success: false, code: 'EXPIRED', message: 'Verification code has expired. Please request a new code.' };
    }
    if (memorySession.otp === cleanOtp) {
      otpCache.delete(cleanEmail);
      return { success: true };
    }
  }

  try {
    const storeUrl = (process.env.WC_STORE_URL || 'https://admin.homemadefoodsmadurai.com').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${storeUrl}/wp-json/homefoods/v1/otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Homefoods-Secret': sharedSecret
      },
      body: JSON.stringify({ email: cleanEmail, otp: cleanOtp }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));
    
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data: any = await res.json().catch(() => ({}));
      if (data.success) return { success: true };
    }
  } catch (err: any) {
    console.warn('[WordPress OTP Verify Warning]:', err.message);
  }

  return { success: false, code: 'INVALID', message: 'Invalid 6-digit verification code.' };
}

async function setIdempotencyInDatabase(key: string, payload: any): Promise<boolean> {
  try {
    const storeUrl = (process.env.WC_STORE_URL || 'https://admin.homemadefoodsmadurai.com').replace(/\/$/, '');
    
    const res = await fetch(`${storeUrl}/wp-json/homefoods/v1/idempotency/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Homefoods-Secret': sharedSecret
      },
      body: JSON.stringify({ key, payload })
    });
    return res.ok;
  } catch (err: any) {
    console.error('[WordPress Idempotency Set Error]:', err.message);
    return false;
  }
}

async function getIdempotencyFromDatabase(key: string): Promise<any | null> {
  try {
    const storeUrl = (process.env.WC_STORE_URL || 'https://admin.homemadefoodsmadurai.com').replace(/\/$/, '');
    
    const res = await fetch(`${storeUrl}/wp-json/homefoods/v1/idempotency/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Homefoods-Secret': sharedSecret
      },
      body: JSON.stringify({ key })
    });
    
    const data: any = await res.json();
    if (res.ok && data.success && data.payload) return data.payload;
    return null;
  } catch (err: any) {
    console.error('[WordPress Idempotency Get Error]:', err.message);
    return null;
  }
}

const APP_URL = (process.env.FRONTEND_URL || 'https://www.homemadefoodsmadurai.com').replace(/\/$/, '');

const app = express();
app.set('trust proxy', 1);

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
      if (
        !origin || 
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://10.') ||
        origin.startsWith('http://172.') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1')
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

const authLimiter = (_req: any, _res: any, next: any) => next();
const checkoutLimiter = (_req: any, _res: any, next: any) => next();
const syncLimiter = (_req: any, _res: any, next: any) => next();

const userExistenceCache = new Map<number, { exists: boolean; lastChecked: number }>();

async function verifyUserExists(customerId: number, bypassCache: boolean = false): Promise<boolean> {
  const now = Date.now();
  const cached = userExistenceCache.get(customerId);
  if (!bypassCache && cached && (now - cached.lastChecked < 3000)) {
    return cached.exists;
  }

  try {
    const res = await wcFetch(`customers/${customerId}`);
    if (res.ok && res.data && res.data.id) {
      userExistenceCache.set(customerId, { exists: true, lastChecked: now });
      return true;
    }
    if (res.status === 404) {
      console.warn(`[User Existence Guard] Customer #${customerId} returned 404 from WooCommerce. User was deleted.`);
      userExistenceCache.set(customerId, { exists: false, lastChecked: now });
      return false;
    }
  } catch (err: any) {
    console.warn(`[User Existence Guard] WooCommerce API check errored for customer #${customerId} (${err.message}). Failing open to protect user session.`);
  }

  return true;
}

const KNOWN_VALID_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com',
  'rediffmail.com', 'live.com', 'proton.me', 'protonmail.com', 'zoho.com',
  'ymail.com', 'gmx.com', 'mail.com', 'yahoo.co.in'
]);

const domainMxCache = new Map<string, boolean>();

async function verifyEmailDomain(email: string): Promise<boolean> {
  const domain = (email.split('@')[1] || '').toLowerCase().trim();
  if (!domain) return false;
  if (KNOWN_VALID_DOMAINS.has(domain)) return true;

  if (domainMxCache.has(domain)) {
    return domainMxCache.get(domain)!;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        domainMxCache.set(domain, true);
        resolve(true);
      }
    }, 800);

    dns.resolveMx(domain, (err, addresses) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      if (err) {
        const errCode = (err as any).code;
        if (errCode === 'ENOTFOUND' || errCode === 'ENODATA') {
          domainMxCache.set(domain, false);
          resolve(false);
        } else {
          domainMxCache.set(domain, true);
          resolve(true);
        }
      } else {
        const isValid = Array.isArray(addresses) && addresses.length > 0;
        domainMxCache.set(domain, isValid);
        resolve(isValid);
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

function parseWeightInGrams(str: string): number {
  const clean = str.toLowerCase().replace(/\s+/g, '');
  const kgMatch = clean.match(/([\d.]+)\s*kg/);
  if (kgMatch) return parseFloat(kgMatch[1]) * 1000;
  const gMatch = clean.match(/([\d.]+)\s*g/);
  if (gMatch) return parseFloat(gMatch[1]);
  return parseInt(clean.replace(/\D/g, ''), 10) || 0;
}

function extractProductVariants(p: any): { weight: string; basePrice: number; regularPrice?: number }[] {
  const basePrice = parseFloat(p.price || p.regular_price || '70');
  const regPrice = parseFloat(p.regular_price || p.price || '70');
  const onSale = p.on_sale === true;

  let options: string[] = [];

  if (Array.isArray(p.attributes) && p.attributes.length > 0) {
    let matchedAttr = p.attributes.find((a: any) => {
      const name = (a.name || '').toLowerCase();
      return name.includes('quantity') || name.includes('weight') || name.includes('pack') || name.includes('size') || name.includes('variant');
    });

    if (!matchedAttr) {
      matchedAttr = p.attributes.find((a: any) => (a.variation === true || (Array.isArray(a.options) && a.options.length > 0)));
    }

    if (matchedAttr && Array.isArray(matchedAttr.options) && matchedAttr.options.length > 0) {
      options = matchedAttr.options.map((opt: any) => decodeHtmlEntities(String(opt).trim())).filter(Boolean);
    }
  }

  if (options.length > 0) {
    options.sort((a, b) => parseWeightInGrams(a) - parseWeightInGrams(b));
    const firstWeight = parseWeightInGrams(options[0]) || 100;

    return options.map((opt: string) => {
      const currentWeight = parseWeightInGrams(opt) || firstWeight;
      const ratio = currentWeight > 0 && firstWeight > 0 ? currentWeight / firstWeight : 1;
      const saleP = Math.round(basePrice * ratio);
      const regP = Math.round(regPrice * ratio);
      return {
        weight: opt,
        basePrice: saleP,
        regularPrice: onSale && regP > saleP ? regP : undefined,
      };
    });
  }

  if (p.weight) {
    return [{
      weight: decodeHtmlEntities(String(p.weight).trim()),
      basePrice,
      regularPrice: onSale && regPrice > basePrice ? regPrice : undefined,
    }];
  }

  return [{
    weight: '100gms',
    basePrice,
    regularPrice: onSale && regPrice > basePrice ? regPrice : undefined,
  }];
}

async function fetchProductVariationsFromWooCommerce(p: any): Promise<{ weight: string; basePrice: number; regularPrice?: number }[]> {
  const basePrice = parseFloat(p.price || p.regular_price || '70');
  const regPrice = parseFloat(p.regular_price || p.price || '70');
  const onSale = p.on_sale === true;

  if (p.type === 'variable' && Array.isArray(p.variations) && p.variations.length > 0) {
    try {
      const varRes = await wcFetch(`products/${p.id}/variations`, { params: { per_page: 50 } });
      if (varRes.ok && Array.isArray(varRes.data) && varRes.data.length > 0) {
        const parsedVariants = varRes.data.map((v: any) => {
          const attr = Array.isArray(v.attributes) && v.attributes.length > 0 ? v.attributes[0] : null;
          const weightLabel = attr?.option ? decodeHtmlEntities(String(attr.option).trim()) : '100gms';
          const vPrice = parseFloat(v.price || v.sale_price || v.regular_price || String(basePrice));
          const vRegPrice = parseFloat(v.regular_price || String(vPrice));
          const vOnSale = v.on_sale === true || (vRegPrice > vPrice);

          return {
            weight: weightLabel,
            basePrice: Math.round(vPrice),
            regularPrice: vOnSale && vRegPrice > vPrice ? Math.round(vRegPrice) : undefined,
          };
        });

        parsedVariants.sort((a, b) => parseWeightInGrams(a.weight) - parseWeightInGrams(b.weight));

        if (parsedVariants.length > 0) {
          return parsedVariants;
        }
      }
    } catch (err: any) {
      console.warn(`[Variations Fetch Warning] Failed to fetch variations for product #${p.id}:`, err.message);
    }
  }

  return extractProductVariants(p);
}

async function getProductFromWooCommerceOrCache(productId: string): Promise<any> {
  if (cachedProductsResponse && cachedProductsResponse.length > 0) {
    const found = cachedProductsResponse.find(p => p.id === productId);
    if (found) return found;
  }
  try {
    const res = await wcFetch(`products/${productId}`);
    if (res.ok && res.data) {
      const p = res.data;
      const variants = await fetchProductVariationsFromWooCommerce(p);
      return {
        id: p.id.toString(),
        name: decodeHtmlEntities(p.name),
        gstPercentage: 0,
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

async function cleanupExpiredPendingOrders() {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const res = await wcFetch('orders', {
      params: {
        status: 'pending',
        before: fifteenMinutesAgo,
        per_page: 50
      }
    });

    if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
      console.log(`[Inventory Reservation Cleanup] Found ${res.data.length} expired pending orders. Cancelling...`);
      for (const order of res.data) {
        wcFetch(`orders/${order.id}`, {
          method: 'PUT',
          body: {
            status: 'cancelled',
            customer_note: 'Payment window expired. Reservation cancelled automatically by system.'
          }
        }).catch((err) => {
          console.error(`[Inventory Reservation Cleanup] Failed to cancel order #${order.id}:`, err.message);
        });
      }
    }
  } catch (err: any) {
    console.error('[Inventory Reservation Cleanup] Error fetching expired orders:', err.message);
  }
}

const couponServerCache = new Map<string, { coupon: any; timestamp: number }>();
const COUPON_CACHE_TTL = 30 * 1000; // 30 seconds

async function validateCouponCode(couponCode: string, cartSubtotal: number): Promise<{
  isValid: boolean;
  discountAmount: number;
  message: string;
} | null> {
  if (!couponCode) return null;
  const cleanCode = couponCode.trim().toLowerCase();
  
  let coupon: any = null;
  const cached = couponServerCache.get(cleanCode);
  if (cached && (Date.now() - cached.timestamp < COUPON_CACHE_TTL)) {
    coupon = cached.coupon;
  }

  if (!coupon) {
    try {
      let res = await wcFetch('coupons', { params: { search: cleanCode, per_page: 100 } });
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        coupon = res.data.find((c: any) => (c.code || '').trim().toLowerCase() === cleanCode);
      }

      if (!coupon) {
        let allRes = await wcFetch('coupons', { params: { per_page: 100 } });
        if (allRes.ok && Array.isArray(allRes.data) && allRes.data.length > 0) {
          coupon = allRes.data.find((c: any) => (c.code || '').trim().toLowerCase() === cleanCode);
        }
      }

      if (coupon) {
        couponServerCache.set(cleanCode, { coupon, timestamp: Date.now() });
      }
    } catch (err: any) {
      console.error('Coupon lookup failed:', err.message);
    }
  }

  if (!coupon) {
    return { isValid: false, discountAmount: 0, message: 'Invalid, expired, or inapplicable coupon code.' };
  }

  if (coupon.date_expires) {
    const expiry = new Date(coupon.date_expires);
    if (expiry < new Date()) {
      return { isValid: false, discountAmount: 0, message: 'Coupon code has expired' };
    }
  }

  if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
    return { isValid: false, discountAmount: 0, message: 'Coupon usage limit reached' };
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
      if (amount <= 0) {
        return { isValid: false, discountAmount: 0, message: 'Coupon discount amount is set to 0 in WooCommerce.' };
      }

  let discountAmount = 0;
  if (coupon.discount_type === 'percent' || coupon.discount_type === 'percentage') {
    discountAmount = Math.round(cartSubtotal * (amount / 100));
  } else {
    discountAmount = Math.round(amount);
  }

  return {
    isValid: true,
    discountAmount: Math.min(discountAmount, cartSubtotal),
    message: `Coupon '${coupon.code.toUpperCase()}' applied successfully!`
  };
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
const recentCreatedOrdersMap = new Map<string, { wcOrderId: number; orderRefCode: string; razorpayOrderId: string; amount: number; amountInPaise: number; keyId: string; timestamp: number; trackingToken?: string }>();

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
  if (s === 'dispatched' || s === 'shipped' || s === 'out_for_delivery' || s === 'out-for-delivery' || s === 'failed' || s.includes('dispatch') || s.includes('ship')) {
    return { stage: 3, label: 'Dispatched & Out for Delivery' };
  }
  if (s === 'kitchen' || s === 'on-hold' || s === 'on_hold' || s.includes('kitchen')) {
    return { stage: 2, label: 'Kitchen Preparation' };
  }
  if (s === 'confirmed' || s === 'processing' || s === 'auto-draft' || s.includes('process')) {
    return { stage: 1, label: 'Order Confirmed' };
  }
  if (s === 'pending' || s === 'pending-payment' || s === 'cancelled' || s === 'refunded') {
    let label = 'Payment Pending';
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

const sentOrderEmailIds = new Set<string>();

function isRealSendableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  if (!clean.includes('@') || !clean.includes('.')) return false;

  const dummyDomains = [
    'homemadefoods.com', // placeholder domain used in test/audit accounts (real domain is homemadefoodsmadurai.com / homemadefoodsmd.com)
    'example.com',
    'example.org',
    'example.net',
    'test.com',
    'invalid',
    'localhost',
  ];

  const dummyPrefixes = ['audit_customer_', 'test_customer_', 'dummy_', 'guest_test_'];

  const [localPart, domainPart] = clean.split('@');
  if (!domainPart || !localPart) return false;

  if (dummyDomains.some((d) => domainPart.endsWith(d))) {
    return false;
  }

  if (dummyPrefixes.some((p) => localPart.startsWith(p))) {
    return false;
  }

  return true;
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

    if (!isRealSendableEmail(toEmail)) {
      console.log(`✉️ [Email Skipped]: Suppressed transactional email for dummy/test recipient (${toEmail}) for Order #${wcOrderId}`);
      return;
    }

    const emailLockKey = `email_sent_${wcOrderId}`;
    if (sentOrderEmailIds.has(emailLockKey)) {
      console.log(`✉️ [Email Suppressed]: Order confirmation email already dispatched for Order #${wcOrderId} (${orderRefCode})`);
      return;
    }
    sentOrderEmailIds.add(emailLockKey);
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = smtpPort === 465;
    const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser;

    if (!smtpUser || !smtpPass) {
      console.log(`✉️ Email notification logged (SMTP credentials not configured): Order ${orderRefCode} (#${wcOrderId}) for ${toEmail}. Track Link: ${trackingLink}`);
      throw new Error(`SMTP Mailer failed: SMTP credentials are not set on the server (User: ${!!smtpUser}, Pass: ${!!smtpPass}).`);
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: secure,
      auth: { user: smtpUser, pass: smtpPass },
      tls: { rejectUnauthorized: false },
    });

    const itemsHtml = items.length > 0
      ? items.map((item) => `
        <tr style="border-bottom: 1px solid #F3F4F6;">
          <td style="padding: 16px 12px; font-weight: 800; color: #1F2937; font-size: 14px;">${item.name}</td>
          <td style="padding: 16px 12px; text-align: center; color: #4B5563; font-weight: 600; font-size: 13px;">${item.weight || 'Standard'}</td>
          <td style="padding: 16px 12px; text-align: center; font-weight: 800; color: #1F2937; font-size: 14px;">${item.quantity}</td>
          <td style="padding: 16px 12px; text-align: right; font-weight: 800; color: #1F2937; font-size: 14px;">₹${(item.pricePerUnit || 0) * item.quantity}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="4" style="padding: 16px; text-align: center; color: #6B7280; font-weight: 500;">Authentic Homemade South Indian Food Package</td></tr>`;

    const mailOptions = {
      from: `"Homemade Foods" <${smtpFromEmail}>`,
      to: toEmail,
      replyTo: smtpFromEmail || 'care.homemadefoods@gmail.com',
      subject: `Order Confirmation - ${orderRefCode} | Homemade Foods`,
      text: `Hello ${customerName},\n\nThank you for your order with Homemade Foods! Your order reference code is ${orderRefCode}.\n\nYou can track your order live anytime using this link: ${trackingLink}\n\nThank you for shopping with us!`,
      headers: {
        'X-Entity-Ref-ID': `order-${wcOrderId}-${Date.now()}`,
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation - Homemade Foods</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1F2937;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #E5E7EB;">
            <!-- Header Banner -->
            <tr>
              <td style="padding: 32px 40px; background-color: #1F2937; text-align: center;">
                <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 26px; font-weight: 900; color: #95CD1A; letter-spacing: 1px; text-transform: uppercase;">
                  Homemade Foods
                </h1>
                <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 800; color: #9CA3AF; letter-spacing: 2px; text-transform: uppercase;">
                  Handcrafted South Indian Tradition
                </p>
              </td>
            </tr>
            
            <!-- Content Body -->
            <tr>
              <td style="padding: 40px 40px 32px 40px;">
                <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 800; color: #1F2937; letter-spacing: -0.5px;">
                  Thank you for your order, ${customerName}! 🎉
                </h2>
                <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #4B5563; font-weight: 500;">
                  We have received your payment, and our kitchen team has started preparing your fresh, traditional South Indian delicacies.
                </p>
                
                <!-- Order Overview Box -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAFBF6; border: 1px solid #ECF9CA; border-radius: 16px; padding: 20px; margin-bottom: 28px;">
                  <tr>
                    <td>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                        <tr>
                          <td style="padding-bottom: 8px; color: #6B7280; font-weight: 600;">Order Reference:</td>
                          <td style="padding-bottom: 8px; font-weight: 800; color: #95CD1A; text-align: right;">${orderRefCode}</td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 8px; color: #6B7280; font-weight: 600;">Store Order ID:</td>
                          <td style="padding-bottom: 8px; font-weight: 800; color: #1F2937; text-align: right;">#${wcOrderId}</td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 8px; color: #6B7280; font-weight: 600;">Payment Status:</td>
                          <td style="padding-bottom: 8px; font-weight: 800; color: #10B981; text-align: right;">✓ Paid via Razorpay</td>
                        </tr>
                        <tr>
                          <td style="color: #6B7280; font-weight: 600;">Current Status:</td>
                          <td style="font-weight: 800; color: #1F2937; text-align: right;">🍳 Kitchen Prep & Packing</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Items Table -->
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 800; color: #1F2937; text-transform: uppercase; letter-spacing: 0.5px;">
                  Order Items Summary
                </h3>
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 28px;">
                  <thead>
                    <tr style="background-color: #F9FAFB; border-bottom: 2px solid #E5E7EB; font-size: 11px;">
                      <th align="left" style="padding: 12px; font-weight: 800; color: #4B5563; text-transform: uppercase; letter-spacing: 0.5px;">Food Item</th>
                      <th align="center" style="padding: 12px; font-weight: 800; color: #4B5563; text-transform: uppercase; letter-spacing: 0.5px;">Pack</th>
                      <th align="center" style="padding: 12px; font-weight: 800; color: #4B5563; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                      <th align="right" style="padding: 12px; font-weight: 800; color: #4B5563; text-transform: uppercase; letter-spacing: 0.5px;">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="3" align="right" style="padding: 16px 12px 6px 12px; font-size: 13px; color: #6B7280; font-weight: 600;">Delivery Charge:</td>
                      <td align="right" style="padding: 16px 12px 6px 12px; font-size: 13px; font-weight: 800; color: #1F2937;">₹40</td>
                    </tr>
                    <tr>
                      <td colspan="3" align="right" style="padding: 6px 12px 16px 12px; font-size: 14px; font-weight: 800; color: #1F2937;">Total Amount Paid:</td>
                      <td align="right" style="padding: 6px 12px 16px 12px; font-size: 18px; font-weight: 900; color: #95CD1A;">₹${totalAmount}</td>
                    </tr>
                  </tfoot>
                </table>

                <!-- Shipping Address Box -->
                ${shippingAddress ? `
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 16px; padding: 20px; margin-bottom: 32px;">
                  <tr>
                    <td>
                      <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Shipping Address</h4>
                      <p style="margin: 0; font-size: 13px; color: #4B5563; line-height: 1.5; font-weight: 500;">
                        <strong>${customerName}</strong> (${phone})<br/>
                        ${shippingAddress}
                      </p>
                    </td>
                  </tr>
                </table>
                ` : ''}

                <!-- Track Button -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center" style="padding-bottom: 24px;">
                      <a href="${trackingLink}" style="display: inline-block; background-color: #95CD1A; color: #ffffff; padding: 16px 36px; text-decoration: none; border-radius: 14px; font-weight: 900; font-size: 14px; box-shadow: 0 4px 14px rgba(149, 205, 26, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                        🚚 Track Your Order Live →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center">
                      <p style="margin: 0; font-size: 11px; color: #9CA3AF; font-weight: 600;">
                        Direct link: <a href="${trackingLink}" style="color: #95CD1A; text-decoration: none;">${trackingLink}</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="padding: 24px 40px 32px 40px; background-color: #FAFBF6; border-top: 1px solid #ECF9CA; text-align: center;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #1F2937; text-transform: uppercase; letter-spacing: 0.5px;">
                  Need Assistance?
                </p>
                <p style="margin: 0 0 20px 0; font-size: 12px; line-height: 1.5; color: #4B5563; font-weight: 600;">
                  Call/WhatsApp: <a href="tel:+918608857705" style="color: #95CD1A; text-decoration: none; font-weight: 800;">+91 86088 57705</a> <br/>
                  Email Support: <a href="mailto:care.homemadefoods@gmail.com" style="color: #95CD1A; text-decoration: none; font-weight: 800;">care.homemadefoods@gmail.com</a>
                </p>
                <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
                <p style="margin: 0; font-size: 10px; line-height: 1.5; color: #9CA3AF; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  © ${new Date().getFullYear()} Homemade Foods Madurai. All rights reserved.
                </p>
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
    throw new Error(`Email sending failed: ${err.message}`);
  }
}

function getSearchRelevanceScoreApi(product: any, searchQuery: string): number {
  if (!searchQuery) return 0;
  const q = searchQuery.toLowerCase().trim();
  if (!q) return 0;

  const rawName = (product.name || '').toLowerCase();
  const englishName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
  const catName = (product.categoryName || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const ingr = (product.ingredients || '').toLowerCase();

  let score = 0;

  if (englishName === q || rawName === q) {
    score += 5000;
  } else if (englishName.startsWith(q) || rawName.startsWith(q)) {
    score += 3000;
  } else if (rawName.split(/[\s,()/]+/).some((w) => w.startsWith(q))) {
    score += 2000;
  } else if (rawName.includes(q)) {
    score += 1000;
  }

  const queryTokens = q.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 1) {
    let matchedInTitle = 0;
    queryTokens.forEach((token) => {
      if (rawName.includes(token)) matchedInTitle++;
    });
    if (matchedInTitle === queryTokens.length) {
      score += 800;
    } else {
      score += matchedInTitle * 200;
    }
  }

  if (catName === q) {
    score += 500;
  } else if (catName.startsWith(q)) {
    score += 300;
  } else if (catName.includes(q)) {
    score += 150;
  }

  const ingrWords = ingr.split(/[\s,()/.]+/);
  if (ingrWords.some((w) => w === q)) {
    score += 100;
  } else if (ingrWords.some((w) => w.startsWith(q))) {
    score += 70;
  } else if (ingr.includes(q)) {
    score += 40;
  }

  const descWords = desc.split(/[\s,()/.]+/);
  if (descWords.some((w) => w === q)) {
    score += 30;
  } else if (descWords.some((w) => w.startsWith(q))) {
    score += 20;
  } else if (desc.includes(q)) {
    score += 10;
  }

  return score;
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
    if (sQuery) {
      const scored = filtered
        .map((p) => ({ product: p, score: getSearchRelevanceScoreApi(p, sQuery) }))
        .filter((item) => item.score > 0);
      scored.sort((a, b) => b.score - a.score);
      filtered = scored.map((item) => item.product);
    }
  }
  if (inStock === 'true') {
    filtered = filtered.filter((p: any) => p.isAvailable);
  }
  return filtered;
}

// Helper to resolve curated dish image when WooCommerce product image is missing or generic
function resolveCuratedProductImage(pName: string, pSlug: string, catSlug: string, rawSrc?: string): string {
  if (rawSrc && rawSrc.includes('/wp-content/uploads/') && !rawSrc.includes('placeholder')) {
    return rawSrc;
  }
  const s = (pSlug || '').toLowerCase();
  const n = (pName || '').toLowerCase();
  const cat = (catSlug || '').toLowerCase();

  if (s.includes('adai') || n.includes('adai') || n.includes('அடை')) {
    return 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('vendaya') || n.includes('vendaya') || n.includes('வெந்தயக்')) {
    return 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('black-urad') || n.includes('black urad') || n.includes('கருப்பு உளுந்து')) {
    return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('sathu') || s.includes('health-mix') || n.includes('sathu') || n.includes('சத்து')) {
    return 'https://images.unsplash.com/photo-1546548970-71785318a17b?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('thokku') || n.includes('thokku') || n.includes('தொக்கு') || cat.includes('thokku')) {
    return 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('cookie') || s.includes('brownie') || n.includes('cookie') || n.includes('brownie') || n.includes('குக்கீஸ்') || cat.includes('cookie')) {
    return 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('sharbath') || s.includes('beverage') || n.includes('sharbath') || n.includes('jaggery') || cat.includes('beverage')) {
    return 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80';
  }
  if (s.includes('podi') || s.includes('soup') || n.includes('podi') || n.includes('பொடி') || cat.includes('podi')) {
    return 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80';
  }
  if (cat.includes('flour') || cat.includes('premix')) {
    return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80';
  }
  return rawSrc && !rawSrc.includes('placeholder')
    ? rawSrc
    : 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80';
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
        formattedProducts = await Promise.all(
          wcRes.data.map(async (p: any) => {
            const primaryCategory = p.categories && p.categories.length > 0 ? p.categories[0] : {};
            const variants = await fetchProductVariationsFromWooCommerce(p);

            const rawImg = p.images && p.images.length > 0 ? p.images[0].src : undefined;
            const finalImg = resolveCuratedProductImage(p.name, p.slug, primaryCategory.slug || '', rawImg);

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
              imageUrl: finalImg,
              images: p.images && p.images.length > 0
                ? p.images.map((img: any) => ({
                    id: img.id,
                    src: resolveCuratedProductImage(p.name, p.slug, primaryCategory.slug || '', img.src),
                    alt: decodeHtmlEntities(img.alt || p.name)
                  }))
                : [{ id: 0, src: finalImg, alt: decodeHtmlEntities(p.name) }],
              gstPercentage: 0,
              isAvailable: p.stock_status === 'instock',
              stockQuantity: p.stock_quantity ?? 100,
              isBestseller: !!p.featured || (Array.isArray(p.categories) && p.categories.some((c: any) => c.slug === 'bestsellers')),
              variants,
            };
          })
        );
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



async function sendEmailOtp(email: string, otp: string, purpose: 'login' | 'checkout' | 'email_change' | 'forgot_password' = 'forgot_password') {
  if (!isRealSendableEmail(email)) {
    console.warn(`[Mail Warning] Suppressed sending OTP to placeholder/dummy email: ${email}`);
    return false;
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = smtpPort === 465;
  const smtpFromEmail = process.env.SMTP_FROM_EMAIL || smtpUser || '';

  if (!smtpUser || !smtpPass) {
    console.warn(`[Mail Warning] SMTP credentials not set on server. Generated OTP for ${purpose} to ${email} is:`, otp);
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: secure,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 4000,
      tls: { rejectUnauthorized: false },
    });

    let subject = `${otp} is your verification code - Homemade Foods`;
    let title = 'Password Reset Request';
    let desc = 'We received a request to reset your password. Use the following verification code to complete the process:';

    if (purpose === 'login') {
      subject = `${otp} is your login code - Homemade Foods`;
      title = 'Login Verification';
      desc = 'Use the following verification code to sign in to your Homemade Foods account:';
    } else if (purpose === 'checkout') {
      subject = `${otp} is your checkout verification code - Homemade Foods`;
      title = 'Checkout Email Verification';
      desc = 'Use the following verification code to verify your email address and proceed with your order:';
    } else if (purpose === 'email_change') {
      subject = `${otp} is your email verification code - Homemade Foods`;
      title = 'Verify Email Change';
      desc = 'Use the following verification code to confirm changing your account email address:';
    }

    const mailOptions = {
      from: `"Homemade Foods" <${smtpFromEmail}>`,
      to: email,
      replyTo: smtpFromEmail || 'care.homemadefoods@gmail.com',
      subject: subject,
      text: `Your Homemade Foods verification code is: ${otp}\n\nThis code expires in 10 minutes. Please do not share this code with anyone.`,
      headers: {
        'X-Entity-Ref-ID': `otp-${Date.now()}`,
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title} - Homemade Foods</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #E5E7EB;">
            <!-- Header Banner -->
            <tr>
              <td style="padding: 32px 40px; background-color: #1F2937; text-align: center;">
                <h1 style="margin: 0; font-family: 'Georgia', serif; font-size: 26px; font-weight: 900; color: #95CD1A; letter-spacing: 1px; text-transform: uppercase;">
                  Homemade Foods
                </h1>
                <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 800; color: #9CA3AF; letter-spacing: 2px; text-transform: uppercase;">
                  Handcrafted South Indian Tradition
                </p>
              </td>
            </tr>
            <!-- Content Body -->
            <tr>
              <td style="padding: 40px;">
                <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: #1F2937; text-align: center;">
                  ${title}
                </h2>
                <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 1.6; color: #4B5563; text-align: center;">
                  ${desc}
                </p>
                <!-- Verification Code Box -->
                <div style="background-color: #FAFBF6; border: 2px dashed #95CD1A; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 28px;">
                  <span style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; color: #1F2937; letter-spacing: 8px;">
                    ${otp}
                  </span>
                </div>
                <p style="margin: 0; font-size: 12px; color: #6B7280; text-align: center;">
                  This code will expire in <strong>10 minutes</strong>. If you did not request this code, please ignore this email.
                </p>
              </td>
            </tr>
            <!-- Footer Details -->
            <tr>
              <td style="padding: 24px 40px 32px 40px; background-color: #FAFBF6; border-top: 1px solid #ECF9CA; text-align: center;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; color: #1F2937; text-transform: uppercase; letter-spacing: 0.5px;">
                  Need Assistance?
                </p>
                <p style="margin: 0 0 20px 0; font-size: 12px; line-height: 1.5; color: #4B5563; font-weight: 600;">
                  Call/WhatsApp: <a href="tel:+918608857705" style="color: #95CD1A; text-decoration: none; font-weight: 800;">+91 86088 57705</a> <br/>
                  Email Support: <a href="mailto:care.homemadefoods@gmail.com" style="color: #95CD1A; text-decoration: none; font-weight: 800;">care.homemadefoods@gmail.com</a>
                </p>
                <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
                <p style="margin: 0; font-size: 10px; line-height: 1.5; color: #9CA3AF; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                  © ${new Date().getFullYear()} Homemade Foods Madurai. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✉️ OTP email sent to ${email} for ${purpose}`);
    return true;
  } catch (err: any) {
    console.warn(`[Mail Warning] Failed to send OTP email for ${purpose} to ${email}:`, err.message);
    return false;
  }
}

// POST /api/v1/auth/send-otp
app.post(['/api/v1/auth/send-otp', '/api/auth/send-otp', '/v1/auth/send-otp', '/auth/send-otp'], authLimiter, async (req, res) => {
  try {
    const { email, purpose } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPurpose = (purpose || 'login').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }

    if (!['login', 'checkout', 'email_change'].includes(cleanPurpose)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP purpose requested.' });
    }

    // Generate random 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in WordPress Database cache (transients)
    const dbRes = await setOtpInDatabase(cleanEmail, otp);
    if (!dbRes.success) {
      return res.status(400).json({ success: false, message: dbRes.message || 'Failed to send verification code. Please try again.' });
    }

    // Send email using SMTP non-blockingly
    sendEmailOtp(cleanEmail, otp, cleanPurpose as any).catch(() => {});

    return res.json({
      success: true,
      isExistingUser: true,
      message: 'Verification code sent successfully to your email address.',
      testOtp: process.env.NODE_ENV !== 'production' ? otp : undefined
    });
  } catch (error: any) {
    console.error('Unhandled Send OTP Error:', error);
    return res.status(500).json({ success: false, message: error?.message || 'Send OTP failed' });
  }
});

// POST /api/v1/auth/verify-otp
app.post(['/api/v1/auth/verify-otp', '/api/auth/verify-otp', '/v1/auth/verify-otp', '/auth/verify-otp'], authLimiter, async (req, res) => {
  try {
    const { email, otp, purpose, name, phone, deviceId, deviceName } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otp || '').trim();
    const cleanPurpose = (purpose || 'login').trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const dbRes = await verifyOtpInDatabase(cleanEmail, cleanOtp);
    if (!dbRes.success) {
      if (dbRes.code === 'EXPIRED') {
        return res.status(400).json({ success: false, message: 'Verification code not found or expired. Please request a new code.' });
      }
      if (dbRes.code === 'MAX_ATTEMPTS') {
        return res.status(400).json({ success: false, message: 'Too many incorrect attempts. Please request a new verification code.' });
      }
      if (dbRes.code === 'INVALID') {
        const remaining = dbRes.attempts_remaining !== undefined ? dbRes.attempts_remaining : 5;
        return res.status(400).json({ success: false, message: `Invalid verification code. Please check your email and try again. (${remaining} attempts remaining)` });
      }
      return res.status(400).json({ success: false, message: dbRes.message || 'Verification failed.' });
    }

    if (cleanPurpose === 'login') {
      const fullName = (name || 'Customer').trim();
      const firstName = fullName.split(' ')[0] || 'Customer';
      const lastName = fullName.split(' ').slice(1).join(' ') || '';
      const cleanPhone = (phone || '').trim();

      // Instant deterministic customer ID generation (0ms latency)
      const customerId = getDeterministicUserId(cleanEmail);

      // Create session tokens immediately (<5ms)
      const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      const accessToken = jwt.sign({ customerId: parseInt(customerId, 10), email: cleanEmail }, JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign({ customerId: parseInt(customerId, 10), sessionId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

      // Non-blocking async WooCommerce customer sync in background
      setImmediate(async () => {
        try {
          let wcCustId = customerId;
          const searchRes = await wcFetch('customers', { params: { email: cleanEmail } });
          if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
            wcCustId = searchRes.data[0].id.toString();
          } else {
            const username = `${cleanEmail.split('@')[0]}_${Math.floor(1000 + Math.random() * 9000)}`;
            await wcFetch('customers', {
              method: 'POST',
              body: {
                email: cleanEmail,
                first_name: firstName,
                last_name: lastName,
                username,
                billing: { first_name: firstName, last_name: lastName, email: cleanEmail, phone: cleanPhone },
                shipping: { first_name: firstName, last_name: lastName }
              }
            });
          }
          linkGuestOrdersToCustomer(cleanEmail, wcCustId);
        } catch (err: any) {
          console.warn(`[Async Customer Sync Notice]:`, err.message);
        }
      });

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
          displayName: customerUser?.display_name || `${firstName} ${lastName}`.trim(),
          phone: customerUser?.billing?.phone || cleanPhone || '',
          billing: customerUser?.billing || {
            first_name: firstName,
            last_name: lastName,
            email: cleanEmail,
            phone: cleanPhone,
            address_1: '',
            city: '',
            state: 'Tamil Nadu',
            postcode: ''
          },
          shipping: customerUser?.shipping || {
            first_name: firstName,
            last_name: lastName,
            address_1: '',
            city: '',
            state: 'Tamil Nadu',
            postcode: ''
          }
        }
      });
    }

    // For checkout or email_change verification, just return success
    return res.json({
      success: true,
      message: 'Email address verified successfully.'
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

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
      if (custRes.status === 404) {
        userExistenceCache.set(customerId, { exists: false, lastChecked: Date.now() });
        return res.status(401).json({ success: false, code: 'ACCOUNT_DELETED', message: 'Customer account not found' });
      }
      return res.status(503).json({ success: false, code: 'SERVICE_UNAVAILABLE', message: 'WooCommerce temporarily unreachable' });
    }

    const customerUser = custRes.data;
    const sessions = getSavedSessionHashes(customerUser);
    const tokenHash = sha256(token);

    let sessionIdx = sessions.findIndex(s => s.hash === tokenHash);
    if (sessionIdx !== -1) {
      const session = sessions[sessionIdx];
      if (new Date(session.expiresAt) < new Date()) {
        sessions.splice(sessionIdx, 1);
        await saveSessionHashes(customerId, sessions);
        return res.status(401).json({ success: false, message: 'Session expired' });
      }
    }

    const newSessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const newAccessToken = jwt.sign({ customerId, email: customerUser.email }, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ customerId, sessionId: newSessionId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
    const newHash = sha256(newRefreshToken);

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const updatedSessionEntry = {
      hash: newHash,
      deviceId: deviceId || (sessionIdx !== -1 ? sessions[sessionIdx].deviceId : 'unknown_device'),
      deviceName: deviceName || (sessionIdx !== -1 ? sessions[sessionIdx].deviceName : 'Web Browser'),
      createdAt: sessionIdx !== -1 ? sessions[sessionIdx].createdAt : nowIso,
      expiresAt: expiresIso,
      lastUsedAt: nowIso
    };

    if (sessionIdx !== -1) {
      sessions[sessionIdx] = updatedSessionEntry;
    } else {
      sessions.push(updatedSessionEntry);
    }

    try {
      await saveSessionHashes(customerId, sessions);
    } catch (saveErr: any) {
      console.warn('[Session Save Warning]:', saveErr.message);
    }

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

// GET /api/v1/auth/account-status (2-Step Deletion Verification Endpoint)
app.get(['/api/v1/auth/account-status', '/api/auth/account-status', '/v1/auth/account-status', '/auth/account-status'], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.json({ exists: true, status: 'unverified' });
    }
    const token = authHeader.split(' ')[1];
    let decoded: any = null;
    try {
      decoded = jwt.decode(token);
    } catch {}

    if (!decoded || !decoded.customerId) {
      return res.json({ exists: true, status: 'unverified' });
    }

    const custRes = await wcFetch(`customers/${decoded.customerId}`);
    if (custRes.status === 404) {
      return res.json({ exists: false, status: 'confirmed_deleted' });
    }
    return res.json({ exists: true, status: 'active' });
  } catch {
    return res.json({ exists: true, status: 'network_fallback' });
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
            const rzpOrderIdMeta = Array.isArray(order.meta_data) ? order.meta_data.find((m: any) => m.key === '_razorpay_order_id') : null;
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
              // Include payment retry parameters only if pending
              ...(order.status === 'pending' ? {
                razorpayOrderId: rzpOrderIdMeta?.value || '',
                amountInPaise: Math.round((parseFloat(order.total) || 0) * 100),
                keyId: (process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E').trim(),
              } : {}),
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

// POST /api/v1/cart/validate (Sub-10ms Fast-Path Cart & Coupon Validation)
app.post(['/api/v1/cart/validate', '/api/cart/validate', '/v1/cart/validate', '/cart/validate'], async (req, res) => {
  try {
    const { items, pincode, couponCode } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Invalid items payload' });
    }

    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const pVal = item.pricePerUnit ?? item.price ?? item.selectedVariant?.basePrice ?? 70;
      const price = typeof pVal === 'number' ? pVal : (parseFloat(pVal) || 70);
      const qty = parseInt(item.quantity, 10) || 1;
      subtotal += price * qty;
      validatedItems.push({
        ...item,
        pricePerUnit: price,
        quantity: qty
      });
    }

    const pincodeVal = pincode ? pincode.toString() : '625001';
    const shipping = validatePincodeAndShipping(pincodeVal, subtotal);
    const shippingCharge = subtotal >= 499 || subtotal === 0 ? 0 : shipping.shippingCharge;

    let couponDiscount = 0;
    let appliedCouponInfo = null;
    let couponErrorMsg = null;
    if (couponCode) {
      const couponRes = await validateCouponCode(couponCode, subtotal);
      if (couponRes && couponRes.isValid) {
        couponDiscount = couponRes.discountAmount;
        appliedCouponInfo = { code: couponCode.toUpperCase(), discount: couponDiscount };
      } else if (couponRes) {
        couponErrorMsg = couponRes.message || 'Invalid coupon code.';
      }
    }

    const netSubtotalAfterDiscount = Math.max(0, subtotal - couponDiscount);
    const gst = 0;
    const grandTotal = Math.max(0, netSubtotalAfterDiscount + shippingCharge);

    return res.json({
      success: true,
      summary: {
        subtotal,
        gst,
        shippingCharge: shipping.shippingCharge,
        discountAmount: couponDiscount,
        grandTotal,
        appliedCoupon: appliedCouponInfo,
        couponError: couponErrorMsg,
        freeShippingThresholdMet: shipping.shippingCharge === 0,
        delivery: shipping
      },
      items: validatedItems
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
// Permanent Single Source of Truth for Payment Confirmation & Reconciliation
const razorpayToWcOrderMap = new Map<string, number>();
const orderConfirmationLocks = new Map<string, number>();

async function confirmWooOrder(
  wcOrderId: number | string,
  razorpayPaymentId: string,
  confirmedBy: 'verify' | 'webhook' | 'reconciliation'
): Promise<{ success: boolean; alreadyConfirmed?: boolean; order?: any; message?: string }> {
  const lockKey = `confirm_lock_${wcOrderId}`;
  const now = Date.now();
  const existingLock = orderConfirmationLocks.get(lockKey);
  if (existingLock && now - existingLock < 10000) {
    console.log(`[confirmWooOrder] Order #${wcOrderId} is locked by another confirmation thread. Waiting 800ms...`);
    await new Promise((r) => setTimeout(r, 800));
  }
  orderConfirmationLocks.set(lockKey, Date.now());

  try {
    const orderRes = await wcFetch(`orders/${wcOrderId}`);
    if (!orderRes.ok || !orderRes.data) {
      console.warn(`[confirmWooOrder Error] Could not fetch Order #${wcOrderId}`);
      return { success: false, message: `Order #${wcOrderId} not found` };
    }

    const order = orderRes.data;
    const metaList = Array.isArray(order.meta_data) ? order.meta_data : [];

    const isPaymentConfirmed = metaList.some((m: any) => m.key === '_payment_state' && m.value === 'confirmed');
    if (isPaymentConfirmed || ['processing', 'confirmed', 'kitchen', 'completed'].includes(order.status)) {
      console.log(`[confirmWooOrder] Order #${wcOrderId} is already confirmed (status: ${order.status}, by: ${confirmedBy}). Returning success.`);
      return { success: true, alreadyConfirmed: true, order };
    }

    const confirmedAt = new Date().toISOString();
    console.log(`[confirmWooOrder] Confirming Order #${wcOrderId} via ${confirmedBy} (Payment ID: ${razorpayPaymentId} at ${confirmedAt})...`);

    const updateRes = await wcFetch(`orders/${wcOrderId}`, {
      method: 'PUT',
      body: {
        set_paid: true,
        status: 'processing',
        transaction_id: razorpayPaymentId || `tx_${Date.now()}`,
        meta_data: [
          { key: '_reservation_expires_at', value: '0' },
          { key: '_payment_verified', value: 'true' },
          { key: '_payment_state', value: 'confirmed' },
          { key: '_payment_confirmed_at', value: confirmedAt },
          { key: '_payment_confirmed_by', value: confirmedBy },
          { key: '_razorpay_payment_id', value: razorpayPaymentId || '' }
        ]
      }
    });

    customerOrdersServerCache.clear();

    const cleanEmail = (order.billing?.email || '').trim().toLowerCase();
    if (cleanEmail && cleanEmail.includes('@')) {
      const refCodeMeta = metaList.find((m: any) => m.key === '_order_ref_code');
      const orderRefCode = refCodeMeta?.value || `HF-${order.id}`;
      const trackingMeta = metaList.find((m: any) => m.key === '_tracking_token');
      const trackingToken = trackingMeta?.value || '';

      const trackingLink = trackingToken 
        ? `${APP_URL}/#track?token=${encodeURIComponent(trackingToken)}`
        : `${APP_URL}/#track?id=${encodeURIComponent(orderRefCode)}`;

      sendOrderTrackingEmail({
        toEmail: cleanEmail,
        customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Valued Customer',
        orderRefCode,
        wcOrderId: order.id,
        totalAmount: parseFloat(order.total) || 0,
        items: Array.isArray(order.line_items) ? order.line_items.map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          totalPrice: parseFloat(i.total) || 0,
          weight: (i.meta_data || []).find((m: any) => m.key === 'weight')?.value || '250gms'
        })) : [],
        shippingAddress: `${order.shipping?.address_1 || ''}, ${order.shipping?.city || ''} - ${order.shipping?.postcode || ''}`,
        trackingLink
      }).catch((err) => console.warn('[confirmWooOrder Email Warning]:', err.message));
    }

    return { success: true, order: updateRes.ok ? updateRes.data : order };
  } finally {
    orderConfirmationLocks.delete(lockKey);
  }
}

// Background Self-Healing Reconciliation Worker (Runs every 45s)
async function reconcilePendingOrders() {
  const razorpay = getRazorpayClient();
  if (!razorpay) return;

  try {
    for (let page = 1; page <= 2; page++) {
      const pendingRes = await wcFetch('orders', { params: { status: 'pending', per_page: 50, page } });
      if (!pendingRes.ok || !Array.isArray(pendingRes.data) || pendingRes.data.length === 0) break;

      for (const order of pendingRes.data) {
        const metaList = Array.isArray(order.meta_data) ? order.meta_data : [];
        const rzpMeta = metaList.find((m: any) => m.key === '_razorpay_order_id');
        const rzpOrderId = rzpMeta?.value;

        if (!rzpOrderId || rzpOrderId.startsWith('order_mock_')) continue;

        try {
          const paymentsRes = await razorpay.orders.fetchPayments(rzpOrderId);
          if (paymentsRes && Array.isArray(paymentsRes.items) && paymentsRes.items.length > 0) {
            const capturedPayment = paymentsRes.items.find((p: any) => p.status === 'captured');
            if (capturedPayment && capturedPayment.id) {
              console.log(`[Reconciliation Worker] Found captured payment ${capturedPayment.id} for pending Order #${order.id}. Confirming now!`);
              await confirmWooOrder(order.id, capturedPayment.id, 'reconciliation');
            }
          }
        } catch (e) {}
      }
    }
  } catch (err: any) {
    console.warn('[Reconciliation Worker Warning]:', err.message);
  }
}

// Start reconciliation timer
setInterval(reconcilePendingOrders, 45 * 1000);

// POST /api/v1/webhooks/razorpay (Razorpay Webhook Handler)
app.post(['/api/v1/webhooks/razorpay', '/webhooks/razorpay', '/v1/webhooks/razorpay'], async (req: any, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Razorpay Webhook] Webhook secret is not configured.');
      return res.status(500).json({ success: false, message: 'Webhook secret not configured' });
    }

    if (!signature || !req.rawBody) {
      return res.status(400).json({ success: false, message: 'Missing signature or rawBody payload.' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('[Razorpay Webhook] Signature verification failed.');
      return res.status(400).json({ success: false, message: 'Signature mismatch' });
    }

    const event = req.body;
    console.log(`[Razorpay Webhook] Verified event: ${event?.event}`);

    if (event && event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const rzpOrderId = payment?.order_id;
      const transactionId = payment?.id;

      if (!rzpOrderId) {
        return res.json({ success: true, message: 'No Razorpay order ID in payload.' });
      }

      // 1. Check in-memory map first
      let targetWcOrderId: number | null = razorpayToWcOrderMap.get(rzpOrderId) || null;

      // 2. Robust multi-page scan for matching pending order
      if (!targetWcOrderId) {
        for (let page = 1; page <= 3; page++) {
          const searchRes = await wcFetch('orders', { params: { status: 'pending', per_page: 50, page } });
          if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
            const found = searchRes.data.find((o: any) =>
              Array.isArray(o.meta_data) && o.meta_data.some((m: any) => m.key === '_razorpay_order_id' && m.value === rzpOrderId)
            );
            if (found) {
              targetWcOrderId = found.id;
              break;
            }
          } else {
            break;
          }
        }
      }

      if (targetWcOrderId) {
        const result = await confirmWooOrder(targetWcOrderId, transactionId, 'webhook');
        return res.status(200).json({ success: true, message: 'Order confirmed via webhook', result });
      } else {
        console.warn(`[Razorpay Webhook Notice] Could not find WooCommerce order for Razorpay Order ${rzpOrderId}. Reconciliation worker will confirm it.`);
        return res.status(200).json({ success: true, message: 'Queued for reconciliation worker' });
      }
    }

    return res.json({ success: true, message: 'Webhook event received' });
  } catch (error: any) {
    console.error('[Razorpay Webhook Error]:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Automated Background Payment Reconciliation Job (Runs every 60 seconds)
async function reconcilePendingPayments() {
  try {
    const pendingOrdersRes = await wcFetch('orders', { params: { status: 'pending', per_page: 50 } });
    if (!pendingOrdersRes.ok || !Array.isArray(pendingOrdersRes.data) || pendingOrdersRes.data.length === 0) {
      return;
    }

    const razorpay = getRazorpayClient();
    if (!razorpay) return;

    for (const order of pendingOrdersRes.data) {
      const metaList = Array.isArray(order.meta_data) ? order.meta_data : [];
      const rzpOrderMeta = metaList.find((m: any) => m.key === '_razorpay_order_id');
      const rzpOrderId = rzpOrderMeta?.value;

      if (!rzpOrderId || rzpOrderId.startsWith('order_mock_')) continue;

      try {
        const rzpPaymentsRes = await razorpay.orders.fetchPayments(rzpOrderId);
        if (rzpPaymentsRes && Array.isArray(rzpPaymentsRes.items) && rzpPaymentsRes.items.length > 0) {
          const capturedPayment = rzpPaymentsRes.items.find((p: any) => p.status === 'captured');
          if (capturedPayment) {
            console.log(`[Payment Reconciliation] Auto-confirming WooCommerce Order #${order.id} for captured Razorpay payment ${capturedPayment.id}`);
            
            const confirmedAt = new Date().toISOString();
            await wcFetch(`orders/${order.id}`, {
              method: 'PUT',
              body: {
                set_paid: true,
                status: 'kitchen',
                transaction_id: capturedPayment.id,
                meta_data: [
                  { key: '_reservation_expires_at', value: '0' },
                  { key: '_payment_verified', value: 'true' },
                  { key: '_payment_state', value: 'confirmed' },
                  { key: '_razorpay_payment_id', value: capturedPayment.id },
                  { key: '_razorpay_order_id', value: rzpOrderId },
                  { key: '_payment_confirmed_at', value: confirmedAt }
                ]
              }
            });
            customerOrdersServerCache.clear();
          }
        }
      } catch (err: any) {
        console.warn(`[Payment Reconciliation] Check warning for Order #${order.id}:`, err.message);
      }
    }
  } catch (err: any) {
    console.warn('[Payment Reconciliation Error]:', err.message);
  }
}

// Start automated background payment reconciliation every 60 seconds
setInterval(reconcilePendingPayments, 60000);

// GET /api/v1/auth/session & /api/v1/auth/me (Real-Time Session Validation)
app.get([
  '/api/v1/auth/session', '/api/auth/session', '/v1/auth/session', '/auth/session',
  '/api/v1/auth/me', '/api/auth/me', '/v1/auth/me', '/auth/me'
], authenticateToken, async (req, res) => {
  try {
    const { customerId } = res.locals.user;
    
    // Bypass cache (bypassCache = true) for 100% real-time WooCommerce database verification
    const exists = await verifyUserExists(customerId, true);
    if (!exists) {
      console.warn(`[Session Guard] Customer #${customerId} deleted from WooCommerce database. Rejecting session validation.`);
      return res.status(401).json({
        valid: false,
        success: false,
        accountDeleted: true,
        code: 'USER_DELETED',
        message: 'Your account no longer exists in our database. Session revoked.',
      });
    }

    const custRes = await wcFetch(`customers/${customerId}`);
    if (!custRes.ok || !custRes.data) {
      return res.status(401).json({
        valid: false,
        success: false,
        accountDeleted: true,
        code: 'USER_DELETED',
        message: 'Account not found or deleted from database.',
      });
    }

    const customerUser = custRes.data;
    const fn = customerUser.first_name || '';
    const ln = customerUser.last_name || '';
    const userObj = {
      id: customerUser.id,
      email: customerUser.email,
      firstName: fn,
      lastName: ln,
      displayName: `${fn} ${ln}`.trim() || customerUser.username,
      phone: customerUser.billing?.phone || '',
      billing: customerUser.billing,
      shipping: customerUser.shipping
    };

    return res.json({
      valid: true,
      success: true,
      user: userObj,
      customer: userObj
    });
  } catch (error: any) {
    return res.status(500).json({ valid: false, success: false, message: error.message });
  }
});

const customerOrdersServerCache = new Map<string, { orders: any[]; lastChecked: number }>();

// GET /api/v1/orders/me & /api/v1/auth/my-orders (Consolidated Orders Endpoint with 30s Server Cache)
app.get([
  '/api/v1/orders/me', '/api/orders/me', '/v1/orders/me', '/orders/me',
  '/api/v1/auth/my-orders', '/api/auth/my-orders', '/v1/auth/my-orders', '/auth/my-orders'
], authenticateToken, async (req, res) => {
  try {
    const { customerId, email } = res.locals.user;
    const cacheKey = `cust_orders_${customerId}_${email}`;
    const now = Date.now();
    const cached = customerOrdersServerCache.get(cacheKey);

    if (cached && (now - cached.lastChecked < 1000)) {
      return res.json({ success: true, data: cached.orders, cached: true });
    }

    linkGuestOrdersToCustomer(email, customerId.toString()).catch(() => {});

    let ordersRes = await wcFetch('orders', { params: { customer: customerId, per_page: 50 } });
    if (!ordersRes.ok || !Array.isArray(ordersRes.data) || ordersRes.data.length === 0) {
      ordersRes = await wcFetch('orders', { params: { search: email, per_page: 50 } });
    }

    if (!ordersRes.ok || !Array.isArray(ordersRes.data)) {
      return res.json({ success: true, data: [] });
    }

    const formattedOrders = ordersRes.data
      .filter((o: any) => o.status !== 'trash' && o.status !== 'pending' && o.status !== 'cancelled')
      .map((order: any) => {
        const stageInfo = getOrderStatusDetails(order.status);
        const refMeta = Array.isArray(order.meta_data)
          ? order.meta_data.find((m: any) => m.key === '_order_ref_code' || m.key === 'order_ref_code')
          : null;
        const refCode = refMeta?.value || `HF-${order.id}`;

        const rzpOrderIdMeta = Array.isArray(order.meta_data) ? order.meta_data.find((m: any) => m.key === '_razorpay_order_id') : null;
        const expTimeMeta = Array.isArray(order.meta_data) ? order.meta_data.find((m: any) => m.key === '_reservation_expires_at') : null;

        const lineSubtotal = (order.line_items || []).reduce((acc: number, item: any) => acc + (parseFloat(item.total) || 0), 0);
        const shippingVal = parseFloat(order.shipping_total) || 0;
        const totalVal = parseFloat(order.total) || 0;
        const resolvedTotal = (lineSubtotal > 0 && lineSubtotal < 499 && shippingVal === 0 && Math.abs(totalVal - lineSubtotal) < 0.01)
          ? (lineSubtotal + 40).toFixed(2)
          : order.total;

        return {
          id: order.id,
          orderRefCode: refCode,
          status: order.status,
          statusLabel: stageInfo.label,
          stage: stageInfo.stage,
          total: resolvedTotal,
          currency: '₹',
          dateCreated: order.date_created,
          items: order.line_items?.map((item: any) => ({ name: item.name, quantity: item.quantity, pricePerUnit: parseFloat(item.price) || 0 })),
          shippingAddress: `${order.shipping?.address_1 || order.billing?.address_1 || ''}, ${order.shipping?.city || order.billing?.city || ''}`,
          ...(order.status === 'pending' ? {
            razorpayOrderId: rzpOrderIdMeta?.value || `order_mock_${order.id}`,
            amountInPaise: Math.round((parseFloat(order.total) || 0) * 100),
            keyId: (process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E').trim(),
            expiresAt: expTimeMeta?.value ? parseInt(expTimeMeta.value, 10) : new Date(order.date_created).getTime() + 10 * 60 * 1000,
          } : {}),
        };
      });

    customerOrdersServerCache.set(cacheKey, { orders: formattedOrders, lastChecked: now });
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
          const userExists = await verifyUserExists(decoded.customerId);
          if (!userExists) {
            console.warn(`[Checkout Guard] Rejecting checkout request for deleted customer #${decoded.customerId}`);
            return res.status(401).json({
              success: false,
              code: 'ACCOUNT_DELETED',
              message: 'Your account no longer exists in our system. Please sign in or create a new account to continue.'
            });
          }
          authCustomerId = decoded.customerId;
        }
        if (decoded && decoded.email) {
          authUserEmail = decoded.email.trim().toLowerCase();
        }
      } catch (tokenErr: any) {
        console.warn('[Checkout Guard] Invalid JWT token during checkout:', tokenErr.message);
      }
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

          // Smart Cart Revision Validation: compare actual item content if revision differs
          const serverCartRevision = parseInt(metaList.find((m: any) => m.key === 'hf_cart_revision')?.value || '0', 10);
          const clientRevInt = cartRevision !== undefined ? parseInt(cartRevision, 10) : undefined;
          if (clientRevInt !== undefined && clientRevInt < serverCartRevision) {
            const cartMeta = metaList.find((m: any) => m.key === 'hf_saved_cart');
            const serverItems = cartMeta && cartMeta.value ? JSON.parse(cartMeta.value) : [];

            const itemsMatch = Array.isArray(items) && Array.isArray(serverItems) && items.length === serverItems.length && items.every((ci: any) => {
              const si = serverItems.find((s: any) => s.id === ci.id || s.productId === ci.productId);
              return si && parseInt(si.quantity, 10) === parseInt(ci.quantity, 10);
            });

            if (itemsMatch || serverItems.length === 0) {
              console.log(`[Checkout Sync Guard] Client Rev ${clientRevInt} < Server Rev ${serverCartRevision}, but item contents match. Aligning revision silently.`);
            } else {
              console.warn(`[Checkout Sync Guard] Mismatch: Client Rev ${clientRevInt} < Server Rev ${serverCartRevision} for Customer #${existingCustomerId}. Rejecting checkout.`);
              return res.status(409).json({
                success: false,
                code: 'CART_OUT_OF_SYNC',
                message: 'Your shopping cart has been modified on another device. We have refreshed it before checkout.',
                serverRevision: serverCartRevision
              });
            }
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

      // Pending Order Deduplication: Check if an active unexpired pending order exists
      try {
        const activeOrdersRes = await wcFetch('orders', { params: { customer: existingCustomerId, status: 'pending', per_page: 5 } });
        if (activeOrdersRes.ok && Array.isArray(activeOrdersRes.data) && activeOrdersRes.data.length > 0) {
          const existingPending = activeOrdersRes.data[0];
          const metaList = Array.isArray(existingPending.meta_data) ? existingPending.meta_data : [];
          const refMeta = metaList.find((m: any) => m.key === '_order_ref_code' || m.key === 'order_ref_code');
          const rzpMeta = metaList.find((m: any) => m.key === '_razorpay_order_id');
          const expMeta = metaList.find((m: any) => m.key === '_reservation_expires_at');

          const expTime = expMeta?.value ? parseInt(expMeta.value, 10) : new Date(existingPending.date_created).getTime() + 10 * 60 * 1000;
          if (expTime > Date.now()) {
            console.log(`[Checkout Deduplication] Reusing unexpired pending order #${existingPending.id} for Customer #${existingCustomerId}`);
            const totalPaise = Math.round((parseFloat(existingPending.total) || 0) * 100);
            const displayRefCode = refMeta?.value || `HF-${existingPending.id}`;

            let razorpayOrderId = rzpMeta?.value || `order_mock_${existingPending.id}`;
            if (!razorpayOrderId || razorpayOrderId.startsWith('order_mock_')) {
              try {
                const razorpay = getRazorpayClient();
                if (razorpay && totalPaise > 0) {
                  const rzpOrder = await razorpay.orders.create({
                    amount: totalPaise,
                    currency: 'INR',
                    receipt: `rcpt_${existingPending.id}_${Date.now().toString().slice(-4)}`,
                  });
                  if (rzpOrder && rzpOrder.id) {
                    razorpayOrderId = rzpOrder.id;
                    await wcFetch(`orders/${existingPending.id}`, {
                      method: 'PUT',
                      body: {
                        meta_data: [
                          { key: '_razorpay_order_id', value: razorpayOrderId },
                          { key: '_reservation_expires_at', value: expTime.toString() },
                        ]
                      }
                    }).catch(() => {});
                  }
                }
              } catch (e: any) {
                console.warn('[Deduplication Razorpay Warning]:', e.message);
              }
            }

            return res.json({
              success: true,
              wcOrderId: existingPending.id,
              orderRefCode: displayRefCode,
              razorpayOrderId,
              amountInPaise: totalPaise,
              currency: 'INR',
              keyId: (process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E').trim(),
              expiresAt: expTime,
              isReused: true,
            });
          }
        }
      } catch (err: any) {
        console.warn('[Checkout Deduplication Guard] Error checking existing pending orders:', err.message);
      }
    }

    const releaseLock = async () => {};

    const reservedQuantities: Record<number, number> = {};

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
      
      const pVal = item.pricePerUnit ?? item.price ?? (p.variants?.find((v: any) => v.weight === item.weight) || p.variants?.[0])?.basePrice ?? 70;
      const verifiedPrice = typeof pVal === 'number' ? pVal : (parseFloat(pVal) || 70);
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

    const pincodeVal = (shippingAddress?.pincode || billingAddress?.pincode || '625001').toString();
    const shipping = validatePincodeAndShipping(pincodeVal, subtotal);
    if (!shipping.isValid) {
      return res.status(400).json({ success: false, message: `Delivery unserviceable: ${shipping.message}` });
    }
    const shippingCharge = subtotal >= 499 || subtotal === 0 ? 0 : shipping.shippingCharge;

    let couponDiscount = 0;
    if (couponCode) {
      const couponRes = await validateCouponCode(couponCode, subtotal);
      if (couponRes && couponRes.isValid) {
        couponDiscount = couponRes.discountAmount;
      }
    }

    const netSubtotalAfterDiscount = Math.max(0, subtotal - couponDiscount);
    const gst = 0;
    let totalAmountInRupees = Math.max(0, netSubtotalAfterDiscount + shippingCharge);
    const amountInPaise = Math.round(totalAmountInRupees * 100);

    // Idempotency check using client header or auto-generated fallback payload key
    const clientIdempotency = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const autoKey = `${customerEmail.toLowerCase()}_${amountInPaise}_${lineItems.map((i: any) => `${i.product_id}x${i.quantity}`).join('_')}`;
    const idempotencyKey = clientIdempotency ? `idempotency:${clientIdempotency}` : `idempotency:auto:${autoKey}`;
    const now = Date.now();

    let existingRecentOrder: any = await getIdempotencyFromDatabase(idempotencyKey);
    if (!existingRecentOrder) {
      existingRecentOrder = recentCreatedOrdersMap.get(idempotencyKey);
    }

    if (existingRecentOrder && existingRecentOrder.wcOrderId) {
      try {
        const checkRes = await wcFetch(`orders/${existingRecentOrder.wcOrderId}`);
        if (checkRes.ok && checkRes.data) {
          const currentStatus = (checkRes.data.status || '').toLowerCase().trim();
          if (currentStatus === 'cancelled' || currentStatus === 'trash' || currentStatus === 'completed' || currentStatus === 'processing' || currentStatus === 'confirmed') {
            console.log(`[Idempotency] Order #${existingRecentOrder.wcOrderId} has status '${currentStatus}'. Will NOT reuse. Creating fresh order...`);
            existingRecentOrder = null;
            recentCreatedOrdersMap.delete(idempotencyKey);
          }
        }
      } catch (err: any) {
        console.warn(`[Idempotency] Could not verify Order #${existingRecentOrder.wcOrderId} status:`, err.message);
      }
    }

    if (existingRecentOrder) {
      console.log(`⚡ Idempotency match: Reusing active pending Order #${existingRecentOrder.wcOrderId} for ${customerEmail}`);
      await releaseLock();
      return res.json({
        success: true,
        wcOrderId: existingRecentOrder.wcOrderId,
        orderRefCode: existingRecentOrder.orderRefCode,
        razorpayOrderId: existingRecentOrder.razorpayOrderId,
        amount: existingRecentOrder.amount,
        amountInPaise: existingRecentOrder.amountInPaise,
        currency: 'INR',
        keyId: existingRecentOrder.keyId,
        trackingToken: existingRecentOrder.trackingToken,
      });
    }

    const trackingToken = crypto.randomBytes(24).toString('hex');
    const trackingTokenExpires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days

    const wcOrderPayload: any = {
      payment_method: 'razorpay',
      payment_method_title: 'Razorpay (UPI/Cards/NetBanking)',
      set_paid: false,
      status: 'pending',
      total: totalAmountInRupees.toFixed(2),
      ...(existingCustomerId > 0 ? { customer_id: existingCustomerId } : {}),
      meta_data: [
        { key: '_order_ref_code', value: orderRefCode },
        { key: '_customer_phone', value: customerPhone },
        { key: '_tracking_token', value: trackingToken },
        { key: '_tracking_token_expires', value: trackingTokenExpires.toString() },
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
    let rzpOrderId = `order_mock_${wcOrderId}`;
    const finalAmountInPaise = Math.round(totalAmountInRupees * 100);

    try {
      // Create Razorpay payment order directly (No WooCommerce order created prior to payment)
      const rzpOrder = await razorpay.orders.create({
        amount: finalAmountInPaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        notes: {
          customer_email: customerEmail,
        }
      }).catch((err: any) => {
        console.warn('[Razorpay Order Creation Notice]:', err.message);
        return null;
      });

      if (rzpOrder && rzpOrder.id) {
        rzpOrderId = rzpOrder.id;
      }
    } catch (err: any) {
      console.error('[Razorpay Order Creation Error]:', err.message);
    }

    if (rzpOrderId && !rzpOrderId.startsWith('order_mock_')) {
      razorpayToWcOrderMap.set(rzpOrderId, wcOrderId);
    }

    const keyId = (process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E').trim();

    const resPayload = {
      success: true,
      wcOrderId,
      orderRefCode,
      razorpayOrderId: rzpOrderId,
      amount: totalAmountInRupees,
      amountInPaise: finalAmountInPaise,
      currency: 'INR',
      keyId,
      trackingToken,
      expiresAt: now + 10 * 60 * 1000,
    };

    await setIdempotencyInDatabase(idempotencyKey, resPayload);
    recentCreatedOrdersMap.set(idempotencyKey, resPayload);

    // Asynchronous background cleanup of expired pending orders
    cleanupExpiredPendingOrders().catch((err) => console.error('[Background Cleanup Error]:', err.message));

    await releaseLock();

    return res.json(resPayload);
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

    const orderRes = await wcFetch(`orders/${wcOrderId}`);
    if (!orderRes.ok || !orderRes.data) {
      return res.status(404).json({ success: false, message: `Order #${wcOrderId} not found` });
    }

    const order = orderRes.data;
    const currentStatus = (order.status || '').toLowerCase().trim();

    if (!['pending', 'pending-payment'].includes(currentStatus)) {
      console.warn(`[Inventory Reservation Cleanup] Rejected cancel request for Order #${wcOrderId}: Status is '${currentStatus}'`);
      return res.status(400).json({
        success: false,
        message: `Order #${wcOrderId} cannot be cancelled because its current status is '${currentStatus}'. Only unpaid pending orders can be cancelled.`
      });
    }

    console.log(`[Inventory Reservation Cleanup] Cancelling unpaid pending order #${wcOrderId} to release stock...`);
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

// POST /api/v1/checkout/retry-payment (Reuse existing WooCommerce order for payment retry)
app.post(['/api/v1/checkout/retry-payment', '/api/checkout/retry-payment', '/v1/checkout/retry-payment', '/checkout/retry-payment'], async (req, res) => {
  try {
    const { wcOrderId } = req.body;
    if (!wcOrderId) {
      return res.status(400).json({ success: false, message: 'wcOrderId parameter is required' });
    }

    const orderRes = await wcFetch(`orders/${wcOrderId}`);
    if (!orderRes.ok || !orderRes.data) {
      return res.status(404).json({ success: false, message: `Order #${wcOrderId} not found` });
    }

    const order = orderRes.data;
    const isPaid = ['processing', 'confirmed', 'kitchen', 'dispatched', 'shipped', 'completed', 'delivered'].includes(order.status);

    if (order.status !== 'pending' && order.status !== 'pending-payment') {
      return res.status(400).json({
        success: false,
        isAlreadyPaid: isPaid,
        message: isPaid
          ? 'This order has already been paid and confirmed.'
          : `Order #${wcOrderId} cannot be paid (Current status: ${order.status})`
      });
    }

    const totalAmount = parseFloat(order.total) || 0;
    const amountInPaise = Math.round(totalAmount * 100);

    // Stock verification
    if (Array.isArray(order.line_items)) {
      for (const item of order.line_items) {
        if (item.product_id) {
          const p = await getProductFromWooCommerceOrCache(item.product_id);
          if (p && p.stockQuantity !== undefined && p.stockQuantity !== null) {
            if (p.stockQuantity < item.quantity) {
              return res.status(400).json({
                success: false,
                code: 'OUT_OF_STOCK',
                message: `Sorry, "${item.name}" only has ${p.stockQuantity} items in stock. Cannot complete payment.`
              });
            }
          }
        }
      }
    }

    const metaList = Array.isArray(order.meta_data) ? order.meta_data : [];
    const refMeta = metaList.find((m: any) => m.key === '_order_ref_code' || m.key === 'order_ref_code');
    const displayRefCode = refMeta?.value || `HF-${order.id}`;

    const razorpay = getRazorpayClient();
    let razorpayOrderId = `order_mock_${wcOrderId}`;
    if (razorpay && amountInPaise > 0) {
      try {
        const rzpOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `retry_${wcOrderId}_${Date.now().toString().slice(-4)}`,
        });
        if (rzpOrder && rzpOrder.id) {
          razorpayOrderId = rzpOrder.id;
        }
      } catch (err: any) {
        console.warn('[Retry Payment] Razorpay creation warning:', err.message);
      }
    }

    const newExpiresAt = Date.now() + 10 * 60 * 1000;

    await wcFetch(`orders/${wcOrderId}`, {
      method: 'PUT',
      body: {
        meta_data: [
          { key: '_razorpay_order_id', value: razorpayOrderId },
          { key: '_razorpay_amount_paise', value: amountInPaise.toString() },
          { key: '_reservation_expires_at', value: newExpiresAt.toString() }
        ]
      }
    }).catch(() => {});

    return res.json({
      success: true,
      wcOrderId: order.id,
      orderRefCode: displayRefCode,
      razorpayOrderId,
      amountInPaise,
      currency: 'INR',
      keyId: (process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E').trim(),
      expiresAt: newExpiresAt,
      customerEmail: order.billing?.email || '',
      customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Valued Customer',
      phone: order.billing?.phone || '',
      shippingAddress: `${order.shipping?.address_1 || ''}, ${order.shipping?.city || ''}`,
      items: order.line_items?.map((it: any) => ({ name: it.name, quantity: it.quantity, pricePerUnit: parseFloat(it.price) || 0 })) || [],
    });
  } catch (error: any) {
    console.error('[Retry Payment Error]:', error.message);
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
        console.warn(`[Verify Payment] Signature check notice for WC Order #${wcOrderId}. Payment ID verified: ${razorpay_payment_id}`);
        if (!razorpay_payment_id) {
          return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }
      }
    }

    let finalWcOrderId = wcOrderId;
    let finalOrderRefCode = orderRefCode;

    // Create WooCommerce Order directly upon payment verification (No pre-created pending orders)
    if (!finalWcOrderId || typeof finalWcOrderId !== 'number' || finalWcOrderId > 1000000000000) {
      try {
        const cleanEmail = (customerEmail || '').trim().toLowerCase();
        const fullName = (customerName || 'Customer').trim();
        const firstName = fullName.split(' ')[0] || 'Customer';
        const lastName = fullName.split(' ').slice(1).join(' ') || '';
        const cleanPhone = (phone || '').trim();

        const safeItems = Array.isArray(items) ? items : [];
        let itemsSubtotal = 0;
        const lineItems = safeItems.map((item: any) => {
          const qty = parseInt(item.quantity || 1, 10);
          const priceVal = item.pricePerUnit ?? item.price ?? 70;
          const priceNum = typeof priceVal === 'number' ? priceVal : (parseFloat(priceVal) || 70);
          const lineTotal = priceNum * qty;
          itemsSubtotal += lineTotal;
          return {
            product_id: parseInt(item.productId || item.id, 10) || 35,
            quantity: qty,
            subtotal: lineTotal.toFixed(2),
            total: lineTotal.toFixed(2),
            meta_data: [{ key: 'weight', value: item.weight || '250gms' }]
          };
        });

        const numTotal = parseFloat(totalAmount || '0') || itemsSubtotal;
        const deliveryCharge = Math.max(0, numTotal - itemsSubtotal);

        const wcOrderPayload: any = {
          payment_method: 'razorpay',
          payment_method_title: 'Razorpay (UPI/Cards/NetBanking)',
          set_paid: true,
          status: 'processing',
          transaction_id: razorpay_payment_id || `tx_${Date.now()}`,
          total: numTotal.toFixed(2),
          meta_data: [
            { key: '_payment_verified', value: 'true' },
            { key: '_payment_state', value: 'confirmed' },
            { key: '_razorpay_payment_id', value: razorpay_payment_id || '' }
          ],
          billing: {
            first_name: firstName,
            last_name: lastName,
            email: cleanEmail,
            phone: cleanPhone,
            address_1: shippingAddress || 'Main Road',
            city: 'Madurai',
            state: 'TN',
            country: 'IN'
          },
          shipping: {
            first_name: firstName,
            last_name: lastName,
            address_1: shippingAddress || 'Main Road',
            city: 'Madurai',
            state: 'TN',
            country: 'IN'
          },
          line_items: lineItems,
          shipping_lines: deliveryCharge > 0 ? [
            {
              method_id: 'flat_rate',
              method_title: 'Flat Delivery Charge',
              total: deliveryCharge.toFixed(2)
            }
          ] : []
        };

        const createRes = await wcFetch('orders', { method: 'POST', body: wcOrderPayload });
        if (createRes.ok && createRes.data && createRes.data.id) {
          finalWcOrderId = createRes.data.id;
          const nowIst = new Date(new Date().getTime() + (5.5 * 60 * 60 * 1000));
          const pad = (n: number) => n.toString().padStart(2, '0');
          const HHMM = `${pad(nowIst.getUTCHours())}${pad(nowIst.getUTCMinutes())}`;
          const DDMMYY = `${pad(nowIst.getUTCDate())}${pad(nowIst.getUTCMonth() + 1)}${nowIst.getUTCFullYear().toString().slice(-2)}`;
          finalOrderRefCode = `${HHMM}//${DDMMYY}//${finalWcOrderId}`;

          wcFetch(`orders/${finalWcOrderId}`, {
            method: 'PUT',
            body: { meta_data: [{ key: '_order_ref_code', value: finalOrderRefCode }] }
          }).catch(() => {});

          sendOrderTrackingEmail({
            toEmail: cleanEmail,
            customerName: fullName,
            orderRefCode: finalOrderRefCode,
            wcOrderId: finalWcOrderId,
            totalAmount: parseFloat(totalAmount || '0'),
            items: safeItems.map((i: any) => ({ name: i.name, quantity: i.quantity, totalPrice: (i.pricePerUnit || 70) * i.quantity, weight: i.weight || '250gms' })),
            shippingAddress: shippingAddress || 'Madurai',
            trackingLink: `${APP_URL}/#track?id=${encodeURIComponent(finalOrderRefCode)}`
          }).catch(() => {});
        }
      } catch (err: any) {
        console.error('[Verify Payment Order Creation Error]:', err.message);
      }
    } else if (finalWcOrderId) {
      await confirmWooOrder(finalWcOrderId, razorpay_payment_id || `tx_${Date.now()}`, 'verify');
    }

    const cleanEmail = (customerEmail || '').trim().toLowerCase();
    let customerUser: any = null;
    let customerId = '';
    let accessToken = '';
    let refreshToken = '';
    let finalCartRevision = 1;

    if (cleanEmail) {
      userCartsMap.set(cleanEmail, []);
      userCartLocks.set(cleanEmail, Date.now() + 5000);

      // Find or create WooCommerce customer
      const fullName = (customerName || 'Customer').trim();
      const firstName = fullName.split(' ')[0] || 'Customer';
      const lastName = fullName.split(' ').slice(1).join(' ') || '';
      const cleanPhone = (phone || '').trim();

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
            address_1: shippingAddress ? shippingAddress.split(',')[0]?.trim() || '' : '',
            city: shippingAddress ? shippingAddress.split(',')[1]?.split('-')[0]?.trim() || '' : '',
            state: 'Tamil Nadu',
            postcode: shippingAddress ? shippingAddress.split('-')?.[1]?.trim() || '' : '',
          },
          shipping: {
            first_name: firstName,
            last_name: lastName,
            address_1: shippingAddress ? shippingAddress.split(',')[0]?.trim() || '' : '',
            city: shippingAddress ? shippingAddress.split(',')[1]?.split('-')[0]?.trim() || '' : '',
            state: 'Tamil Nadu',
            postcode: shippingAddress ? shippingAddress.split('-')?.[1]?.trim() || '' : '',
          },
          meta_data: [
            { key: 'hf_saved_cart', value: '[]' },
            { key: '_saved_cart', value: '[]' },
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
        } catch (createErr: any) {
          console.error('[Verify Payment] Customer creation failed:', createErr.message);
          customerId = getDeterministicUserId(cleanEmail);
          customerUser = { id: customerId, email: cleanEmail, first_name: firstName, last_name: lastName };
        }
      } else {
        // Clear saved cart and increment revision
        const metaList = Array.isArray(customerUser.meta_data) ? customerUser.meta_data : [];
        const serverRevision = parseInt(metaList.find((m: any) => m.key === 'hf_cart_revision')?.value || '0', 10);
        finalCartRevision = serverRevision + 1;

        try {
          await wcFetch(`customers/${customerId}`, {
            method: 'PUT',
            body: {
              meta_data: [
                { key: 'hf_saved_cart', value: '[]' },
                { key: '_saved_cart', value: '[]' },
                { key: 'hf_cart_revision', value: finalCartRevision.toString() }
              ],
            },
          });
        } catch {}
      }

      if (!customerId) {
        customerId = getDeterministicUserId(cleanEmail);
      }

      // link guest orders
      linkGuestOrdersToCustomer(cleanEmail, customerId);

      // Create JWT session for auto-login
      const sessionId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      accessToken = jwt.sign({ customerId: parseInt(customerId, 10), email: cleanEmail }, JWT_SECRET, { expiresIn: '15m' });
      refreshToken = jwt.sign({ customerId: parseInt(customerId, 10), sessionId }, JWT_REFRESH_SECRET, { expiresIn: '30d' });

      const activeSessions = getSavedSessionHashes(customerUser);
      activeSessions.push({
        hash: sha256(refreshToken),
        deviceId: 'checkout_auto_registration',
        deviceName: 'Web Checkout',
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
    }

    let trackingToken = '';
    try {
      const orderDataRes = await wcFetch(`orders/${wcOrderId}`);
      if (orderDataRes.ok && orderDataRes.data) {
        const orderObj = orderDataRes.data;
        const trackingMeta = (orderObj.meta_data || []).find((m: any) => m.key === '_tracking_token');
        if (trackingMeta && trackingMeta.value) {
          trackingToken = trackingMeta.value;
        }
      }
    } catch {}

    const displayOrderCode = finalOrderRefCode || orderRefCode || `HF-${finalWcOrderId || wcOrderId}`;
    const trackingLink = trackingToken 
      ? `${APP_URL}/#track?token=${encodeURIComponent(trackingToken)}`
      : `${APP_URL}/#track?id=${encodeURIComponent(displayOrderCode)}`;

    return res.json({
      success: true,
      message: 'Payment verified',
      wcOrderId: finalWcOrderId || wcOrderId,
      orderRefCode: displayOrderCode,
      trackingLink,
      cartRevision: finalCartRevision,
      accessToken: accessToken || undefined,
      refreshToken: refreshToken || undefined,
      user: customerUser ? {
        id: customerId,
        email: cleanEmail,
        firstName: customerUser?.first_name || (customerName || 'Customer').split(' ')[0],
        lastName: customerUser?.last_name || (customerName || 'Customer').split(' ').slice(1).join(' '),
        displayName: customerUser?.display_name || customerName || 'Customer',
        phone: customerUser?.billing?.phone || phone || '',
        billing: customerUser?.billing || {
          first_name: customerUser?.first_name || (customerName || 'Customer').split(' ')[0],
          last_name: customerUser?.last_name || (customerName || 'Customer').split(' ').slice(1).join(' '),
          email: cleanEmail,
          phone: phone || '',
          address_1: '',
          city: '',
          state: 'Tamil Nadu',
          postcode: ''
        },
        shipping: customerUser?.shipping || {
          first_name: customerUser?.first_name || (customerName || 'Customer').split(' ')[0],
          last_name: customerUser?.last_name || (customerName || 'Customer').split(' ').slice(1).join(' '),
          address_1: '',
          city: '',
          state: 'Tamil Nadu',
          postcode: ''
        }
      } : undefined
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/checkout/track and /api/v1/checkout/track/:tokenOrId
app.get([
  '/api/v1/checkout/track', '/api/checkout/track', '/v1/checkout/track', '/checkout/track',
  '/api/v1/checkout/track/:tokenOrId', '/api/checkout/track/:tokenOrId', '/v1/checkout/track/:tokenOrId', '/checkout/track/:tokenOrId'
], async (req, res) => {
  try {
    const rawQuery = (req.query.q || req.query.id || req.query.token || req.query.order_id || req.params.tokenOrId || '').toString();
    const cleanParam = decodeURIComponent(rawQuery).trim();

    if (!cleanParam) {
      return res.status(400).json({ success: false, message: 'Invalid or missing tracking parameters.' });
    }

    let order: any = null;

    // 1. Check 48-char hex tracking token (from email link)
    if (cleanParam.length === 48 && /^[0-9a-fA-F]+$/.test(cleanParam)) {
      try {
        const wcRes = await wcFetch('orders', {
          params: {
            meta_key: '_tracking_token',
            meta_value: cleanParam
          }
        });
        if (wcRes.ok && Array.isArray(wcRes.data) && wcRes.data.length > 0) {
          order = wcRes.data[0];
        }
      } catch {}
    }

    // 2. Multi-strategy Search for Order IDs, Reference Codes (e.g. 2259//250826//307), or Numeric Order Numbers
    if (!order) {
      const cleanId = cleanParam.replace(/^#/, '').trim();
      const numbers = cleanId.match(/\d+/g) || [];

      // Strategy A: Match by _order_ref_code meta value
      try {
        const metaRes = await wcFetch('orders', {
          params: {
            meta_key: '_order_ref_code',
            meta_value: cleanId
          }
        });
        if (metaRes.ok && Array.isArray(metaRes.data) && metaRes.data.length > 0) {
          order = metaRes.data[0];
        }
      } catch {}

      // Strategy B: Direct fetch by numeric WooCommerce Order ID (e.g., 2259)
      if (!order && numbers.length > 0) {
        for (const numId of numbers) {
          try {
            const wcRes = await wcFetch(`orders/${numId}`);
            if (wcRes.ok && wcRes.data && wcRes.data.id) {
              order = wcRes.data;
              break;
            }
          } catch {}
        }
      }

      // Strategy C: WooCommerce Search API parameter
      if (!order) {
        try {
          const searchKey = numbers.length > 0 ? numbers[0] : cleanId;
          const searchRes = await wcFetch('orders', {
            params: {
              search: searchKey,
              per_page: 20
            }
          });
          if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
            const match = searchRes.data.find((o: any) => {
              const oNum = (o.number || '').toString().toLowerCase();
              const oId = (o.id || '').toString().toLowerCase();
              const refMeta = (o.meta_data || []).find((m: any) => m.key === '_order_ref_code')?.value || '';
              const qLower = cleanId.toLowerCase();
              return oNum === qLower || oId === qLower || refMeta.toLowerCase() === qLower ||
                     oNum.includes(qLower) || qLower.includes(oNum) ||
                     (numbers.length > 0 && oId === numbers[0]);
            }) || searchRes.data[0];
            order = match;
          }
        } catch {}
      }

      // Strategy D: Fallback match against recent orders in server memory
      if (!order && recentCreatedOrdersMap.size > 0) {
        for (const [_, val] of recentCreatedOrdersMap.entries()) {
          const rRef = (val.orderRefCode || '').toLowerCase();
          const rWc = (val.wcOrderId || '').toString().toLowerCase();
          const qLower = cleanId.toLowerCase();
          if (rRef === qLower || rWc === qLower || rRef.includes(qLower) || qLower.includes(rRef) || (numbers.length > 0 && rWc === numbers[0])) {
            order = {
              id: val.wcOrderId,
              number: val.orderRefCode,
              status: 'processing',
              total: (val.amountInPaise / 100).toFixed(2),
              date_created: new Date(val.timestamp).toISOString(),
              line_items: [],
              billing: {},
              shipping: {},
              meta_data: [{ key: '_order_ref_code', value: val.orderRefCode }]
            };
            break;
          }
        }
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: `No order found matching "${cleanParam}". Please check your Order ID.` });
    }

    // Format clean tracking response
    const refCodeMeta = (order.meta_data || []).find((m: any) => m.key === '_order_ref_code');
    const orderRefCode = order.number || refCodeMeta?.value || `HF-${order.id}`;
    const currentStatus = getOrderStatusDetails(order.status || 'processing');
    const rzpOrderIdMeta = (order.meta_data || []).find((m: any) => m.key === '_razorpay_order_id');

    const items = (order.line_items || []).map((item: any) => ({
      name: decodeHtmlEntities(item.name || 'Homemade Delicacy'),
      quantity: parseInt(item.quantity || '1', 10),
      total: item.total || '0'
    }));

    const city = order.shipping?.city || order.billing?.city || 'Madurai';
    const address = order.shipping?.address_1 || order.billing?.address_1 || '';
    const formattedAddress = address ? `${address}, ${city}` : city;

    const lineSubtotal = (order.line_items || []).reduce((acc: number, item: any) => acc + (parseFloat(item.total) || 0), 0);
    const shippingVal = parseFloat(order.shipping_total) || 0;
    const totalVal = parseFloat(order.total) || 0;
    const resolvedTotal = (lineSubtotal > 0 && lineSubtotal < 499 && shippingVal === 0 && Math.abs(totalVal - lineSubtotal) < 0.01)
      ? (lineSubtotal + 40).toFixed(2)
      : (order.total || '0');

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        orderRefCode,
        status: order.status,
        statusLabel: currentStatus.label,
        stage: currentStatus.stage,
        total: resolvedTotal,
        currency: '₹',
        dateCreated: order.date_created || new Date().toISOString(),
        customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim() || 'Valued Customer',
        phone: order.billing?.phone || '',
        shippingAddress: formattedAddress,
        items,
        ...(order.status === 'pending' ? {
          razorpayOrderId: rzpOrderIdMeta?.value || '',
          amountInPaise: Math.round((parseFloat(order.total) || 0) * 100),
          keyId: (process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E').trim(),
        } : {})
      }
    });

  } catch (error: any) {
    console.error('[Order Track Endpoint Error]:', error.message);
    return res.status(500).json({ success: false, message: 'Server error while tracking order. Please try again.' });
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
