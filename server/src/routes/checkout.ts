import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { wcApi, isWooCommerceConfigured } from '../config/woocommerce.js';
import { razorpayClient, isRazorpayConfigured } from '../config/razorpay.js';

export const checkoutRouter = Router();

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

    const customerEmail = customerDetails?.email || billingAddress?.email || 'guest@homemadefoods.in';
    const customerPhone = customerDetails?.phone || billingAddress?.phone || '9999999999';
    const firstName = customerDetails?.name?.split(' ')[0] || billingAddress?.firstName || 'Customer';
    const lastName = customerDetails?.name?.split(' ').slice(1).join(' ') || billingAddress?.lastName || '';

    let wcOrderId = Date.now();
    let totalAmountInRupees = items.reduce((sum: number, item: any) => sum + (item.pricePerUnit * item.quantity), 0);

    // 1. Create WooCommerce Order via REST API
    if (isWooCommerceConfigured()) {
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
          state: billingAddress?.state || 'TN',
          postcode: billingAddress?.pincode || '625001',
          country: 'IN',
        },
        shipping: {
          first_name: firstName,
          last_name: lastName,
          address_1: shippingAddress?.address || billingAddress?.address || 'Street Address',
          city: shippingAddress?.city || billingAddress?.city || 'Madurai',
          state: shippingAddress?.state || billingAddress?.state || 'TN',
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
      wcOrderId = wcRes.data.id;
      totalAmountInRupees = parseFloat(wcRes.data.total);
    }

    // 2. Create Razorpay Order
    const amountInPaise = Math.round(totalAmountInRupees * 100);
    let razorpayOrderId = `rzp_order_mock_${wcOrderId}`;

    if (isRazorpayConfigured()) {
      const rzpOrder = await razorpayClient.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_wc_${wcOrderId}`,
        notes: {
          wc_order_id: wcOrderId.toString(),
          customer_phone: customerPhone,
          customer_email: customerEmail,
        },
      });
      razorpayOrderId = rzpOrder.id;
    }

    return res.json({
      success: true,
      wcOrderId,
      razorpayOrderId,
      amount: totalAmountInRupees,
      amountInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
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
    } = req.body;

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (isRazorpayConfigured() && keySecret) {
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

    // Mark WooCommerce order as paid & processing
    if (isWooCommerceConfigured() && wcOrderId) {
      await wcApi.put(`orders/${wcOrderId}`, {
        set_paid: true,
        status: 'processing',
        transaction_id: razorpay_payment_id || `mock_tx_${Date.now()}`,
      });
    }

    return res.json({
      success: true,
      message: 'Payment verified successfully and order placed!',
      wcOrderId,
      paymentId: razorpay_payment_id,
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

    const wcRes = await wcApi.get(`orders/${id}`);
    const order = wcRes.data;

    // Map WooCommerce status codes to Customer Tracking Progress Stages (1 to 4)
    const statusStageMap: Record<string, { stage: number; label: string }> = {
      pending: { stage: 1, label: 'Order Placed (Pending Payment)' },
      processing: { stage: 2, label: 'Order Confirmed & Kitchen Preparation' },
      on_hold: { stage: 2, label: 'Order On Hold' },
      shipped: { stage: 3, label: 'Dispatched & Out for Delivery' },
      completed: { stage: 4, label: 'Successfully Delivered' },
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
