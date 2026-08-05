import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type ProductImage } from '../data/products';

interface ProductImageSliderProps {
  images: ProductImage[];
  productName: string;
  onImageClick: (index: number) => void;
}

export const ProductImageSlider: React.FC<ProductImageSliderProps> = ({
  images,
  productName,
  onImageClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const hasMultiple = images && images.length > 1;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMultiple) return;
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hasMultiple) return;
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  // Touch Swipe handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    } else if (isRightSwipe) {
      setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }
  };

  const currentImage = images[currentIndex] || { src: '', alt: productName };

  return (
    <div
      className="relative w-full h-full group overflow-hidden bg-gray-50 flex items-center justify-center cursor-pointer"
      onClick={() => onImageClick(currentIndex)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Active Image */}
      <img
        src={currentImage.src}
        alt={currentImage.alt || productName}
        loading={currentIndex === 0 ? "eager" : "lazy"}
        className="w-full h-full object-cover transition-all duration-500 ease-out transform group-hover:scale-105"
      />

      {/* Navigation Arrows (Desktop overlay on hover) */}
      {hasMultiple && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 hover:scale-110 active:scale-95"
            title="Previous Image"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/80 hover:bg-white text-gray-800 shadow-md border border-gray-200/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 hover:scale-110 active:scale-95"
            title="Next Image"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        </>
      )}

      {/* Dot Indicators */}
      {hasMultiple && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/35 px-2.5 py-1 rounded-full backdrop-blur-xs z-10">
          {images.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-3.5 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}

      {/* Text Slide Count Indicator (Mobile) */}
      {hasMultiple && (
        <span className="sm:hidden absolute top-2 right-2 bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-md z-10">
          {currentIndex + 1} / {images.length}
        </span>
      )}
    </div>
  );
};
