import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Trash2, Plus, Minus, PhoneCall, ArrowRight, MapPin, Phone } from 'lucide-react';
import { type CartItem, generateCartCheckoutWhatsAppUrl } from '../data/bestsellers';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, newQty: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onExploreShop?: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onExploreShop,
}) => {
  // Shipping & Contact Details State with LocalStorage persistence
  const [customerName, setCustomerName] = useState<string>(() => {
    try {
      return localStorage.getItem('hf_customer_name') || '';
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

  useEffect(() => {
    try {
      localStorage.setItem('hf_customer_name', customerName);
      localStorage.setItem('hf_mobile_number', mobileNumber);
      localStorage.setItem('hf_shipping_address', shippingAddress);
    } catch (err) {
      console.error('Failed to save shipping details to localStorage', err);
    }
  }, [customerName, mobileNumber, shippingAddress]);

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

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = items.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);

  const whatsappCheckoutUrl = generateCartCheckoutWhatsAppUrl(items, {
    customerName,
    phone: mobileNumber,
    address: shippingAddress,
  });

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
                  {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'} selected
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
            {items.length === 0 ? (
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
                          className="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0"
                        />

                        {/* Info & Quantity controls */}
                        <div className="grow space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs sm:text-sm font-extrabold text-[#1F2937] leading-snug line-clamp-1">
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

                          <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
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
                  <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200/90 text-left space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#1F2937] uppercase tracking-wider">
                      <MapPin className="w-4 h-4 text-[#95CD1A]" />
                      <span>Delivery & Shipping Details</span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Full Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Enter your full name"
                          className="w-full px-3 py-2 bg-white rounded-xl border border-gray-200 focus:border-[#95CD1A] focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Mobile Number
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            value={mobileNumber}
                            onChange={(e) => setMobileNumber(e.target.value)}
                            placeholder="e.g. +91 98765 43210"
                            className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-gray-200 focus:border-[#95CD1A] focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium font-numeric transition-all"
                          />
                          <Phone className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Shipping / Delivery Address
                        </label>
                        <textarea
                          rows={2}
                          value={shippingAddress}
                          onChange={(e) => setShippingAddress(e.target.value)}
                          placeholder="Door No, Street Name, Area, City, Pincode"
                          className="w-full px-3 py-2 bg-white rounded-xl border border-gray-200 focus:border-[#95CD1A] focus:ring-1 focus:ring-[#95CD1A] focus:outline-none text-gray-800 font-medium resize-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Cart Footer & Checkout Panel */}
          {items.length > 0 && (
            <div className="p-6 bg-white border-t border-gray-200 space-y-4 shadow-lg shrink-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-bold">
                  <span>Subtotal ({totalQuantity} items)</span>
                  <span>₹{grandTotal}</span>
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
                    (Includes GST)
                  </span>
                </div>
              </div>

              {/* Logic B WhatsApp Checkout CTA */}
              <a
                href={whatsappCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm sm:text-base rounded-2xl transition-all duration-300 shadow-xl shadow-[#95CD1A]/30 hover:shadow-2xl transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2.5 cursor-pointer text-center"
              >
                <PhoneCall className="w-5 h-5 text-white shrink-0" />
                <span>Send Order via WhatsApp</span>
              </a>

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
