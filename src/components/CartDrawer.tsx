import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Trash2, Plus, Minus, ArrowRight, MapPin, Phone, Mail, CheckCircle2 } from 'lucide-react';
import { type CartItem } from '../data/bestsellers';
import { processRazorpayCheckout, type CheckoutPayload } from '../services/checkoutService';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, newQty: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onExploreShop?: () => void;
  onOpenAuthModal?: () => void;
  isLoggedIn?: boolean;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onExploreShop,
  onOpenAuthModal,
  isLoggedIn = false,
}) => {
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
  const [orderSuccess, setOrderSuccess] = useState<{ wcOrderId: number; paymentId: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Prevent background page from scrolling while drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const SHIPPING_FEE = 40;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
  const grandTotal = subtotal > 0 ? subtotal + SHIPPING_FEE : 0;

  const handleOrderNow = async () => {
    setCheckoutError(null);
    setFieldErrors({});

    if (items.length === 0) {
      setCheckoutError('Your cart is empty');
      return;
    }

    const errors: Record<string, string> = {};

    // Enforce Mandatory Form Field Validation with Per-Field Error States
    if (!customerName.trim()) {
      errors.customerName = 'Full Name is required';
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
    };

    await processRazorpayCheckout(
      payload,
      (response) => {
        setIsProcessing(false);
        setOrderSuccess(response);
        onClearCart();
      },
      (errorMsg) => {
        setIsProcessing(false);
        setCheckoutError(errorMsg);
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-[#1F2937]">
      {/* Dark Blurred Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300 cursor-pointer"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 h-full">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">
          
          {/* Cart Header */}
          <div className="px-6 py-5 bg-[#F7FCE8] border-b border-gray-200/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#95CD1A] text-white rounded-xl shadow-xs">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-[#1F2937] leading-tight">
                  Your Order Cart
                </h2>
                <span className="text-xs font-bold text-gray-600">
                  {orderSuccess ? 'Order Placed' : `${totalQuantity} ${totalQuantity === 1 ? 'item' : 'items'} selected`}
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-white/80 transition-colors cursor-pointer"
              aria-label="Close cart"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Cart Items & Shipping Details Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
            
            {/* Order Success View */}
            {orderSuccess ? (
              <div className="py-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-extrabold text-[#1F2937]">
                    Order Placed Successfully!
                  </h3>
                  <p className="text-xs text-gray-500">
                    Thank you for your order. Order ID: <strong className="text-[#1F2937]">#{orderSuccess.wcOrderId}</strong>
                  </p>
                  <p className="text-[11px] text-gray-400 font-mono mt-1">
                    Payment ID: {orderSuccess.paymentId}
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => {
                      setOrderSuccess(null);
                      onClose();
                    }}
                    className="w-full py-3 bg-[#95CD1A] hover:bg-[#7EB30E] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                <div className="w-20 h-20 rounded-full bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-[#1F2937]">
                    Your Cart is Currently Empty
                  </h3>
                  <p className="text-xs text-gray-500 max-w-xs">
                    Explore our traditional homemade delicacies and add items to your order cart.
                  </p>
                </div>
                {onExploreShop && (
                  <button
                    onClick={() => {
                      onClose();
                      onExploreShop();
                    }}
                    className="mt-2 px-6 py-3 bg-[#95CD1A] hover:bg-[#7EB30E] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <span>Explore Storefront</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Items List */}
                <div className="space-y-3">
                  {items.map((item) => {
                    const itemTotal = item.pricePerUnit * item.quantity;
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 bg-gray-50/80 hover:bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center gap-3.5 transition-all text-left"
                      >
                        {/* Thumbnail */}
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-16 h-16 rounded-xl object-cover bg-gray-200 shrink-0 border border-gray-100"
                        />

                        {/* Item Details */}
                        <div className="flex flex-col justify-between grow min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-extrabold text-xs text-[#1F2937] truncate">
                              {item.name}
                            </h4>
                            <button
                              onClick={() => onRemoveItem(item.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                            <span className="bg-white px-2 py-0.5 rounded-md border border-gray-200 text-gray-700">
                              {item.weight}
                            </span>
                            <span className="font-extrabold text-[#1F2937]">
                              ₹{item.pricePerUnit} / unit
                            </span>
                          </div>

                          {/* Quantity Counter & Subtotal */}
                          <div className="pt-1 flex items-center justify-between">
                            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-0.5">
                              <button
                                onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                                className="p-1 hover:bg-gray-100 text-gray-700 rounded-md transition-colors cursor-pointer"
                                title="Decrease"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-xs font-black text-[#1F2937]">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                                className="p-1 hover:bg-gray-100 text-gray-700 rounded-md transition-colors cursor-pointer"
                                title="Increase"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <span className="text-sm font-black text-[#1F2937]">
                              ₹{itemTotal}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Delivery & Shipping Details Input Form */}
                <div className="pt-2">

                  {/* Have an Account? Login Banner */}
                  {!isLoggedIn && onOpenAuthModal && (
                    <div className="mb-3 p-3.5 bg-[#F7FCE8] border border-[#95CD1A]/40 rounded-2xl flex items-center justify-between gap-3 text-left">
                      <div>
                        <span className="text-xs font-black text-[#1F2937] block">Have an account?</span>
                        <span className="text-[11px] text-gray-500 font-medium leading-tight block">
                          Login to auto-fill saved address
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAuthModal();
                        }}
                        className="px-3 py-1.5 bg-[#95CD1A] hover:bg-[#7EB30E] text-white text-xs font-extrabold rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                      >
                        Continue with Account
                      </button>
                    </div>
                  )}

                  <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200/90 text-left space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#1F2937] uppercase tracking-wider">
                      <MapPin className="w-4 h-4 text-[#95CD1A]" />
                      <span>Delivery & Shipping Details</span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => {
                            setCustomerName(e.target.value);
                            if (fieldErrors.customerName) setFieldErrors(prev => ({ ...prev, customerName: '' }));
                          }}
                          placeholder="Enter your full name"
                          className={`w-full px-3 py-2 bg-white rounded-xl border ${
                            fieldErrors.customerName ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                          } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium transition-all`}
                        />
                        {fieldErrors.customerName && (
                          <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.customerName}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Mobile Number
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              value={mobileNumber}
                              onChange={(e) => {
                                setMobileNumber(e.target.value);
                                if (fieldErrors.mobileNumber) setFieldErrors(prev => ({ ...prev, mobileNumber: '' }));
                              }}
                              placeholder="+91 9876543210"
                              className={`w-full pl-8 pr-2 py-2 bg-white rounded-xl border ${
                                fieldErrors.mobileNumber ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                              } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium font-numeric transition-all`}
                            />
                            <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                          {fieldErrors.mobileNumber && (
                            <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.mobileNumber}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Email Address
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }));
                              }}
                              placeholder="name@email.com"
                              className={`w-full pl-8 pr-2 py-2 bg-white rounded-xl border ${
                                fieldErrors.email ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                              } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium transition-all`}
                            />
                            <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          </div>
                          {fieldErrors.email && (
                            <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.email}</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Shipping Address
                        </label>
                        <textarea
                          rows={2}
                          value={shippingAddress}
                          onChange={(e) => {
                            setShippingAddress(e.target.value);
                            if (fieldErrors.shippingAddress) setFieldErrors(prev => ({ ...prev, shippingAddress: '' }));
                          }}
                          placeholder="Door No, Street Name, Area"
                          className={`w-full px-3 py-2 bg-white rounded-xl border ${
                            fieldErrors.shippingAddress ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                          } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium resize-none transition-all`}
                        />
                        {fieldErrors.shippingAddress && (
                          <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.shippingAddress}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            City
                          </label>
                          <input
                            type="text"
                            value={city}
                            onChange={(e) => {
                              setCity(e.target.value);
                              if (fieldErrors.city) setFieldErrors(prev => ({ ...prev, city: '' }));
                            }}
                            placeholder="Madurai"
                            className={`w-full px-3 py-2 bg-white rounded-xl border ${
                              fieldErrors.city ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                            } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium transition-all`}
                          />
                          {fieldErrors.city && (
                            <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.city}</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Pincode
                          </label>
                          <input
                            type="text"
                            value={pincode}
                            onChange={(e) => {
                              setPincode(e.target.value);
                              if (fieldErrors.pincode) setFieldErrors(prev => ({ ...prev, pincode: '' }));
                            }}
                            placeholder="625001"
                            className={`w-full px-3 py-2 bg-white rounded-xl border ${
                              fieldErrors.pincode ? 'border-red-500 bg-red-50/30' : 'border-gray-200 focus:border-[#95CD1A]'
                            } focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium font-numeric transition-all`}
                          />
                          {fieldErrors.pincode && (
                            <p className="text-[10px] text-red-500 font-extrabold mt-0.5">{fieldErrors.pincode}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cart Footer & Checkout Panel */}
          {items.length > 0 && !orderSuccess && (
            <div className="p-6 bg-white border-t border-gray-200 space-y-4 shadow-lg shrink-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span>Subtotal ({totalQuantity} items)</span>
                  <span>₹{subtotal}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span>Delivery Charge</span>
                  <span className="text-[#1F2937] font-extrabold">₹{SHIPPING_FEE}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span>GST & Taxes</span>
                  <span className="text-[#95CD1A] font-extrabold">Included</span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider block">
                      Grand Total
                    </span>
                    <span className="text-2xl font-black text-[#1F2937]">
                      ₹{grandTotal}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 font-semibold">
                    (Includes ₹{SHIPPING_FEE} Shipping & GST)
                  </span>
                </div>
              </div>

              {checkoutError && (
                <p className="text-xs text-red-500 font-extrabold text-center">{checkoutError}</p>
              )}

              {/* Headless E-Commerce "Order Now" CTA */}
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
