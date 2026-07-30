import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { wcApi, isWooCommerceConfigured } from '../config/woocommerce.js';

export const webhooksRouter = Router();

// POST /api/v1/webhooks/razorpay - Razorpay webhook handler
webhooksRouter.post('/razorpay', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;

    if (webhookSecret && signature) {
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).send('Invalid Razorpay webhook signature');
      }
    }

    const payload = req.body;
    const eventType = payload.event;

    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const paymentEntity = payload.payload?.payment?.entity;
      const wcOrderId = paymentEntity?.notes?.wc_order_id;
      const paymentId = paymentEntity?.id;

      if (wcOrderId && isWooCommerceConfigured()) {
        await wcApi.put(`orders/${wcOrderId}`, {
          set_paid: true,
          status: 'processing',
          transaction_id: paymentId,
        });
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = payload.payload?.payment?.entity;
      const wcOrderId = paymentEntity?.notes?.wc_order_id;

      if (wcOrderId && isWooCommerceConfigured()) {
        await wcApi.put(`orders/${wcOrderId}`, {
          status: 'failed',
        });
      }
    }

    return res.status(200).json({ status: 'ok', event: eventType });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
});
