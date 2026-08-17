import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Phone,
  Mail,
  CheckCircle2,
  Package,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  Truck,
  PackageCheck,
  AlertCircle,
  CreditCard,
  Loader2,
} from 'lucide-react';
import { type CartItem } from '../data/bestsellers';
import { processRazorpayCheckout, type CheckoutPayload, trackSingleOrder, cancelInventoryReservation, retryRazorpayPayment, fetchRetryPaymentDetails } from '../services/checkoutService';
import { fetchCustomerOrders, getCachedCustomerOrders, sendEmailOtp, verifyEmailOtp, type CustomerOrderHistoryItem, type UserProfile } from '../services/authService';
import { getCachedProductsSync } from '../services/productService';
import { validateCart } from '../services/cartService';
import { bootstrapSync } from '../services/syncManager';
import { useSyncStore } from '../store/useSyncStore';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  cartRevision?: number;
  onUpdateQuantity: (id: string, newQty: number) => void;
  onUpdateItemWeight?: (oldId: string, newWeight: string, newPricePerUnit: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onExploreShop?: () => void;
  onOpenAuthModal?: () => void;
  onSyncCart?: (items: CartItem[]) => void;
  isLoggedIn?: boolean;
  user?: UserProfile | null;
  initialTab?: 'cart' | 'orders';
}

const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const normalizeMobile = (phone: string) => {
  return phone.replace(/\D/g, '').replace(/^91/, '');
};

const validateMobile = (phone: string) => {
  const normalized = normalizeMobile(phone);
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(normalized);
};

const validatePincode = (pincode: string) => {
  return /^\d{6}$/.test(pincode.trim());
};

