import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ArrowRight, BookOpen, Layers, Leaf, Ban, HeartHandshake, Sparkles, Flame, ChevronRight } from 'lucide-react';
import { CATEGORIES, type Category } from '../data/categories';
import { PRODUCTS, type Product } from '../data/products';

interface HeroSectionProps {
  onSearchSubmit?: (searchTerm: string) => void;
  onCategorySelect?: (categoryId: string) => void;
  onViewInventory?: () => void;
  onViewMenu?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onSearchSubmit,
  onCategorySelect,
  onViewInventory,
  onViewMenu,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const searchSuggestions = [
    'Natural Honey',
    'Nannari Sherbet',
    'Garlic Thokku',
    'Ragi Flour',
    'Millet Cookies',
  ];

  const trustItems = [
    { icon: <Leaf className="w-4 h-4 text-[#95CD1A] shrink-0" />, label: '100% Vegetarian' },
    { icon: <Ban className="w-4 h-4 text-[#95CD1A] shrink-0" />, label: 'No Artificial Preservatives' },
    { icon: <img src="/fssai-logo.png" alt="FSSAI Logo" className="h-5 w-auto object-contain shrink-0" />, label: 'FSSAI Certified', sub: '(Lic. 22425577000230)' },
    { icon: <HeartHandshake className="w-4 h-4 text-amber-600 shrink-0" />, label: 'Authentic Family Recipes' },
    { icon: <Flame className="w-4 h-4 text-[#95CD1A] shrink-0" />, label: 'Hand-pounded Spices' },
    { icon: <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />, label: 'Pure Desi Ghee' },
  ];

  // Dynamic Matching Product Options for the Search Dropdown
  const dropdownProducts = useMemo(() => {
    if (!searchTerm.trim()) {
      return PRODUCTS.slice(0, 5); // Featured recommendations
    }
    const query = searchTerm.toLowerCase().trim();
    return PRODUCTS.filter((p: Product) => 
      p.name.toLowerCase().includes(query) ||
      p.categoryName.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.ingredients.toLowerCase().includes(query)
    ).slice(0, 6);
  }, [searchTerm]);

