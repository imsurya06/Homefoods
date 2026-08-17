import React from 'react';
import { X, User, LogOut, Package, MapPin, Phone, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';
import type { UserProfile } from '../services/authService';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onOpenAuthModal: () => void;
  onOpenOrders: () => void;
  onLogout: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenAuthModal,
  onOpenOrders,
  onLogout,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Backdrop overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200 text-left">
        
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#1F2937] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#95CD1A]/20 flex items-center justify-center text-[#95CD1A]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif-headline text-lg font-black text-white">
                {user ? 'My Account' : 'Account & Login'}
              </h2>
              <p className="text-[11px] text-gray-400 font-medium">
                {user ? 'Manage profile & order history' : 'Sign in to access your profile'}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">

          {user ? (
            /* ================= LOGGED IN USER VIEW ================= */
            <>
              {/* User Profile Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#95CD1A]/10 via-[#95CD1A]/5 to-transparent border border-[#95CD1A]/20 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#95CD1A] text-white flex items-center justify-center font-black text-2xl uppercase shadow-md shrink-0">
                  {user.email.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-[#1F2937] truncate">
                      {user.displayName || 'Valued Customer'}
                    </h3>
                    <span className="bg-[#95CD1A]/20 text-[#7EB30E] text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-600 truncate mt-0.5" title={user.email}>
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Account Quick Options Grid */}
              <div className="space-y-2.5">

                {/* 1. My Orders & Live Tracking */}
                <button
                  onClick={() => {
                    onClose();
                    onOpenOrders();
                  }}
                  className="w-full p-3.5 rounded-2xl bg-gray-50 hover:bg-[#F7FCE8] border border-gray-100 hover:border-[#95CD1A]/40 flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white text-[#95CD1A] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-extrabold text-sm text-[#1F2937] block">My Orders & Live Tracking</span>
                      <span className="text-[11px] text-gray-500 font-medium block">View active orders and past history</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#95CD1A] group-hover:translate-x-1 transition-all" />
                </button>

                {/* 2. Customer Support */}
                <a
                  href="https://wa.me/919789444555?text=Hello%20Homemade%20Foods%20Support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full p-3.5 rounded-2xl bg-gray-50 hover:bg-[#F7FCE8] border border-gray-100 hover:border-[#95CD1A]/40 flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white text-[#95CD1A] shadow-2xs flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-extrabold text-sm text-[#1F2937] block">Customer Support & Help</span>
                      <span className="text-[11px] text-gray-500 font-medium block">Direct WhatsApp & Call support</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#95CD1A] group-hover:translate-x-1 transition-all" />
                </a>

              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="w-full py-3.5 rounded-2xl bg-red-50 hover:bg-red-100/80 text-red-600 font-extrabold text-sm flex items-center justify-center gap-2 border border-red-100 transition-colors cursor-pointer mt-4"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span>Logout Account</span>
              </button>
            </>
          ) : (
            /* ================= GUEST / LOGGED OUT VIEW ================= */
            <>
              {/* Welcome Card */}
              <div className="text-center p-5 rounded-2xl bg-[#F7FCE8] border border-[#ECF9CA] space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[#95CD1A] text-white flex items-center justify-center mx-auto shadow-md">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="font-serif-headline text-lg font-black text-[#1F2937]">
                  Welcome to Homemade Foods!
                </h3>
                <p className="text-xs text-gray-600 font-medium max-w-xs mx-auto leading-relaxed">
                  Sign in with your Email OTP to view your orders, save delivery addresses, and enjoy 1-click checkouts.
                </p>
              </div>

              {/* Features Perks List */}
              <div className="space-y-2.5 text-xs font-semibold text-gray-700">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <Package className="w-4 h-4 text-[#95CD1A] shrink-0" />
                  <span>Live order status tracking & updates</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <MapPin className="w-4 h-4 text-[#95CD1A] shrink-0" />
                  <span>Saved shipping addresses for fast checkout</span>
                </div>
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <KeyRound className="w-4 h-4 text-[#95CD1A] shrink-0" />
                  <span>100% passwordless email OTP verification</span>
                </div>
              </div>

              {/* Sign In CTA Button */}
              <button
                onClick={() => {
                  onClose();
                  onOpenAuthModal();
                }}
                className="w-full py-4 rounded-2xl bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#95CD1A]/30 transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                <User className="w-5 h-5 text-white" />
                <span>Sign In / Sign Up with Email OTP</span>
                <ArrowRight className="w-4 h-4 text-white stroke-[3] ml-1" />
              </button>
            </>
          )}

        </div>

      </div>
    </div>
  );
};
