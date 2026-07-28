import React, { useState, useMemo, useEffect } from 'react';
import { Search, PhoneCall, Filter, ChevronDown, X, ArrowLeft, Check } from 'lucide-react';
import { PRODUCTS, CATEGORY_FILTERS, type Product } from '../data/products';
import { calculatePriceDetails, generateWhatsAppOrderUrl } from '../data/bestsellers';

interface ShopCatalogProps {
  initialCategory?: string;
  initialSearchQuery?: string;
  onNavigateHome?: () => void;
}

export const ShopCatalog: React.FC<ShopCatalogProps> = ({
  initialCategory = 'all',
  initialSearchQuery = '',
  onNavigateHome,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [showInStockOnly, setShowInStockOnly] = useState<boolean>(false);
  
  // Track selected variant index for each product ID
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  const handleVariantChange = (productId: string, variantIdx: number) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [productId]: variantIdx,
    }));
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // Filter products based on Category, Search Query, and In-Stock toggle
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((product: Product) => {
      // Category Filter
      if (selectedCategory !== 'all' && product.categoryId !== selectedCategory) {
        return false;
      }
      // In-Stock Filter
      if (showInStockOnly && !product.isAvailable) {
        return false;
      }
      // Search Query Filter (Matches Name, Description, or Ingredients)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesDesc = product.description.toLowerCase().includes(query);
        const matchesIngr = product.ingredients.toLowerCase().includes(query);
        const matchesCategory = product.categoryName.toLowerCase().includes(query);
        return matchesName || matchesDesc || matchesIngr || matchesCategory;
      }
      return true;
    });
  }, [selectedCategory, searchQuery, showInStockOnly]);

  const activeCategoryInfo = useMemo(() => {
    return CATEGORY_FILTERS.find((c) => c.id === selectedCategory) || CATEGORY_FILTERS[0];
  }, [selectedCategory]);

  return (
    <section id="shop" className="w-full bg-white text-[#1F2937] py-8 sm:py-14 px-3 sm:px-8 lg:px-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Breadcrumb / Back to Home Navigation */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100 text-left">
          <button
            onClick={onNavigateHome}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold text-gray-600 hover:text-[#95CD1A] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#95CD1A]" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
            <span className="cursor-pointer hover:text-gray-600" onClick={onNavigateHome}>Home</span>
            <span>/</span>
            <span className="text-[#1F2937] font-bold">Shop Catalog</span>
          </div>
        </div>

        {/* Section Title & Prominent Center-Aligned Search Bar */}
        <div className="text-center max-w-3xl mx-auto mb-8 space-y-4">
          
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-[#1F2937] mb-1">
              <span>Full Storefront Catalog</span>
            </div>

            <h1 className="font-serif-headline text-3xl sm:text-5xl font-extrabold text-[#1F2937]">
              Shop Traditional Delicacies
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-xl mx-auto">
              Select product variants, check dynamic GST prices, and click "Order via WhatsApp" to place your order directly.
            </p>
          </div>

          {/* Prominently Visible Center-Aligned Search Bar */}
          <div className="pt-2 max-w-2xl mx-auto text-left">
            <div className="relative flex items-center bg-white rounded-2xl border-2 border-gray-300 focus-within:border-[#95CD1A] focus-within:ring-4 focus-within:ring-[#95CD1A]/20 shadow-lg shadow-gray-100 transition-all duration-300 overflow-hidden">
              <div className="pl-4.5 pr-2 py-4 text-[#95CD1A] flex items-center justify-center">
                <Search className="w-5 h-5 sm:w-6 sm:h-6 text-[#95CD1A] stroke-[2.5]" />
              </div>
              
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recipes, thokku, podi, honey, sherbet..."
                className="w-full py-4 pr-10 text-sm sm:text-base bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none font-bold text-left"
              />

              {searchQuery && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search input"
                  className="mr-3 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Centered Search Result Summary Badge */}
            {searchQuery && (
              <div className="mt-2.5 flex items-center justify-between text-xs text-gray-600 font-bold px-2">
                <span>Filtering by: <strong className="text-[#1F2937]">"{searchQuery}"</strong></span>
                <button
                  onClick={clearSearch}
                  className="text-[#95CD1A] hover:underline font-black cursor-pointer"
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Mobile-Only Horizontal Category Pills (Scrolly Pill Row) */}
        <div className="md:hidden mb-6 overflow-x-auto hide-scrollbar flex items-center gap-2.5 pb-2">
          {CATEGORY_FILTERS.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2.5 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer shadow-xs ${
                  isActive
                    ? 'bg-[#95CD1A] text-white shadow-md shadow-[#95CD1A]/30 scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Main Two-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-start">
          
          {/* Component 1: The Artisan Sidebar (Left Column - 3.5 cols desktop) */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3 bg-gray-50/70 p-6 rounded-2xl border border-gray-200/80 sticky top-24 text-left space-y-6">
            
            <div className="flex items-center justify-between pb-3 border-b border-gray-200/80">
              <h3 className="font-serif-headline text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#95CD1A]" />
                <span>Artisan Menu Index</span>
              </h3>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                Filter
              </span>
            </div>

            {/* Category List */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                Categories
              </span>
              
              <nav className="flex flex-col space-y-1.5 font-bold text-sm">
                {CATEGORY_FILTERS.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${
                        isActive
                          ? 'bg-[#95CD1A] text-white font-black shadow-md shadow-[#95CD1A]/20'
                          : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isActive && <span className="w-2 h-2 rounded-full bg-white" />}
                        <span>{cat.label}</span>
                      </span>
                      <span className={`text-xs font-mono font-normal ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                        ({cat.id === 'all' ? PRODUCTS.length : PRODUCTS.filter(p => p.categoryId === cat.id).length})
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Premium iOS-Style Availability Toggle Switch */}
            <div className="pt-4 border-t border-gray-200/80 flex items-center justify-between gap-3">
              <div className="flex flex-col text-left">
                <span className="text-xs font-extrabold text-[#1F2937]">
                  In-Stock Items Only
                </span>
                <span className="text-[10px] text-gray-400 font-semibold">
                  Hide sold out items
                </span>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={showInStockOnly}
                onClick={() => setShowInStockOnly((prev) => !prev)}
                className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out cursor-pointer flex items-center shadow-inner border border-gray-200/60 shrink-0 ${
                  showInStockOnly ? 'bg-[#95CD1A] shadow-md shadow-[#95CD1A]/20' : 'bg-gray-300 hover:bg-gray-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center ${
                    showInStockOnly ? 'translate-x-5' : 'translate-x-0'
                  }`}
                >
                  {showInStockOnly && <Check className="w-3 h-3 text-[#1F2937] stroke-[3]" />}
                </span>
              </button>
            </div>

          </aside>

          {/* Component 2: The Organic Product Grid (Right Column - 8 cols desktop) */}
          <main className="md:col-span-8 lg:col-span-9 flex flex-col space-y-4 sm:space-y-6">
            
            {/* Header with Active Category & Item Count */}
            <div className="flex flex-row items-center justify-between gap-2 text-left pb-1">
              <div>
                <h3 className="font-serif-headline text-lg sm:text-2xl font-extrabold text-[#1F2937]">
                  {activeCategoryInfo.label}
                </h3>
                <p className="text-xs text-gray-500 hidden sm:block">
                  Hand-crafted traditional items made with pure ingredients.
                </p>
              </div>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full shrink-0">
                Showing {filteredProducts.length} items
              </span>
            </div>

            {/* Product Cards Responsive Grid (2 Columns on Mobile, 3 Columns on Desktop) */}
            {filteredProducts.length === 0 ? (
              <div className="py-12 text-center bg-gray-50 rounded-2xl border border-gray-200/80 p-6 space-y-3">
                <p className="text-sm font-bold text-gray-700">No traditional products match your search query "{searchQuery}".</p>
                <p className="text-xs text-gray-500">Try searching for other ingredients like "garlic", "ragi", "honey", or reset your filters.</p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                    setShowInStockOnly(false);
                  }}
                  className="px-5 py-2.5 bg-[#95CD1A] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs cursor-pointer"
                >
                  Reset Filters & Search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-6 items-stretch">
                {filteredProducts.map((product: Product) => {
                  const currentVariantIdx = selectedVariants[product.id] ?? 0;
                  const currentVariant = product.variants[currentVariantIdx] || product.variants[0];
                  const priceInfo = calculatePriceDetails(currentVariant.basePrice, product.gstPercentage);
                  const orderUrl = generateWhatsAppOrderUrl(
                    product.name,
                    currentVariant.weight,
                    currentVariant.basePrice,
                    product.gstPercentage
                  );

                  return (
                    <div
                      key={product.id}
                      className="group bg-white rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-xl hover:border-[#95CD1A]/60 transition-all duration-300 flex flex-col justify-between h-full text-left"
                    >
                      {/* Product Image Frame */}
                      <div className="relative aspect-square sm:aspect-4/3 w-full overflow-hidden bg-gray-100 border-b border-gray-100">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                        
                        {/* Category Badge (Desktop) */}
                        <span className="hidden sm:block absolute top-2 left-2 bg-white/90 backdrop-blur-xs text-[#1F2937] text-[10px] font-extrabold px-2.5 py-0.5 rounded-md shadow-xs border border-gray-200">
                          {product.categoryName}
                        </span>

                        <span className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md">
                          {product.gstPercentage}% GST
                        </span>
                      </div>

                      {/* Content Details */}
                      <div className="p-3 sm:p-5 flex flex-col justify-between grow space-y-3 sm:space-y-4">
                        
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-sm sm:text-lg text-[#1F2937] group-hover:text-[#95CD1A] transition-colors leading-tight line-clamp-2">
                            {product.name}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-gray-500 leading-tight line-clamp-1 sm:line-clamp-2">
                            {product.description}
                          </p>
                        </div>

                        {/* Weight Variant Selector & Price */}
                        <div className="pt-2 sm:pt-3 border-t border-gray-100 space-y-2.5">
                          
                          {/* Prominent Weight Selector Dropdown */}
                          <div className="space-y-1">
                            <label htmlFor={`variant-${product.id}`} className="text-xs font-extrabold text-gray-700 block">
                              Weight:
                            </label>
                            <div className="relative w-full">
                              <select
                                id={`variant-${product.id}`}
                                value={currentVariantIdx}
                                onChange={(e) => handleVariantChange(product.id, Number(e.target.value))}
                                className="w-full appearance-none bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-900 text-xs sm:text-sm font-extrabold py-2 px-3 pr-8 rounded-xl focus:outline-none focus:border-[#95CD1A] focus:ring-1 focus:ring-[#95CD1A] cursor-pointer shadow-2xs"
                              >
                                {product.variants.map((v, idx) => (
                                  <option key={v.weight} value={idx}>
                                    {v.weight} - ₹{v.basePrice}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-4 h-4 text-gray-600 absolute right-2.5 top-2.5 pointer-events-none" />
                            </div>
                          </div>

                          {/* Dynamic Price Display */}
                          <div className="flex items-baseline justify-between pt-1">
                            <div>
                              <span className="text-[10px] sm:text-xs font-bold text-gray-400 block uppercase tracking-wider">
                                Total Price
                              </span>
                              <span className="text-base sm:text-2xl font-black text-[#1F2937]">
                                ₹{priceInfo.totalPrice}
                              </span>
                            </div>
                            <span className="text-[10px] sm:text-xs text-gray-400 font-semibold">
                              Incl. GST
                            </span>
                          </div>

                        </div>

                        {/* Prominent WhatsApp Order Action Button */}
                        <div className="pt-1">
                          <a
                            href={orderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 sm:py-3.5 px-3 sm:px-4 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-xs sm:text-sm rounded-xl transition-all duration-300 shadow-md shadow-[#95CD1A]/25 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer text-center"
                          >
                            <PhoneCall className="w-4 h-4 text-white shrink-0" />
                            <span className="truncate">Order via WhatsApp</span>
                          </a>
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </main>

        </div>

      </div>
    </section>
  );
};