  // Handle Outside Click to Close Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsDropdownOpen(false);
    if (onSearchSubmit && searchTerm.trim()) {
      onSearchSubmit(searchTerm.trim());
    } else if (onSearchSubmit) {
      onSearchSubmit('');
    }
  };

  const handleSelectProductOption = (productName: string) => {
    setSearchTerm(productName);
    setIsDropdownOpen(false);
    if (onSearchSubmit) {
      onSearchSubmit(productName);
    }
  };

  const handlePillClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    setIsDropdownOpen(false);
    if (onSearchSubmit) {
      onSearchSubmit(suggestion);
    }
  };

  return (
    <div className="w-full bg-white text-[#1F2937] relative overflow-hidden">
      
      {/* Subtle Warm Background Hearth Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-0">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#F7FCE8] rounded-full blur-3xl opacity-80" />
        <div className="absolute -top-16 -right-16 w-[28rem] h-[28rem] bg-gradient-to-bl from-[#F7FCE8] via-lime-50/40 to-transparent rounded-full blur-3xl opacity-80" />
      </div>

      {/* 1. Asymmetrical Organic Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-8 pb-14 md:pt-14 md:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          
          {/* Left Column (7 cols lg) - Warm Conversational Typography */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
            
            {/* Warm Conversational Tag */}
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#F7FCE8] border border-[#ECF9CA] text-[#1F2937] text-xs font-extrabold tracking-wide uppercase shadow-xs mx-auto lg:mx-0">
              <span>From our kitchen to yours</span>
            </div>

            {/* Natural Serif Headline */}
            <h1 className="font-serif-headline text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1F2937] tracking-tight leading-[1.15] text-left">
              A taste of tradition <br />
              <span className="font-decorative text-[#95CD1A] font-normal text-5xl sm:text-6xl lg:text-7xl relative inline-block">
                in every bite.
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#95CD1A]/40" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path d="M0 10 Q 50 20 100 10" stroke="currentColor" strokeWidth="3" fill="none" />
                </svg>
              </span>
            </h1>

            {/* Ragged-Right Conversational Subheadline */}
            <p className="text-base sm:text-lg text-gray-600 font-normal leading-relaxed max-w-xl text-left mx-auto lg:mx-0">
              Handcrafted South Indian delicacies made with time-honored family recipes, pure ingredients, and zero preservatives. Pure goodness delivered straight from our kitchen to your home.
            </p>

            {/* Search Input Bar + Interactive Dropdown Menu Options */}
            <div ref={searchContainerRef} className="w-full max-w-xl pt-2 mx-auto lg:mx-0 relative z-30">
              <form onSubmit={handleSearchSubmit} className="relative group">
                <div className="relative flex items-center bg-white rounded-2xl border-2 border-gray-200 group-hover:border-[#95CD1A]/60 focus-within:border-[#95CD1A] shadow-md shadow-gray-100 transition-all duration-300 overflow-hidden">
                  <div className="pl-4 pr-2 py-3.5 text-[#95CD1A] flex items-center justify-center">
                    <Search className="w-5 h-5 text-[#95CD1A] stroke-[2.5]" />
                  </div>
                  
                  <input
                    type="text"
                    value={searchTerm}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    placeholder="Search thokku, podi, honey, sherbet..."
                    className="w-full py-3.5 pr-3 text-gray-800 text-sm sm:text-base bg-transparent placeholder-gray-400 focus:outline-none font-medium text-left"
                  />

                  <button
                    type="submit"
                    className="mr-1.5 px-6 py-2.5 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm rounded-xl transition-colors duration-200 shadow-md shadow-[#95CD1A]/20 cursor-pointer shrink-0"
                  >
                    Search
                  </button>
                </div>
              </form>

              {/* Interactive Product Dropdown Menu Options */}
              {isDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden z-50 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
                    <span>
                      {searchTerm.trim() ? `Matching Items (${dropdownProducts.length})` : 'Popular Recommendations'}
                    </span>
                    <span className="text-[11px] text-gray-400 font-normal">Select an item to view</span>
                  </div>

                  {dropdownProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No matching products found for "{searchTerm}". Click Search to filter catalog anyway.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                      {dropdownProducts.map((product: Product) => (
                        <div
                          key={product.id}
                          onClick={() => handleSelectProductOption(product.name)}
                          className="p-3 hover:bg-[#F7FCE8]/80 transition-colors flex items-center justify-between cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0 border border-gray-200"
                            />
                            <div>
                              <h4 className="text-xs sm:text-sm font-extrabold text-[#1F2937] group-hover:text-[#95CD1A] transition-colors leading-tight">
                                {product.name}
                              </h4>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-500 font-medium">
                                  {product.categoryName}
                                </span>
                                <span className="text-[10px] font-bold text-[#95CD1A]">
                                  From ₹{product.variants[0].basePrice}
                                </span>
                              </div>
                            </div>
                          </div>

                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#95CD1A] group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Trending Search Pills */}
            <div className="w-full max-w-xl flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1 text-xs sm:text-sm mx-auto lg:mx-0">
              <span className="text-gray-400 font-semibold uppercase tracking-wider text-[11px] mr-1">
                Trending:
              </span>
              {searchSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handlePillClick(suggestion)}
                  className="px-3.5 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 font-medium text-xs transition-all duration-200 hover:bg-[#95CD1A] hover:text-white hover:border-[#95CD1A] cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Intentional Brand Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4 w-full max-w-md mx-auto lg:mx-0">
              <button
                onClick={onViewInventory}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm sm:text-base rounded-xl transition-all duration-300 shadow-lg shadow-[#95CD1A]/25 hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Layers className="w-5 h-5 text-white" />
                <span>View Inventory</span>
              </button>

              <button
                onClick={onViewMenu}
                className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-[#F7FCE8] text-[#1F2937] border-2 border-[#95CD1A] font-extrabold text-sm sm:text-base rounded-xl transition-all duration-300 shadow-xs hover:shadow-md transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-5 h-5 text-[#1F2937]" />
                <span>View Menu</span>
              </button>
            </div>

          </div>

          {/* Right Column (5 cols lg) - Hand-Placed Scrapbook Photography Collage */}
          <div className="lg:col-span-5 relative mt-8 lg:mt-0 flex justify-center">
            
            <div className="relative w-full max-w-md">
              {/* Primary Photo Card */}
              <div className="relative rounded-2xl overflow-hidden shadow-xl border-4 border-white aspect-4/3 sm:aspect-square transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                <img
                  src="https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=1000&q=80"
                  alt="Authentic South Indian Relish"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                <div className="absolute bottom-4 left-4 right-4 text-white text-left">
                  <span className="text-[11px] font-bold tracking-widest uppercase text-amber-300 block">
                    Handcrafted Relish
                  </span>
                  <h4 className="font-serif-headline text-lg font-bold">
                    Garlic & Mango Thokku
                  </h4>
                </div>
              </div>

              {/* Overlapping Secondary Photo Card */}
              <div className="absolute -bottom-6 -left-6 sm:-bottom-8 sm:-left-8 w-44 sm:w-52 aspect-square rounded-2xl overflow-hidden shadow-lg border-4 border-white transform rotate-2 hover:rotate-0 transition-transform duration-500 hidden sm:block">
                <img
                  src="https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=600&q=80"
                  alt="Traditional Indian Spices"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Physical Floating Kitchen Recipe Tag */}
              <div className="absolute -top-4 -left-4 sm:top-2 sm:-left-6 bg-white px-4 py-2.5 rounded-xl shadow-md border border-gray-200 transform -rotate-2 flex items-center gap-2.5 text-left z-20">
                <div className="w-8 h-8 rounded-full bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center font-bold text-xs">
                  🌱
                </div>
                <div>
                  <span className="text-xs font-extrabold text-[#1F2937] block leading-tight">
                    Pure Ghee & Spices
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    100% Traditional Recipe
                  </span>
                </div>
              </div>

              {/* Floating FSSAI Certificate Badge */}
              <div className="absolute -top-3 -right-3 sm:top-4 sm:-right-6 bg-white/95 backdrop-blur-xs px-3.5 py-2 rounded-xl shadow-lg border border-gray-200 transform rotate-3 hover:rotate-0 transition-transform duration-300 flex items-center gap-2.5 text-left z-20">
                <img src="/fssai-logo.png" alt="FSSAI Logo" className="h-7 w-auto object-contain shrink-0" />
                <div>
                  <span className="text-xs font-extrabold text-[#1F2937] block leading-tight">
                    FSSAI Certified
                  </span>
                  <span className="text-[9px] font-mono text-gray-500 font-semibold block">
                    Lic. 22425577000230
                  </span>
                </div>
              </div>

              {/* Fresh Batch Tag */}
              <div className="absolute -bottom-3 right-4 bg-white px-3.5 py-1.5 rounded-lg shadow-md border border-gray-200 flex items-center gap-2 transform rotate-1 z-20">
                <span className="w-2 h-2 rounded-full bg-[#95CD1A] animate-pulse" />
                <span className="text-xs font-bold text-gray-700">Fresh Weekly Batches</span>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 2. Seamless Infinite Marquee Trust Bar */}
      <section className="relative z-10 w-full bg-[#FAFAFA] border-y border-gray-200/80 py-3.5 overflow-hidden">
        <div className="relative w-full overflow-hidden">
          <div className="animate-marquee flex items-center gap-12 sm:gap-16 whitespace-nowrap text-xs sm:text-sm text-gray-700 font-semibold select-none">
            
            {/* First Set of Items */}
            {trustItems.map((item, idx) => (
              <div key={`trust-1-${idx}`} className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
                {item.sub && <span className="font-mono text-gray-500 font-normal text-xs">{item.sub}</span>}
                <span className="ml-8 text-gray-300 font-light">•</span>
              </div>
            ))}

            {/* Duplicate Second Set of Items for Seamless Loop */}
            {trustItems.map((item, idx) => (
              <div key={`trust-2-${idx}`} className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
                {item.sub && <span className="font-mono text-gray-500 font-normal text-xs">{item.sub}</span>}
                <span className="ml-8 text-gray-300 font-light">•</span>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* 3. Organically Staggered Category Cards */}
      <section id="categories" className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-16 md:py-24">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-between mb-14 gap-4 pb-4 border-b border-gray-100 text-center sm:text-left">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#1F2937] block mb-1">
              Curated Delicacies
            </span>
            <h2 className="font-serif-headline text-3xl sm:text-4xl font-extrabold text-[#1F2937]">
              Explore Our Categories
            </h2>
          </div>
          <p className="text-sm text-gray-500 max-w-md sm:text-right text-left">
            Select a traditional category to view items crafted with pure ingredients and homemade care.
          </p>
        </div>

        {/* Straight Aligned Cards with Hover Lift Effect */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 sm:gap-8 items-stretch">
          {CATEGORIES.map((category: Category) => {
            return (
              <div
                key={category.id}
                onClick={() => onCategorySelect && onCategorySelect(category.id)}
                className="group cursor-pointer flex flex-col bg-white rounded-2xl border-2 border-transparent hover:border-[#95CD1A] overflow-hidden shadow-xs hover:shadow-xl hover:shadow-[#95CD1A]/15 hover:-translate-y-2.5 transition-all duration-300 transform"
              >
                {/* Physical Printed Photo Frame Container */}
                <div className="relative aspect-4/3 sm:aspect-square w-full overflow-hidden bg-gray-100 border-b border-gray-100">
                  <img
                    src={category.imageUrl}
                    alt={category.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  <span className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-xs text-white text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-md">
                    {category.itemCount}
                  </span>
                </div>

                {/* Content Details */}
                <div className="p-3.5 sm:p-4 flex flex-col justify-between grow text-left space-y-2">
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-[#1F2937] group-hover:text-[#95CD1A] transition-colors duration-200 line-clamp-1">
                      {category.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {category.subtitle}
                    </p>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#95CD1A] font-bold opacity-80 group-hover:opacity-100">
                    <span>Browse</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </section>
    </div>
  );
};
