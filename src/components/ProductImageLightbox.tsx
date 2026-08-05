import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { type ProductImage } from '../data/products';

interface ProductImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: ProductImage[];
  initialIndex: number;
  productName: string;
}

export const ProductImageLightbox: React.FC<ProductImageLightboxProps> = ({
  isOpen,
  onClose,
  images,
  initialIndex,
  productName,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Sync state if initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
  }, [initialIndex, isOpen]);

  const hasMultiple = images && images.length > 1;

  const handlePrev = () => {
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  // Keyboard navigation & Escape close listeners
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasMultiple) handlePrev();
      if (e.key === 'ArrowRight' && hasMultiple) handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasMultiple, currentIndex]);

  // Touch Swipe navigation
  const minSwipeDistance = 50;
  const onTouchStart = (e: React.TouchEvent) => {
    if (isZoomed) return; // Disable swipe when zoomed to allow panning
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (isZoomed) return;
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (isZoomed || !touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  if (!isOpen) return null;

  const currentImage = images[currentIndex] || { src: '', alt: productName };

  // Calculate dynamic captions based on slide role if not specified in alt
  const getCaption = (index: number, altText: string) => {
    if (altText && altText !== productName && !altText.includes('hero')) {
      return altText;
    }
    const captionsMap = [
      'Featured Product - Prepared freshly following ancestral Madurai culinary traditions.',
      'Ingredients Breakdown - 100% pure ingredients, premium spices, cold pressed oils, and zero preservatives.',
      'Cooking Process - Prepared in clean, hygienic batches using traditional slow-curation.',
      'Shelf Life & Quality - Locked in freshness with state-of-the-art sterile packaging.',
      'Serving Suggestion - Best enjoyed warm with traditional side dishes.',
    ];
    return captionsMap[index % captionsMap.length];
  };

  return (
    <div
      onClick={(e) => {
        // Close if clicking the dark overlay backdrop itself
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between items-center py-6 select-none animate-in fade-in duration-200"
    >
      {/* Lightbox Header / Controls */}
      <div className="w-full max-w-5xl px-4 flex items-center justify-between z-10 shrink-0">
        <div className="text-left">
          <h4 className="text-sm sm:text-base font-black text-white leading-tight">
            {productName}
          </h4>
          <span className="text-[10px] sm:text-xs font-bold text-gray-400">
            Image {currentIndex + 1} of {images.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom Toggle Button */}
          <button
            onClick={() => setIsZoomed((prev) => !prev)}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
            title={isZoomed ? "Zoom Out" : "Zoom In"}
          >
            {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>

          {/* Close Lightbox */}
          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Close Preview (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        className="flex-1 w-full max-w-5xl flex items-center justify-center relative overflow-hidden px-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Navigation Buttons (Desktop) */}
        {hasMultiple && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white shadow-lg backdrop-blur-xs hidden md:flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95 z-10"
              title="Previous"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2.5]" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white shadow-lg backdrop-blur-xs hidden md:flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95 z-10"
              title="Next"
            >
              <ChevronRight className="w-6 h-6 stroke-[2.5]" />
            </button>
          </>
        )}

        {/* The Zoomable Display Image */}
        <div
          className={`relative max-h-[70vh] sm:max-h-[75vh] max-w-full aspect-auto transition-transform duration-300 ease-out select-none flex items-center justify-center ${
            isZoomed ? 'scale-175 cursor-zoom-out overflow-auto' : 'scale-100 cursor-zoom-in'
          }`}
          onClick={() => setIsZoomed((prev) => !prev)}
        >
          <img
            src={currentImage.src}
            alt={currentImage.alt || productName}
            className="max-h-[70vh] sm:max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl pointer-events-none select-none"
          />
        </div>
      </div>

      {/* Lightbox Footer (Captions overlay) */}
      <div className="w-full max-w-2xl px-6 text-center z-10 shrink-0">
        <p className="text-xs sm:text-sm text-gray-200 font-extrabold leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-300">
          {getCaption(currentIndex, currentImage.alt)}
        </p>
        
        {/* Mobile Swipe Guidance */}
        {hasMultiple && (
          <span className="md:hidden block text-[9px] text-gray-500 font-bold mt-2">
            Swipe left/right to browse images
          </span>
        )}
      </div>
    </div>
  );
};
