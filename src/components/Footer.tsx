import React from 'react';
import { PhoneCall, MapPin, Heart, ArrowUpRight, Leaf, Sparkles } from 'lucide-react';

interface FooterProps {
  onNavigatePage?: (page: 'home' | 'shop', categoryId?: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigatePage }) => {
  const handleNavClick = (page: 'home' | 'shop', hashAnchor?: string) => {
    if (onNavigatePage) {
      onNavigatePage(page);
    }
    if (hashAnchor) {
      setTimeout(() => {
        const el = document.getElementById(hashAnchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <footer id="footer" className="bg-[#FAFBF6] text-[#1F2937] pt-16 pb-8 px-4 sm:px-8 lg:px-12 border-t border-gray-200/80 relative overflow-hidden">
      
      {/* Subtle Warm Background Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-[#F7FCE8] rounded-full blur-3xl opacity-70" />
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-lime-50/50 rounded-full blur-3xl opacity-70" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10 space-y-12">
        
        {/* Main 4-Column Premium Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 items-start text-left">
          
          {/* Column 1: Brand & Heritage (4 cols lg) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center">
              <img
                src="/logo.svg"
                alt="Homemade Foods - Traditional Foods Logo"
                className="h-10 sm:h-12 w-auto object-contain"
              />
            </div>

            <p className="text-sm text-gray-600 leading-relaxed max-w-sm">
              Handcrafted South Indian delicacies made with time-honored family recipes, pure ingredients, cold-pressed oils, and zero artificial preservatives. From our kitchen to yours.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-700 shadow-2xs">
                <Leaf className="w-3.5 h-3.5 text-[#95CD1A]" />
                100% Vegetarian
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-gray-200 text-xs font-bold text-gray-700 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Pure Desi Ghee
              </span>
            </div>
          </div>

          {/* Column 2: Quick Links (2.5 cols lg) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="font-serif-headline text-base font-extrabold text-[#1F2937] uppercase tracking-wider">
              Explore Storefront
            </h4>
            
            <nav className="flex flex-col space-y-2 text-sm font-bold text-gray-600">
              <button
                onClick={() => handleNavClick('home')}
                className="hover:text-[#95CD1A] transition-colors flex items-center justify-between text-left cursor-pointer group"
              >
                <span>Home Page</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#95CD1A]" />
              </button>

              <button
                onClick={() => handleNavClick('shop')}
                className="hover:text-[#95CD1A] transition-colors flex items-center justify-between text-left cursor-pointer group"
              >
                <span>Shop Full Catalog</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#95CD1A]" />
              </button>

              <button
                onClick={() => handleNavClick('home', 'categories')}
                className="hover:text-[#95CD1A] transition-colors flex items-center justify-between text-left cursor-pointer group"
              >
                <span>Categories Index</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#95CD1A]" />
              </button>

              <button
                onClick={() => handleNavClick('home', 'process')}
                className="hover:text-[#95CD1A] transition-colors flex items-center justify-between text-left cursor-pointer group"
              >
                <span>Our Preparation Method</span>
                <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#95CD1A]" />
              </button>
            </nav>
          </div>

          {/* Column 3: FSSAI Compliance Card (3 cols lg) */}
          <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              <img src="/fssai-logo.png" alt="FSSAI Logo" className="h-8 w-auto object-contain" />
              <span className="text-[#1F2937] font-extrabold text-sm">FSSAI Certified Business</span>
            </div>
            
            <p className="text-xs text-gray-500 leading-normal">
              Government Food Safety & Standards Authority of India Registration:
            </p>
            
            <div className="bg-[#FAFBF6] px-3.5 py-2 rounded-xl border border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-bold uppercase">Lic No:</span>
              <span className="text-sm font-mono font-black text-[#1F2937] tracking-wider">
                22425577000230
              </span>
            </div>
          </div>

          {/* Column 4: Direct WhatsApp Ordering (2 cols lg) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="font-serif-headline text-base font-extrabold text-[#1F2937] uppercase tracking-wider">
              Direct Contact
            </h4>
            
            <div className="space-y-2 text-xs font-bold text-gray-600">
              <p className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#95CD1A] shrink-0" />
                <span>+91 86088 57705</span>
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#95CD1A] shrink-0" />
                <span>Tamil Nadu, India</span>
              </p>
            </div>

            <div className="pt-2">
              <a
                href="https://wa.me/918608857705"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-[#95CD1A] hover:bg-[#7EB30E] text-[#1F2937] font-extrabold text-xs rounded-xl transition-all shadow-sm hover:shadow-md cursor-pointer"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#1F2937]" />
                <span>WhatsApp Us</span>
              </a>
            </div>
          </div>

        </div>

        {/* Footer Bottom Bar */}
        <div className="pt-8 border-t border-gray-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-gray-500">
          <p>© {new Date().getFullYear()} Homemade Foods. All rights reserved.</p>
          
          <p className="flex items-center gap-1.5">
            Made with <Heart className="w-3.5 h-3.5 text-[#95CD1A] fill-[#95CD1A]" /> for South Indian Taste Traditions
          </p>
        </div>

      </div>
    </footer>
  );
};
