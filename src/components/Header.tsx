import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowRight, ShoppingBag } from 'lucide-react';

interface HeaderProps {
  currentPage: 'home' | 'shop';
  onNavigate: (page: 'home' | 'shop') => void;
  onSearchClick?: () => void;
  cartItemCount?: number;
  onOpenCart?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  cartItemCount = 0,
  onOpenCart,
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>(currentPage === 'shop' ? 'shop' : 'home');

  // Scrollspy logic to automatically activate navbar links based on scroll position
  useEffect(() => {
    if (currentPage === 'shop') {
      setActiveSection('shop');
      return;
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180;
      const bodyHeight = document.body.offsetHeight;
      const windowHeight = window.innerHeight;

      // Bottom of page -> Footer (Contact Us)
      if (windowHeight + window.scrollY >= bodyHeight - 150) {
        setActiveSection('footer');
        return;
      }

      const processEl = document.getElementById('process');
      const categoriesEl = document.getElementById('categories');

      if (processEl && scrollPosition >= processEl.offsetTop) {
        setActiveSection('process');
      } else if (categoriesEl && scrollPosition >= categoriesEl.offsetTop) {
        setActiveSection('categories');
      } else {
        setActiveSection('home');
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentPage]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleNavClick = (page: 'home' | 'shop', hashAnchor?: string) => {
    setIsMobileMenuOpen(false);
    onNavigate(page);

    if (page === 'shop') {
      setActiveSection('shop');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (hashAnchor) {
      setActiveSection(hashAnchor);
      setTimeout(() => {
        const el = document.getElementById(hashAnchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      setActiveSection('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
            className={`relative py-1 transition-all duration-200 cursor-pointer ${
              activeSection === 'home' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
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
            className={`relative py-1 transition-all duration-200 cursor-pointer ${
              activeSection === 'categories' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
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
            className={`relative py-1 transition-all duration-200 cursor-pointer ${
              activeSection === 'process' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
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
            className={`relative py-1 transition-all duration-200 cursor-pointer ${
              activeSection === 'footer' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
            }`}
          >
            <span>Contact Us</span>
            {activeSection === 'footer' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#95CD1A] rounded-full animate-in fade-in zoom-in-50 duration-200" />
            )}
          </button>
        </nav>

        {/* Header Right Actions: Cart Icon Button & Shop Now CTA Button */}
        <div className="flex items-center gap-3">
          {/* Cart Drawer Trigger Button */}
          <button
            onClick={onOpenCart}
            aria-label="View Cart"
            className="relative px-4 py-3 rounded-2xl bg-gray-100 text-[#1F2937] hover:bg-[#F7FCE8] hover:text-[#95CD1A] transition-all cursor-pointer group shadow-2xs flex items-center gap-2 font-extrabold text-sm sm:text-base"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-[#1F2937] group-hover:text-[#95CD1A] transition-colors" />
            <span>Cart</span>
            {cartItemCount > 0 && (
              <span className="bg-[#95CD1A] text-white text-[11px] font-black px-1.5 py-0.5 rounded-full min-w-5 h-5 flex items-center justify-center shadow-md animate-in zoom-in-50 duration-200 ml-0.5">
                {cartItemCount > 99 ? '99+' : cartItemCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNavClick('shop')}
            className={`hidden sm:inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-white font-extrabold text-base transition-all duration-300 shadow-md cursor-pointer ${
              activeSection === 'shop'
                ? 'bg-[#7EB30E] ring-4 ring-[#95CD1A]/30 scale-105 shadow-lg'
                : 'bg-[#95CD1A] hover:bg-[#7EB30E] shadow-[#95CD1A]/25 hover:shadow-lg transform hover:-translate-y-0.5'
            }`}
          >
            <ShoppingBag className="w-5 h-5 text-white" />
            <span>Shop Now</span>
            <ArrowRight className="w-5 h-5 text-white stroke-[3]" />
          </button>

          {/* Mobile Hamburger Menu Toggle Button */}
          <button
            onClick={toggleMobileMenu}
            aria-label="Toggle Navigation Menu"
            className="md:hidden p-3 rounded-2xl bg-gray-100 text-[#1F2937] hover:bg-[#F7FCE8] hover:text-[#95CD1A] transition-colors cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>

      </div>

      {/* Mobile Slide-Down Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-6 py-6 space-y-4 shadow-xl animate-in slide-in-from-top duration-300">
          <nav className="flex flex-col space-y-3 font-bold text-lg text-gray-800 text-center">
            <button
              onClick={() => handleNavClick('home')}
              className={`py-2.5 border-b border-gray-100 ${
                activeSection === 'home' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
              }`}
            >
              <span>Home</span>
            </button>

            <button
              onClick={() => handleNavClick('home', 'categories')}
              className={`py-2.5 border-b border-gray-100 ${
                activeSection === 'categories' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
              }`}
            >
              <span>Categories</span>
            </button>

            <button
              onClick={() => handleNavClick('home', 'process')}
              className={`py-2.5 border-b border-gray-100 ${
                activeSection === 'process' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
              }`}
            >
              <span>Our Method</span>
            </button>

            <button
              onClick={() => handleNavClick('home', 'footer')}
              className={`py-2.5 border-b border-gray-100 ${
                activeSection === 'footer' ? 'text-[#95CD1A] font-black' : 'hover:text-[#95CD1A]'
              }`}
            >
              <span>Contact Us</span>
            </button>
          </nav>

          <div className="pt-2">
            <button
              onClick={() => handleNavClick('shop')}
              className="w-full py-3.5 rounded-xl bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#95CD1A]/25 cursor-pointer"
            >
              <ShoppingBag className="w-5 h-5 text-white" />
              <span>Shop Now</span>
              <ArrowRight className="w-4 h-4 text-white stroke-[3] ml-1" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
