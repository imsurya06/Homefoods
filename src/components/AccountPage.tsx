import React from 'react';
import { LogOut, Package, ShieldCheck, ArrowRight, ArrowLeft, ShoppingBag, Store, User, MapPin, KeyRound } from 'lucide-react';
import type { UserProfile } from '../services/authService';

interface AccountPageProps {
  user: UserProfile | null;
  onNavigateHome: () => void;
  onNavigateShop: () => void;
  onOpenAuthModal: () => void;
  onOpenOrders: () => void;
  onOpenCart?: () => void;
  onLogout: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  user,
  onNavigateHome,
  onNavigateShop,
  onOpenAuthModal,
  onOpenOrders,
  onOpenCart,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-gray-50/50 pb-28 md:pb-16 text-[#1F2937]">
      
      {/* Top Banner & Navigation Header */}
      <div className="bg-white border-b border-gray-200/80 shadow-2xs py-6 px-4 sm:px-6">
        <div className="max-w-xl mx-auto flex flex-col gap-4">
          
          {/* Breadcrumb & Back Button */}
          <div className="flex items-center justify-between">
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-[#95CD1A] transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Home</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
              <span onClick={onNavigateHome} className="hover:underline cursor-pointer">Home</span>
              <span>/</span>
              <span className="text-[#1F2937] font-bold">My Account</span>
            </div>
          </div>

        </div>
      </div>

      {/* Main Page Container */}
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {user ? (
          /* ================= LOGGED IN USER PAGE VIEW ================= */
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* 1 & 2: Top Round Profile Icon in Center + Username Details at Bottom */}
            <div className="bg-white rounded-3xl p-8 shadow-xs border border-gray-100 text-center flex flex-col items-center justify-center space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-gradient-to-b from-[#95CD1A]/10 to-transparent rounded-full blur-2xl pointer-events-none" />

              {/* Round Profile Icon in Center */}
              <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-tr from-[#7EB30E] to-[#95CD1A] text-white flex items-center justify-center font-black text-3xl sm:text-4xl uppercase shadow-xl shadow-[#95CD1A]/25 border-4 border-white shrink-0">
                {user.email.charAt(0)}
              </div>

              {/* Username Details at Bottom of Icon */}
              <div className="relative z-10 space-y-1">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <h2 className="font-serif-headline text-2xl sm:text-3xl font-black text-[#1F2937]">
                    {user.displayName || 'Valued Customer'}
                  </h2>
                  <span className="bg-[#95CD1A]/15 text-[#7EB30E] text-xs font-black px-3 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-gray-500 truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
            </div>

            {/* Ordered Action Cards: View Orders -> My Cart -> View Products -> Logout */}
            <div className="space-y-3">
              
              {/* 3. View Orders */}
              <button
                onClick={onOpenOrders}
                className="w-full p-4 rounded-2xl bg-white hover:bg-[#F7FCE8] border border-gray-200 hover:border-[#95CD1A] shadow-xs flex items-center justify-between transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <Package className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-base text-[#1F2937] block">View Orders</span>
                    <span className="text-xs text-gray-500 font-medium">Track active orders & view order history</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-[#95CD1A] group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* 4. My Cart */}
              {onOpenCart && (
                <button
                  onClick={onOpenCart}
                  className="w-full p-4 rounded-2xl bg-white hover:bg-emerald-50/50 border border-gray-200 hover:border-emerald-400 shadow-xs flex items-center justify-between transition-all cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                      <ShoppingBag className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <span className="font-extrabold text-base text-[#1F2937] block">My Cart</span>
                      <span className="text-xs text-gray-500 font-medium">Review selected items & proceed to checkout</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all shrink-0" />
                </button>
              )}

              {/* 5. View Products */}
              <button
                onClick={onNavigateShop}
                className="w-full p-4 rounded-2xl bg-white hover:bg-blue-50/50 border border-gray-200 hover:border-blue-400 shadow-xs flex items-center justify-between transition-all cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <Store className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-base text-[#1F2937] block">View Products</span>
                    <span className="text-xs text-gray-500 font-medium">Explore fresh traditional snacks & mixes</span>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0" />
              </button>

              {/* 6. Logout */}
              <button
                onClick={onLogout}
                className="w-full py-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-extrabold text-sm flex items-center justify-center gap-2 border border-red-200 transition-colors cursor-pointer mt-4 shadow-xs"
              >
                <LogOut className="w-4.5 h-4.5 text-red-500" />
                <span>Logout</span>
              </button>

            </div>
          </div>
        ) : (
          /* ================= GUEST / LOGGED OUT PAGE VIEW ================= */
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Guest Hero Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 text-center relative overflow-hidden">
              <div className="w-16 h-16 rounded-2xl bg-[#95CD1A] text-white flex items-center justify-center mx-auto shadow-lg shadow-[#95CD1A]/25 mb-4">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="font-serif-headline text-xl sm:text-2xl font-black text-[#1F2937]">
                Welcome to Homemade Foods!
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 font-medium max-w-md mx-auto mt-2 leading-relaxed">
                Sign in with your Email OTP to view your orders, save delivery addresses, and enjoy seamless 1-click checkouts.
              </p>

              {/* Primary Sign In Button */}
              <div className="mt-6 max-w-sm mx-auto">
                <button
                  onClick={onOpenAuthModal}
                  className="w-full py-4 px-6 rounded-2xl bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#95CD1A]/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
                >
                  <User className="w-5 h-5 text-white" />
                  <span>Sign In / Sign Up with Email OTP</span>
                  <ArrowRight className="w-5 h-5 text-white stroke-[3] ml-1" />
                </button>
              </div>
            </div>

            {/* Member Benefits Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-green-50 text-[#95CD1A] flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#1F2937]">
                  Live Order Tracking
                </h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  Track dispatch status, courier info, and order progress live.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#1F2937]">
                  Saved Shipping Addresses
                </h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  Save your address once and enjoy instant 1-click checkouts.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-sm text-[#1F2937]">
                  100% Passwordless Login
                </h3>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  No passwords to remember. Instant email OTP verification.
                </p>
              </div>

            </div>

            {/* Secondary Store CTA */}
            <div className="bg-[#F7FCE8] border border-[#ECF9CA] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-serif-headline text-lg font-black text-[#1F2937]">
                  Want to explore traditional food items first?
                </h3>
                <p className="text-xs text-gray-600 font-medium mt-1">
                  Browse our artisanal podis, masalas, thokkus, and authentic Madurai recipes.
                </p>
              </div>
              <button
                onClick={onNavigateShop}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#1F2937] hover:bg-black text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#95CD1A]" />
                <span>Explore Shop</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
