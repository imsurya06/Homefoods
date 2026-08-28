import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, X, ArrowLeft, Check, ShoppingBag, Zap } from 'lucide-react';
import { PRODUCTS, type Product } from '../data/products';
import { getLiveProducts, getCachedProductsSync } from '../services/productService';
import { calculatePriceDetails, type CartItem } from '../data/bestsellers';
import { filterAndSortProductsBySearch } from '../utils/searchUtils';
import { CustomDropdown } from './CustomDropdown';
import { ProductImageSlider } from './ProductImageSlider';
import { ProductImageLightbox } from './ProductImageLightbox';

interface ShopCatalogProps {
  initialCategory?: string;
  initialSearchQuery?: string;
  onNavigateHome?: () => void;
  onAddToCart?: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  onOrderNow?: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
}

export const ShopCatalog: React.FC<ShopCatalogProps> = ({
  initialCategory = 'all',
  initialSearchQuery = '',
  onNavigateHome,
  onAddToCart,
  onOrderNow,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearchQuery);
  const [showInStockOnly, setShowInStockOnly] = useState<boolean>(false);
  const [productsList, setProductsList] = useState<Product[]>(() => {
    const cached = getCachedProductsSync();
    return cached.length > 0 ? cached : PRODUCTS;
  });

  // Track selected variant index for each product ID
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});

  // Lightbox Modal State
  const [lightboxState, setLightboxState] = useState<{
    isOpen: boolean;
    images: { id: number; src: string; alt: string }[];
    initialIndex: number;
    productName: string;
    description?: string;
  }>({
    isOpen: false,
    images: [],
    initialIndex: 0,
    productName: '',
    description: '',
  });

  const openLightbox = (product: Product, index: number) => {
    const imgs = product.images && product.images.length > 0
      ? product.images
      : [{ id: 0, src: product.imageUrl, alt: product.name }];
    setLightboxState({
      isOpen: true,
      images: imgs,
      initialIndex: index,
      productName: product.name,
      description: product.description,
    });
  };

  const closeLightbox = () => {
    setLightboxState((prev) => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    let isMounted = true;
    getLiveProducts()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setProductsList(data);
        }
      })
      .catch((err) => console.warn('Live products load error:', err));
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (initialCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory]);

  useEffect(() => {
    setSearchQuery(initialSearchQuery);
  }, [initialSearchQuery]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedCategory, searchQuery]);

  const handleVariantChange = (productId: string, variantIdx: number) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [productId]: variantIdx,
    }));
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  // Filter & Sort products: Global Search with relevance ranking, or Category filter when search query is empty
  const filteredProducts = useMemo(() => {
    let list = productsList;

    // Apply In-Stock Filter first if enabled
    if (showInStockOnly) {
      list = list.filter((product) => product.isAvailable);
    }

    // Global Search Query Filter & Relevance Ranking
    if (searchQuery.trim()) {
      return filterAndSortProductsBySearch(list, searchQuery);
    }

    // Category Filter (applies when search bar is empty)
    if (selectedCategory && selectedCategory !== 'all') {
      const selCat = selectedCategory.toLowerCase().trim();
      const selCatBase = selCat.endsWith('s') ? selCat.slice(0, -1) : selCat;

      list = list.filter((product: Product) => {
        const prodCatId = (product.categoryId || '').toLowerCase().trim();
        const prodCatName = (product.categoryName || '').toLowerCase().trim();

        const isExactId = prodCatId === selCat;
        const isSubstringMatch = prodCatId.includes(selCatBase) || selCatBase.includes(prodCatId);
        const isNameMatch = prodCatName.includes(selCatBase) || selCatBase.includes(prodCatName);

        return isExactId || isSubstringMatch || isNameMatch;
      });
    }

    return list;
  }, [productsList, selectedCategory, searchQuery, showInStockOnly]);

  // Dynamically compute category filters based on live products
  const categoryFilters = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number }>();
    map.set('all', { id: 'all', label: 'All Products', count: productsList.length });
    productsList.forEach((p) => {
      if (p.categoryId && p.categoryId !== 'all') {
        const existing = map.get(p.categoryId);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(p.categoryId, {
            id: p.categoryId,
            label: p.categoryName || p.categoryId,
            count: 1,
          });
        }
      }
    });
    return Array.from(map.values());
  }, [productsList]);

  const activeCategoryInfo = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'all') {
      return categoryFilters.find((c) => c.id === 'all') || { id: 'all', label: 'All Products', count: productsList.length };
    }

    const target = selectedCategory.toLowerCase().trim();
    const targetBase = target.endsWith('s') ? target.slice(0, -1) : target;

    // 1. Direct ID match
    let match = categoryFilters.find((c) => c.id.toLowerCase().trim() === target);
    if (match) return match;

    // 2. Substring ID match (e.g. 'thokku' matching 'thokku-varieties')
    match = categoryFilters.find((c) => {
      const cId = c.id.toLowerCase().trim();
      const cBase = cId.endsWith('s') ? cId.slice(0, -1) : cId;
      return cId.includes(targetBase) || targetBase.includes(cBase);
    });
    if (match) return match;

    // 3. Substring Label match
    match = categoryFilters.find((c) => {
      const cLabel = c.label.toLowerCase().trim();
      return cLabel.includes(targetBase);
    });
    if (match) return match;

    return categoryFilters[0] || { id: 'all', label: 'All Products', count: productsList.length };
  }, [categoryFilters, selectedCategory, productsList.length]);

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
              Select product variants and click "Order Now" to place your order directly.
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
                placeholder="Search recipes, thokku, podi, honey, sharbath..."
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
          {categoryFilters.map((cat) => {
            const isActive = !searchQuery.trim() && (selectedCategory === cat.id || activeCategoryInfo.id === cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery('');
                }}
                className={`px-4 py-2.5 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all cursor-pointer shadow-xs ${isActive
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
              <h3 className="font-serif-headline text-xs sm:text-sm font-extrabold text-[#1F2937] tracking-tight">
                Artisan Menu Index
              </h3>
              <div className="flex flex-col items-center justify-center shrink-0 leading-none">
                <Filter className="w-3.5 h-3.5 text-[#95CD1A]" />
                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wider mt-0.5">
                  Filter
                </span>
              </div>
            </div>

            {/* Category List */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2">
                Categories
              </span>

              <nav className="flex flex-col space-y-1.5 font-bold text-sm">
                {categoryFilters.map((cat) => {
                  const isActive = !searchQuery.trim() && (selectedCategory === cat.id || activeCategoryInfo.id === cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSearchQuery('');
                      }}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all text-left cursor-pointer ${isActive
                          ? 'bg-[#95CD1A] text-white font-black shadow-md shadow-[#95CD1A]/20'
                          : 'text-gray-600 hover:bg-white/80 hover:text-gray-900'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        {isActive && <span className="w-2 h-2 rounded-full bg-white" />}
                        <span>{cat.label}</span>
                      </span>
                      <span className={`text-xs font-mono font-normal ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                        ({
                          cat.id === 'all'
                            ? productsList.length
                            : productsList.filter((p) => {
                                const catBase = cat.id.toLowerCase().replace(/s$/, '');
                                const pCatId = (p.categoryId || '').toLowerCase();
                                const pCatName = (p.categoryName || '').toLowerCase();
                                return pCatId === cat.id || pCatId.includes(catBase) || pCatName.includes(catBase);
                              }).length
                        })
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
                className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 ease-in-out cursor-pointer flex items-center shadow-inner border border-gray-200/60 shrink-0 ${showInStockOnly ? 'bg-[#95CD1A] shadow-md shadow-[#95CD1A]/20' : 'bg-gray-300 hover:bg-gray-400'
                  }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ease-in-out flex items-center justify-center ${showInStockOnly ? 'translate-x-5' : 'translate-x-0'
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
                  {searchQuery.trim() ? `Search Results for "${searchQuery.trim()}"` : activeCategoryInfo.label}
                </h3>
                <p className="text-xs text-gray-500 hidden sm:block">
                  {searchQuery.trim()
                    ? `Searching globally across all store categories.`
                    : `Hand-crafted traditional items made with pure ingredients.`}
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
                  const regularPriceInfo = currentVariant.regularPrice
                    ? calculatePriceDetails(currentVariant.regularPrice, product.gstPercentage)
                    : null;
                  const discountPercent = regularPriceInfo
                    ? Math.round(((regularPriceInfo.totalPrice - priceInfo.totalPrice) / regularPriceInfo.totalPrice) * 100)
                    : 0;

                  const handleAddToCartClick = () => {
                    if (onAddToCart) {
                      onAddToCart({
                        productId: product.id,
                        name: product.name,
                        weight: currentVariant.weight,
                        pricePerUnit: priceInfo.totalPrice,
                        imageUrl: product.imageUrl,
                        gstPercentage: product.gstPercentage,
                      });
                    }
                  };

                  const handleOrderNowClick = () => {
                    const itemData = {
                      productId: product.id,
                      name: product.name,
                      weight: currentVariant.weight,
                      pricePerUnit: priceInfo.totalPrice,
                      imageUrl: product.imageUrl,
                      gstPercentage: product.gstPercentage,
                    };
                    if (onOrderNow) {
                      onOrderNow(itemData);
                    } else if (onAddToCart) {
                      onAddToCart(itemData);
                    }
                  };

                  return (
                    <div
                      key={product.id}
                      className="group bg-white rounded-xl sm:rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-xl hover:border-[#95CD1A]/60 transition-all duration-300 flex flex-col justify-between h-full text-left"
                    >
                      {/* Product Image Frame with Slider */}
                      <div className="relative aspect-4/3 sm:aspect-16/10 w-full max-h-44 sm:max-h-56 overflow-hidden bg-gray-100 border-b border-gray-100">
                        <ProductImageSlider
                          images={product.images && product.images.length > 0 
                            ? product.images 
                            : [{ id: 0, src: product.imageUrl, alt: product.name }]}
                          productName={product.name}
                          onImageClick={(index) => openLightbox(product, index)}
                        />

                        {/* Category Badge (Desktop) */}
                        <span className="hidden sm:block absolute top-2 left-2 bg-white/90 backdrop-blur-xs text-[#1F2937] text-[10px] font-extrabold px-2.5 py-0.5 rounded-md shadow-xs border border-gray-200 pointer-events-none z-10">
                          {product.categoryName}
                        </span>

                        {/* Stock Status Badge */}
                        {!product.isAvailable ? (
                          <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs z-10">
                            Sold Out
                          </span>
                        ) : product.stockQuantity !== undefined && product.stockQuantity <= 5 ? (
                          <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs z-10 animate-pulse">
                            Only {product.stockQuantity} Left!
                          </span>
                        ) : (
                          <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow-xs z-10">
                            In Stock
                          </span>
                        )}
                      </div>

                      {/* Content Details */}
                      <div className="p-2.5 sm:p-5 flex flex-col justify-between grow space-y-2.5 sm:space-y-4">

                        <div className="space-y-1">
                          <h4 className="font-extrabold text-sm sm:text-lg text-[#1F2937] group-hover:text-[#95CD1A] transition-colors leading-tight line-clamp-2">
                            {product.name}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-gray-500 leading-tight line-clamp-1 sm:line-clamp-2">
                            {product.description}
                          </p>
                        </div>

                        {/* Weight Variant Selector & Price */}
                        <div className="pt-2 sm:pt-3 border-t border-gray-100 space-y-2">

                          {/* Prominent Weight Selector Custom Dropdown */}
                          <div className="space-y-1">
                            <label className="text-xs font-extrabold text-gray-700 hidden sm:block">
                              Weight:
                            </label>
                            <CustomDropdown
                              id={`variant-${product.id}`}
                              options={product.variants}
                              selectedIndex={currentVariantIdx}
                              onSelect={(idx) => handleVariantChange(product.id, idx)}
                            />
                          </div>

                           {/* Dynamic Price Display */}
                           <div className="flex items-baseline justify-between pt-1">
                             <div className="flex flex-col text-left">
                               <span className="text-[10px] sm:text-xs font-bold text-gray-400 hidden sm:block uppercase tracking-wider">
                                 Total Price
                               </span>
                               <div className="flex flex-wrap items-baseline gap-1.5 mt-0.5">
                                 {regularPriceInfo && regularPriceInfo.totalPrice > priceInfo.totalPrice && (
                                   <>
                                     <span className="line-through text-[11px] sm:text-sm text-gray-400 font-extrabold">
                                       ₹{regularPriceInfo.totalPrice}
                                     </span>
                                     {discountPercent > 0 && (
                                       <span className="text-[9px] bg-red-50 text-red-500 font-black px-1 py-0.5 rounded-md">
                                         {discountPercent}% OFF
                                       </span>
                                     )}
                                   </>
                                 )}
                                 <span className="text-base sm:text-2xl font-black text-[#1F2937]">
                                   ₹{priceInfo.totalPrice}
                                 </span>
                               </div>
                             </div>
                           </div>

                         </div>

                         {/* Dual Action Buttons: Add to Cart & Order Now (Side-by-side on mobile, 2 cols on desktop) */}
                         <div className="pt-1 flex flex-row gap-1.5 sm:grid sm:grid-cols-2 sm:gap-2 w-full">
                           <button
                             onClick={handleAddToCartClick}
                             disabled={!product.isAvailable}
                             title="Add to Cart"
                             className={`p-2.5 sm:py-2.5 sm:px-3 font-extrabold text-xs sm:text-xs rounded-xl border transition-all duration-200 shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer text-center group/cartBtn ${
                               product.isAvailable
                                 ? 'bg-[#F7FCE8] hover:bg-[#95CD1A] text-[#1F2937] hover:text-white border-[#95CD1A]/40'
                                 : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                             }`}
                           >
                             <ShoppingBag className={`w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 ${product.isAvailable ? 'text-[#95CD1A] group-hover/cartBtn:text-white' : 'text-gray-300'}`} />
                             <span className="hidden sm:inline whitespace-nowrap font-black">Add to Cart</span>
                           </button>

                           <button
                             onClick={handleOrderNowClick}
                             disabled={!product.isAvailable}
                             className={`flex-1 sm:w-full py-2.5 px-3 text-white font-extrabold text-xs sm:text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                               product.isAvailable
                                 ? 'bg-[#95CD1A] hover:bg-[#7EB30E] shadow-md shadow-[#95CD1A]/20 hover:shadow-lg transform hover:-translate-y-0.5'
                                 : 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                             }`}
                           >
                             <Zap className="w-3.5 h-3.5 shrink-0 text-white fill-white" />
                             <span className="whitespace-nowrap font-black">{product.isAvailable ? 'Order Now' : 'Sold Out'}</span>
                           </button>
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

      {/* Dynamic Lightbox Modal */}
      <ProductImageLightbox
        isOpen={lightboxState.isOpen}
        onClose={closeLightbox}
        images={lightboxState.images}
        initialIndex={lightboxState.initialIndex}
        productName={lightboxState.productName}
        description={lightboxState.description}
      />
    </section>
  );
};
