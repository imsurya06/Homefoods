import React from 'react';
import { Home, ShoppingBag, Package, User } from 'lucide-react';
import type { UserProfile } from '../services/authService';

export type MobileTab = 'home' | 'store' | 'orders' | 'profile';

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  user?: UserProfile | null;
  activeOrdersCount?: number;
  cartItemCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  user,
  activeOrdersCount = 0,
  cartItemCount = 0,
}) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-safe">
      <div className="flex items-center justify-around max-w-md mx-auto">
        
        {/* 1. HOME TAB */}
        <button
          onClick={() => onTabChange('home')}
          aria-label="Home"
          className={`flex flex-col items-center justify-center w-16 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'home'
              ? 'text-[#95CD1A] font-extrabold scale-105'
              : 'text-gray-500 hover:text-gray-900 font-medium'
          }`}
        >
          <div className="relative">
            <Home className={`w-5 h-5 transition-transform ${activeTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            {activeTab === 'home' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#95CD1A] rounded-full" />
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Home</span>
        </button>

        {/* 2. STORE TAB */}
        <button
          onClick={() => onTabChange('store')}
          aria-label="Store Catalog"
          className={`flex flex-col items-center justify-center w-16 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'store'
              ? 'text-[#95CD1A] font-extrabold scale-105'
              : 'text-gray-500 hover:text-gray-900 font-medium'
          }`}
        >
          <div className="relative">
            <ShoppingBag className={`w-5 h-5 transition-transform ${activeTab === 'store' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-[#95CD1A] text-white text-[9px] font-black px-1 rounded-full min-w-4 h-4 flex items-center justify-center shadow-xs">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
            {activeTab === 'store' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#95CD1A] rounded-full" />
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Store</span>
        </button>

        {/* 3. ORDERS TAB */}
        <button
          onClick={() => onTabChange('orders')}
          aria-label="Track & Orders"
          className={`flex flex-col items-center justify-center w-16 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'orders'
              ? 'text-[#95CD1A] font-extrabold scale-105'
              : 'text-gray-500 hover:text-gray-900 font-medium'
          }`}
        >
          <div className="relative">
            <Package className={`w-5 h-5 transition-transform ${activeTab === 'orders' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            {activeOrdersCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] font-black px-1 rounded-full min-w-4 h-4 flex items-center justify-center shadow-xs">
                {activeOrdersCount}
              </span>
            )}
            {activeTab === 'orders' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#95CD1A] rounded-full" />
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Orders</span>
        </button>

        {/* 4. PROFILE TAB */}
        <button
          onClick={() => onTabChange('profile')}
          aria-label="Profile Account"
          className={`flex flex-col items-center justify-center w-16 py-1.5 rounded-xl transition-all duration-200 cursor-pointer ${
            activeTab === 'profile'
              ? 'text-[#95CD1A] font-extrabold scale-105'
              : 'text-gray-500 hover:text-gray-900 font-medium'
          }`}
        >
          <div className="relative">
            <User className={`w-5 h-5 transition-transform ${activeTab === 'profile' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            {user && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#95CD1A] rounded-full ring-2 ring-white" />
            )}
            {activeTab === 'profile' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#95CD1A] rounded-full" />
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">{user ? 'Profile' : 'Account'}</span>
        </button>

      </div>
    </div>
  );
};
