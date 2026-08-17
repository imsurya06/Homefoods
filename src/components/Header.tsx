import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ShoppingBag, User, LogOut, Package } from 'lucide-react';
import type { UserProfile } from '../services/authService';

interface HeaderProps {
  currentPage: 'home' | 'shop' | 'account';
  onNavigate: (page: 'home' | 'shop' | 'account') => void;
  onSearchClick?: () => void;
  cartItemCount?: number;
  onOpenCart?: () => void;
  onOpenTrackModal?: () => void;
  user?: UserProfile | null;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  cartItemCount = 0,
  onOpenCart,
  onOpenTrackModal,
  user = null,
  onLogout,
}) => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(currentPage === 'shop' ? 'shop' : 'home');
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close User Dropdown when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };

    if (isUserDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserDropdownOpen]);

  const isProgrammaticScrollRef = useRef(false);
  const scrollTimerRef = useRef<any>(null);

  // Scrollspy logic to automatically activate navbar links based on scroll position
  useEffect(() => {
    if (currentPage === 'shop') {
      setActiveSection('shop');
      return;
    }

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      const headerHeight = 90;
      const scrollPosition = window.scrollY + headerHeight + 40;
      const bodyHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;

      // Bottom of page -> Footer (Contact Us)
      if (windowHeight + window.scrollY >= bodyHeight - 120) {
        setActiveSection('footer');
        return;
      }

      const footerEl = document.getElementById('footer');
      const processEl = document.getElementById('process');
      const categoriesEl = document.getElementById('categories');

      if (footerEl && scrollPosition >= footerEl.offsetTop - 40) {
        setActiveSection('footer');
      } else if (processEl && scrollPosition >= processEl.offsetTop - 40) {
        setActiveSection('process');
      } else if (categoriesEl && scrollPosition >= categoriesEl.offsetTop - 40) {
        setActiveSection('categories');
      } else {
        setActiveSection('home');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPage]);

  const handleNavClick = (page: 'home' | 'shop', hashAnchor?: string) => {
    onNavigate(page);

    if (page === 'shop') {
      setActiveSection('shop');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (hashAnchor) {
      setActiveSection(hashAnchor);
      isProgrammaticScrollRef.current = true;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);

      const scrollToElement = () => {
        const el = document.getElementById(hashAnchor);
        if (el) {
          const headerHeight = 80;
          const elementPosition = el.getBoundingClientRect().top + window.scrollY;
          const offsetPosition = Math.max(0, elementPosition - headerHeight);

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      };

      scrollToElement();
      setTimeout(scrollToElement, 100);

      scrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 900);
    } else {
      setActiveSection('home');
      isProgrammaticScrollRef.current = true;
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);

      window.scrollTo({ top: 0, behavior: 'smooth' });

      scrollTimerRef.current = setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 900);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-xs w-full">
      <div className="w-full px-4 sm:px-8 lg:px-12 h-16 sm:h-20 flex items-center justify-between">

        {/* Pure Clean Brand Logo */}
        <div
          onClick={() => handleNavClick('home')}
          className="flex items-center cursor-pointer group py-1"
        >
          <img
            src="/logo.svg"
            alt="Homemade Foods - Traditional Foods Logo"
            className="h-10 sm:h-12 md:h-14 w-auto object-contain group-hover:scale-105 transition-transform shrink-0"
          />
        </div>

        {/* Desktop Scrollspy Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-base sm:text-lg font-extrabold text-gray-700">

          {/* Home Link */}
          <button
            onClick={() => handleNavClick('home')}
            className={`relative py-1 transition-all duration-200 cursor-pointer ${activeSection === 'home' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
              }`}
          >
            <span>Home</span>
            {activeSection === 'home' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#95CD1A] rounded-full animate-in fade-in zoom-in-50 duration-200" />
            )}
          </button>

          {/* Categories Link */}
          <button
            onClick={() => handleNavClick('home', 'categories')}
            className={`relative py-1 transition-all duration-200 cursor-pointer ${activeSection === 'categories' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
              }`}
          >
            <span>Categories</span>
            {activeSection === 'categories' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#95CD1A] rounded-full animate-in fade-in zoom-in-50 duration-200" />
            )}
          </button>

          {/* Our Method Link */}
          <button
            onClick={() => handleNavClick('home', 'process')}
            className={`relative py-1 transition-all duration-200 cursor-pointer ${activeSection === 'process' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
              }`}
          >
            <span>Our Method</span>
            {activeSection === 'process' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#95CD1A] rounded-full animate-in fade-in zoom-in-50 duration-200" />
            )}
          </button>

          {/* Contact Us Link */}
          <button
            onClick={() => handleNavClick('home', 'footer')}
            className={`relative py-1 transition-all duration-200 cursor-pointer ${activeSection === 'footer' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
              }`}
          >
            <span>Contact Us</span>
            {activeSection === 'footer' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#95CD1A] rounded-full animate-in fade-in zoom-in-50 duration-200" />
            )}
          </button>

          {/* My Orders / Track Order Link */}
          <button
            onClick={onOpenTrackModal}
            className="relative py-1 text-gray-700 hover:text-[#95CD1A] transition-all duration-200 cursor-pointer flex items-center gap-1.5 font-extrabold"
          >
            <span>{user ? 'My Orders' : 'Track Order'}</span>
          </button>
        </nav>

        {/* Header Right Actions: Shop Now + Cart + User Profile Icon */}
        <div className="flex items-center gap-2.5 sm:gap-3 relative">

          {/* 1. Shop Now CTA Button */}
          <button
            onClick={() => handleNavClick('shop')}
            className={`hidden sm:inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-white font-extrabold text-base transition-all duration-300 shadow-md cursor-pointer ${activeSection === 'shop'
                ? 'bg-[#7EB30E] ring-4 ring-[#95CD1A]/30 scale-105 shadow-lg'
                : 'bg-[#95CD1A] hover:bg-[#7EB30E] shadow-[#95CD1A]/25 hover:shadow-lg transform hover:-translate-y-0.5'
              }`}
          >
            <ShoppingBag className="w-5 h-5 text-white" />
            <span>Shop Now</span>
            <ArrowRight className="w-5 h-5 text-white stroke-[3]" />
          </button>

          {/* 2. Cart Drawer Trigger Button (Placed next to Profile Icon) */}
          <button
            onClick={onOpenCart}
            aria-label="View Cart"
            className="relative px-3.5 sm:px-4 py-3 rounded-2xl bg-gray-100 text-[#1F2937] hover:bg-[#F7FCE8] hover:text-[#95CD1A] transition-all cursor-pointer group shadow-2xs flex items-center gap-2 font-extrabold text-sm sm:text-base"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-[#1F2937] group-hover:text-[#95CD1A] transition-colors" />
            <span>Cart</span>
            {cartItemCount > 0 && (
              <span className="bg-[#95CD1A] text-white text-[11px] font-black px-1.5 py-0.5 rounded-full min-w-5 h-5 flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200 ml-0.5">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </button>

          {/* 3. Clickable User Profile Icon Button (Desktop Only: hidden md:block) */}
          {user ? (
            <div ref={userDropdownRef} className="hidden md:block relative">
              <button
                onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                title={user.displayName || 'User Profile'}
                aria-label="User Account Menu"
                className="p-3.5 rounded-2xl bg-gray-100 text-[#1F2937] hover:bg-[#F7FCE8] hover:text-[#95CD1A] transition-all cursor-pointer group shadow-2xs flex items-center justify-center"
              >
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#95CD1A] group-hover:scale-110 transition-transform" />
              </button>

              {/* User Dropdown Menu */}
              {isUserDropdownOpen && (
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl shadow-gray-200/80 border border-gray-100 p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                  {/* Dropdown Header User Card */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-[#95CD1A]/5 via-transparent to-[#7EB30E]/5 border border-gray-50 mb-1 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#95CD1A]/10 text-[#95CD1A] flex items-center justify-center font-extrabold text-base uppercase shrink-0">
                      {user.email.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-extrabold text-gray-400 block uppercase tracking-wider">Logged In As</span>
                      <span className="text-xs font-black text-[#1F2937] truncate block" title={user.email}>{user.email}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      onNavigate('account');
                    }}
                    className="w-full px-3 py-2.5 text-xs font-extrabold text-gray-700 hover:bg-[#F7FCE8] hover:text-[#7EB30E] rounded-xl flex items-center gap-2.5 transition-all cursor-pointer group/item"
                  >
                    <User className="w-4 h-4 text-[#95CD1A] group-hover/item:scale-110 transition-transform" />
                    <span>My Profile & Account</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      if (onOpenTrackModal) onOpenTrackModal();
                    }}
                    className="w-full px-3 py-2.5 text-xs font-extrabold text-gray-700 hover:bg-[#F7FCE8] hover:text-[#7EB30E] rounded-xl flex items-center gap-2.5 transition-all cursor-pointer group/item"
                  >
                    <Package className="w-4 h-4 text-[#95CD1A] group-hover/item:scale-110 transition-transform" />
                    <span>My Orders & Live Tracking</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      if (onLogout) onLogout();
                    }}
                    className="w-full px-3 py-2.5 mt-1 text-xs font-extrabold text-red-600 hover:bg-red-50/60 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer border-t border-gray-50 pt-2.5"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Logout Account</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => onNavigate('account')}
              aria-label="Account Login"
              title="Account Login / Signup"
              className="hidden md:flex p-3.5 rounded-2xl bg-gray-100 text-[#1F2937] hover:bg-[#F7FCE8] hover:text-[#95CD1A] transition-all cursor-pointer group shadow-2xs items-center justify-center"
            >
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-[#1F2937] group-hover:text-[#95CD1A] transition-colors" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
