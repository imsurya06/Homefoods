import React, { useState, useEffect } from 'react';
import { Award, Clock, Heart, Zap } from 'lucide-react';
import { calculatePriceDetails, type CartItem } from '../data/bestsellers';
import { type Product } from '../data/products';
import { getLiveProducts, getCachedProductsSync } from '../services/productService';

interface CuratedProcessSectionProps {
  onAddToCart?: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  onOrderNow?: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
}

export const CuratedProcessSection: React.FC<CuratedProcessSectionProps> = ({ onAddToCart, onOrderNow }) => {
  const [liveProducts, setLiveProducts] = useState<Product[]>(() => getCachedProductsSync().slice(0, 3));
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({});

  useEffect(() => {
    getLiveProducts().then((data) => {
      if (data && data.length > 0) setLiveProducts(data.slice(0, 3));
    });
  }, []);

  const handleVariantChange = (productId: string, variantIndex: number) => {
    setSelectedVariants((prev) => ({
      ...prev,
      [productId]: variantIndex,
    }));
  };

  return (
    <section id="process" className="w-full bg-white text-[#1F2937] pt-8 md:pt-12 pb-16 md:pb-24 px-4 sm:px-8 lg:px-12 border-t border-gray-100 relative overflow-hidden">

      {/* Subtle Background Glow Accent */}
      <div className="absolute inset-0 pointer-events-none -z-0">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-[#F7FCE8] rounded-full blur-3xl opacity-60 transform -translate-y-1/2" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Main Section Grid: Our Process (Left 5 Cols) vs Curated Signature Bestsellers (Right 7 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-12 items-start">

          {/* Component 1: The Homemade Process (Left Side) */}
          <div className="lg:col-span-5 flex flex-col items-start text-left space-y-8">

            {/* Section Tag */}
            <div className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-[#F7FCE8] border border-[#ECF9CA] text-[#1F2937] text-xs font-extrabold uppercase tracking-wider">
              <span>Our Recipe Story & Method</span>
            </div>

            {/* Heading & Subheadline */}
            <div className="space-y-4">
              <h2 className="font-serif-headline text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1F2937] leading-[1.15]">
                Hand-Pounded & <br />
                <span className="italic text-[#95CD1A] font-normal">
                  Sun-Dried.
                </span>
              </h2>

              <p className="text-base text-gray-600 leading-relaxed max-w-md">
                We believe food tastes best when crafted slowly. Our spices are sun-dried under traditional Tamil Nadu sunshine, hand-pounded in small batches, and cooked in cold-pressed sesame oil and pure ghee. No artificial colors, no chemicals—just pure, authentic taste.
              </p>
            </div>

            {/* Crafting Process Points */}
            <div className="space-y-3.5 w-full pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="p-2 rounded-lg bg-[#F7FCE8] text-[#95CD1A]">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1F2937]">Small Batch Heritage Recipes</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Prepared in limited quantities to guarantee freshness.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="p-2 rounded-lg bg-[#F7FCE8] text-[#95CD1A]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1F2937]">Time-Honored Preparation</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Slow-cooked without hurry to lock in deep traditional flavors.</p>
                </div>
              </div>
            </div>

            {/* Visual Staggered Photo Collage */}
            <div className="relative w-full max-w-md pt-6">
              {/* Primary Image: Sun-dried Spices */}
              <div className="relative rounded-2xl overflow-hidden shadow-xl border-4 border-white aspect-4/3 transform -rotate-1 hover:rotate-0 transition-transform duration-500">
                <img
                  src="https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80"
                  alt="Sun-dried traditional Indian spices"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <span className="absolute bottom-3 left-4 text-white text-xs font-bold tracking-wide">
                  🌿 100% Natural Sun-Dried Spices
                </span>
              </div>

              {/* Overlapping Secondary Image: Mortar & Pestle */}
              <div className="absolute -bottom-6 -right-4 sm:-right-6 w-44 sm:w-52 aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-white transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <img
                  src="https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80"
                  alt="Hand-pounding South Indian podi spices"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-white/95 backdrop-blur-xs text-[#1F2937] text-[10px] font-bold px-2 py-1 rounded-md shadow-xs flex items-center gap-1">
                  <Heart className="w-3 h-3 text-[#95CD1A] fill-[#95CD1A]" />
                  <span>Handcrafted Batch</span>
                </div>
              </div>
            </div>

          </div>

          {/* Component 2: Curated Signature Items (Right Side) */}
          <div className="lg:col-span-7 flex flex-col space-y-8">

            {/* Header Title */}
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pb-4 border-b border-gray-100 text-left">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-widest text-[#1F2937] block mb-1">
                  Customer Favorites
                </span>
                <h3 className="font-serif-headline text-2xl sm:text-3xl font-extrabold text-[#1F2937]">
                  Curated Signature Bestsellers
                </h3>
              </div>
            </div>

            {/* Loose, Airy Bestsellers Product Presentation */}
            <div className="space-y-6">
              {liveProducts.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-8 text-center space-y-2">
                  <p className="text-sm font-bold text-gray-700">No products available yet.</p>
                  <p className="text-xs text-gray-500">Add products in your WordPress admin panel to display them here live!</p>
                </div>
              ) : (
                liveProducts.map((product: Product) => {
                  const currentVariantIdx = selectedVariants[product.id] ?? 0;
                  const currentVariant = product.variants[currentVariantIdx] || product.variants[0];
                  const priceInfo = calculatePriceDetails(currentVariant.basePrice, product.gstPercentage);

                  const handleOrderNow = () => {
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
                      className="group bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-xs hover:shadow-xl hover:border-[#95CD1A]/50 transition-all duration-300 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-left"
                    >
                      {/* Product Image */}
                      <div className="relative w-full sm:w-44 aspect-square rounded-xl overflow-hidden bg-gray-100 shrink-0 border border-gray-100">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <span className="absolute top-2 left-2 bg-[#95CD1A] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-xs">
                          Live Product
                        </span>
                      </div>

                      {/* Product Info & Controls */}
                      <div className="flex flex-col justify-between grow w-full space-y-4">

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                              {product.categoryName}
                            </span>
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {product.gstPercentage}% GST Included
                            </span>
                          </div>

                          <h4 className="text-lg sm:text-xl font-extrabold text-[#1F2937] group-hover:text-[#95CD1A] transition-colors mt-1">
                            {product.name}
                          </h4>

                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed line-clamp-2">
                            {product.description}
                          </p>
                        </div>

                        {/* Variant Selection & Pricing Bar */}
                        <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">

                          {/* Weight Variant Switcher */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-500 mr-1">Weight:</span>
                            {product.variants.map((v, vIdx) => (
                              <button
                                key={v.weight}
                                onClick={() => handleVariantChange(product.id, vIdx)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${vIdx === currentVariantIdx
                                    ? 'bg-[#95CD1A] text-white shadow-xs'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                              >
                                {v.weight}
                              </button>
                            ))}
                          </div>

                          {/* Price Highlights */}
                          <div className="text-right">
                            <span className="text-xs text-gray-400 block">Total Price</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl sm:text-2xl font-extrabold text-[#1F2937]">
                                ₹{priceInfo.totalPrice}
                              </span>
                              <span className="text-[11px] text-gray-400 font-normal">
                                (Base ₹{priceInfo.basePrice} + GST ₹{priceInfo.gstAmount})
                              </span>
                            </div>
                          </div>

                        </div>

                        {/* Order Now Action Button */}
                        <div className="pt-2">
                          <button
                            onClick={handleOrderNow}
                            className="w-full py-3 px-6 bg-[#95CD1A] hover:bg-[#7EB30E] text-white font-extrabold text-sm rounded-xl transition-all duration-300 shadow-md shadow-[#95CD1A]/20 hover:shadow-lg transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Zap className="w-4 h-4 text-white fill-white" />
                            <span>Order Now</span>
                          </button>
                        </div>

                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
