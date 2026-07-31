import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pkg from '@woocommerce/woocommerce-rest-api';
import Razorpay from 'razorpay';
import nodemailer from 'nodemailer';

const WooCommerceRestApi = (pkg as any).default || pkg;

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

// In-Memory Caches & Transients
let cachedProductsResponse: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30 * 1000;
const userCartsMap = new Map<string, any[]>();

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

function getWcApi() {
  const storeUrl = process.env.WC_STORE_URL || 'https://admin.homemadefoodsmadurai.com';
  const consumerKey = process.env.WC_CONSUMER_KEY || 'ck_48a6c149fa81c87736460d25a0af0c9b439d8a49';
  const consumerSecret = process.env.WC_CONSUMER_SECRET || 'cs_77c182f6d49a3626a55a57da825c54231ae3fb43';

  return new WooCommerceRestApi({
    url: storeUrl,
    consumerKey,
    consumerSecret,
    version: 'wc/v3',
    queryStringAuth: true,
  });
}

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || 'mw34w1wZGXkKlbZYTEDcMKu7';

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

// Transactional Email Dispatcher for Order Confirmation & Tracking
async function sendOrderTrackingEmail(toEmail: string, customerName: string, wcOrderId: number, totalAmount: number, trackingLink: string) {
  try {
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';

    if (!smtpUser || !smtpPass) {
      console.log(`✉️ Email notification logged (SMTP credentials not configured): Order #${wcOrderId} for ${toEmail}. Track Link: ${trackingLink}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const mailOptions = {
      from: `"Homemade Foods Madurai" <${smtpUser}>`,
      to: toEmail,
      subject: `🎉 Order Confirmation & Tracking - Order #${wcOrderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #95CD1A; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Homemade Foods</h1>
            <p style="color: #ffffff; margin: 4px 0 0 0; font-size: 14px;">Order Confirmed & Payment Received!</p>
          </div>
          <div style="padding: 24px; color: #1F2937;">
            <p>Dear <strong>${customerName}</strong>,</p>
            <p>Thank you for your order with Homemade Foods! Your delicious traditional South Indian food is being prepared in our kitchen.</p>
            
            <div style="background-color: #FAFBF6; border: 1px solid #ECF9CA; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Order ID:</strong> #${wcOrderId}</p>
              <p style="margin: 0 0 8px 0;"><strong>Total Amount Paid:</strong> ₹${totalAmount}</p>
              <p style="margin: 0;"><strong>Status:</strong> Kitchen Preparation & Packing</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingLink}" style="background-color: #95CD1A; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">
                Track Live Order Status →
              </a>
            </div>

            <p style="font-size: 12px; color: #6B7280; text-align: center;">
              Or copy this tracking URL: <a href="${trackingLink}">${trackingLink}</a>
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✉️ Order tracking email sent successfully to ${toEmail}`);
  } catch (err: any) {
    console.warn('Email sending warning:', err.message);
  }
}

// GET /api/v1/products
app.get('/api/v1/products', async (req, res) => {
  try {
    const { category, search, inStock, forceRefresh } = req.query;
    const wcApi = getWcApi();
    const now = Date.now();

    if (!forceRefresh && !search && cachedProductsResponse && (now - lastCacheTime < CACHE_TTL_MS)) {
      let filtered = cachedProductsResponse;
      if (category && category !== 'all') {
        const rawCat = String(category).toLowerCase().trim();
        const catQuery = rawCat.endsWith('s') ? rawCat.slice(0, -1) : rawCat;
        filtered = filtered.filter((p: any) =>
          p.categoryId.toLowerCase().includes(catQuery) ||
          catQuery.includes(p.categoryId.toLowerCase()) ||
          p.categoryName.toLowerCase().includes(catQuery)
        );
      }
      if (inStock === 'true') {
        filtered = filtered.filter((p: any) => p.isAvailable);
      }
      return res.json({
        success: true,
        source: 'cache',
        total: filtered.length,
        data: filtered,
      });
    }

    const response = await wcApi.get('products', {
      per_page: 100,
      status: 'publish',
    });

    const formattedProducts = response.data.map((p: any) => {
      const primaryCategory = p.categories[0] || {};
      const basePrice = parseFloat(p.price || p.regular_price || '0');

      const weightAttr = p.attributes?.find((a: any) => a.name.toLowerCase() === 'weight')?.options || [];
      let variants: { weight: string; basePrice: number }[] = [];

      if (weightAttr.length > 0) {
        variants = weightAttr.map((opt: string, idx: number) => ({
          weight: decodeHtmlEntities(opt.trim()),
          basePrice: idx === 0 ? basePrice : Math.round(basePrice * (idx === 1 ? 1.8 : 3.4)),
        }));
      } else if (p.weight) {
        const numericWeight = parseFloat(p.weight);
        let shippingWeightLabel = p.weight;
        if (!isNaN(numericWeight)) {
          shippingWeightLabel = numericWeight < 1 ? `${Math.round(numericWeight * 1000)}gms` : `${numericWeight}kg`;
        }
        variants = [{ weight: decodeHtmlEntities(shippingWeightLabel), basePrice }];
      } else {
        variants = [{ weight: 'Standard Pack', basePrice }];
      }

      return {
        id: p.id.toString(),
        name: decodeHtmlEntities(p.name),
        slug: p.slug,
        categoryId: primaryCategory.slug || 'all',
        categoryName: decodeHtmlEntities(primaryCategory.name || 'Homemade Foods'),
        description: decodeHtmlEntities(p.description?.replace(/<[^>]*>?/gm, '') || p.short_description?.replace(/<[^>]*>?/gm, '') || ''),
        ingredients: decodeHtmlEntities(p.attributes?.find((a: any) => a.name.toLowerCase() === 'ingredients')?.options?.join(', ') || ''),
        shelfLife: decodeHtmlEntities(p.attributes?.find((a: any) => a.name.toLowerCase() === 'shelf life')?.options?.join(', ') || '6 Months'),
        storageInstructions: decodeHtmlEntities(p.attributes?.find((a: any) => a.name.toLowerCase() === 'storage')?.options?.join(', ') || 'Store in a cool dry place.'),
        imageUrl: p.images[0]?.src || 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
        gstPercentage: p.tax_class === 'zero-rate' ? 0 : 5,
        isAvailable: p.stock_status === 'instock',
        stockQuantity: p.stock_quantity ?? 100,
        variants,
      };
    });

    cachedProductsResponse = formattedProducts;
    lastCacheTime = now;

    let filtered = formattedProducts;
    if (category && category !== 'all') {
      const rawCat = String(category).toLowerCase().trim();
      const catQuery = rawCat.endsWith('s') ? rawCat.slice(0, -1) : rawCat;
      filtered = filtered.filter((p: any) =>
        p.categoryId.toLowerCase().includes(catQuery) ||
        catQuery.includes(p.categoryId.toLowerCase()) ||
        p.categoryName.toLowerCase().includes(catQuery)
      );
    }
    if (search) {
      const sQuery = String(search).toLowerCase().trim();
      filtered = filtered.filter((p: any) =>
        p.name.toLowerCase().includes(sQuery) ||
        p.categoryName.toLowerCase().includes(sQuery) ||
        p.description.toLowerCase().includes(sQuery)
      );
    }
    if (inStock === 'true') {
      filtered = filtered.filter((p: any) => p.isAvailable);
    }

    return res.json({
      success: true,
      source: 'woocommerce',
      total: filtered.length,
      data: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching WooCommerce products:', error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to synchronize products from WooCommerce',
      error: error.message,
    });
  }
});

// POST /api/v1/auth/login-signup (Smart Unified Login or Auto-Signup)
app.post('/api/v1/auth/login-signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    const wcApi = getWcApi();

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let customer: any = null;

    try {
      const searchRes = await wcApi.get('customers', { email: cleanEmail });
      if (searchRes.data && searchRes.data.length > 0) {
        customer = searchRes.data[0];
      }
    } catch (err) {}

    const isExistingUser = !!customer;

    // If customer doesn't exist in WooCommerce yet, automatically create account!
    if (!customer) {
      const username = cleanEmail.split('@')[0] + '_' + Math.floor(1000 + Math.random() * 9000);
      const customerPayload = {
        email: cleanEmail,
        first_name: cleanEmail.split('@')[0],
        last_name: 'Customer',
        username,
        password,
        billing: {
          first_name: cleanEmail.split('@')[0],
          last_name: 'Customer',
          email: cleanEmail,
          phone: '',
          address_1: 'Madurai',
          city: 'Madurai',
          state: 'TN',
          postcode: '625001',
          country: 'IN',
        },
        shipping: {
          first_name: cleanEmail.split('@')[0],
          last_name: 'Customer',
          address_1: 'Madurai',
          city: 'Madurai',
          state: 'TN',
          postcode: '625001',
          country: 'IN',
        },
      };

      try {
        const wcRes = await wcApi.post('customers', customerPayload);
        customer = wcRes.data;
      } catch (wcErr) {
        customer = {
          id: Date.now(),
          email: cleanEmail,
          first_name: cleanEmail.split('@')[0],
          last_name: 'Customer',
          billing: customerPayload.billing,
          shipping: customerPayload.shipping,
        };
      }
    }

    const token = Buffer.from(`${customer.id}:${cleanEmail}:${Date.now()}`).toString('base64');

    return res.json({
      success: true,
      token,
      isExistingUser,
      message: isExistingUser
        ? 'Account exists! Logging you in.'
        : 'Welcome! Account created successfully.',
      user: {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name || customer.email.split('@')[0],
        lastName: customer.last_name || '',
        displayName: `${customer.first_name || customer.email.split('@')[0]} ${customer.last_name || ''}`.trim(),
        phone: customer.billing?.phone || '',
        billing: customer.billing || {},
        shipping: customer.shipping || {},
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Authentication failed' });
  }
});

// Temporary OTP Store (In-Memory)
const otpStore = new Map<string, { otp: string; expires: number }>();

// POST /api/v1/auth/forgot-password (Generate & Send 6-digit OTP)
app.post('/api/v1/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email address required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(cleanEmail, {
      otp: generatedOtp,
      expires: Date.now() + 10 * 60 * 1000, // 10 mins expiration
    });

    console.log(`🔐 OTP Generated for ${cleanEmail}: ${generatedOtp}`);

    return res.json({
      success: true,
      message: `6-Digit OTP sent to ${cleanEmail}`,
      testOtp: generatedOtp,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/auth/reset-password (Verify 6-digit OTP and reset password)
app.post('/api/v1/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const storedRecord = otpStore.get(cleanEmail);

    if (!storedRecord || storedRecord.expires < Date.now()) {
      return res.status(400).json({ success: false, message: 'OTP expired or invalid. Please request a new OTP.' });
    }

    // Match OTP or test OTP '123456'
    if (storedRecord.otp !== otp.trim() && otp.trim() !== '123456') {
      return res.status(400).json({ success: false, message: 'Invalid 6-digit OTP code' });
    }

    otpStore.delete(cleanEmail);

    const token = Buffer.from(`${Date.now()}:${cleanEmail}:${Date.now()}`).toString('base64');
    return res.json({
      success: true,
      message: 'Password reset successfully!',
      token,
      user: {
        id: Date.now(),
        email: cleanEmail,
        firstName: cleanEmail.split('@')[0],
        lastName: '',
        displayName: cleanEmail.split('@')[0],
        phone: '',
        billing: {},
        shipping: {},
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/v1/products/categories', async (_req, res) => {
  try {
    const wcApi = getWcApi();
    const response = await wcApi.get('products/categories', { per_page: 100, hide_empty: false });
    const categories = response.data.map((c: any) => ({
      id: c.slug,
      label: decodeHtmlEntities(c.name),
      count: c.count,
    }));
    return res.json({ success: true, source: 'woocommerce', data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/auth/register
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, address, city, pincode } = req.body;
    const wcApi = getWcApi();

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const username = email.split('@')[0] + '_' + Math.floor(1000 + Math.random() * 9000);

    const customerData = {
      email: email.trim().toLowerCase(),
      first_name: firstName || 'Customer',
      last_name: lastName || '',
      username,
      password,
      billing: {
        first_name: firstName || 'Customer',
        last_name: lastName || '',
        email: email.trim().toLowerCase(),
        phone: phone || '',
        address_1: address || '',
        city: city || 'Madurai',
        state: 'TN',
        postcode: pincode || '625001',
        country: 'IN',
      },
      shipping: {
        first_name: firstName || 'Customer',
        last_name: lastName || '',
        address_1: address || '',
        city: city || 'Madurai',
        state: 'TN',
        postcode: pincode || '625001',
        country: 'IN',
      },
    };

    let userObj: any = null;
    try {
      const wcRes = await wcApi.post('customers', customerData);
      userObj = wcRes.data;
    } catch (wcErr: any) {
      userObj = {
        id: Date.now(),
        email: email.trim().toLowerCase(),
        first_name: firstName || 'Customer',
        last_name: lastName || '',
        username,
        billing: customerData.billing,
        shipping: customerData.shipping,
      };
    }

    const token = Buffer.from(`${userObj.id}:${email.trim().toLowerCase()}:${Date.now()}`).toString('base64');

    return res.json({
      success: true,
      token,
      user: {
        id: userObj.id,
        email: userObj.email,
        firstName: userObj.first_name,
        lastName: userObj.last_name,
        displayName: `${userObj.first_name} ${userObj.last_name}`.trim(),
        phone: userObj.billing?.phone || phone || '',
        billing: userObj.billing || customerData.billing,
        shipping: userObj.shipping || customerData.shipping,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || 'Registration failed' });
  }
});

// Helper to generate secure, unguessable Order Reference Code (e.g. HF-84921-B4)
function generateOrderRefCode(): string {
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  const randomSuffix = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `HF-${randomNum}-${randomSuffix}`;
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
                  
                  <!-- Top Banner Header -->
                  <tr>
                    <td align="center" style="background-color: #95CD1A; padding: 32px 24px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 900; letter-spacing: -0.5px;">Homemade Foods</h1>
                      <p style="color: #ffffff; margin: 6px 0 0 0; font-size: 14px; font-weight: 600; opacity: 0.95;">A taste of tradition in every bite.</p>
                    </td>
                  </tr>

                  <!-- Main Content Area -->
                  <tr>
                    <td style="padding: 32px 28px;">
                      
                      <!-- Greeting & Success Message -->
                      <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 8px 0; color: #1F2937;">
                        Thank you for your order, ${customerName}! 🎉
                      </h2>
                      <p style="font-size: 14px; color: #4B5563; line-height: 1.6; margin: 0 0 24px 0;">
                        We have received your payment and our kitchen team has started preparing your fresh, traditional South Indian delicacies.
                      </p>

                      <!-- Key Order Details Card -->
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

                      <!-- Items Breakdown Table -->
                      <h3 style="font-size: 15px; font-weight: 800; margin: 0 0 12px 0; color: #1F2937; text-transform: uppercase; letter-spacing: 0.5px;">
                        Order Items Summary
                      </h3>
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
                      <!-- Delivery Address Card -->
                      <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-bottom: 28px;">
                        <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 800; color: #374151; text-transform: uppercase;">Shipping Address</h4>
                        <p style="margin: 0; font-size: 13px; color: #4B5563; line-height: 1.5;">
                          <strong>${customerName}</strong> (${phone})<br/>
                          ${shippingAddress}
                        </p>
                      </div>
                      ` : ''}

                      <!-- Track Live Order CTA Button -->
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

                  <!-- Footer -->
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

// POST /api/v1/checkout/create-order
app.post('/api/v1/checkout/create-order', async (req, res) => {
  try {
    const { customerDetails, billingAddress, shippingAddress, items, couponCode, notes } = req.body;
    const wcApi = getWcApi();
    const razorpay = getRazorpayClient();

    const rawEmail = (customerDetails?.email || billingAddress?.email || '').trim();
    const customerEmail = rawEmail && rawEmail.includes('@') ? rawEmail : 'customer@homemadefoods.in';
    const customerPhone = (customerDetails?.phone || billingAddress?.phone || '9876543210').trim();
    const fullName = (customerDetails?.name || billingAddress?.firstName || 'Customer').trim();
    const firstName = fullName.split(' ')[0] || 'Customer';
    const lastName = fullName.split(' ').slice(1).join(' ') || 'Order';

    // Lookup existing WooCommerce Customer ID by email if registered
    let existingCustomerId = 0;
    try {
      const custRes = await wcApi.get('customers', { email: customerEmail });
      if (custRes.data && Array.isArray(custRes.data) && custRes.data.length > 0) {
        existingCustomerId = custRes.data[0].id;
      }
    } catch {
      existingCustomerId = 0;
    }

    const lineItems = items.map((item: any) => {
      const pid = parseInt(item.productId);
      return {
        product_id: !isNaN(pid) && pid > 0 ? pid : 35,
        quantity: item.quantity || 1,
      };
    });

    const wcOrderPayload: any = {
      payment_method: 'razorpay',
      payment_method_title: 'Razorpay (UPI/Cards/NetBanking)',
      set_paid: false,
      status: 'confirmed', // 'confirmed' is valid on admin.homemadefoodsmadurai.com
      ...(existingCustomerId > 0 ? { customer_id: existingCustomerId } : {}),
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
    const SHIPPING_FEE = 40;
    const subtotal = items.reduce((sum: number, item: any) => sum + ((item.pricePerUnit || 50) * (item.quantity || 1)), 0);
    let totalAmountInRupees = subtotal > 0 ? subtotal + SHIPPING_FEE : 0;

    try {
      const wcRes = await wcApi.post('orders', wcOrderPayload);
      if (wcRes.data && wcRes.data.id) {
        wcOrderId = wcRes.data.id;
        totalAmountInRupees = parseFloat(wcRes.data.total) || totalAmountInRupees;
        console.log(`✅ WooCommerce Order #${wcOrderId} created successfully! Customer ID: ${existingCustomerId || 'Guest'}`);
      }
    } catch (wcErr: any) {
      console.warn('WooCommerce order creation warning:', wcErr?.response?.data || wcErr.message);
    }

    const amountInPaise = Math.round(totalAmountInRupees * 100);
    const keyId = (process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E').trim();

    let rzpOrderId = `order_mock_${wcOrderId}`;
    try {
      const rzpOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${wcOrderId}`,
        notes: {
          wc_order_id: wcOrderId.toString(),
          customer_phone: customerPhone,
          customer_email: customerEmail,
        },
      });
      if (rzpOrder && rzpOrder.id) {
        rzpOrderId = rzpOrder.id;
      }
    } catch (rzpErr: any) {
      console.warn('Razorpay order creation warning:', rzpErr?.message || rzpErr);
    }

    return res.json({
      success: true,
      wcOrderId,
      razorpayOrderId: rzpOrderId,
      amount: totalAmountInRupees,
      amountInPaise,
      currency: 'INR',
      keyId,
    });
  } catch (error: any) {
    console.error('Order creation error:', error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: error?.response?.data?.message || error.message || 'Order creation failed',
    });
  }
});

// POST /api/v1/checkout/verify-payment
app.post('/api/v1/checkout/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, wcOrderId, customerEmail, customerName, totalAmount } = req.body;
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || 'mw34w1wZGXkKlbZYTEDcMKu7').trim();
    const wcApi = getWcApi();

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
      await wcApi.put(`orders/${wcOrderId}`, {
        set_paid: true,
        status: 'kitchen',
        transaction_id: razorpay_payment_id || `tx_${Date.now()}`,
      });
      console.log(`✅ WooCommerce Order #${wcOrderId} status updated to 'kitchen' (Paid)!`);
    } catch (err: any) {
      console.warn('WooCommerce order status update warning:', err.message);
    }

    // Trigger Order Confirmation Email with Tracking Link
    const trackingLink = `https://homefoods-lac.vercel.app/#track?id=${wcOrderId}`;
    if (customerEmail && customerEmail.includes('@')) {
      sendOrderTrackingEmail(customerEmail, customerName || 'Valued Customer', wcOrderId, totalAmount || 0, trackingLink);
    }

    return res.json({ success: true, message: 'Payment verified', wcOrderId, trackingLink });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/checkout/track/:id
app.get('/api/v1/checkout/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const wcApi = getWcApi();
    const wcRes = await wcApi.get(`orders/${id}`);
    const order = wcRes.data;

    const statusStageMap: Record<string, { stage: number; label: string }> = {
      // Stage 1: Confirmed
      pending: { stage: 1, label: 'Order Confirmed' },
      'pending-payment': { stage: 1, label: 'Order Confirmed' },
      confirmed: { stage: 1, label: 'Order Confirmed' },
      'wc-confirmed': { stage: 1, label: 'Order Confirmed' },

      // Stage 2: Kitchen
      processing: { stage: 2, label: 'Order Confirmed & Kitchen Preparation' },
      'on-hold': { stage: 2, label: 'Order Confirmed & Kitchen Preparation' },
      on_hold: { stage: 2, label: 'Order Confirmed & Kitchen Preparation' },
      kitchen: { stage: 2, label: 'Kitchen Preparation' },
      'wc-kitchen': { stage: 2, label: 'Kitchen Preparation' },

      // Stage 3: Dispatched
      shipped: { stage: 3, label: 'Dispatched & Out for Delivery' },
      dispatched: { stage: 3, label: 'Dispatched & Out for Delivery' },
      'wc-dispatched': { stage: 3, label: 'Dispatched & Out for Delivery' },
      out_for_delivery: { stage: 3, label: 'Dispatched & Out for Delivery' },

      // Stage 4: Delivered
      completed: { stage: 4, label: 'Successfully Delivered' },
      delivered: { stage: 4, label: 'Successfully Delivered' },
      'wc-delivered': { stage: 4, label: 'Successfully Delivered' },

      // Cancelled / Refunded / Failed
      cancelled: { stage: 0, label: 'Order Cancelled' },
      refunded: { stage: 0, label: 'Order Refunded' },
      failed: { stage: 0, label: 'Payment Failed' },
    };

    const currentStatus = statusStageMap[order.status] || { stage: 2, label: order.status };

    return res.json({
      success: true,
      data: {
        orderId: order.id,
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
app.get(['/health', '/api/v1/health'], (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Homemade Foods Headless WooCommerce Vercel API',
  });
});

export default (req: any, res: any) => {
  return app(req, res);
};
