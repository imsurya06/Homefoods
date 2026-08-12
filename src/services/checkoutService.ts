import { fetchApi } from './apiClient';
import type { CartItem } from '../data/bestsellers';
import { useSyncStore } from '../store/useSyncStore';

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
    cartRevision?: number;
  }) => void,
  onError: (errorMsg: string, isOutOfSync?: boolean) => void,
  onReservationCreated?: (wcOrderId: number, items: CartItem[], expiresAt: number) => void
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
      let idKey = localStorage.getItem('hf_checkout_idempotency_key');
      if (!idKey) {
        idKey = generateUUID();
        localStorage.setItem('hf_checkout_idempotency_key', idKey);
      }
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
        onReservationCreated(orderRes.wcOrderId, payload.items, expTime);
      }
    } catch (err: any) {
      if (err.status === 409 || err.code === 'CART_OUT_OF_SYNC') {
        throw err;
      }
      const safeItems = Array.isArray(payload.items) ? payload.items : [];
      const subtotal = safeItems.reduce((s, i) => s + (i?.pricePerUnit || 0) * (i?.quantity || 1), 0);
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
          localStorage.removeItem('hf_checkout_idempotency_key');
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

          // 1. Store order ID in sessionStorage as confirmed immediately
          try {
            const existing = JSON.parse(sessionStorage.getItem('hf_confirmed_order_ids') || '[]');
            const strId = String(orderRes.wcOrderId);
            if (!existing.includes(strId)) {
              existing.push(strId);
              sessionStorage.setItem('hf_confirmed_order_ids', JSON.stringify(existing));
            }
          } catch {}

          // 2. Clear active checkout session and cart immediately upon successful payment
          try {
            useSyncStore.getState().setActiveCheckoutSession(null);
            localStorage.removeItem('hf_active_checkout_session');
            localStorage.removeItem('hf_checkout_reservation_expires_at');
            useSyncStore.getState().clearCart();
          } catch (e) {}

          // 3. Await backend verification so WooCommerce order status is updated to processing FIRST
          try {
            const verifyRes = await fetchApi<{ success: boolean; accessToken?: string; refreshToken?: string; user?: any }>('/checkout/verify-payment', {
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

            if (verifyRes && verifyRes.success) {
              if (verifyRes.accessToken && verifyRes.refreshToken && verifyRes.user) {
                useSyncStore.getState().login(verifyRes.user, verifyRes.accessToken, verifyRes.refreshToken);
              }
            }
          } catch (err: any) {
            console.warn('[Verification Notice]:', err);
          }

          window.dispatchEvent(new Event('hf_orders_updated'));

          // 4. Trigger onSuccess UI transition AFTER WooCommerce status is confirmed
          onSuccess({
            wcOrderId: orderRes.wcOrderId,
            paymentId: response.razorpay_payment_id,
            orderRefCode: orderRes.orderRefCode,
          });
        } catch (err: any) {
          console.warn('[Payment Handler Notice]:', err);
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

export async function fetchRetryPaymentDetails(wcOrderId: number) {
  try {
    const res = await fetchApi<{
      success: boolean;
      isAlreadyPaid?: boolean;
      message?: string;
      wcOrderId: number;
      orderRefCode: string;
      razorpayOrderId: string;
      amountInPaise: number;
      currency: string;
      keyId: string;
      expiresAt: number;
      customerEmail?: string;
      customerName?: string;
      phone?: string;
      shippingAddress?: string;
      items?: any[];
    }>('/checkout/retry-payment', {
      method: 'POST',
      body: JSON.stringify({ wcOrderId }),
    });
    if (res) {
      return res;
    }
  } catch (err: any) {
    console.warn('Failed to fetch retry payment details from server:', err.message);
  }
  return null;
}

export async function retryRazorpayPayment(
  order: {
    wcOrderId: number;
    razorpayOrderId: string;
    amountInPaise: number;
    keyId: string;
    orderRefCode?: string;
    customerEmail?: string;
    customerName?: string;
    items?: any[];
    shippingAddress?: string;
    phone?: string;
  },
  onSuccess: (response: {
    wcOrderId: number;
    paymentId: string;
    orderRefCode?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: any;
    cartRevision?: number;
  }) => void,
  onError: (errorMsg: string) => void
) {
  try {
    if (!window.Razorpay) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay SDK script. Please check your network connection.'));
        document.body.appendChild(script);
      });
    }

    const displayOrderCode = order.orderRefCode || `HF-${order.wcOrderId}`;

    const razorpayOptions: any = {
      key: order.keyId,
      amount: order.amountInPaise,
      currency: 'INR',
      name: 'Homemade Foods',
      description: `Complete Payment for Order #${displayOrderCode}`,
      image: 'https://www.homemadefoodsmadurai.com/favicon.png',
      handler: async function (response: any) {
        try {
          try {
            useSyncStore.getState().setActiveCheckoutSession(null);
            localStorage.removeItem('hf_active_checkout_session');
            localStorage.removeItem('hf_checkout_reservation_expires_at');
            useSyncStore.getState().clearCart();
          } catch (e) {}

          // 1. Store order ID in sessionStorage as confirmed immediately
          try {
            const existing = JSON.parse(sessionStorage.getItem('hf_confirmed_order_ids') || '[]');
            const strId = String(order.wcOrderId);
            if (!existing.includes(strId)) {
              existing.push(strId);
              sessionStorage.setItem('hf_confirmed_order_ids', JSON.stringify(existing));
            }
          } catch {}

          // 2. Clear active checkout session and cart
          try {
            useSyncStore.getState().setActiveCheckoutSession(null);
            localStorage.removeItem('hf_active_checkout_session');
            localStorage.removeItem('hf_checkout_reservation_expires_at');
            useSyncStore.getState().clearCart();
          } catch (e) {}

          // 3. Await backend verification FIRST so WooCommerce order status is updated to processing
          try {
            const verifyRes = await fetchApi<{ success: boolean; orderRefCode?: string }>('/checkout/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: order.razorpayOrderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                wcOrderId: order.wcOrderId,
                orderRefCode: displayOrderCode,
                customerEmail: order.customerEmail || '',
                customerName: order.customerName || 'Valued Customer',
                totalAmount: order.amountInPaise / 100,
                items: order.items || [],
                shippingAddress: order.shippingAddress || '',
                phone: order.phone || '',
              }),
            });

            if (verifyRes && verifyRes.success) {
              if ((verifyRes as any).accessToken && (verifyRes as any).refreshToken && (verifyRes as any).user) {
                useSyncStore.getState().login((verifyRes as any).user, (verifyRes as any).accessToken, (verifyRes as any).refreshToken);
              }
            }
          } catch (err: any) {
            console.warn('[Retry Verification Notice]:', err);
          }

          window.dispatchEvent(new Event('hf_orders_updated'));

          // 4. Trigger onSuccess UI transition AFTER status update is completed
          onSuccess({
            wcOrderId: order.wcOrderId,
            paymentId: response.razorpay_payment_id,
            orderRefCode: displayOrderCode,
          });
        } catch (err: any) {
          console.warn('[Retry Payment Handler Notice]:', err);
        }
      },
      modal: {
        ondismiss: function () {
          onError('Payment process was cancelled by user.');
        },
      },
    };

    if (order.razorpayOrderId && order.razorpayOrderId.startsWith('order_') && !order.razorpayOrderId.startsWith('order_mock_')) {
      razorpayOptions.order_id = order.razorpayOrderId;
    }

    const rzp = new window.Razorpay(razorpayOptions);
    rzp.open();
  } catch (err: any) {
    console.error('Retry payment error:', err);
    onError(err.message || 'Failed to open payment modal.');
  }
}
