import React from 'react';
import { User, LogOut, Package, MapPin, ShieldCheck, ArrowRight, KeyRound, ArrowLeft, ShoppingBag, MessageCircle } from 'lucide-react';
import type { UserProfile } from '../services/authService';

interface AccountPageProps {
  user: UserProfile | null;
  onNavigateHome: () => void;
  onNavigateShop: () => void;
  onOpenAuthModal: () => void;
  onOpenOrders: () => void;
  onLogout: () => void;
}

export const AccountPage: React.FC<AccountPageProps> = ({
  user,
  onNavigateHome,
  onNavigateShop,
  onOpenAuthModal,
  onOpenOrders,
  onLogout,
}) => {
  return (
    <div className="min-h-screen bg-gray-50/50 pb-24 md:pb-16 text-[#1F2937]">
      
      {/* Top Banner & Navigation Header */}
      <div className="bg-white border-b border-gray-200/80 shadow-2xs py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          
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

          {/* Page Headline */}
          <div>
            <h1 className="font-serif-headline text-2xl sm:text-3xl font-black text-[#1F2937]">
              {user ? 'My Account & Profile' : 'Account & Login'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
              {user ? 'Manage your order history, shipping details, and account preferences' : 'Sign in to access your order history, save addresses, and track deliveries live'}
            </p>
          </div>

        </div>
      </div>

      {/* Main Page Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {user ? (
          /* ================= LOGGED IN USER PAGE VIEW ================= */
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* User Profile Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#95CD1A]/10 to-transparent rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              
              <div className="flex items-center gap-5 relative z-10">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#7EB30E] to-[#95CD1A] text-white flex items-center justify-center font-black text-2xl sm:text-3xl uppercase shadow-lg shadow-[#95CD1A]/20 shrink-0">
                  {user.email.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-serif-headline text-xl sm:text-2xl font-black text-[#1F2937]">
                      {user.displayName || 'Valued Customer'}
                    </h2>
                    <span className="bg-[#95CD1A]/15 text-[#7EB30E] text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified Customer
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-gray-500 mt-1 truncate" title={user.email}>
                    {user.email}
                  </p>
                </div>
              </div>

              <button
                onClick={onLogout}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-red-50 hover:bg-red-100/80 text-red-600 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 border border-red-100 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span>Logout Account</span>
              </button>
            </div>

            {/* Main Action Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* 1. My Orders & Live Tracking */}
              <div
                onClick={onOpenOrders}
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#95CD1A]/40 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Package className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-extrabold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    Active & History
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-extrabold text-base sm:text-lg text-[#1F2937] group-hover:text-[#7EB30E] transition-colors">
                    My Orders & Live Tracking
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                    View active delivery status, track live dispatch, and review previous home-cooked food orders.
                  </p>
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs font-black text-[#95CD1A] group-hover:translate-x-1 transition-transform">
                  <span>View Orders</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

              {/* 2. Customer Support */}
              <a
                href="https://wa.me/919789444555?text=Hello%20Homemade%20Foods%20Support"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md hover:border-[#95CD1A]/40 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-extrabold bg-emerald-100/60 text-emerald-700 px-2.5 py-1 rounded-full">
                    Instant WhatsApp
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-extrabold text-base sm:text-lg text-[#1F2937] group-hover:text-emerald-600 transition-colors">
                    Customer Support & Help
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                    Need help with your order or custom requirements? Chat directly with our Madurai team.
                  </p>
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs font-black text-emerald-600 group-hover:translate-x-1 transition-transform">
                  <span>Chat on WhatsApp (+91 97894 44555)</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </a>

              {/* 3. Account Security Info */}
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <KeyRound className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-extrabold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                    Passwordless OTP
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-extrabold text-base sm:text-lg text-[#1F2937]">
                    Account Security & Authentication
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-relaxed">
                    Your account uses 100% passwordless Email OTP verification. No passwords to remember or reset.
                  </p>
                </div>
                <div className="mt-5 text-xs font-bold text-gray-400">
                  Secured with encrypted session tokens
                </div>
              </div>

              {/* 4. Browse Store Card */}
              <div
                onClick={onNavigateShop}
                className="bg-gradient-to-br from-[#1F2937] to-gray-900 text-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 text-[#95CD1A] flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-extrabold bg-[#95CD1A]/20 text-[#95CD1A] px-2.5 py-1 rounded-full">
                    Store Catalog
                  </span>
                </div>
                <div className="mt-4">
                  <h3 className="font-serif-headline text-lg sm:text-xl font-black text-white group-hover:text-[#95CD1A] transition-colors">
                    Explore Traditional Foods
                  </h3>
                  <p className="text-xs text-gray-300 font-medium mt-1 leading-relaxed">
                    Browse our handcrafted masalas, idly podis, thokkus, and traditional premixes.
                  </p>
                </div>
                <div className="mt-5 flex items-center gap-2 text-xs font-black text-[#95CD1A] group-hover:translate-x-1 transition-transform">
                  <span>Go to Shop Catalog</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>

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
