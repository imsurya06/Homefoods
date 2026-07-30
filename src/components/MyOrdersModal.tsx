import React, { useState, useEffect } from 'react';
import { X, Search, PackageCheck, Truck, CheckCircle2, Clock, AlertCircle, ShoppingBag, Utensils, ArrowRight, User } from 'lucide-react';
import { fetchCustomerOrders, type CustomerOrderHistoryItem, type UserProfile } from '../services/authService';
import { fetchApi } from '../services/apiClient';

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onOpenAuthModal: () => void;
  onExploreShop?: () => void;
}

export const MyOrdersModal: React.FC<MyOrdersModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenAuthModal,
  onExploreShop,
}) => {
  const [orders, setOrders] = useState<CustomerOrderHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [guestOrderInput, setGuestOrderInput] = useState<string>('');
  const [guestResult, setGuestResult] = useState<any | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);

      let localOrders: CustomerOrderHistoryItem[] = [];
      try {
        const saved = localStorage.getItem('hf_local_orders');
        localOrders = saved ? JSON.parse(saved) : [];
      } catch {}

      fetchCustomerOrders()
        .then((remoteOrders) => {
          const remoteMap = new Map(remoteOrders.map((o) => [o.id.toString(), o]));
          const merged: CustomerOrderHistoryItem[] = [...remoteOrders];

          // Append any local-only orders that have not synced to WooCommerce yet
          localOrders.forEach((lo) => {
            if (!remoteMap.has(lo.id.toString())) {
              merged.push(lo);
            }
          });

          setOrders(merged);
        })
        .catch(() => setOrders(localOrders))
        .finally(() => setLoading(false));
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleGuestTrackSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError(null);

    const cleanId = guestOrderInput.replace('#', '').trim();
    if (!cleanId) {
      setGuestError('Please enter a valid Order ID (e.g. 97)');
      return;
    }

    setGuestLoading(true);
    try {
      const res = await fetchApi<{ success: boolean; data: any }>(`/checkout/track/${cleanId}`);
      if (res.success && res.data) {
        setGuestResult(res.data);
      } else {
        setGuestError('Order not found. Please check your Order ID.');
      }
    } catch (err: any) {
      setGuestError(err.message || 'Order not found. Please verify your Order ID.');
      setGuestResult(null);
    } finally {
      setGuestLoading(false);
    }
  };

  const getStageStatus = (stageNum: number, currentStage: number) => {
    if (currentStage === 0) return 'cancelled';
    if (currentStage > stageNum) return 'completed';
    if (currentStage === stageNum) return 'active';
    return 'pending';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-[#1F2937] flex items-center justify-center p-4">
      {/* Dark Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Main Card */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-8 z-10 overflow-hidden border border-gray-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 text-left">
        
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Modal Title Header */}
        <div className="mb-6">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#95CD1A] block mb-1">
            {user ? `Customer Portal • ${user.displayName}` : 'Order Tracking Portal'}
          </span>
          <h3 className="font-serif-headline text-2xl sm:text-3xl font-extrabold text-[#1F2937]">
            {user ? 'My Order History' : 'Track Your Order'}
          </h3>
        </div>

        {/* View A: Logged-In User Orders History View */}
        {user ? (
          <div>
            {loading ? (
              <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-3 border-[#95CD1A] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-gray-500">Fetching your order history...</span>
              </div>
            ) : orders.length === 0 ? (
              /* Warm Empty State when 0 orders placed */
              <div className="py-12 text-center space-y-4 bg-gray-50 rounded-2xl p-6 border border-gray-200/80">
                <div className="w-16 h-16 rounded-full bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center mx-auto shadow-xs">
                  <Utensils className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-extrabold text-[#1F2937]">
                    Let's taste our traditional delicacies!
                  </h4>
                  <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    You haven't placed any orders yet. Explore our handcrafted South Indian podis, thokkus, and malts.
                  </p>
                </div>
                {onExploreShop && (
                  <button
                    onClick={() => {
                      onClose();
                      onExploreShop();
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4 text-white" />
                    <span>Explore Storefront Menu</span>
                    <ArrowRight className="w-4 h-4 text-white stroke-[3]" />
                  </button>
                )}
              </div>
            ) : (
              /* Render Orders List Cards */
              <div className="space-y-4">
                {orders.map((ord) => (
                  <div key={ord.id} className="bg-gray-50/90 rounded-2xl p-4 sm:p-5 border border-gray-200/80 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-200/80">
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Order ID</span>
                        <span className="text-base font-black text-[#1F2937]">#{ord.id}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">Total</span>
                        <span className="text-base font-black text-[#95CD1A]">₹{ord.total}</span>
                      </div>
                      <span className="text-xs font-extrabold bg-white px-3 py-1 rounded-full border border-gray-200 text-gray-700">
                        {ord.statusLabel || ord.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="grid grid-cols-4 gap-2 text-center py-1">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                          getStageStatus(1, ord.stage) === 'completed' || getStageStatus(1, ord.stage) === 'active'
                            ? 'bg-[#95CD1A] text-white shadow-xs'
                            : 'bg-gray-200 text-gray-400'
                        }`}>
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-700">Confirmed</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                          getStageStatus(2, ord.stage) === 'completed' || getStageStatus(2, ord.stage) === 'active'
                            ? 'bg-[#95CD1A] text-white shadow-xs'
                            : 'bg-gray-200 text-gray-400'
                        }`}>
                          <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-700">Kitchen</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                          getStageStatus(3, ord.stage) === 'completed' || getStageStatus(3, ord.stage) === 'active'
                            ? 'bg-[#95CD1A] text-white shadow-xs'
                            : 'bg-gray-200 text-gray-400'
                        }`}>
                          <Truck className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-700">Dispatched</span>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                          getStageStatus(4, ord.stage) === 'completed'
                            ? 'bg-[#95CD1A] text-white shadow-xs'
                            : 'bg-gray-200 text-gray-400'
                        }`}>
                          <PackageCheck className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-gray-700">Delivered</span>
                      </div>
                    </div>

                    {/* Purchased Items */}
                    <div className="bg-white p-3 rounded-xl border border-gray-200 text-xs font-bold divide-y divide-gray-100">
                      {ord.items?.map((it, idx) => (
                        <div key={idx} className="py-1.5 flex items-center justify-between text-gray-800">
                          <span>{it.name}</span>
                          <span className="text-gray-400">x{it.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* View B: Guest Order Lookup Form */
          <div className="space-y-6">
            <div className="p-4 bg-lime-50/60 rounded-2xl border border-lime-200/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-[#95CD1A]" />
                <span className="text-xs font-bold text-gray-700">Have an account? Login to view all past orders</span>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenAuthModal();
                }}
                className="px-3.5 py-1.5 bg-[#95CD1A] hover:bg-[#7EB30E] text-white text-xs font-extrabold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                Login Now
              </button>
            </div>

            <form onSubmit={handleGuestTrackSearch}>
              <label className="block text-xs font-extrabold text-gray-700 mb-1">
                Guest Order Lookup (Order ID):
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="e.g. 97 or #97"
                  value={guestOrderInput}
                  onChange={(e) => setGuestOrderInput(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm font-extrabold py-3.5 pl-4 pr-28 rounded-2xl focus:outline-none focus:border-[#95CD1A] focus:ring-2 focus:ring-[#95CD1A]/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={guestLoading}
                  className="absolute right-2 px-4 py-2 bg-[#95CD1A] hover:bg-[#7EB30E] text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {guestLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Track</span>
                    </>
                  )}
                </button>
              </div>

              {guestError && (
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{guestError}</span>
                </div>
              )}
            </form>

            {guestResult && (
              <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200/90 space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <span className="text-sm font-black text-[#1F2937]">Order #{guestResult.orderId}</span>
                  <span className="text-sm font-black text-[#95CD1A]">₹{guestResult.total}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                      getStageStatus(1, guestResult.stage) === 'completed' || getStageStatus(1, guestResult.stage) === 'active'
                        ? 'bg-[#95CD1A] text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700">Confirmed</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                      getStageStatus(2, guestResult.stage) === 'completed' || getStageStatus(2, guestResult.stage) === 'active'
                        ? 'bg-[#95CD1A] text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700">Kitchen</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                      getStageStatus(3, guestResult.stage) === 'completed' || getStageStatus(3, guestResult.stage) === 'active'
                        ? 'bg-[#95CD1A] text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      <Truck className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700">Dispatched</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-1 ${
                      getStageStatus(4, guestResult.stage) === 'completed'
                        ? 'bg-[#95CD1A] text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      <PackageCheck className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-gray-700">Delivered</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-gray-200 text-xs font-bold divide-y divide-gray-100">
                  {guestResult.items?.map((it: any, idx: number) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between text-gray-800">
                      <span>{it.name}</span>
                      <span className="text-gray-400">x{it.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