const validateName = (name: string) => {
  return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
};

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  cartRevision = 0,
  onUpdateQuantity,
  onUpdateItemWeight,
  onRemoveItem,
  onClearCart,
  onExploreShop,
  onOpenAuthModal,
  onSyncCart: _onSyncCart,
  isLoggedIn = false,
  user = null,
  initialTab = 'cart',
}) => {
  const [activeTab, setActiveTab] = useState<'cart' | 'orders'>(initialTab);

  const getWeightOptionsForItem = (item: CartItem) => {
    try {
      const allProducts = getCachedProductsSync();
      const matched = allProducts.find(
        (p) => String(p.id) === String(item.productId) || p.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );

      if (matched && Array.isArray(matched.variants) && matched.variants.length > 0) {
        const gstMultiplier = 1 + (matched.gstPercentage || item.gstPercentage || 5) / 100;
        return matched.variants.map((v) => ({
          weight: v.weight,
          price: Math.round(v.basePrice * gstMultiplier),
        }));
      }
    } catch {}

    const basePrice = item.pricePerUnit;
    return [
      { weight: item.weight || '100gms', price: basePrice },
      { weight: '200gms', price: Math.round(basePrice * 1.85) },
      { weight: '500gms', price: Math.round(basePrice * 4.2) },
      { weight: '1kg', price: Math.round(basePrice * 8.0) },
    ].filter((v, idx, arr) => arr.findIndex((x) => x.weight === v.weight) === idx);
  };

  // Sync activeTab when initialTab or isOpen changes
  useEffect(() => {
    if (isOpen) {
      const redirectTab = sessionStorage.getItem('hf_redirect_tab');
      if (redirectTab === 'orders') {
        setActiveTab('orders');
        sessionStorage.removeItem('hf_redirect_tab');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [initialTab, isOpen]);

  // Email Verification OTP State
  const [checkoutEmailVerified, setCheckoutEmailVerified] = useState<string | null>(null);
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Shipping & Contact Details State with LocalStorage persistence
  const [customerName, setCustomerName] = useState<string>(() => {
    try {
      return localStorage.getItem('hf_customer_name') || '';
    } catch {
      return '';
    }
  });

  const [email, setEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('hf_customer_email') || '';
    } catch {
      return '';
    }
  });

  const [mobileNumber, setMobileNumber] = useState<string>(() => {
    try {
      return localStorage.getItem('hf_mobile_number') || '';
    } catch {
      return '';
    }
  });

  const [shippingAddress, setShippingAddress] = useState<string>(() => {
    try {
      return localStorage.getItem('hf_shipping_address') || '';
    } catch {
      return '';
    }
  });

  const [city, setCity] = useState<string>(() => {
    try {
      return localStorage.getItem('hf_shipping_city') || '';
    } catch {
      return '';
    }
  });

  const [pincode, setPincode] = useState<string>(() => {
    try {
      return localStorage.getItem('hf_shipping_pincode') || '';
    } catch {
      return '';
    }
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isWaitingForPayment, setIsWaitingForPayment] = useState<boolean>(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutInfoMsg, setCheckoutInfoMsg] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{ wcOrderId: number; paymentId: string; orderRefCode?: string; amountPaid?: number } | null>(() => {
    try {
      const saved = sessionStorage.getItem('hf_latest_order_success');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'shipping'>('cart');

  // Active Checkout Session (Zustand Store)
  const activeCheckoutSession = useSyncStore((state) => state.activeCheckoutSession);
  const setActiveCheckoutSession = useSyncStore((state) => state.setActiveCheckoutSession);
  const setCheckoutInProgress = useSyncStore((state) => state.setCheckoutInProgress);
  const setLastCheckoutRevision = useSyncStore((state) => state.setLastCheckoutRevision);
  const clearStoreCart = useSyncStore((state) => state.clearCart);

  // Coupon and Real-time Pricing Validation States
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponStatus, setCouponStatus] = useState<{ success: boolean; message: string; discount?: number } | null>(null);
  const [calcSummary, setCalcSummary] = useState<any>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Orders Tab State
  const [orders, setOrders] = useState<CustomerOrderHistoryItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | number | null>(null);
  const [ordersSubTab, setOrdersSubTab] = useState<'active' | 'history'>('active');

  const removeLocalPendingOrder = (wcOrderId?: number | string) => {
    setActiveCheckoutSession(null);
    setCheckoutInProgress(false);
    setCouponCode('');
    setCouponStatus(null);
    setCalcSummary(null);
    try {
      const savedLocal = localStorage.getItem('hf_local_orders');
      if (savedLocal) {
        const parsed = JSON.parse(savedLocal);
        const filtered = parsed.filter((o: any) => {
          const matchesId = wcOrderId && (o.id === wcOrderId || o.wcOrderId === wcOrderId || o.id === `HF-${wcOrderId}` || o.orderRefCode === `HF-${wcOrderId}`);
          const isPending = o.status === 'pending' || o.status === 'pending_payment';
          return !matchesId && !isPending;
        });
        localStorage.setItem('hf_local_orders', JSON.stringify(filtered));
      }
      sessionStorage.removeItem('hf_guest_orders');
      localStorage.removeItem('hf_pending_order');
      localStorage.removeItem('hf_checkout_idempotency_key');
    } catch (e) {
      console.warn('Error clearing local pending orders:', e);
    }
  };

  // Guest Order Tracking Search State
  const [guestSearchInput, setGuestSearchInput] = useState<string>('');
  const [guestSearchResult, setGuestSearchResult] = useState<any | null>(null);
  const [guestSearchError, setGuestSearchError] = useState<string | null>(null);
  const [guestSearchLoading, setGuestSearchLoading] = useState<boolean>(false);

  // Real-time ticking state for live countdowns (updates every second)
  const [now, setNow] = useState<number>(Date.now());
  const [ordersRefreshTrigger, setOrdersRefreshTrigger] = useState<number>(0);
  const [checkoutSuccessMsg, setCheckoutSuccessMsg] = useState<string | null>(null);

  // Real-time ticking state for live countdowns (updates every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check reservation auto-expiry
  useEffect(() => {
    if (!activeCheckoutSession || activeCheckoutSession.status !== 'pending_payment') return;
    const remaining = Math.max(0, Math.floor((activeCheckoutSession.reservationExpiresAt - Date.now()) / 1000));
    if (remaining <= 0) {
      console.log('[Inventory Reservation] Reservation expired. Releasing stock...');
      const orderIdToCancel = activeCheckoutSession.wcOrderId;
      const isActivelyOpen = isOpen;
      setActiveCheckoutSession(null);
      if (isActivelyOpen) {
        setCheckoutInfoMsg('Your 10-minute stock reservation expired. We have restored your cart items for easy re-ordering.');
      }
      if (typeof orderIdToCancel === 'number') {
        cancelInventoryReservation(orderIdToCancel).catch((err) => {
          console.warn('Failed to release expired reservation:', err);
        });
      }
      setOrdersRefreshTrigger((prev) => prev + 1);
    }
  }, [now, activeCheckoutSession, isOpen]);
  // Automatically clear activeCheckoutSession if user modifies cart items
  useEffect(() => {
    if (activeCheckoutSession && Array.isArray(activeCheckoutSession.cartSnapshot) && activeCheckoutSession.cartSnapshot.length > 0) {
      const sessionItemKeys = activeCheckoutSession.cartSnapshot.map((i: any) => `${i.productId || i.id}_${i.weight}_${i.quantity}`).sort().join('|');
      const currentItemKeys = items.map((i: any) => `${i.productId || i.id}_${i.weight}_${i.quantity}`).sort().join('|');
      if (sessionItemKeys !== currentItemKeys) {
        console.log('[Checkout Session] Cart items modified. Clearing previous session reservation...');
        setActiveCheckoutSession(null);
        localStorage.removeItem('hf_checkout_idempotency_key');
      }
    }
  }, [items, activeCheckoutSession]);
  const renderReservationTimer = (expTime: number) => {
    const secondsLeft = Math.max(0, Math.floor((expTime - now) / 1000));
    if (secondsLeft <= 0) return <span className="text-xs font-bold text-gray-400">Expired</span>;
    const mins = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const isWarning = secondsLeft <= 120; // < 2 mins: orange text

    return (
      <span className={`font-mono text-xs font-black px-2.5 py-0.5 rounded-lg border transition-all ${
        isWarning ? 'bg-amber-50 text-amber-600 border-amber-300 animate-pulse shadow-xs' : 'bg-white text-[#95CD1A] border-[#95CD1A]/30'
      }`}>
        {timeStr}
      </span>
    );
  };

  const handleRetryPayment = async (orderOrSession: any) => {
    setIsProcessing(true);
    setCheckoutError(null);
    setCheckoutInfoMsg(null);
    setCheckoutSuccessMsg(null);

    const wcOrderId = orderOrSession.wcOrderId || orderOrSession.id;

    // Fetch fresh retry payment parameters from server
    const retryDetails = await fetchRetryPaymentDetails(wcOrderId);

    const expTime = orderOrSession.expiresAt || (activeCheckoutSession?.wcOrderId === wcOrderId ? activeCheckoutSession?.reservationExpiresAt : null);
    if (expTime && Date.now() >= expTime) {
      setIsProcessing(false);
      useSyncStore.getState().setActiveCheckoutSession(null);
      localStorage.removeItem('hf_active_checkout_session');
      localStorage.removeItem('hf_pending_order');
      setCheckoutInfoMsg(null);
      setCheckoutError(`Reservation for Order #${wcOrderId} has expired and cannot be paid.`);
      return;
    }

    if (retryDetails && (retryDetails as any).isAlreadyPaid) {
      setIsProcessing(false);
      removeLocalPendingOrder(wcOrderId);
      setCheckoutInfoMsg(null);
      setCheckoutSuccessMsg(`Order #${wcOrderId} has already been paid and confirmed!`);
      setOrdersRefreshTrigger((prev) => prev + 1);
      return;
    }

    if (!retryDetails || !(retryDetails as any).success) {
      setIsProcessing(false);
      useSyncStore.getState().setActiveCheckoutSession(null);
      localStorage.removeItem('hf_active_checkout_session');
      localStorage.removeItem('hf_pending_order');
      localStorage.removeItem(`hf_pending_reservation_${wcOrderId}`);
      setCheckoutInfoMsg(null);
      setOrders((prev) => prev.filter((o) => o.id !== wcOrderId && o.id?.toString() !== wcOrderId?.toString()));
      setCheckoutError(`Order #${wcOrderId} is no longer active or has been removed from our system.`);
      setOrdersRefreshTrigger((prev) => prev + 1);
      return;
    }

    const targetOrder = {
      wcOrderId,
      razorpayOrderId: retryDetails?.razorpayOrderId || orderOrSession.razorpayOrderId || `order_mock_${wcOrderId}`,
      amountInPaise: retryDetails?.amountInPaise || orderOrSession.amountInPaise || Math.round(parseFloat(orderOrSession.total || '0') * 100),
      keyId: retryDetails?.keyId || orderOrSession.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E',
      orderRefCode: retryDetails?.orderRefCode || orderOrSession.orderRefCode || `HF-${wcOrderId}`,
      customerEmail: retryDetails?.customerEmail || orderOrSession.customerEmail || email || user?.email || '',
      customerName: retryDetails?.customerName || orderOrSession.customerName || customerName || (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Valued Customer'),
      phone: retryDetails?.phone || orderOrSession.phone || mobileNumber || user?.phone || '',
      items: retryDetails?.items || orderOrSession.items || items,
      shippingAddress: retryDetails?.shippingAddress || orderOrSession.shippingAddress || `${shippingAddress}, ${city}`,
    };

    if (retryDetails && retryDetails.expiresAt) {
      setActiveCheckoutSession({
        wcOrderId: targetOrder.wcOrderId,
        orderRefCode: targetOrder.orderRefCode,
        status: 'pending_payment',
        reservationExpiresAt: retryDetails.expiresAt,
        razorpayOrderId: targetOrder.razorpayOrderId,
        amountInPaise: targetOrder.amountInPaise,
        keyId: targetOrder.keyId,
        cartSnapshot: targetOrder.items,
        customerEmail: targetOrder.customerEmail,
        customerName: targetOrder.customerName,
        phone: targetOrder.phone,
        shippingAddress: targetOrder.shippingAddress,
      });
    }

    setCheckoutInProgress(true);

    retryRazorpayPayment(
      targetOrder,
      async (response) => {
        setCheckoutInProgress(false);
        setIsProcessing(false);
        setActiveCheckoutSession(null);
        setCheckoutStep('cart');
        setOrderSuccess(response);
        setCheckoutSuccessMsg(`Payment completed successfully for Order #${response.orderRefCode || targetOrder.orderRefCode}!`);
        setOrdersRefreshTrigger((prev) => prev + 1);
      },
      (errorMsg) => {
        setCheckoutInProgress(false);
        setIsProcessing(false);
        if (errorMsg.includes('cancelled by user')) {
          setCheckoutInfoMsg('Payment was cancelled. Your items are still reserved for a few minutes. You can retry payment now or continue shopping.');
        } else {
          setCheckoutError(errorMsg);
        }
      }
    );
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!window.confirm('Are you sure you want to cancel this order and release the stock?')) {
      return;
    }
    setIsProcessing(true);
    setCheckoutError(null);
    setCheckoutInfoMsg(null);
    setCheckoutSuccessMsg(null);
    try {
      const success = await cancelInventoryReservation(orderId);
      if (success) {
        if (activeCheckoutSession?.wcOrderId === orderId) {
          setActiveCheckoutSession(null);
        }

        // Restore reserved items back to active shopping cart
        const savedRes = localStorage.getItem(`hf_pending_reservation_${orderId}`);
        let restoredCount = 0;
        if (savedRes) {
          try {
            const parsed = JSON.parse(savedRes);
            if (Array.isArray(parsed.items) && parsed.items.length > 0) {
              const currentCart = useSyncStore.getState().cartItems;
              const merged = [...currentCart];
              parsed.items.forEach((item: CartItem) => {
                const existingIndex = merged.findIndex((i) => i.id === item.id);
                if (existingIndex > -1) {
                  merged[existingIndex].quantity += item.quantity;
                } else {
                  merged.push(item);
                }
              });
              useSyncStore.getState().setCart(merged);
              restoredCount = parsed.items.length;
            }
          } catch {}
          localStorage.removeItem(`hf_pending_reservation_${orderId}`);
        }

        const msg = restoredCount > 0
          ? 'We restored your cart items for easy re-ordering. Stock reservation released.'
          : 'Order cancelled successfully. Stock reservation released.';
        setCheckoutInfoMsg(msg);
        setOrdersRefreshTrigger((prev) => prev + 1);
      } else {
        setCheckoutError('Failed to cancel order.');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to cancel order.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-fill checkout fields from logged-in user profile
  useEffect(() => {
    if (user && isOpen) {
      if (user.email) setEmail(user.email);
      if (user.displayName && user.displayName.trim() !== 'Customer') setCustomerName(user.displayName);
      if (user.phone && !mobileNumber) setMobileNumber(user.phone);
      if (user.billing?.address_1 && !shippingAddress) setShippingAddress(user.billing.address_1);
      if (user.billing?.city && !city) setCity(user.billing.city);
      if (user.billing?.postcode && !pincode) setPincode(user.billing.postcode);
    }
  }, [user, isOpen]);

  // Resend OTP cooldown timer effect
  useEffect(() => {
    let interval: any = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendTimer]);

  // Clear orderSuccess state when user adds new items to shopping cart
  useEffect(() => {
    if (items.length > 0 && orderSuccess) {
      sessionStorage.removeItem('hf_latest_order_success');
      setOrderSuccess(null);
    }
  }, [items.length]);

  // Auto-purge activeCheckoutSession and checkoutInfoMsg when reservation timer expires
  useEffect(() => {
    if (activeCheckoutSession && activeCheckoutSession.reservationExpiresAt) {
      if (now >= activeCheckoutSession.reservationExpiresAt) {
        useSyncStore.getState().setActiveCheckoutSession(null);
        localStorage.removeItem('hf_active_checkout_session');
        localStorage.removeItem('hf_pending_order');
        setCheckoutInfoMsg(null);
      }
    } else if (!activeCheckoutSession && checkoutInfoMsg && checkoutInfoMsg.includes('still reserved')) {
      setCheckoutInfoMsg(null);
    }
  }, [activeCheckoutSession, now, checkoutInfoMsg]);

  // Run cart validation instantly on item/pincode changes
  useEffect(() => {
    if (items.length === 0) {
      setCalcSummary(null);
      return;
    }

    let isMounted = true;
    const activePincode = pincode.trim().length === 6 ? pincode.trim() : '625001';
    const activeCoupon = couponStatus?.success ? couponCode.trim() : undefined;

    validateCart(items, activePincode, activeCoupon).then((summary) => {
      if (isMounted) {
        setCalcSummary(summary);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [items, pincode, couponStatus]);

  // Auto-search guest order if token/id parameter is present in URL hash
  useEffect(() => {
    if (isOpen && activeTab === 'orders') {
      const hash = window.location.hash;
      if (hash.includes('?token=') || hash.includes('?id=')) {
        const urlParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
        const tokenParam = urlParams.get('token') || urlParams.get('id');
        if (tokenParam) {
          const decoded = decodeURIComponent(tokenParam);
          setGuestSearchInput(decoded);
          
          setGuestSearchLoading(true);
          setGuestSearchError(null);
          trackSingleOrder(decoded.trim())
            .then((data) => {
              if (data && data.orderId && !data.notFound) {
                setGuestSearchResult(data);
                setExpandedOrderId(data.orderId);
              } else {
                setGuestSearchError(data?.message || 'Order not found. Check parameters.');
              }
            })
            .catch(() => {
              setGuestSearchError('Error fetching order details.');
            })
            .finally(() => {
              setGuestSearchLoading(false);
              // Clean the hash so it doesn't trigger repeatedly
              window.history.replaceState(null, '', '#track');
            });
        }
      }
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    try {
      localStorage.setItem('hf_customer_name', customerName);
      localStorage.setItem('hf_customer_email', email);
      localStorage.setItem('hf_mobile_number', mobileNumber);
      localStorage.setItem('hf_shipping_address', shippingAddress);
      localStorage.setItem('hf_shipping_city', city);
      localStorage.setItem('hf_shipping_pincode', pincode);
    } catch (err) {
      console.error('Failed to save shipping details to localStorage', err);
    }
  }, [customerName, email, mobileNumber, shippingAddress, city, pincode]);

  const hasFetchedOrdersOnce = useRef<boolean>(false);
  const scrollableBodyRef = useRef<HTMLDivElement>(null);

  // Prevent background page from scrolling while drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      hasFetchedOrdersOnce.current = false;
      setOrderSuccess(null);
      setCheckoutStep('cart');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Live Sync & 3-Second Ultra-Fast Polling for Orders & Cart Data Across Devices (Zero-Flicker)
  useEffect(() => {
    if (!isOpen) return;

    const hasToken = !!localStorage.getItem('hf_auth_token');

    const syncData = (isInitial = false) => {
      if (activeTab === 'orders') {
        if (!user && !hasToken) {
          setLoadingOrders(false);
          setOrders([]);
          return;
        }

        // Instantly render cached orders on drawer open (< 50ms)
        const cached = getCachedCustomerOrders();
        if (cached && cached.length > 0 && orders.length === 0) {
          setOrders(cached);
          setLoadingOrders(false);
        } else if (isInitial && !hasFetchedOrdersOnce.current && orders.length === 0) {
          setLoadingOrders(true);
        }

        fetchCustomerOrders()
          .then((remoteOrders) => {
            if (Array.isArray(remoteOrders)) {
              const activeOrders = remoteOrders.filter((o) => o.status !== 'trash');
              setOrders(activeOrders);

              // Auto-purge activeCheckoutSession if deleted from WooCommerce database
              const activeSess = useSyncStore.getState().activeCheckoutSession;
              if (activeSess && activeSess.wcOrderId) {
                const existsInRemote = activeOrders.some((o: any) =>
                  String(o.id) === String(activeSess.wcOrderId) ||
                  String((o as any).wcOrderId) === String(activeSess.wcOrderId) ||
                  String(o.orderRefCode) === String(activeSess.orderRefCode)
                );
                if (!existsInRemote) {
                  console.log(`[Auto Purge] Pending order #${activeSess.wcOrderId} was deleted from database. Purging activeCheckoutSession.`);
                  useSyncStore.getState().setActiveCheckoutSession(null);
                  localStorage.removeItem('hf_active_checkout_session');
                  localStorage.removeItem('hf_pending_order');
                }
              }
            }
          })
          .catch((err) => {
            console.warn('Silent order poll warning:', err);
          })
          .finally(() => {
            hasFetchedOrdersOnce.current = true;
            setLoadingOrders(false);
          });
      } else if (activeTab === 'cart') {
        // Cart data is seamlessly synced via App.tsx props with 0 drawer flickering
        return;
      }
    };

    // Initial fetch
    syncData(true);

    // Silent background polling every 12 seconds (never shows spinner or wipes existing orders)
    const pollInterval = setInterval(() => syncData(false), 12000);

    const handleFocus = () => syncData(false);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('hf_orders_updated', handleFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('hf_orders_updated', handleFocus);
    };
  }, [isOpen, activeTab, user, ordersRefreshTrigger]);

  if (!isOpen) return null;

  const SHIPPING_FEE = 40;
  const safeItems = Array.isArray(items) ? items : [];
  const totalQuantity = safeItems.reduce((sum, item) => sum + (item?.quantity || 1), 0);
  const subtotal = safeItems.reduce((sum, item) => sum + (item?.pricePerUnit || 0) * (item?.quantity || 1), 0);
  const grandTotal = subtotal > 0 ? subtotal + SHIPPING_FEE : 0;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setIsValidating(true);
    setCouponStatus(null);
    try {
      const activePincode = pincode.trim().length === 6 ? pincode.trim() : '625001';
      const summary = await validateCart(items, activePincode, couponCode.trim());
      if (summary.appliedCoupon) {
        setCouponStatus({
          success: true,
          message: `Coupon '${couponCode.trim().toUpperCase()}' applied successfully!`,
          discount: summary.discountAmount
        });
      } else {
        setCouponStatus({
          success: false,
          message: summary.couponError || 'Invalid, expired, or inapplicable coupon code.'
        });
      }
    } catch (err: any) {
      setCouponStatus({
        success: false,
        message: err.message || 'Failed to apply coupon.'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setCouponStatus(null);
  };

  const triggerCheckoutOtp = async () => {
    setOtpError(null);
    setOtpLoading(true);
    try {
      const res = await sendEmailOtp(email.trim(), 'checkout');
      if (res.success) {
        setShowOtpPopup(true);
        setResendTimer(60);
      } else {
        setCheckoutError(res.message || 'Failed to send verification code. Please try again.');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Error sending verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyCheckoutOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    try {
      const res = await verifyEmailOtp(email.trim(), otpCode, 'checkout');
      if (res.success) {
        setCheckoutEmailVerified(email.trim().toLowerCase());
        setShowOtpPopup(false);
        setOtpCode('');
        
        // Immediately place order on verification success!
        setTimeout(() => {
          handleOrderNowInternal();
        }, 100);
      } else {
        setOtpError(res.message || 'Incorrect verification code. Please try again.');
      }
    } catch (err: any) {
      setOtpError(err.message || 'Invalid verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOrderNow = async () => {
    setIsProcessing(true);
    setCheckoutError(null);
    setFieldErrors({});

    if (items.length === 0) {
      setIsProcessing(false);
      setCheckoutError('Your cart is empty');
      return;
    }

    const errors: Record<string, string> = {};
    if (!validateName(customerName)) {
      errors.customerName = 'Name must contain only letters and be at least 2 characters';
    }
    if (!validateMobile(mobileNumber)) {
      errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number (starts with 6-9)';
    }
    if (!validateEmail(email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (shippingAddress.trim().length < 10) {
      errors.shippingAddress = 'Shipping address must be at least 10 characters';
    }
    if (city.trim().length < 2) {
      errors.city = 'City must be at least 2 characters';
    }
    if (!validatePincode(pincode)) {
      errors.pincode = 'Please enter a valid 6-digit pincode';
    }

    if (Object.keys(errors).length > 0) {
      setIsProcessing(false);
      setFieldErrors(errors);
      return;
    }

    if (calcSummary && calcSummary.delivery && !calcSummary.delivery.deliveryAvailable) {
      setIsProcessing(false);
      setCheckoutError(`We cannot deliver to pincode ${pincode}: ${calcSummary.delivery.message || 'Location unserviceable.'}`);
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    const needsVerification = !isLoggedIn || !user || user.email.toLowerCase() !== targetEmail;

    if (needsVerification && checkoutEmailVerified !== targetEmail) {
      try {
        await triggerCheckoutOtp();
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    await handleOrderNowInternal();
  };

  const handleOrderNowInternal = async () => {
    setIsProcessing(true);
    setCheckoutError(null);
    setCheckoutInfoMsg(null);
    setCheckoutInProgress(true);

    const payload: CheckoutPayload = {
      customerDetails: {
        name: customerName.trim(),
        email: email.trim(),
        phone: normalizeMobile(mobileNumber),
      },
      shippingAddress: {
        address: shippingAddress.trim(),
        city: city.trim(),
        state: 'Tamil Nadu',
        pincode: pincode.trim(),
      },
      items,
      couponCode: couponStatus?.success ? couponCode.trim() : undefined,
      cartRevision: isLoggedIn ? cartRevision : undefined,
    };

    // Step 1: Set waiting for payment state while Razorpay window is opening/open
    setIsWaitingForPayment(true);
    setIsVerifyingPayment(false);

    await processRazorpayCheckout(
      payload,
      (response) => {
        setIsWaitingForPayment(false);
        setIsVerifyingPayment(false);
        setCheckoutInProgress(false);
        setIsProcessing(false);
        removeLocalPendingOrder(response.wcOrderId);
        clearStoreCart(response.cartRevision);
        if (typeof onClearCart === 'function') onClearCart();
        localStorage.removeItem('hf_checkout_idempotency_key');
        localStorage.removeItem('hf_active_checkout_session');
        localStorage.removeItem('hf_pending_order');
        useSyncStore.getState().setActiveCheckoutSession(null);
        setCheckoutStep('cart');
        sessionStorage.setItem('hf_latest_order_success', JSON.stringify(response));
        setOrderSuccess(response);

        // Prepend optimistic confirmed order directly to state
        const displayCode = response.orderRefCode || `HF-${response.wcOrderId}`;
        const totalVal = calcSummary ? calcSummary.grandTotal.toString() : '0';
        const optimisticConfirmedOrder: any = {
          id: response.wcOrderId,
          orderRefCode: displayCode,
          status: 'processing',
          statusLabel: 'Order Confirmed & Kitchen Preparation',
          stage: 2,
          total: totalVal,
          currency: '₹',
          dateCreated: new Date().toISOString(),
          items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
          shippingAddress: `${shippingAddress.trim()}, ${city.trim()}`,
        };

        setOrders((prevOrders) => {
          const filtered = prevOrders.filter((o) => {
            const matchesId = o.id === response.wcOrderId || o.id.toString() === response.wcOrderId.toString() || o.id === 'HF-PENDING';
            return !matchesId;
          });
          return [optimisticConfirmedOrder, ...filtered];
        });

        // Show confirmation view on Shopping Cart tab
        setActiveTab('cart');
        setCheckoutStep('cart');
        if (response && response.wcOrderId) {
          setExpandedOrderId(response.wcOrderId);
        }

        setOrdersRefreshTrigger((prev) => prev + 1);
        useSyncStore.getState().clearCart(response?.cartRevision);
        onClearCart();
        if (response && response.cartRevision !== undefined) {
          setLastCheckoutRevision(response.cartRevision);
        }
        setCouponCode('');
        setCouponStatus(null);
        setCalcSummary(null);
        setCheckoutError(null);
        setCheckoutInfoMsg(null);
        setFieldErrors({});

        // Auto-login new registered customer
        if (response && response.accessToken && response.refreshToken && response.user) {
          try {
            useSyncStore.getState().login(response.user, response.accessToken, response.refreshToken);
          } catch (e) {
            console.error('Error logging in guest account after auto-registration:', e);
          }
        }
      },
      async (errorMsg, isOutOfSync) => {
        setIsWaitingForPayment(false);
        setIsVerifyingPayment(false);
        setCheckoutInProgress(false);
        setIsProcessing(false);
        if (isOutOfSync) {
          setCheckoutError(null);
          await bootstrapSync();
        } else if (errorMsg.includes('cancelled by user')) {
          setCheckoutInfoMsg('Payment was cancelled. Your items are still reserved for a few minutes. You can retry payment now or continue shopping.');
        } else {
          setCheckoutError(errorMsg);
        }
      },
      (wcOrderId: number, reservedItems: CartItem[], expiresAt: number) => {
        try {
          const reservationData = {
            wcOrderId,
            items: reservedItems || items,
            expiresAt,
          };
          localStorage.setItem(`hf_pending_reservation_${wcOrderId}`, JSON.stringify(reservationData));
        } catch (e) {}

        setActiveCheckoutSession({
          wcOrderId,
          orderRefCode: `HF-${wcOrderId}`,
          status: 'pending_payment',
          reservationExpiresAt: expiresAt,
          razorpayOrderId: '',
          amountInPaise: (calcSummary ? calcSummary.grandTotal : grandTotal) * 100,
          keyId: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TJhDcvxup2pu4E',
          cartSnapshot: [...(reservedItems || items)],
        });
      },
      // Step 2: Transition from Waiting for Payment -> Payment Verified & Confirming Order
      () => {
        setIsWaitingForPayment(false);
        setIsVerifyingPayment(true);
      }
    );
  };

  const handleGuestSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawQuery = guestSearchInput.trim();
    const cleanId = rawQuery.replace(/^#/, '').trim();
    if (!cleanId) return;

    setGuestSearchLoading(true);
    setGuestSearchError(null);
    setGuestSearchResult(null);

    try {
      const data = await trackSingleOrder(cleanId);
      if (data && data.orderId && !data.notFound) {
        setGuestSearchResult(data);
        setExpandedOrderId(data.orderId);
      } else {
        let localFound: any = null;
        try {
          const saved = localStorage.getItem('hf_local_orders');
          const localList: CustomerOrderHistoryItem[] = saved ? JSON.parse(saved) : [];
          localFound = localList.find((lo) => {
            const lId = lo.id ? lo.id.toString().toLowerCase() : '';
            const lRef = lo.orderRefCode ? lo.orderRefCode.toLowerCase() : '';
            const qLower = cleanId.toLowerCase();
            return lId === qLower || lRef === qLower || lRef.includes(qLower) || qLower.includes(lRef);
          });
        } catch {}

        if (localFound) {
          setGuestSearchResult({
            orderId: localFound.id,
            orderRefCode: localFound.orderRefCode || `HF-${localFound.id}`,
            status: localFound.status,
            statusLabel: localFound.statusLabel,
            stage: localFound.stage,
            total: localFound.total,
            currency: localFound.currency || '₹',
            dateCreated: localFound.dateCreated,
            customerName: 'Customer',
            phone: '',
            shippingAddress: localFound.shippingAddress || '',
            items: localFound.items || [],
          });
          setExpandedOrderId(localFound.id);
        } else {
          setGuestSearchError(`No order found matching #${rawQuery}. Please check Order ID.`);
        }
      }
    } catch {
      setGuestSearchError(`Failed to fetch Order #${rawQuery}. Please try again.`);
    } finally {
      setGuestSearchLoading(false);
    }
  };

  const toggleAccordion = (orderId: string | number) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-hidden animate-in fade-in duration-200">
      {/* Darkened Semi-Transparent Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      <div className="absolute inset-y-0 right-0 w-full sm:w-[460px] max-w-full flex pl-0">
        <div className="w-full h-full bg-white shadow-2xl flex flex-col justify-between transform transition-transform duration-300">
          
          {/* Top Drawer Header with Segmented Tabs */}
          <div className="p-4 sm:p-5 bg-white border-b border-gray-100 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-[#1F2937] tracking-tight">
                  {activeTab === 'cart' ? 'Your Shopping Cart' : 'My Orders & Tracking'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Segmented Dual Tab Switcher: Cart vs Your Orders */}
            <div className="flex border border-gray-200 bg-gray-100/80 p-1 rounded-2xl gap-1">
              <button
                onClick={() => {
                  setActiveTab('cart');
                  setOrderSuccess(null);
                  setCheckoutStep('cart');
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'cart'
                    ? 'bg-white text-[#95CD1A] shadow-md border border-gray-100'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Shopping Cart</span>
                {totalQuantity > 0 && (
                  <span className="bg-[#95CD1A] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-4.5 text-center">
                    {totalQuantity}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab('orders');
                  setOrderSuccess(null);
                  setCheckoutStep('cart');
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-white text-[#95CD1A] shadow-md border border-gray-100'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Your Orders</span>
                {Array.isArray(orders) && orders.length > 0 && (
                  <span className="bg-[#1F2937] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-4.5 text-center">
                    {orders.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: SHOPPING CART CONTENT */}
          {activeTab === 'cart' && (
            <div ref={scrollableBodyRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {isWaitingForPayment ? (
                /* Stage 1: Waiting for Payment View */
                <div className="py-12 px-2 text-center space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="w-20 h-20 rounded-full bg-[#1F2937] text-[#95CD1A] border-4 border-gray-700 flex items-center justify-center shadow-xl relative z-10">
                      <CreditCard className="w-9 h-9 text-[#95CD1A] animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-700 bg-gray-100 border border-gray-200 px-3.5 py-1 rounded-full inline-block">
                      Waiting for Payment
                    </span>
                    <h3 className="text-2xl font-black text-[#1F2937]">
                      Payment Window Open
                    </h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                      Please complete your payment in the secure Razorpay payment window to lock in your order.
                    </p>
                  </div>

                  {/* Progress Checklist */}
                  <div className="bg-[#FAFBF6] p-4 rounded-2xl border border-[#ECF9CA] text-left text-xs space-y-3 font-semibold max-w-xs mx-auto">
                    <div className="flex items-center gap-2.5 text-[#2D5A1E]">
                      <Loader2 className="w-4 h-4 text-[#95CD1A] animate-spin shrink-0" />
                      <span>Completing Payment in Razorpay...</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-400">
                      <Clock className="w-4 h-4 text-gray-300 shrink-0" />
                      <span>Kitchen Order Confirmation</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-400">
                      <PackageCheck className="w-4 h-4 text-gray-300 shrink-0" />
                      <span>Order Placement & Live Tracking</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 italic">
                    If the payment window did not open, please check popup blockers or click order now again.
                  </p>
                </div>
              ) : isVerifyingPayment ? (
                /* Full-Screen Payment Verifying Processing View */
                <div className="py-12 px-2 text-center space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-[#ECF9CA] animate-ping opacity-75" />
                    <div className="w-20 h-20 rounded-full bg-[#F7FCE8] border-4 border-[#95CD1A] flex items-center justify-center shadow-lg relative z-10">
                      <Loader2 className="w-10 h-10 text-[#95CD1A] animate-spin" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-black uppercase tracking-widest text-[#95CD1A] bg-[#F7FCE8] border border-[#ECF9CA] px-3.5 py-1 rounded-full inline-block">
                      Payment Received
                    </span>
                    <h3 className="text-2xl font-black text-[#1F2937]">
                      Confirming Your Order...
                    </h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                      We’ve received your payment and are locking in your authentic food preparation with our kitchen.
                    </p>
                  </div>

                  {/* Progress Step Checklist */}
                  <div className="bg-[#FAFBF6] p-4 rounded-2xl border border-[#ECF9CA] text-left text-xs space-y-3 font-semibold max-w-xs mx-auto">
                    <div className="flex items-center gap-2.5 text-[#2D5A1E]">
                      <CheckCircle2 className="w-4 h-4 text-[#95CD1A] shrink-0" />
                      <span>Payment Verified via Razorpay</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-700">
                      <Loader2 className="w-4 h-4 text-[#95CD1A] animate-spin shrink-0" />
                      <span>Kitchen Order Confirmation...</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-gray-400">
                      <Clock className="w-4 h-4 text-gray-300 shrink-0" />
                      <span>Live Tracking Link Generation</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 italic">
                    Please do not close this window while we finalize your order.
                  </p>
                </div>
              ) : orderSuccess ? (
                /* Order Placed Success Confirmation View */
                <div className="py-8 text-center space-y-5 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-[#F7FCE8] text-[#95CD1A] rounded-full flex items-center justify-center mx-auto border-2 border-[#ECF9CA] shadow-md">
                    <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[#95CD1A]">
                      Order Confirmed 🎉
                    </span>
                    <h3 className="text-2xl font-black text-[#1F2937]">
                      Order Placed Successfully
                    </h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed mt-1.5 px-2">
                      {isLoggedIn ? (
                        <>
                          Your order has been confirmed and is now being prepared in our kitchen.
                          <br />
                          You can track its live progress anytime from <strong className="font-extrabold text-[#1F2937]">My Orders & Tracking</strong>.
                        </>
                      ) : (
                        <>
                          Thank you for your order. Your tracking details have been saved to your session.
                          <br />
                          Use your Order Reference ID to track live kitchen and delivery status.
                        </>
                      )}
                    </p>
                  </div>

                  {/* Summary Details Box */}
                  <div className="bg-[#FAFBF6] p-4 rounded-2xl border border-[#ECF9CA] text-left text-xs space-y-2.5 font-medium max-w-xs mx-auto">
                    <div className="flex justify-between border-b border-gray-200/60 pb-2">
                      <span className="text-gray-500">Order Reference:</span>
                      <span className="font-extrabold text-[#95CD1A]">#{(orderSuccess as any).orderRefCode || `HF-${orderSuccess.wcOrderId}`}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200/60 pb-2">
                      <span className="text-gray-500">Amount Paid:</span>
                      <span className="font-black text-[#1F2937]">
                        ₹{(orderSuccess as any).amountPaid || (orderSuccess as any).amount || (calcSummary ? calcSummary.grandTotal : 334)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Live Status:</span>
                      <span className="font-bold text-[#95CD1A] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Kitchen Preparation
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2.5 max-w-xs mx-auto">
                    <button
                      onClick={() => {
                        if (orderSuccess && orderSuccess.wcOrderId) {
                          setExpandedOrderId(orderSuccess.wcOrderId);
                        }
                        sessionStorage.removeItem('hf_latest_order_success');
                        setOrderSuccess(null);
                        setActiveTab('orders');
                        setOrdersSubTab('active');
                      }}
                      className="w-full py-3.5 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Package className="w-4.5 h-4.5 text-white" />
                      <span>View & Track Order</span>
                    </button>

                    <button
                      onClick={() => {
                        sessionStorage.removeItem('hf_latest_order_success');
                        setOrderSuccess(null);
                        onClose();
                        if (onExploreShop) onExploreShop();
                      }}
                      className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Continue Shopping</span>
                      <ArrowRight className="w-4 h-4 text-gray-500" />
                    </button>
                  </div>
                </div>
              ) : items.length === 0 ? (
                /* Empty Cart State */
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                  <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center border border-gray-100 shadow-inner">
                    <ShoppingBag className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-extrabold text-[#1F2937]">Your Cart is Empty</h3>
                    <p className="text-xs text-gray-500 max-w-xs">
                      Explore our hand-pounded spices, authentic thokku, and traditional snacks!
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      if (onExploreShop) onExploreShop();
                    }}
                    className="px-6 py-3 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer mt-2"
                  >
                    <span>Browse Product Catalog</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* 2-Step Checkout Wizard Stepper */
                <>
                  <div className="flex items-center justify-between bg-gray-50 border border-gray-100 p-3 rounded-2xl shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shadow-xs ${
                        checkoutStep === 'cart'
                          ? 'bg-[#95CD1A] text-white ring-2 ring-[#95CD1A]/20'
                          : 'bg-green-100 text-[#95CD1A]'
                      }`}>
                        1
                      </span>
                      <span className={`text-[11px] font-extrabold ${checkoutStep === 'cart' ? 'text-[#1F2937]' : 'text-gray-400'}`}>
                        Review Cart
                      </span>
                    </div>
                    <div className="flex-1 h-[2px] mx-3 bg-gray-200" />
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shadow-xs ${
                        checkoutStep === 'shipping'
                          ? 'bg-[#95CD1A] text-white ring-2 ring-[#95CD1A]/20'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        2
                      </span>
                      <span className={`text-[11px] font-extrabold ${checkoutStep === 'shipping' ? 'text-[#1F2937]' : 'text-gray-400'}`}>
                        Shipping & Payment
                      </span>
                    </div>
                  </div>

                  {checkoutStep === 'cart' ? (
                    /* Step 1: Review Items */
                    <div className="space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                        <span>Selected Items ({totalQuantity})</span>
                      </div>

                      <div className="divide-y divide-gray-100 border-y border-gray-100">
                        {items.map((item, index) => (
                          <div key={`${item.id}-${index}`} className="py-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-12 h-12 rounded-xl object-cover bg-gray-100 shrink-0 border border-gray-100"
                              />
                              <div className="min-w-0 text-left">
                                <h4 className="text-xs sm:text-sm font-extrabold text-[#1F2937] truncate leading-tight">
                                  {item.name}
                                </h4>
                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="text-[10px] uppercase font-bold text-gray-400">Pack:</span>
                                  <select
                                    value={item.weight}
                                    onChange={(e) => {
                                      const selectedWeight = e.target.value;
                                      const opts = getWeightOptionsForItem(item);
                                      const chosen = opts.find((o) => o.weight === selectedWeight);
                                      const newPrice = chosen ? chosen.price : item.pricePerUnit;
                                      if (onUpdateItemWeight) {
                                        onUpdateItemWeight(item.id, selectedWeight, newPrice);
                                      }
                                    }}
                                    className="text-[11px] font-extrabold text-[#1F2937] bg-gray-100 hover:bg-gray-200 border border-gray-200/80 rounded-md px-1.5 py-0.5 outline-none cursor-pointer transition-all"
                                  >
                                    {getWeightOptionsForItem(item).map((opt) => (
                                      <option key={opt.weight} value={opt.weight}>
                                        {opt.weight} (₹{opt.price})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <p className="text-xs font-black text-[#95CD1A] font-numeric mt-0.5">
                                  ₹{item.pricePerUnit * item.quantity}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50/50">
                                <button
                                  onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="px-2 text-xs font-extrabold text-[#1F2937] font-numeric">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                  className="px-2 py-1 text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <button
                                onClick={() => onRemoveItem(item.id)}
                                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Step 2: Shipping & Details Form */
                    <div className="space-y-4 text-left animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                          Delivery & Shipping Details
                        </span>
                        {!isLoggedIn && onOpenAuthModal && (
                          <button
                            onClick={onOpenAuthModal}
                            className="text-[11px] font-bold text-[#95CD1A] hover:underline cursor-pointer"
                          >
                            Login for Auto-Fill
                          </button>
                        )}
                      </div>

                      <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200/80 space-y-3.5">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">Full Name</label>
                          <input
                            type="text"
                            value={customerName}
                            autoComplete="name"
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomerName(val);
                              if (val.trim() && !validateName(val)) {
                                setFieldErrors((prev) => ({ ...prev, customerName: 'Name must contain only letters and be at least 2 characters.' }));
                              } else {
                                setFieldErrors((prev) => ({ ...prev, customerName: '' }));
                              }
                            }}
                            placeholder="Full Name"
                            className={`w-full px-3 py-2 bg-white rounded-xl border ${
                              fieldErrors.customerName ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                            } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium transition-all text-xs sm:text-sm`}
                          />
                          {fieldErrors.customerName && (
                            <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.customerName}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Mobile Number</label>
                            <div className="relative">
                              <input
                                type="tel"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                autoComplete="tel"
                                value={mobileNumber}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMobileNumber(val);
                                  if (val.trim() && !validateMobile(val)) {
                                    setFieldErrors((prev) => ({ ...prev, mobileNumber: 'Enter a valid 10-digit Indian mobile number.' }));
                                  } else {
                                    setFieldErrors((prev) => ({ ...prev, mobileNumber: '' }));
                                  }
                                }}
                                placeholder="9876543210"
                                className={`w-full pl-7 pr-2 py-2 bg-white rounded-xl border ${
                                  fieldErrors.mobileNumber ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                                } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium font-numeric transition-all text-xs`}
                              />
                              <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            </div>
                            {fieldErrors.mobileNumber && (
                              <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.mobileNumber}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Email Address</label>
                            <div className="relative">
                              <input
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setEmail(val);
                                  if (val.trim() && !validateEmail(val)) {
                                    setFieldErrors((prev) => ({ ...prev, email: 'Please enter a valid email address.' }));
                                  } else {
                                    setFieldErrors((prev) => ({ ...prev, email: '' }));
                                  }
                                }}
                                placeholder="name@email.com"
                                className={`w-full pl-7 pr-2 py-2 bg-white rounded-xl border ${
                                  fieldErrors.email ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                                } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium transition-all text-xs`}
                              />
                              <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            </div>
                            {fieldErrors.email && (
                              <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.email}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">Shipping Address</label>
                          <textarea
                            rows={2}
                            value={shippingAddress}
                            autoComplete="street-address"
                            onChange={(e) => {
                              const val = e.target.value;
                              setShippingAddress(val);
                              if (val.trim() && val.trim().length < 10) {
                                setFieldErrors((prev) => ({ ...prev, shippingAddress: 'Address must be at least 10 characters long.' }));
                              } else {
                                setFieldErrors((prev) => ({ ...prev, shippingAddress: '' }));
                              }
                            }}
                            placeholder="Door No, Street Name, Area"
                            className={`w-full px-3 py-2 bg-white rounded-xl border ${
                              fieldErrors.shippingAddress ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                            } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium resize-none transition-all text-xs`}
                          />
                          {fieldErrors.shippingAddress && (
                            <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.shippingAddress}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">City</label>
                            <input
                              type="text"
                              value={city}
                              autoComplete="address-level2"
                              onChange={(e) => {
                                const val = e.target.value;
                                setCity(val);
                                if (val.trim() && val.trim().length < 2) {
                                  setFieldErrors((prev) => ({ ...prev, city: 'City must be at least 2 characters.' }));
                                } else {
                                  setFieldErrors((prev) => ({ ...prev, city: '' }));
                                }
                              }}
                              placeholder="Madurai"
                              className={`w-full px-3 py-2 bg-white rounded-xl border ${
                                fieldErrors.city ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                              } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium transition-all text-xs`}
                            />
                            {fieldErrors.city && (
                              <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.city}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-gray-600 mb-1">Pincode</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="postal-code"
                              value={pincode}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPincode(val);
                                if (val.trim() && !validatePincode(val)) {
                                  setFieldErrors((prev) => ({ ...prev, pincode: 'Please enter a valid 6-digit pincode.' }));
                                } else {
                                  setFieldErrors((prev) => ({ ...prev, pincode: '' }));
                                }
                              }}
                              placeholder="625001"
                              className={`w-full px-3 py-2 bg-white rounded-xl border ${
                                fieldErrors.pincode ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                              } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium font-numeric transition-all text-xs`}
                            />
                            {fieldErrors.pincode && (
                              <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.pincode}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: YOUR ORDERS & LIVE TRACKING CONTENT */}
          {activeTab === 'orders' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-left">
              
              {/* Quick Guest Order Tracking Input */}
              <div className="bg-[#FAFBF6] p-3.5 rounded-2xl border border-[#ECF9CA] space-y-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#95CD1A] block">
                  Track Any Order by ID
                </span>
                <form onSubmit={handleGuestSearchSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={guestSearchInput}
                      onChange={(e) => {
                        setGuestSearchInput(e.target.value);
                        if (!e.target.value.trim()) {
                          setGuestSearchResult(null);
                          setGuestSearchError(null);
                        }
                      }}
                      placeholder="Enter Order ID (e.g. 118)"
                      className="w-full pl-8 pr-2 py-2 bg-white rounded-xl border border-gray-200 focus:border-[#95CD1A] text-xs font-bold font-numeric focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="submit"
                    disabled={guestSearchLoading}
                    className="px-3.5 py-2 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {guestSearchLoading ? 'Searching...' : 'Track'}
                  </button>
                </form>
                {guestSearchError && (
                  <p className="text-[11px] text-red-500 font-bold mt-1">{guestSearchError}</p>
                )}
              </div>

              {/* Logged in prompt if guest */}
              {!user && (
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">Logged in users see all past order history automatically.</span>
                  {onOpenAuthModal && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenAuthModal();
                      }}
                      className="text-[#95CD1A] font-extrabold hover:underline whitespace-nowrap cursor-pointer ml-2"
                    >
                      Login
                    </button>
                  )}
                </div>
              )}

              {checkoutSuccessMsg && (
                <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-xs font-extrabold text-green-700 text-center animate-in fade-in duration-200">
                  {checkoutSuccessMsg}
                </div>
              )}
              {checkoutError && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs font-extrabold text-red-600 text-center animate-in fade-in duration-200">
                  {checkoutError}
                </div>
              )}

              {/* Orders List Container */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                  <span>Your Order History ({Array.isArray(orders) ? orders.length : 0})</span>
                </div>

                {loadingOrders && (!Array.isArray(orders) || orders.length === 0) ? (
                  <div className="space-y-3 py-2">
                    {[1, 2].map((idx) => (
                      <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3 animate-pulse shadow-xs text-left">
                        <div className="flex items-center justify-between">
                          <div className="h-4 bg-gray-200 rounded-md w-28" />
                          <div className="h-4 bg-gray-100 rounded-md w-16" />
                        </div>
                        <div className="h-3 bg-gray-100 rounded-md w-44" />
                        <div className="h-8 bg-gray-50 rounded-xl w-full" />
                      </div>
                    ))}
                  </div>
                ) : (!Array.isArray(orders) || orders.length === 0) && !guestSearchResult ? (
                  <div className="py-10 text-center space-y-3 bg-gray-50 rounded-2xl border border-gray-100 p-4">
                    <Package className="w-10 h-10 text-gray-300 mx-auto" />
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-700">No Orders Found</h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Placed an order recently? Enter your Order ID in the search box above to track it live!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      const displayList = Array.isArray(orders) ? [...orders] : [];

                      if (activeCheckoutSession && activeCheckoutSession.reservationExpiresAt > now) {
                        const sessWcId = activeCheckoutSession.wcOrderId?.toString();
                        const sessRefCode = activeCheckoutSession.orderRefCode;

                        let confirmedIds: string[] = [];
                        try {
                          confirmedIds = JSON.parse(sessionStorage.getItem('hf_confirmed_order_ids') || '[]');
                        } catch {}

                        const isConfirmedInSession = (sessWcId && confirmedIds.includes(sessWcId)) ||
                          (sessRefCode && confirmedIds.includes(sessRefCode));

                        if (isConfirmedInSession) {
                          setTimeout(() => {
                            useSyncStore.getState().setActiveCheckoutSession(null);
                            localStorage.removeItem('hf_active_checkout_session');
                          }, 0);
                        } else {
                          const sessionOrder = {
                            id: activeCheckoutSession.wcOrderId,
                            orderRefCode: activeCheckoutSession.orderRefCode,
                            status: 'pending',
                            statusLabel: 'Payment Pending',
                            stage: 1,
                            total: (activeCheckoutSession.amountInPaise / 100).toFixed(2),
                            currency: '₹',
                            dateCreated: new Date().toISOString(),
                            items: activeCheckoutSession.cartSnapshot || [],
                            shippingAddress: activeCheckoutSession.shippingAddress || '',
                            razorpayOrderId: activeCheckoutSession.razorpayOrderId,
                            amountInPaise: activeCheckoutSession.amountInPaise,
                            keyId: activeCheckoutSession.keyId,
                            expiresAt: activeCheckoutSession.reservationExpiresAt,
                          };

                          const alreadyExists = displayList.some((o: any) => {
                            const oIdStr = o.id?.toString();
                            const oWcIdStr = o.wcOrderId?.toString();
                            const oRefStr = o.orderRefCode?.toString();
                            const isMatch = (
                              (sessWcId && (oIdStr === sessWcId || oWcIdStr === sessWcId)) ||
                              (sessRefCode && (oRefStr === sessRefCode || oIdStr === sessRefCode))
                            );
                            const isPaidStatus = ['processing', 'confirmed', 'kitchen', 'dispatched', 'shipped', 'completed', 'delivered'].includes((o.status || '').toLowerCase()) ||
                              confirmedIds.some((cid) => {
                                const cStr = String(cid);
                                return oIdStr === cStr || oWcIdStr === cStr || oRefStr === cStr || oIdStr.endsWith(`//${cStr}`) || oRefStr.endsWith(`//${cStr}`);
                              });

                            if (isMatch && isPaidStatus) {
                              setTimeout(() => {
                                useSyncStore.getState().setActiveCheckoutSession(null);
                                localStorage.removeItem('hf_active_checkout_session');
                              }, 0);
                            }
                            return isMatch;
                          });

                          if (!alreadyExists) {
                            displayList.unshift(sessionOrder);
                          }
                        }
                      }

                      if (guestSearchResult) {
                        const guestOrderObj = {
                          id: guestSearchResult.orderId || guestSearchResult.id,
                          orderRefCode: guestSearchResult.orderRefCode,
                          status: guestSearchResult.status,
                          statusLabel: guestSearchResult.statusLabel,
                          stage: guestSearchResult.stage,
                          total: guestSearchResult.total,
                          currency: '₹',
                          dateCreated: guestSearchResult.dateCreated || new Date().toISOString(),
                          items: guestSearchResult.items || [],
                          shippingAddress: guestSearchResult.shippingAddress || '',
                          razorpayOrderId: guestSearchResult.razorpayOrderId,
                          amountInPaise: guestSearchResult.amountInPaise,
                          keyId: guestSearchResult.keyId,
                        };
                        if (!displayList.some((o) => o.id.toString() === guestOrderObj.id.toString())) {
                          displayList.unshift(guestOrderObj);
                        }
                      }

                      const isCancelledOrInactive = (o: any) => {
                        const rawStatus = (o.status || '').toLowerCase().trim();
                        const rawLabel = (o.statusLabel || '').toLowerCase().trim();
                        const expTime = o.expiresAt || (activeCheckoutSession?.wcOrderId === o.id ? activeCheckoutSession?.reservationExpiresAt : null);
                        const isExpiredTimer = expTime ? now >= expTime : false;

                        if (isExpiredTimer) return true;

                        if (rawLabel.includes('dispatched') || rawLabel.includes('kitchen') || rawLabel.includes('confirmed') || rawLabel.includes('delivered') || rawLabel.includes('preparation') || rawLabel.includes('out for delivery')) {
                          if (rawStatus !== 'cancelled' && rawStatus !== 'refunded' && !rawLabel.includes('cancelled')) {
                            return false;
                          }
                        }

                        return rawStatus === 'cancelled' || rawStatus === 'refunded' || rawStatus === 'expired' || rawStatus === 'trash' ||
                               rawLabel.includes('cancelled') || rawLabel.includes('refunded');
                      };

                      const activeOrders = displayList.filter((o) => {
                        if (isCancelledOrInactive(o)) return false;
                        const rawStatus = (o.status || '').toLowerCase().trim();
                        const rawLabel = (o.statusLabel || '').toLowerCase().trim();
                        return ['pending', 'processing', 'confirmed', 'kitchen', 'dispatched', 'shipped', 'in_transit', 'on_hold', 'pending_payment', 'failed'].includes(rawStatus) ||
                               rawLabel.includes('dispatched') || rawLabel.includes('kitchen') || rawLabel.includes('confirmed') || rawLabel.includes('out for delivery');
                      });

                      const pastOrders = displayList.filter((o) => {
                        if (isCancelledOrInactive(o)) return true;
                        const rawStatus = (o.status || '').toLowerCase().trim();
                        const rawLabel = (o.statusLabel || '').toLowerCase().trim();
                        const isActiveLabel = rawLabel.includes('dispatched') || rawLabel.includes('kitchen') || rawLabel.includes('confirmed') || rawLabel.includes('out for delivery');
                        return !isActiveLabel && !['pending', 'processing', 'confirmed', 'kitchen', 'dispatched', 'shipped', 'in_transit', 'on_hold', 'pending_payment', 'failed'].includes(rawStatus);
                      });

                      const renderCard = (ord: any) => {
                        const isExpanded = expandedOrderId === ord.id || expandedOrderId?.toString() === ord.id.toString();

                        const foodNamesSummary = ord.items && ord.items.length > 0
                          ? ord.items.map((i: any) => `${i.name}${i.quantity > 1 ? ` (${i.quantity}x)` : ''}`).join(', ')
                          : 'Homemade South Indian Food Delicacies';

                        const rawStatus = (ord.status || '').toLowerCase().trim();
                        const rawLabel = (ord.statusLabel || '').toLowerCase().trim();

                        let stage = ord.stage ?? 2;
                        if (rawStatus.includes('dispatch') || rawStatus.includes('shipped') || rawStatus.includes('out_for_delivery') || rawLabel.includes('dispatch') || rawLabel.includes('shipped')) {
                          stage = 3;
                        } else if (rawStatus.includes('deliver') || rawStatus.includes('complete') || rawLabel.includes('deliver') || rawLabel.includes('complete')) {
                          stage = 4;
                        } else if (rawStatus.includes('kitchen') || rawStatus.includes('process') || rawStatus.includes('hold') || rawLabel.includes('kitchen') || rawLabel.includes('process')) {
                          stage = 2;
                        }

                        const expTime = ord.expiresAt || (activeCheckoutSession?.wcOrderId === ord.id ? activeCheckoutSession?.reservationExpiresAt : null);
                        const isExpiredTimer = expTime ? now >= expTime : false;

                        const isPending = (rawStatus === 'pending' || rawStatus === 'pending_payment') && !isExpiredTimer;
                        const isCancelled = rawStatus === 'cancelled' || rawStatus === 'failed' || rawStatus === 'expired' || isExpiredTimer;
                        const isCompleted = rawStatus === 'completed' || rawStatus === 'delivered';

                        const stageLabel = ord.statusLabel || (
                          isPending ? 'Payment Pending' :
                          isCancelled ? 'Cancelled' :
                          isCompleted ? 'Delivered' :
                          stage === 3 ? 'Dispatched' : stage === 2 ? 'Kitchen' : 'Confirmed'
                        );

                        return (
                          <div
                            key={ord.id}
                            className={`rounded-2xl border transition-all overflow-hidden ${
                              isExpanded
                                ? 'border-[#95CD1A] bg-white shadow-md'
                                : 'border-gray-200 hover:border-[#95CD1A]/50 bg-white'
                            }`}
                          >
                            <div className="p-4 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-[#1F2937] font-numeric">
                                      Order #{ord.orderRefCode || `HF-${ord.id}`}
                                    </span>
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                      isPending ? 'bg-[#F7FCE8] text-[#2D5A1E] border-[#ECF9CA]' :
                                      isCancelled ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                      'bg-[#F7FCE8] text-[#95CD1A] border-[#ECF9CA]'
                                    }`}>
                                      {stageLabel}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                                    {ord.dateCreated ? new Date(ord.dateCreated).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently Placed'}
                                  </p>
                                </div>

                                <div className="text-right shrink-0 font-numeric">
                                  <span className="text-sm font-black text-[#1F2937] block">
                                    ₹{ord.total}
                                  </span>
                                  <span className="text-[10px] text-gray-400 font-bold">
                                    {ord.items?.length || 1} {ord.items?.length === 1 ? 'Item' : 'Items'}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-gray-100 flex items-start gap-2">
                                <span className="text-xs font-bold text-[#95CD1A] shrink-0">Items:</span>
                                <span className="text-xs font-extrabold text-[#1F2937] line-clamp-2 leading-snug">
                                  {foodNamesSummary}
                                </span>
                              </div>

                              <button
                                onClick={() => toggleAccordion(ord.id)}
                                className="w-full pt-2 flex items-center justify-between text-xs font-extrabold text-[#95CD1A] hover:text-[#7EB30E] transition-colors cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide Tracking Details' : 'View Tracking Details & Items'}</span>
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>

                            {isExpanded && (
                              <div className="px-4 pb-4 pt-3 bg-[#FAFBF6] border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                {isPending ? (
                                  <div className="p-3.5 bg-[#F7FCE8] rounded-xl border border-[#ECF9CA] text-xs space-y-3 text-left">
                                    <div className="flex items-start gap-2.5">
                                      <Clock className="w-5 h-5 text-[#95CD1A] shrink-0 mt-0.5 animate-pulse" />
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                          <h4 className="font-extrabold text-[#2D5A1E]">Payment Pending</h4>
                                          {expTime && renderReservationTimer(expTime)}
                                        </div>
                                        <p className="text-[#4A7C34] font-medium leading-relaxed">
                                          Stock remains reserved for you. Complete payment before the reservation timer expires to guarantee availability.
                                        </p>
                                      </div>
                                    </div>

                                    <div className="pt-1 flex gap-2">
                                      <button
                                        onClick={() => handleRetryPayment(ord)}
                                        disabled={isProcessing}
                                        className="flex-1 py-2 px-3 bg-[#95CD1A] hover:bg-[#7EB30E] disabled:bg-gray-400 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                      >
                                        <CreditCard className="w-3.5 h-3.5" />
                                        <span>{isProcessing ? 'Opening Payment...' : 'Retry Payment'}</span>
                                      </button>
                                      <button
                                        onClick={() => handleCancelOrder(typeof ord.id === 'string' ? parseInt(ord.id, 10) : ord.id)}
                                        disabled={isProcessing}
                                        className="py-2 px-3 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 text-gray-600 font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <span>Cancel Order</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block">
                                      Live Delivery Progress
                                    </span>

                                    <div className="grid grid-cols-4 gap-1 relative text-center pt-2">
                                      <div className="absolute top-5 left-[12%] right-[12%] h-1 bg-gray-200 -z-0">
                                        <div
                                          className="h-full bg-[#95CD1A] transition-all duration-500"
                                          style={{ width: `${Math.max(0, Math.min(100, ((stage - 1) / 3) * 100))}%` }}
                                        />
                                      </div>

                                      <div className="flex flex-col items-center gap-1 relative z-10">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                          stage >= 1 ? 'bg-[#95CD1A] text-white shadow-md' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                          <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <span className="text-[9px] font-extrabold text-gray-700 leading-tight">Confirmed</span>
                                      </div>

                                      <div className="flex flex-col items-center gap-1 relative z-10">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                          stage >= 2 ? 'bg-[#95CD1A] text-white shadow-md' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                          <Clock className="w-4 h-4" />
                                        </div>
                                        <span className="text-[9px] font-extrabold text-gray-700 leading-tight">Kitchen</span>
                                      </div>

                                      <div className="flex flex-col items-center gap-1 relative z-10">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                          stage >= 3 ? 'bg-[#95CD1A] text-white shadow-md' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                          <Truck className="w-4 h-4" />
                                        </div>
                                        <span className="text-[9px] font-extrabold text-gray-700 leading-tight">Dispatched</span>
                                      </div>

                                      <div className="flex flex-col items-center gap-1 relative z-10">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                          stage >= 4 ? 'bg-[#95CD1A] text-white shadow-md' : 'bg-gray-200 text-gray-500'
                                        }`}>
                                          <PackageCheck className="w-4 h-4" />
                                        </div>
                                        <span className="text-[9px] font-extrabold text-gray-700 leading-tight">Delivered</span>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {ord.items && ord.items.length > 0 && (
                                  <div className="space-y-1.5 pt-2 border-t border-gray-200/60">
                                    <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider block">
                                      Food Items Breakdown
                                    </span>
                                    <div className="divide-y divide-gray-200/60 bg-white rounded-xl p-2.5 border border-gray-200/80 text-xs">
                                      {ord.items.map((it: any, i: number) => (
                                        <div key={i} className="py-1 flex items-center justify-between">
                                          <span className="font-extrabold text-gray-800">{it.name}</span>
                                          <span className="font-bold text-gray-500 font-numeric">x{it.quantity}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {ord.shippingAddress && (
                                  <div className="pt-2 border-t border-gray-200/60 text-xs">
                                    <span className="font-extrabold text-gray-500 uppercase tracking-wider block text-[10px] mb-0.5">
                                      Delivery Address:
                                    </span>
                                    <span className="font-medium text-gray-700 block">{ord.shippingAddress}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-4">
                          {/* Segmented Sub-tab bar: Active vs History */}
                          <div className="flex border border-gray-200 bg-gray-100/90 p-1 rounded-xl gap-1">
                            <button
                              type="button"
                              onClick={() => setOrdersSubTab('active')}
                              className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                ordersSubTab === 'active'
                                  ? 'bg-white text-[#95CD1A] shadow-xs border border-gray-100'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Active Orders</span>
                              <span className="bg-[#95CD1A] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-4.5 text-center">
                                {activeOrders.length}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setOrdersSubTab('history')}
                              className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                ordersSubTab === 'history'
                                  ? 'bg-white text-[#1F2937] shadow-xs border border-gray-100'
                                  : 'text-gray-600 hover:text-gray-900'
                              }`}
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>History</span>
                              <span className="bg-gray-200 text-gray-700 text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-4.5 text-center">
                                {pastOrders.length}
                              </span>
                            </button>
                          </div>

                          {/* Sub-tab Content Panel */}
                          {ordersSubTab === 'active' ? (
                            <div className="space-y-3">
                              {activeOrders.length === 0 ? (
                                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-center space-y-2">
                                  <Clock className="w-8 h-8 text-gray-300 mx-auto" />
                                  <h5 className="text-xs font-extrabold text-gray-700">No Active Orders</h5>
                                  <p className="text-[11px] text-gray-400 font-medium max-w-xs mx-auto">
                                    All your recent orders have been fulfilled or delivered. Click the History tab to view past orders.
                                  </p>
                                </div>
                              ) : (
                                activeOrders.map(renderCard)
                              )}
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {pastOrders.length === 0 ? (
                                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-center space-y-2">
                                  <PackageCheck className="w-8 h-8 text-gray-300 mx-auto" />
                                  <h5 className="text-xs font-extrabold text-gray-700">No Past Orders Found</h5>
                                  <p className="text-[11px] text-gray-400 font-medium max-w-xs mx-auto">
                                    Your delivered or completed order history will appear here.
                                  </p>
                                </div>
                              ) : (
                                pastOrders.map(renderCard)
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cart Footer & Checkout Panel (Only Visible in Shopping Cart Tab) */}
          {activeTab === 'cart' && items.length > 0 && !orderSuccess && (
            <div className="p-4 sm:p-5 pb-8 sm:pb-5 bg-white border-t border-gray-200 space-y-3.5 shadow-lg shrink-0">
              
              {/* Coupon Block */}
              {checkoutStep === 'cart' ? (
                /* Step 1 Coupon Input */
                <div className="pb-2.5 border-b border-gray-100 space-y-2 text-left">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                    Promo / Coupon Code
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      disabled={couponStatus?.success || isValidating}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="E.G. FEST50"
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#95CD1A] focus:outline-none text-xs font-bold text-gray-800 uppercase"
                    />
                    {couponStatus?.success ? (
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="px-3.5 py-2 bg-red-50 text-red-500 hover:bg-red-100 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={!couponCode.trim() || isValidating}
                        className="px-4 py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                  {couponStatus && (
                    <p className={`text-[10px] font-extrabold ${couponStatus.success ? 'text-green-600' : 'text-red-500'}`}>
                      {couponStatus.message}
                    </p>
                  )}
                </div>
              ) : (
                /* Step 2 Read-Only Coupon Badge */
                couponStatus?.success && (
                  <div className="pb-2 border-b border-gray-100 flex items-center justify-between animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 text-xs text-green-700 font-extrabold">
                      <span className="bg-green-100 text-[#95CD1A] px-2 py-0.5 rounded-lg border border-[#95CD1A]/20 uppercase text-[10px]">
                        🎟️ {couponCode}
                      </span>
                      <span>Coupon Applied</span>
                    </div>
                    <span className="text-xs text-green-700 font-black">-₹{calcSummary?.discountAmount || 0}</span>
                  </div>
                )
              )}

              {/* Pricing calculations */}
              <div className={`space-y-1.5 transition-opacity duration-200 text-xs ${isValidating ? 'opacity-65' : ''}`}>
                <div className="flex items-center justify-between text-gray-500 font-bold">
                  <span>Subtotal ({totalQuantity} items)</span>
                  <span className="font-extrabold text-gray-800">₹{calcSummary ? calcSummary.subtotal : subtotal}</span>
                </div>
                {calcSummary?.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-green-600 font-extrabold animate-in slide-in-from-top-1">
                    <span>Coupon Discount</span>
                    <span>-₹{calcSummary.discountAmount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-gray-500 font-bold">
                  <span>Delivery Charge</span>
                  <div className="flex items-center gap-2">
                    {calcSummary?.delivery?.estimatedDays && (
                      <span className="text-[9px] bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded-full font-extrabold">
                        {calcSummary.delivery.estimatedDays}
                      </span>
                    )}
                    <span className="text-[#1F2937] font-extrabold">
                      {calcSummary 
                        ? (calcSummary.shippingCharge > 0 ? `₹${calcSummary.shippingCharge}` : 'FREE') 
                        : `₹${SHIPPING_FEE}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-gray-500 font-bold">
                  <span>GST (5% Included)</span>
                  <span className="text-[#1F2937] font-extrabold">
                    ₹{calcSummary ? calcSummary.gst : Math.round(subtotal - (subtotal / 1.05))}
                  </span>
                </div>
                
                {/* Grand Total */}
                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-baseline justify-between gap-1">
                  <div>
                    <span className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wider block">
                      Grand Total
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#1F2937]">
                      ₹{calcSummary ? calcSummary.grandTotal : grandTotal}
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    (Includes Shipping & GST)
                  </span>
                </div>
              </div>

              {/* Active Checkout Session & Stock Reservation Banner */}
              {activeCheckoutSession && activeCheckoutSession.reservationExpiresAt > now && (
                <div className="bg-[#F7FCE8] border border-[#ECF9CA] rounded-2xl p-3.5 space-y-2.5 animate-in fade-in duration-300 text-left shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${
                        Math.floor((activeCheckoutSession.reservationExpiresAt - now) / 1000) <= 120 ? 'text-amber-500 animate-pulse' : 'text-[#95CD1A]'
                      }`} />
                      <span className="text-xs font-black text-[#1F2937]">
                        Items reserved for Order #{activeCheckoutSession.orderRefCode}
                      </span>
                    </div>
                    {renderReservationTimer(activeCheckoutSession.reservationExpiresAt)}
                  </div>

                  <p className="text-xs text-[#4A7C34] font-medium leading-snug">
                    Complete payment before the timer expires to guarantee stock availability of these items.
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleRetryPayment(activeCheckoutSession)}
                      disabled={isProcessing}
                      className="flex-1 py-2 px-3 bg-[#95CD1A] hover:bg-[#7EB30E] disabled:bg-gray-400 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>{isProcessing ? 'Opening Payment...' : 'Resume Payment Now'}</span>
                    </button>

                    <button
                      onClick={() => handleCancelOrder(activeCheckoutSession.wcOrderId)}
                      disabled={isProcessing}
                      className="py-2 px-3 bg-white hover:bg-gray-50 border border-gray-200 hover:border-gray-300 text-gray-600 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Neutral Payment Status / Info Notice Banner */}
              {checkoutInfoMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-emerald-800 font-medium animate-in fade-in duration-200 text-left">
                  <CheckCircle2 className="w-4 h-4 text-[#95CD1A] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-[#2D5A1E]">Payment Status Notice</p>
                    <p className="leading-relaxed text-[#4A7C34]">{checkoutInfoMsg}</p>
                  </div>
                </div>
              )}

              {checkoutError && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs font-extrabold text-red-600 text-center animate-in fade-in duration-200">
                  {checkoutError}
                </div>
              )}

              {/* Action Buttons based on checkoutStep */}
              {checkoutStep === 'cart' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (items.length > 0) {
                        setCheckoutStep('shipping');
                        if (scrollableBodyRef.current) {
                          scrollableBodyRef.current.scrollTop = 0;
                        }
                      }
                    }}
                    className="w-full py-3.5 px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm sm:text-base rounded-2xl transition-all duration-300 shadow-xl shadow-[#95CD1A]/30 hover:shadow-2xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Shipping & Details</span>
                    <ArrowRight className="w-4.5 h-4.5" />
                  </button>

                  <button
                    onClick={onClearCart}
                    className="w-full py-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-center"
                  >
                    Clear Entire Cart
                  </button>
                </>
              ) : (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleOrderNow}
                    disabled={isProcessing}
                    className="w-full py-3.5 px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm sm:text-base rounded-2xl transition-all duration-300 shadow-xl shadow-[#95CD1A]/30 hover:shadow-2xl flex items-center justify-center gap-2.5 cursor-pointer text-center disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <ShoppingBag className="w-5 h-5 text-white shrink-0" />
                    )}
                    <span>{isProcessing ? 'Processing Order...' : 'Pay & Place Order'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCheckoutStep('cart');
                      if (scrollableBodyRef.current) {
                        scrollableBodyRef.current.scrollTop = 0;
                      }
                    }}
                    className="w-full py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    <span>← Back to Cart Details</span>
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      </div>

      {/* Checkout Email Verification Code Popup */}
      {showOtpPopup && (
        <div className="fixed inset-0 z-50 overflow-hidden text-[#1F2937] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowOtpPopup(false)}
          />

          <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 z-10 overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setShowOtpPopup(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center mx-auto mb-2.5 shadow-xs border border-[#ECF9CA]">
                <Mail className="w-5 h-5" />
              </div>
              <h4 className="font-extrabold text-lg text-[#1F2937]">Verify Email Code</h4>
              <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                We sent a 6-digit order verification code to <strong className="text-gray-800">{email}</strong>. Please enter it below.
              </p>
            </div>

            {otpError && (
              <div className="mb-3.5 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-1.5 text-[11px] text-red-600 font-semibold animate-in slide-in-from-top-1">
                <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyCheckoutOtp} className="space-y-4">
              <div>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full py-2.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#95CD1A] focus:bg-white focus:outline-none font-black tracking-[8px] text-center text-lg font-numeric"
                />
              </div>

              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={otpLoading}
                  className="w-full py-3 px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {otpLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Confirm & Pay Order</span>
                  )}
                </button>

                <div className="flex items-center justify-between text-[11px] font-extrabold pt-1">
                  <button
                    type="button"
                    onClick={() => setShowOtpPopup(false)}
                    className="text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={resendTimer > 0 || otpLoading}
                    onClick={() => triggerCheckoutOtp()}
                    className="text-[#95CD1A] hover:underline disabled:text-gray-400 disabled:no-underline cursor-pointer"
                  >
                    {resendTimer > 0 ? `Resend (${resendTimer}s)` : 'Resend Code'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
