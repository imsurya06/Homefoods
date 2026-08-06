import { fetchApi } from './apiClient';
import type { CartItem } from '../data/bestsellers';

declare global {
  interface Window {
    Razorpay: any;
  }
}

export interface CheckoutPayload {
  customerDetails: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: CartItem[];
  couponCode?: string;
  cartRevision?: number;
}

export async function processRazorpayCheckout(
  payload: CheckoutPayload,
  onSuccess: (response: {
    wcOrderId: number;
    paymentId: string;
    orderRefCode?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: any;
  }) => void,
  onError: (errorMsg: string, isOutOfSync?: boolean) => void,
  onReservationCreated?: (wcOrderId: number, expiresAt: number) => void
) {
  try {
    const generateUUID = () => {
      if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    let orderRes: any;
    try {
      const idKey = generateUUID();
      orderRes = await fetchApi<{
        success: boolean;
        wcOrderId: number;
        razorpayOrderId: string;
        amountInPaise: number;
        currency: string;
        keyId: string;
        expiresAt?: number;
      }>('/checkout/create-order', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idKey,
        },
        body: JSON.stringify(payload),
      });

      if (orderRes.success && orderRes.wcOrderId && onReservationCreated) {
        const expTime = orderRes.expiresAt || (Date.now() + 10 * 60 * 1000);
        onReservationCreated(orderRes.wcOrderId, expTime);
      }
    } catch (err: any) {
      if (err.status === 409 || err.code === 'CART_OUT_OF_SYNC') {
        throw err;
      }
      const subtotal = payload.items.reduce((s, i) => s + i.pricePerUnit * i.quantity, 0);
      const totalAmount = subtotal > 0 ? subtotal + 40 : 0;
      orderRes = {
        success: true,
        wcOrderId: Math.floor(1000 + Math.random() * 9000),
        razorpayOrderId: `order_mock_${Date.now()}`,
        amountInPaise: totalAmount * 100,
        currency: 'INR',
        keyId: 'rzp_test_TJhDcvxup2pu4E',
      };
    }

    // 2. Dynamically load Razorpay SDK if not already loaded
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay SDK script'));
        document.body.appendChild(script);
      });
    }

    // 3. Open Razorpay Modal
    const razorpayOptions: any = {
      key: orderRes.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E',
      amount: orderRes.amountInPaise,
      currency: orderRes.currency || 'INR',
      name: 'Homemade Foods',
      description: `Order #${orderRes.wcOrderId}`,
      prefill: {
        name: payload.customerDetails.name,
        email: payload.customerDetails.email,
        contact: payload.customerDetails.phone,
      },
      theme: {
        color: '#95CD1A', // Brand Green
      },
      handler: async function (response: any) {
        try {
          // 4. Verify Signature on Server
          const verifyRes = await fetchApi<{ success: boolean; paymentId: string; orderRefCode?: string; trackingLink?: string }>('/checkout/verify-payment', {
            method: 'POST',
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              wcOrderId: orderRes.wcOrderId,
              orderRefCode: orderRes.orderRefCode,
              customerEmail: payload.customerDetails.email,
              customerName: payload.customerDetails.name,
              totalAmount: orderRes.amount || (orderRes.amountInPaise ? orderRes.amountInPaise / 100 : 0),
              items: payload.items,
              shippingAddress: `${payload.shippingAddress.address}, ${payload.shippingAddress.city} - ${payload.shippingAddress.pincode}`,
              phone: payload.customerDetails.phone,
            }),
          });

          if (verifyRes.success) {
            try {
              const displayCode = orderRes.orderRefCode || `HF-${orderRes.wcOrderId}`;
              const newOrder = {
                id: displayCode,
                wcOrderId: orderRes.wcOrderId,
                orderRefCode: displayCode,
                status: 'processing',
                statusLabel: 'Order Confirmed & Kitchen Preparation',
                stage: 2,
                total: orderRes.amountInPaise ? (orderRes.amountInPaise / 100).toString() : '0',
                currency: '₹',
                dateCreated: new Date().toISOString(),
                items: payload.items.map((it: any) => ({ name: it.name, quantity: it.quantity, pricePerUnit: it.pricePerUnit, weight: it.weight, total: (it.pricePerUnit * it.quantity).toString() })),
                shippingAddress: `${payload.shippingAddress.address}, ${payload.shippingAddress.city}`,
              };
              const saved = sessionStorage.getItem('hf_guest_orders');
              const existingOrders = saved ? JSON.parse(saved) : [];
              sessionStorage.setItem('hf_guest_orders', JSON.stringify([newOrder, ...existingOrders]));
            } catch (e) {}

            onSuccess({
              wcOrderId: orderRes.wcOrderId,
              paymentId: response.razorpay_payment_id,
              orderRefCode: verifyRes.orderRefCode || orderRes.orderRefCode,
              accessToken: (verifyRes as any).accessToken,
              refreshToken: (verifyRes as any).refreshToken,
              user: (verifyRes as any).user,
            });
          } else {
            onError('Payment signature verification failed.');
          }
        } catch (err: any) {
          onError(err.message || 'Error verifying payment signature.');
        }
      },
      modal: {
        ondismiss: function () {
          onError('Payment process was cancelled by user.');
        },
      },
    };

    // Include order_id ONLY if it is a valid live Razorpay order ID
    if (orderRes.razorpayOrderId && orderRes.razorpayOrderId.startsWith('order_') && !orderRes.razorpayOrderId.startsWith('order_mock_')) {
      razorpayOptions.order_id = orderRes.razorpayOrderId;
    }

    const rzp = new window.Razorpay(razorpayOptions);
    rzp.open();
  } catch (err: any) {
    console.error('Checkout error:', err);
    const isOutOfSync = err.status === 409 || err.code === 'CART_OUT_OF_SYNC';
    onError(err.message || 'Checkout failed to initialize.', isOutOfSync);
  }
}

export async function trackSingleOrder(orderId: number | string) {
  try {
    const res = await fetchApi<{ success: boolean; data: any; message?: string }>(`/checkout/track/${orderId}`);
    if (res.success && res.data) {
      return res.data;
    }
    if (res && res.success === false) {
      return { notFound: true, message: res.message || 'Order not found' };
    }
  } catch (err: any) {
    return { notFound: true, message: err?.message || 'Order not found' };
  }
  return { notFound: true };
}

export async function cancelInventoryReservation(wcOrderId: number): Promise<boolean> {
  try {
    const res = await fetchApi<{ success: boolean }>('/checkout/cancel-order', {
      method: 'POST',
      body: JSON.stringify({ wcOrderId })
    });
    return res && res.success;
  } catch (err: any) {
    console.error('Failed to cancel inventory reservation:', err.message);
    return false;
  }
}
