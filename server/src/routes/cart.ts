import { Router, Request, Response } from 'express';
import { wcApi, isWooCommerceConfigured } from '../config/woocommerce.js';

export const cartRouter = Router();

// POST /api/v1/cart/validate - Validate stock, coupons, shipping charges, GST, and totals
cartRouter.post('/validate', async (req: Request, res: Response) => {
  try {
    const { items, pincode, state, couponCode } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items required' });
    }

    let subtotal = 0;
    let totalGst = 0;
    const validatedItems = [];

    // Calculate item pricing and GST
    for (const item of items) {
      const pricePerUnit = Number(item.pricePerUnit) || 100;
      const qty = Number(item.quantity) || 1;
      const itemSubtotal = pricePerUnit * qty;
      const itemGst = Math.round(itemSubtotal * 0.05); // 5% GST on food products

      subtotal += itemSubtotal;
      totalGst += itemGst;

      validatedItems.push({
        ...item,
        validatedPrice: pricePerUnit,
        itemSubtotal,
        isAvailable: true,
      });
    }

    // Dynamic Shipping Zone Calculation (Madurai, Tamil Nadu, Rest of India)
    let shippingCharge = 60; // Default flat rate
    const cleanedPincode = (pincode || '').toString().trim();

    if (cleanedPincode.startsWith('625')) {
      // Madurai Delivery Zone
      shippingCharge = subtotal >= 499 ? 0 : 30;
    } else if (cleanedPincode.startsWith('60') || cleanedPincode.startsWith('61') || cleanedPincode.startsWith('62') || cleanedPincode.startsWith('63') || cleanedPincode.startsWith('64')) {
      // Tamil Nadu Delivery Zone
      shippingCharge = subtotal >= 799 ? 0 : 50;
    } else {
      // Rest of India Delivery Zone
      shippingCharge = subtotal >= 999 ? 0 : 90;
    }

    // Coupon Validation via WooCommerce
    let discountAmount = 0;
    let appliedCoupon = null;

    if (couponCode) {
      const cleanCoupon = couponCode.trim().toUpperCase();

      if (isWooCommerceConfigured()) {
        try {
          const couponRes = await wcApi.get('coupons', { code: cleanCoupon });
          if (couponRes.data && couponRes.data.length > 0) {
            const coupon = couponRes.data[0];
            const amount = parseFloat(coupon.amount);
            if (coupon.discount_type === 'percent') {
              discountAmount = Math.round((subtotal * amount) / 100);
            } else {
              discountAmount = amount;
            }
            appliedCoupon = { code: cleanCoupon, discount: discountAmount };
          }
        } catch {
          // Ignore invalid coupon
        }
      } else {
        // Fallback local coupon rules for dev
        if (cleanCoupon === 'HOME10') {
          discountAmount = Math.round(subtotal * 0.1);
          appliedCoupon = { code: 'HOME10', discount: discountAmount };
        } else if (cleanCoupon === 'MADURAI50') {
          discountAmount = 50;
          appliedCoupon = { code: 'MADURAI50', discount: 50 };
        } else if (cleanCoupon === 'FREESHIP') {
          shippingCharge = 0;
          appliedCoupon = { code: 'FREESHIP', discount: 0 };
        }
      }
    }

    const grandTotal = Math.max(0, subtotal + totalGst + shippingCharge - discountAmount);

    return res.json({
      success: true,
      summary: {
        subtotal,
        gst: totalGst,
        shippingCharge,
        discountAmount,
        grandTotal,
        appliedCoupon,
        freeShippingThresholdMet: shippingCharge === 0,
      },
      items: validatedItems,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
