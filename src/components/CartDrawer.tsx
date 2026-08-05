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
} from 'lucide-react';
import { type CartItem } from '../data/bestsellers';
import { processRazorpayCheckout, type CheckoutPayload, trackSingleOrder, cancelInventoryReservation } from '../services/checkoutService';
import { fetchCustomerOrders, type CustomerOrderHistoryItem, type UserProfile } from '../services/authService';
import { getCachedProductsSync } from '../services/productService';
import { validateCart } from '../services/cartService';
import { bootstrapSync } from '../services/syncManager';

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
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

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
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{ wcOrderId: number; paymentId: string; orderRefCode?: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Coupon and Real-time Pricing Validation States
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponStatus, setCouponStatus] = useState<{ success: boolean; message: string; discount?: number } | null>(null);
  const [calcSummary, setCalcSummary] = useState<any>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Active Inventory Reservation States
  const [activeReservationOrderId, setActiveReservationOrderId] = useState<number | null>(null);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Orders Tab State
  const [orders, setOrders] = useState<CustomerOrderHistoryItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | number | null>(null);

  // Guest Order Tracking Search State
  const [guestSearchInput, setGuestSearchInput] = useState<string>('');
  const [guestSearchResult, setGuestSearchResult] = useState<any | null>(null);
  const [guestSearchError, setGuestSearchError] = useState<string | null>(null);
  const [guestSearchLoading, setGuestSearchLoading] = useState<boolean>(false);

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

  // 1. Countdown timer effect for inventory reservations
  useEffect(() => {
    if (!reservationExpiresAt || !activeReservationOrderId) return;

    const interval = setInterval(async () => {
      const remaining = Math.max(0, Math.round((reservationExpiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        console.log('[Inventory Reservation] Reservation expired. Releasing stock...');
        const orderIdToCancel = activeReservationOrderId;
        setActiveReservationOrderId(null);
        setReservationExpiresAt(null);
        setIsProcessing(false);
        setCheckoutError('Your 10-minute stock reservation expired. The items have been released.');
        
        try {
          await cancelInventoryReservation(orderIdToCancel);
        } catch (err) {
          console.warn('Failed to release expired reservation:', err);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservationExpiresAt, activeReservationOrderId]);

  // 2. Cleanup reservation on drawer close (abandoned checkout)
  useEffect(() => {
    if (!isOpen && activeReservationOrderId) {
      console.log('[Inventory Reservation] Drawer closed. Releasing active reservation...');
      const orderIdToCancel = activeReservationOrderId;
      setActiveReservationOrderId(null);
      setReservationExpiresAt(null);
      
      cancelInventoryReservation(orderIdToCancel).catch((err) => {
        console.warn('Failed to release reservation on drawer close:', err);
      });
    }
  }, [isOpen, activeReservationOrderId]);

  // Run server-side validation dynamically when items, pincode, or coupon changes
  useEffect(() => {
    if (items.length === 0) {
      setCalcSummary(null);
      return;
    }

    const runValidation = async () => {
      setIsValidating(true);
      try {
        const activePincode = pincode.trim().length === 6 ? pincode.trim() : '625001';
        const activeCoupon = couponStatus?.success ? couponCode.trim() : undefined;
        const summary = await validateCart(items, activePincode, activeCoupon);
        setCalcSummary(summary);
      } catch (err) {
        console.warn('Failed to validate cart on server:', err);
      } finally {
        setIsValidating(false);
      }
    };

    const timer = setTimeout(runValidation, 500);
    return () => clearTimeout(timer);
  }, [items, pincode, couponStatus]);

  // Auto-search guest order if id parameter is present in URL hash
  useEffect(() => {
    if (isOpen && activeTab === 'orders') {
      const hash = window.location.hash;
      if (hash.includes('?id=')) {
        const urlParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
        const idParam = urlParams.get('id');
        if (idParam) {
          const decoded = decodeURIComponent(idParam);
          setGuestSearchInput(decoded);
          
          setGuestSearchLoading(true);
          setGuestSearchError(null);
          trackSingleOrder(decoded.trim().replace(/^#/, ''))
            .then((data) => {
              if (data && data.orderId && !data.notFound) {
                setGuestSearchResult(data);
                setExpandedOrderId(data.orderId);
              } else {
                setGuestSearchError(data?.message || 'Order not found. Check ID.');
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

  // Prevent background page from scrolling while drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      hasFetchedOrdersOnce.current = false;
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

        // Only show spinner once on initial load if orders have never been fetched yet
        if (isInitial && !hasFetchedOrdersOnce.current && orders.length === 0) {
          setLoadingOrders(true);
        }

        fetchCustomerOrders()
          .then((remoteOrders) => {
            if (Array.isArray(remoteOrders)) {
              const activeOrders = remoteOrders.filter((o) => o.status !== 'trash');
              setOrders(activeOrders);
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

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isOpen, activeTab, user]);

  if (!isOpen) return null;

  const SHIPPING_FEE = 40;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
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
          message: 'Invalid, expired, or inapplicable coupon code.'
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

  const handleOrderNow = async () => {
    setCheckoutError(null);
    setFieldErrors({});

    if (items.length === 0) {
      setCheckoutError('Your cart is empty');
      return;
    }

    const errors: Record<string, string> = {};
    if (!customerName.trim()) {
      errors.customerName = 'Full name is required';
    }
    if (!mobileNumber.trim() || mobileNumber.trim().length < 10) {
      errors.mobileNumber = 'Valid 10-digit mobile number required';
    }
    if (!email.trim() || !email.includes('@')) {
      errors.email = 'Valid email address required';
    }
    if (!shippingAddress.trim()) {
      errors.shippingAddress = 'Shipping address is required';
    }
    if (!city.trim()) {
      errors.city = 'City is required';
    }
    if (!pincode.trim() || pincode.trim().length < 6) {
      errors.pincode = 'Valid 6-digit pincode required';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Check pincode delivery availability before creating order
    if (calcSummary && calcSummary.delivery && !calcSummary.delivery.deliveryAvailable) {
      setCheckoutError(`We cannot deliver to pincode ${pincode}: ${calcSummary.delivery.message || 'Location unserviceable.'}`);
      return;
    }

    setIsProcessing(true);

    const payload: CheckoutPayload = {
      customerDetails: {
        name: customerName.trim(),
        email: email.trim(),
        phone: mobileNumber.trim(),
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

    await processRazorpayCheckout(
      payload,
      (response) => {
        setIsProcessing(false);
        setActiveReservationOrderId(null);
        setReservationExpiresAt(null);
        setOrderSuccess(response);
        onClearCart();
        setCouponCode('');
        setCouponStatus(null);
        setActiveTab('orders');
        if (response && response.wcOrderId) {
          setExpandedOrderId(response.wcOrderId);
        }
      },
      async (errorMsg, isOutOfSync) => {
        setIsProcessing(false);
        if (isOutOfSync) {
          setCheckoutError('Your shopping cart was modified on another device. We have refreshed it. Please review and try again.');
          await bootstrapSync();
        } else {
          setCheckoutError(errorMsg);
        }
      },
      (wcOrderId, expiresAt) => {
        setActiveReservationOrderId(wcOrderId);
        setReservationExpiresAt(expiresAt);
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
    <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
      {/* Darkened Semi-Transparent Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-full sm:w-screen max-w-full sm:max-w-md bg-white shadow-2xl flex flex-col justify-between transform transition-transform duration-300">
          
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
                onClick={() => setActiveTab('cart')}
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
                onClick={() => setActiveTab('orders')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-white text-[#95CD1A] shadow-md border border-gray-100'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Package className="w-4 h-4" />
                <span>Your Orders</span>
                {orders.length > 0 && (
                  <span className="bg-[#1F2937] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-4.5 text-center">
                    {orders.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: SHOPPING CART CONTENT */}
          {activeTab === 'cart' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {orderSuccess ? (
                /* Order Placed Success Confirmation View */
                <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-[#F7FCE8] text-[#95CD1A] rounded-full flex items-center justify-center mx-auto border-2 border-[#ECF9CA] shadow-md">
                    <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[#95CD1A]">
                      Payment Successful!
                    </span>
                    <h3 className="text-2xl font-black text-[#1F2937]">
                      Order #{(orderSuccess as any).orderRefCode || `HF-${orderSuccess.wcOrderId}`} Confirmed
                    </h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">
                      Thank you! Your delicious South Indian delicacies are now being prepared in our kitchen.
                    </p>
                  </div>

                  <div className="bg-[#FAFBF6] p-4 rounded-2xl border border-[#ECF9CA] text-left text-xs space-y-2 font-medium">
                    <div className="flex justify-between border-b border-gray-200/60 pb-2">
                      <span className="text-gray-500">Order Reference:</span>
                      <span className="font-extrabold text-[#95CD1A]">#{(orderSuccess as any).orderRefCode || `HF-${orderSuccess.wcOrderId}`}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200/60 pb-2">
                      <span className="text-gray-500">Razorpay Payment ID:</span>
                      <span className="font-mono font-bold text-gray-700 truncate max-w-[180px]">{orderSuccess.paymentId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Live Status:</span>
                      <span className="font-bold text-[#95CD1A] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Kitchen Preparation
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      onClick={() => {
                        setExpandedOrderId(orderSuccess.wcOrderId);
                        setActiveTab('orders');
                      }}
                      className="w-full py-3.5 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Package className="w-4 h-4" />
                      <span>Track Order Status Live →</span>
                    </button>

                    <button
                      onClick={() => {
                        setOrderSuccess(null);
                        onClose();
                        if (onExploreShop) onExploreShop();
                      }}
                      className="w-full py-2.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                    >
                      Continue Shopping
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
                /* Cart Items List & Delivery Form */
                <>
                  {/* Cart Items List */}
                  <div className="space-y-3">
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

                  {/* Customer Shipping & Contact Details Form */}
                  <div className="pt-2 space-y-3">
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

                    <div className="bg-gray-50/80 p-3.5 rounded-2xl border border-gray-200/80 space-y-3 text-left">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (fieldErrors.customerName) setFieldErrors((prev) => ({ ...prev, customerName: '' }));
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
                              value={mobileNumber}
                              onChange={(e) => {
                                setMobileNumber(e.target.value);
                                if (fieldErrors.mobileNumber) setFieldErrors((prev) => ({ ...prev, mobileNumber: '' }));
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
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }));
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
                          onChange={(e) => {
                            setShippingAddress(e.target.value);
                            if (fieldErrors.shippingAddress) setFieldErrors((prev) => ({ ...prev, shippingAddress: '' }));
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
                            onChange={(e) => {
                              setCity(e.target.value);
                              if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: '' }));
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
                            value={pincode}
                            onChange={(e) => {
                              setPincode(e.target.value);
                              if (fieldErrors.pincode) setFieldErrors((prev) => ({ ...prev, pincode: '' }));
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

              {/* Orders List Container */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-extrabold text-gray-400 uppercase tracking-wider">
                  <span>Your Order History ({orders.length})</span>
                </div>

                {loadingOrders && orders.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-[#95CD1A] border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-gray-400 font-bold">Loading your orders...</p>
                  </div>
                ) : orders.length === 0 && !guestSearchResult ? (
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
                  <div className="space-y-3.5">
                    {(() => {
                      const displayList = [...orders];
                      if (guestSearchResult) {
                        const guestOrderObj = {
                          id: guestSearchResult.orderId || guestSearchResult.id,
                          orderRefCode: guestSearchResult.orderRefCode,
                          status: guestSearchResult.status,
                          statusLabel: guestSearchResult.statusLabel,
                          stage: guestSearchResult.stage,
                          total: guestSearchResult.total,
                          currency: guestSearchResult.currency || '₹',
                          dateCreated: guestSearchResult.dateCreated,
                          items: guestSearchResult.items || [],
                          shippingAddress: guestSearchResult.shippingAddress || '',
                        };
                        if (!displayList.some(o => o.id.toString() === guestOrderObj.id.toString())) {
                          displayList.unshift(guestOrderObj);
                        }
                      }
                      return displayList.map((ord) => {
                        const isExpanded = expandedOrderId === ord.id || expandedOrderId?.toString() === ord.id.toString();

                        // Compute food names summary
                        const foodNamesSummary = ord.items && ord.items.length > 0
                          ? ord.items.map((i: any) => `${i.name}${i.quantity > 1 ? ` (${i.quantity}x)` : ''}`).join(', ')
                          : 'Homemade South Indian Food Delicacies';

                        // Status Stage & Label Calculation
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

                        const stageLabel = ord.statusLabel || (stage === 3 ? 'Dispatched' : stage === 4 ? 'Delivered' : stage === 2 ? 'Kitchen' : 'Confirmed');

                        return (
                          <div
                            key={ord.id}
                            className={`rounded-2xl border transition-all overflow-hidden ${
                              isExpanded
                                ? 'border-[#95CD1A] bg-white shadow-md'
                                : 'border-gray-200 hover:border-[#95CD1A]/50 bg-white'
                            }`}
                          >
                            {/* Order Summary Header Card (Always Visible) */}
                            <div className="p-4 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-[#1F2937] font-numeric">
                                      Order #{ord.orderRefCode || `HF-${ord.id}`}
                                    </span>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#F7FCE8] text-[#95CD1A] border border-[#ECF9CA]">
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

                              {/* Prominent Food Item Name Display */}
                              <div className="pt-2 border-t border-gray-100 flex items-start gap-2">
                                <span className="text-xs font-bold text-[#95CD1A] shrink-0">Items:</span>
                                <span className="text-xs font-extrabold text-[#1F2937] line-clamp-2 leading-snug">
                                  {foodNamesSummary}
                                </span>
                              </div>

                              {/* Dropdown Toggle Button */}
                              <button
                                onClick={() => toggleAccordion(ord.id)}
                                className="w-full pt-2 flex items-center justify-between text-xs font-extrabold text-[#95CD1A] hover:text-[#7EB30E] transition-colors cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide Tracking Details' : 'View Tracking Details & Items'}</span>
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>

                            {/* Accordion Expanded Tracking Details */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-3 bg-[#FAFBF6] border-t border-gray-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                
                                {/* 4-Step Visual Tracking Stepper */}
                                <div className="space-y-2">
                                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 block">
                                    Live Delivery Progress
                                  </span>

                                  <div className="grid grid-cols-4 gap-1 relative text-center pt-2">
                                    {/* Progress Line */}
                                    <div className="absolute top-5 left-[12%] right-[12%] h-1 bg-gray-200 -z-0">
                                      <div
                                        className="h-full bg-[#95CD1A] transition-all duration-500"
                                        style={{ width: `${Math.max(0, Math.min(100, ((stage - 1) / 3) * 100))}%` }}
                                      />
                                    </div>

                                    {/* Step 1: Confirmed */}
                                    <div className="flex flex-col items-center gap-1 relative z-10">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                        stage >= 1 ? 'bg-[#95CD1A] text-white shadow-md' : 'bg-gray-200 text-gray-500'
                                      }`}>
                                        <CheckCircle2 className="w-4 h-4" />
                                      </div>
                                      <span className="text-[9px] font-extrabold text-gray-700 leading-tight">Confirmed</span>
                                    </div>

                                    {/* Step 2: Kitchen */}
                                    <div className="flex flex-col items-center gap-1 relative z-10">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                        stage >= 2 ? 'bg-[#95CD1A] text-white shadow-md' : 'bg-gray-200 text-gray-500'
                                      }`}>
                                        <Clock className="w-4 h-4" />
                                      </div>
                                      <span className="text-[9px] font-extrabold text-gray-700 leading-tight">Kitchen</span>
                                    </div>

                                    {/* Step 3: Dispatched */}
                                    <div className="flex flex-col items-center gap-1 relative z-10">
                                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                        stage >= 3 ? 'bg-[#95CD1A] text-white shadow-md' : 'bg-gray-200 text-gray-500'
                                      }`}>
                                        <Truck className="w-4 h-4" />
                                      </div>
                                      <span className="text-[9px] font-extrabold text-gray-700 leading-tight">Dispatched</span>
                                    </div>

                                    {/* Step 4: Delivered */}
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

                                {/* Items Breakdown List */}
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

                                {/* Shipping Address */}
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
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cart Footer & Checkout Panel (Only Visible in Shopping Cart Tab) */}
          {activeTab === 'cart' && items.length > 0 && !orderSuccess && (
            <div className="p-4 sm:p-6 bg-white border-t border-gray-200 space-y-4 shadow-lg shrink-0">
              
              {/* Coupon Promo Code Input */}
              <div className="pb-3 border-b border-gray-100 space-y-2 text-left">
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

              <div className={`space-y-2 transition-opacity duration-200 ${isValidating ? 'opacity-65' : ''}`}>
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span>Subtotal ({totalQuantity} items)</span>
                  <span>₹{calcSummary ? calcSummary.subtotal : subtotal}</span>
                </div>
                {calcSummary?.discountAmount > 0 && (
                  <div className="flex items-center justify-between text-xs text-green-600 font-extrabold animate-in slide-in-from-top-1">
                    <span>Coupon Discount</span>
                    <span>-₹{calcSummary.discountAmount}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
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
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span>GST (5%)</span>
                  <span className="text-[#1F2937] font-extrabold">
                    ₹{calcSummary ? calcSummary.gst : Math.round(subtotal * 0.05)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex flex-wrap items-baseline justify-between gap-1">
                  <div>
                    <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider block">
                      Grand Total
                    </span>
                    <span className="text-2xl font-black text-[#1F2937]">
                      ₹{calcSummary ? calcSummary.grandTotal : grandTotal}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-semibold">
                    (Includes Shipping & GST)
                  </span>
                </div>
              </div>

              {activeReservationOrderId && timeLeft > 0 && (
                <div className="bg-[#FAFBF6] border border-[#ECF9CA] rounded-xl p-3 flex items-center justify-between animate-in fade-in duration-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#95CD1A] animate-pulse" />
                    <span className="text-[11px] font-extrabold text-gray-700">
                      Stock temporarily reserved for checkout
                    </span>
                  </div>
                  <span className="text-xs font-black text-[#95CD1A] font-mono bg-white border border-[#95CD1A]/20 px-2 py-0.5 rounded-md">
                    {Math.floor(timeLeft / 60)}:{((timeLeft % 60) < 10 ? '0' : '') + (timeLeft % 60)}
                  </span>
                </div>
              )}

              {checkoutError && (
                <p className="text-xs text-red-500 font-extrabold text-center">{checkoutError}</p>
              )}

              {/* Order Now CTA */}
              <button
                type="button"
                onClick={handleOrderNow}
                disabled={isProcessing}
                className="w-full py-4 px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm sm:text-base rounded-2xl transition-all duration-300 shadow-xl shadow-[#95CD1A]/30 hover:shadow-2xl transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2.5 cursor-pointer text-center disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <ShoppingBag className="w-5 h-5 text-white shrink-0" />
                )}
                <span>{isProcessing ? 'Processing Order...' : 'Order Now'}</span>
              </button>

              <button
                onClick={onClearCart}
                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors cursor-pointer text-center"
              >
                Clear Entire Cart
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
