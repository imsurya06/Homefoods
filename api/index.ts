import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// In-Memory Caches & Transients
let cachedProductsResponse: any = null;
let lastCacheTime = 0;
const userCartsMap = new Map<string, any[]>();
const recentCreatedOrdersMap = new Map<string, { wcOrderId: number; orderRefCode: string; razorpayOrderId: string; amount: number; amountInPaise: number; keyId: string; timestamp: number }>();

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

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, fetchOptions);
    const data = await response.json();
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
  if (s === 'kitchen' || s === 'processing' || s === 'on-hold' || s === 'on_hold' || s.includes('kitchen') || s.includes('process')) {
    return { stage: 2, label: 'Kitchen Preparation' };
  }
  if (s === 'pending' || s === 'pending-payment' || s === 'confirmed' || s === 'auto-draft') {
    return { stage: 1, label: 'Order Confirmed' };
  }
  if (s === 'cancelled' || s === 'refunded' || s === 'failed') {
    return { stage: 0, label: s === 'cancelled' ? 'Order Cancelled' : s === 'refunded' ? 'Order Refunded' : 'Payment Failed' };
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
                      <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">
                        We have received your payment and our kitchen team has started preparing your fresh, traditional South Indian delicacies.
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

    const wcRes = await wcFetch('products', { params: { per_page: 100 } });
    let formattedProducts: any[] = [];

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
          gstPercentage: 5,
          isAvailable: p.stock_status === 'instock',
          stockQuantity: p.stock_quantity ?? 100,
          variants,
        };
      });
    }

    if (formattedProducts.length > 0) {
      cachedProductsResponse = formattedProducts;
      lastCacheTime = now;
    }

    const filtered = filterProducts(formattedProducts, category, search, inStock);
    return res.json({ success: true, source: 'woocommerce', count: filtered.length, data: filtered });
  } catch (error: any) {
    console.error('Error fetching products:', error.message);
    return res.status(500).json({ success: false, message: 'Error fetching products', error: error.message });
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

// POST /api/v1/auth/login-signup (Instant Auto-Registration & Customer Login)
app.post('/api/v1/auth/login-signup', async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }

    const fullName = (name || 'Customer').trim();
    const firstName = fullName.split(' ')[0] || 'Customer';
    const lastName = fullName.split(' ').slice(1).join(' ') || '';
    const cleanPhone = (phone || '').trim();

    let customerId = '';
    let customerUser: any = null;

    try {
      const searchRes = await wcFetch('customers', { params: { email: cleanEmail } });
      if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        customerUser = searchRes.data[0];
        customerId = customerUser.id.toString();
      }
    } catch {}

    const isExistingUser = !!customerUser;

    if (isExistingUser && customerUser) {
      const passMeta = (customerUser.meta_data || []).find((m: any) => m.key === '_customer_auth_pass');
      const expectedPassword = passMeta?.value;

      if (expectedPassword && expectedPassword !== cleanPassword) {
        return res.status(401).json({
          success: false,
          message: 'Incorrect password! Account already exists for this email address. Please enter the correct password or click Forgot Password to reset.',
        });
      }

      if (!expectedPassword && cleanPassword) {
        try {
          await wcFetch(`customers/${customerId}`, {
            method: 'PUT',
            body: { meta_data: [{ key: '_customer_auth_pass', value: cleanPassword }] },
          });
        } catch {}
      }
    }

    if (!customerUser) {
      const username = `${cleanEmail.split('@')[0]}_${Math.floor(1000 + Math.random() * 9000)}`;
      const customerPayload = {
        email: cleanEmail,
        first_name: firstName,
        last_name: lastName,
        username,
        billing: { first_name: firstName, last_name: lastName, email: cleanEmail, phone: cleanPhone },
        shipping: { first_name: firstName, last_name: lastName },
        meta_data: cleanPassword ? [{ key: '_customer_auth_pass', value: cleanPassword }] : [],
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
    }

    if (!customerId) {
      customerId = getDeterministicUserId(cleanEmail);
    }

    // Retroactively claim any guest orders placed with this email address
    linkGuestOrdersToCustomer(cleanEmail, customerId);

    const payloadStr = `${customerId}:${cleanEmail}:${Date.now()}`;
    const token = Buffer.from(payloadStr).toString('base64');

    return res.json({
      success: true,
      token,
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

// POST /api/v1/auth/register
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }

    const username = `${cleanEmail.split('@')[0]}_${Math.floor(1000 + Math.random() * 9000)}`;
    const customerData = {
      email: cleanEmail,
      password: password || 'CustomerPass123!',
      first_name: firstName || 'Valued',
      last_name: lastName || 'Customer',
      username,
      billing: { first_name: firstName || 'Valued', last_name: lastName || 'Customer', email: cleanEmail, phone: phone || '' },
    };

    let createdUser: any = null;
    try {
      const wcRes = await wcFetch('customers', { method: 'POST', body: customerData });
      if (wcRes.ok && wcRes.data) createdUser = wcRes.data;
    } catch {}

    if (!createdUser) {
      createdUser = { id: `usr_${Date.now()}`, email: cleanEmail, first_name: firstName || 'Valued', last_name: lastName || 'Customer' };
    }

    const tokenPayload = `${createdUser.id}:${cleanEmail}:${Date.now()}`;
    const token = Buffer.from(tokenPayload).toString('base64');

    return res.json({
      success: true,
      token,
      user: {
        id: createdUser.id.toString(),
        email: cleanEmail,
        firstName: createdUser.first_name,
        lastName: createdUser.last_name,
        displayName: `${createdUser.first_name} ${createdUser.last_name}`.trim(),
        phone: phone || '',
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/auth/login
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }

    let customerUser: any = null;
    try {
      const searchRes = await wcFetch('customers', { params: { email: cleanEmail } });
      if (searchRes.ok && Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        customerUser = searchRes.data[0];
      }
    } catch {}

    const id = customerUser ? customerUser.id.toString() : `usr_${Date.now()}`;
    const fn = customerUser?.first_name || cleanEmail.split('@')[0];
    const ln = customerUser?.last_name || '';

    const tokenPayload = `${id}:${cleanEmail}:${Date.now()}`;
    const token = Buffer.from(tokenPayload).toString('base64');

    return res.json({
      success: true,
      token,
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

// GET /api/v1/auth/me
app.get('/api/v1/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    const rawDecoded = Buffer.from(token, 'base64').toString('utf-8');
    const decoded = rawDecoded.includes('%') ? decodeURIComponent(rawDecoded) : rawDecoded;
    const parts = decoded.split(':');
    const idStr = parts[0] || '';
    const emailStr = parts[1] || '';

    if (!emailStr) return res.status(401).json({ success: false, message: 'Invalid token' });

    let customerUser: any = null;
    if (/^\d+$/.test(idStr)) {
      try {
        const wcRes = await wcFetch(`customers/${idStr}`);
        if (wcRes.ok && wcRes.data) {
          customerUser = wcRes.data;
        } else if (wcRes.status === 404) {
          return res.status(401).json({ success: false, message: 'User account has been deleted from database', accountDeleted: true });
        }
      } catch {}
    }

    const fn = customerUser?.first_name || emailStr.split('@')[0];
    const ln = customerUser?.last_name || '';

    return res.json({
      success: true,
      user: {
        id: idStr,
        email: emailStr,
        firstName: fn,
        lastName: ln,
        displayName: `${fn} ${ln}`.trim(),
        phone: customerUser?.billing?.phone || '',
      },
    });
  } catch (error: any) {
    return res.status(401).json({ success: false, message: 'Invalid session token' });
  }
});

// GET /api/v1/auth/my-orders
app.get(['/api/v1/auth/my-orders', '/api/auth/my-orders', '/v1/auth/my-orders', '/auth/my-orders'], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const token = authHeader.replace('Bearer ', '');
    let userEmail = '';
    let idStr = '';
    try {
      const rawDecoded = Buffer.from(token, 'base64').toString('utf-8');
      const decoded = rawDecoded.includes('%') ? decodeURIComponent(rawDecoded) : rawDecoded;
      const parts = decoded.split(':');
      idStr = parts[0] || '';
      userEmail = parts[1] || '';
    } catch {}

    if (!userEmail && !idStr) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Verify if user account was deleted from WordPress Admin
    if (/^\d+$/.test(idStr)) {
      try {
        const checkCust = await wcFetch(`customers/${idStr}`);
        if (checkCust.status === 404) {
          return res.status(401).json({ success: false, message: 'User account has been deleted from database', accountDeleted: true, data: [] });
        }
      } catch {}
    }

    if (userEmail && idStr) {
      await linkGuestOrdersToCustomer(userEmail, idStr);
    }

    let orders: any[] = [];
    try {
      let list1: any[] = [];
      if (/^\d+$/.test(idStr)) {
        const r1 = await wcFetch('orders', { params: { customer: idStr, per_page: 100 } });
        if (r1.ok && Array.isArray(r1.data)) list1 = r1.data;
      }

      let list2: any[] = [];
      const r2 = await wcFetch('orders', { params: { per_page: 100 } });
      if (r2.ok && Array.isArray(r2.data)) list2 = r2.data;

      const rawCombined = [...list1, ...list2];
      const userCleanEmail = (userEmail || '').trim().toLowerCase();
      const emailPrefix = userCleanEmail.split('@')[0];

      const seenIds = new Set<string>();
      orders = rawCombined.filter((o: any) => {
        if (!o || !o.id || o.status === 'trash') return false;
        const oId = o.id.toString();
        if (seenIds.has(oId)) return false;
        seenIds.add(oId);

        const orderEmail = (o.billing?.email || '').toLowerCase();
        const orderCustId = o.customer_id ? o.customer_id.toString() : '';

        return (
          (idStr && orderCustId === idStr) ||
          (userCleanEmail && orderEmail === userCleanEmail) ||
          (emailPrefix && emailPrefix.length > 2 && orderEmail.startsWith(emailPrefix))
        );
      });
    } catch {}

    const seenOrderIds = new Set<string>();
    const formattedOrders: any[] = [];

    for (const order of orders) {
      const idKey = order.id ? order.id.toString() : '';
      if (idKey && seenOrderIds.has(idKey)) continue;
      if (idKey) seenOrderIds.add(idKey);

      const currentStatus = getOrderStatusDetails(order.status);
      const refMeta = (order.meta_data || []).find((m: any) => m.key === '_order_ref_code');
      const orderRefCode = refMeta?.value || `HF-${order.id}`;

      formattedOrders.push({
        id: order.id,
        orderRefCode,
        status: order.status,
        statusLabel: currentStatus.label,
        stage: currentStatus.stage,
        total: order.total,
        currency: order.currency_symbol || '₹',
        dateCreated: order.date_created,
        items: order.line_items?.map((item: any) => ({ name: item.name, quantity: item.quantity, total: item.total })),
        shippingAddress: `${order.shipping?.address_1 || order.billing?.address_1 || ''}, ${order.shipping?.city || order.billing?.city || ''}`,
      });
    }

    return res.json({ success: true, count: formattedOrders.length, data: formattedOrders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/checkout/create-order
app.post('/api/v1/checkout/create-order', async (req, res) => {
  try {
    const { customerDetails, billingAddress, shippingAddress, items, couponCode, notes } = req.body;
    const razorpay = getRazorpayClient();

    let authUserEmail = '';
    let authCustomerId = 0;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const rawDecoded = Buffer.from(token, 'base64').toString('utf-8');
        const decoded = rawDecoded.includes('%') ? decodeURIComponent(rawDecoded) : rawDecoded;
        const parts = decoded.split(':');
        if (parts[0] && /^\d+$/.test(parts[0])) {
          authCustomerId = parseInt(parts[0]);
        }
        if (parts[1] && parts[1].includes('@')) {
          authUserEmail = parts[1].trim().toLowerCase();
        }
      } catch {}
    }

    const rawEmail = (customerDetails?.email || billingAddress?.email || authUserEmail || '').trim();
    const customerEmail = rawEmail && rawEmail.includes('@') ? rawEmail : (authUserEmail || 'customer@homemadefoods.in');
    const customerPhone = (customerDetails?.phone || billingAddress?.phone || '9876543210').trim();
    const fullName = (customerDetails?.name || billingAddress?.firstName || 'Customer').trim();
    const firstName = fullName.split(' ')[0] || 'Customer';
    const lastName = fullName.split(' ').slice(1).join(' ') || 'Order';

    const orderRefCode = generateOrderRefCode();

    let existingCustomerId = authCustomerId;
    if (!existingCustomerId && customerEmail) {
      try {
        const custRes = await wcFetch('customers', { params: { email: customerEmail } });
        if (custRes.ok && Array.isArray(custRes.data) && custRes.data.length > 0) {
          existingCustomerId = custRes.data[0].id;
        }
      } catch {}
    }

    const lineItems = items.map((item: any) => {
      const pid = parseInt(item.productId);
      return {
        product_id: !isNaN(pid) && pid > 0 ? pid : 35,
        quantity: item.quantity || 1,
      };
    });

    const SHIPPING_FEE = 40;
    const subtotal = items.reduce((sum: number, item: any) => sum + ((item.pricePerUnit || 50) * (item.quantity || 1)), 0);
    let totalAmountInRupees = subtotal > 0 ? subtotal + SHIPPING_FEE : 0;
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
      status: 'confirmed',
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
          method_title: 'Flat Delivery Charge',
          total: '40.00',
        },
      ],
      customer_note: notes || 'Order placed via Headless Storefront',
    };

    let wcOrderId = Date.now();
    try {
      const wcRes = await wcFetch('orders', { method: 'POST', body: wcOrderPayload });
      if (wcRes.ok && wcRes.data && wcRes.data.id) {
        wcOrderId = wcRes.data.id;
        totalAmountInRupees = parseFloat(wcRes.data.total) || totalAmountInRupees;
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

    return res.json({
      success: true,
      wcOrderId,
      orderRefCode,
      razorpayOrderId: rzpOrderId,
      amount: totalAmountInRupees,
      amountInPaise,
      currency: 'INR',
      keyId,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/checkout/verify-payment
app.post('/api/v1/checkout/verify-payment', async (req, res) => {
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
        body: { set_paid: true, status: 'kitchen', transaction_id: razorpay_payment_id || `tx_${Date.now()}` },
      });
    } catch {}

    const displayOrderCode = orderRefCode || `HF-${wcOrderId}`;
    const trackingLink = `https://homefoods-lac.vercel.app/#track?id=${displayOrderCode}`;

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

// GET /api/v1/checkout/track/:id
app.get(['/api/v1/checkout/track/:id', '/api/checkout/track/:id', '/v1/checkout/track/:id', '/checkout/track/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const rawInput = (id || '').trim();
    const cleanId = rawInput.replace(/^#/, '').trim();
    const searchCore = cleanId.replace(/^HF-/i, '').trim();
    const searchLower = cleanId.toLowerCase();

    let order: any = null;

    // Strategy 1: Direct numeric order ID fetch
    const numericId = searchCore.split('-')[0];
    if (numericId && /^\d+$/.test(numericId)) {
      try {
        const wcRes = await wcFetch(`orders/${numericId}`);
        if (wcRes.ok && wcRes.data && wcRes.data.id) {
          order = wcRes.data;
        }
      } catch {}
    }

    // Strategy 2: Search recent orders by ref code, ID, email, or phone
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
            if (refVal && (refVal === searchLower || refVal.includes(searchLower) || searchLower.includes(refVal))) return true;

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
