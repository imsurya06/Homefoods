import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pkg from '@woocommerce/woocommerce-rest-api';
import Razorpay from 'razorpay';

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

// In-Memory Server Cache for Ultra-Fast Responses (<5ms)
let cachedProductsResponse: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30 * 1000;

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

// GET /api/v1/products/categories
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

// POST /api/v1/checkout/create-order
app.post('/api/v1/checkout/create-order', async (req, res) => {
  try {
    const { customerDetails, billingAddress, shippingAddress, items, couponCode, notes } = req.body;
    const wcApi = getWcApi();
    const razorpay = getRazorpayClient();

    const customerEmail = customerDetails?.email || billingAddress?.email || 'guest@homemadefoods.in';
    const customerPhone = customerDetails?.phone || billingAddress?.phone || '9999999999';
    const firstName = customerDetails?.name?.split(' ')[0] || billingAddress?.firstName || 'Customer';
    const lastName = customerDetails?.name?.split(' ').slice(1).join(' ') || billingAddress?.lastName || '';

    const lineItems = items.map((item: any) => ({
      product_id: parseInt(item.productId) || 1,
      quantity: item.quantity,
      total: (item.pricePerUnit * item.quantity).toString(),
    }));

    const wcOrderPayload: any = {
      payment_method: 'razorpay',
      payment_method_title: 'Razorpay (UPI/Cards/NetBanking)',
      set_paid: false,
      status: 'pending',
      billing: {
        first_name: firstName,
        last_name: lastName,
        email: customerEmail,
        phone: customerPhone,
        address_1: billingAddress?.address || 'Street Address',
        city: billingAddress?.city || 'Madurai',
        state: 'TN',
        postcode: billingAddress?.pincode || '625001',
        country: 'IN',
      },
      shipping: {
        first_name: firstName,
        last_name: lastName,
        address_1: shippingAddress?.address || billingAddress?.address || 'Street Address',
        city: shippingAddress?.city || billingAddress?.city || 'Madurai',
        state: 'TN',
        postcode: shippingAddress?.pincode || billingAddress?.pincode || '625001',
        country: 'IN',
      },
      line_items: lineItems,
      customer_note: notes || 'Order placed via Headless React Storefront',
    };

    if (couponCode) {
      wcOrderPayload.coupon_lines = [{ code: couponCode }];
    }

    const wcRes = await wcApi.post('orders', wcOrderPayload);
    const wcOrderId = wcRes.data.id;
    const totalAmountInRupees = parseFloat(wcRes.data.total);

    const amountInPaise = Math.round(totalAmountInRupees * 100);
    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_wc_${wcOrderId}`,
      notes: {
        wc_order_id: wcOrderId.toString(),
        customer_phone: customerPhone,
        customer_email: customerEmail,
      },
    });

    return res.json({
      success: true,
      wcOrderId,
      razorpayOrderId: rzpOrder.id,
      amount: totalAmountInRupees,
      amountInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E',
    });
  } catch (error: any) {
    console.error('Order creation error:', error?.response?.data || error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/v1/checkout/verify-payment
app.post('/api/v1/checkout/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, wcOrderId } = req.body;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'mw34w1wZGXkKlbZYTEDcMKu7';
    const wcApi = getWcApi();

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    await wcApi.put(`orders/${wcOrderId}`, {
      set_paid: true,
      status: 'processing',
      transaction_id: razorpay_payment_id,
    });

    return res.json({ success: true, message: 'Payment verified', wcOrderId });
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

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        status: order.status,
        total: order.total,
        customerName: `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
        phone: order.billing?.phone || '',
        items: order.line_items?.map((item: any) => ({ name: item.name, quantity: item.quantity })),
      },
    });
  } catch (error: any) {
    return res.status(404).json({ success: false, message: 'Order not found', error: error.message });
  }
});

// GET /health
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Homemade Foods Headless WooCommerce Vercel API',
  });
});

export default (req: any, res: any) => {
  return app(req, res);
};
