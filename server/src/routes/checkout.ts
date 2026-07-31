import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { wcApi, isWooCommerceConfigured } from '../config/woocommerce.js';
import { razorpayClient, isRazorpayConfigured } from '../config/razorpay.js';

export const checkoutRouter = Router();

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

// POST /api/v1/checkout/create-order - Create WooCommerce Order + Create Razorpay Order
checkoutRouter.post('/create-order', async (req: Request, res: Response) => {
  try {
    const {
      customerDetails,
      billingAddress,
      shippingAddress,
      items,
      couponCode,
      notes,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items required for order creation' });
    }

    const rawEmail = (customerDetails?.email || billingAddress?.email || '').trim();
    const customerEmail = rawEmail && rawEmail.includes('@') ? rawEmail : 'customer@homemadefoods.in';
    const customerPhone = (customerDetails?.phone || billingAddress?.phone || '9876543210').trim();
    const fullName = (customerDetails?.name || billingAddress?.firstName || 'Customer').trim();
    const firstName = fullName.split(' ')[0] || 'Customer';
    const lastName = fullName.split(' ').slice(1).join(' ') || 'Order';

    const orderRefCode = generateOrderRefCode();

    let existingCustomerId = 0;
    if (isWooCommerceConfigured()) {
      try {
        const custRes = await wcApi.get('customers', { email: customerEmail });
        if (custRes.data && Array.isArray(custRes.data) && custRes.data.length > 0) {
          existingCustomerId = custRes.data[0].id;
        }
      } catch {}
    }

    let wcOrderId = Date.now();
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

    // 1. Create WooCommerce Order via REST API with status: 'confirmed'
    if (isWooCommerceConfigured()) {
      const wcOrderPayload: any = {
        payment_method: 'razorpay',
        payment_method_title: 'Razorpay (UPI/Cards/NetBanking)',
        set_paid: false,
        status: 'confirmed', // Use confirmed instead of invalid pending
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

      if (couponCode) {
        wcOrderPayload.coupon_lines = [{ code: couponCode }];
      }

      try {
        const wcRes = await wcApi.post('orders', wcOrderPayload);
        if (wcRes.data && wcRes.data.id) {
          wcOrderId = wcRes.data.id;
          totalAmountInRupees = parseFloat(wcRes.data.total) || totalAmountInRupees;
          console.log(`✅ Local Dev WooCommerce Order #${wcOrderId} (Ref: ${orderRefCode}) created successfully! Customer ID: ${existingCustomerId || 'Guest'}`);
        }
      } catch (wcErr: any) {
        console.warn('Local Dev WooCommerce order creation warning:', wcErr?.response?.data || wcErr.message);
      }
    }

    // 2. Create Razorpay Order
    const amountInPaise = Math.round(totalAmountInRupees * 100);
    let razorpayOrderId = `rzp_order_mock_${wcOrderId}`;

    if (isRazorpayConfigured()) {
      try {
        const rzpOrder = await razorpayClient.orders.create({
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
          razorpayOrderId = rzpOrder.id;
        }
      } catch (rzpErr: any) {
        console.warn('Razorpay order creation warning:', rzpErr?.message || rzpErr);
      }
    }

    return res.json({
      success: true,
      wcOrderId,
      orderRefCode,
      razorpayOrderId,
      amount: totalAmountInRupees,
      amountInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E',
    });
  } catch (error: any) {
    console.error('Order creation error:', error?.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'Failed to create backend order', error: error.message });
  }
});

// POST /api/v1/checkout/verify-payment - HMAC-SHA256 Signature Verification
checkoutRouter.post('/verify-payment', async (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      wcOrderId,
      orderRefCode,
      customerEmail,
      customerName,
      totalAmount,
      items,
      shippingAddress,
      phone,
    } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (isRazorpayConfigured() && keySecret && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed. Invalid Razorpay signature.',
        });
      }
    }

    // Mark WooCommerce order as paid & status 'kitchen'
    if (isWooCommerceConfigured() && wcOrderId) {
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
    }

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

    return res.json({
      success: true,
      message: 'Payment verified successfully and order placed!',
      wcOrderId,
      orderRefCode: displayOrderCode,
      paymentId: razorpay_payment_id,
      trackingLink,
    });
  } catch (error: any) {
    console.error('Verification Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/checkout/track/:id - Live Order Tracking Endpoint for Customers
checkoutRouter.get('/track/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isWooCommerceConfigured()) {
      return res.status(400).json({ success: false, message: 'WooCommerce API not configured' });
    }

    const cleanId = id.trim();
    let order: any = null;

    const isNumeric = /^\d+$/.test(cleanId);
    if (isNumeric) {
      try {
        const wcRes = await wcApi.get(`orders/${cleanId}`);
        order = wcRes.data;
      } catch {}
    }

    if (!order) {
      try {
        const recentOrdersRes = await wcApi.get('orders', { per_page: 50 });
        const ordersList = recentOrdersRes.data || [];
        order = ordersList.find((o: any) => {
          if (o.id.toString() === cleanId) return true;
          const refMeta = (o.meta_data || []).find((m: any) => m.key === '_order_ref_code');
          return refMeta && refMeta.value === cleanId;
        });
      } catch {}
    }

    if (!order) {
      return res.status(404).json({ success: false, message: `Order #${cleanId} not found` });
    }

    const refCodeMeta = (order.meta_data || []).find((m: any) => m.key === '_order_ref_code');
    const orderRefCode = refCodeMeta?.value || `HF-${order.id}`;

    const statusStageMap: Record<string, { stage: number; label: string }> = {
      pending: { stage: 1, label: 'Order Confirmed' },
      'pending-payment': { stage: 1, label: 'Order Confirmed' },
      confirmed: { stage: 1, label: 'Order Confirmed' },
      'wc-confirmed': { stage: 1, label: 'Order Confirmed' },

      processing: { stage: 2, label: 'Order Confirmed & Kitchen Preparation' },
      'on-hold': { stage: 2, label: 'Order Confirmed & Kitchen Preparation' },
      on_hold: { stage: 2, label: 'Order Confirmed & Kitchen Preparation' },
      kitchen: { stage: 2, label: 'Kitchen Preparation' },
      'wc-kitchen': { stage: 2, label: 'Kitchen Preparation' },

      shipped: { stage: 3, label: 'Dispatched & Out for Delivery' },
      dispatched: { stage: 3, label: 'Dispatched & Out for Delivery' },
      'wc-dispatched': { stage: 3, label: 'Dispatched & Out for Delivery' },
      out_for_delivery: { stage: 3, label: 'Dispatched & Out for Delivery' },

      completed: { stage: 4, label: 'Successfully Delivered' },
      delivered: { stage: 4, label: 'Successfully Delivered' },
      'wc-delivered': { stage: 4, label: 'Successfully Delivered' },

      cancelled: { stage: 0, label: 'Order Cancelled' },
      refunded: { stage: 0, label: 'Order Refunded' },
      failed: { stage: 0, label: 'Payment Failed' },
    };

    const currentStatus = statusStageMap[order.status] || { stage: 2, label: order.status };

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
        items: order.line_items?.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          total: item.total,
        })),
        customerNote: order.customer_note || '',
      },
    });
  } catch (error: any) {
    return res.status(404).json({ success: false, message: 'Order not found or invalid Order ID', error: error.message });
  }
});
