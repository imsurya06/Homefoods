import React from 'react';
import { Leaf, Ban, HeartHandshake, Flame, Sparkles } from 'lucide-react';

export const MarqueeTrustBar: React.FC = () => {
  const trustItems = [
    { icon: <Leaf className="w-4 h-4 text-[#95CD1A] shrink-0" />, label: '100% Vegetarian' },
    { icon: <Ban className="w-4 h-4 text-[#95CD1A] shrink-0" />, label: 'No Artificial Preservatives' },
    { icon: <img src="/fssai-logo.png" alt="FSSAI Logo" className="h-5 w-auto object-contain shrink-0" />, label: 'FSSAI Certified', sub: '(Lic. 22425577000230)' },
    { icon: <HeartHandshake className="w-4 h-4 text-amber-600 shrink-0" />, label: 'Authentic Family Recipes' },
    { icon: <Flame className="w-4 h-4 text-[#95CD1A] shrink-0" />, label: 'Hand-pounded Spices' },
    { icon: <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />, label: 'Pure Desi Ghee' },
  ];

  return (
    <div className="relative z-30 w-full bg-white text-gray-700 py-2 overflow-hidden border-b border-gray-200/80 shadow-2xs">
      <div className="relative w-full overflow-hidden">
        <div className="animate-marquee flex items-center gap-10 sm:gap-14 whitespace-nowrap text-xs sm:text-sm font-medium select-none">
          
          {/* First Set of Items */}
          {trustItems.map((item, idx) => (
            <div key={`top-trust-1-${idx}`} className="flex items-center gap-2">
              {item.icon}
              <span className="font-semibold text-gray-800">{item.label}</span>
              {item.sub && <span className="font-mono text-gray-500 font-normal text-[11px]">{item.sub}</span>}
              <span className="ml-6 sm:ml-8 text-gray-300 font-light">•</span>
            </div>
          ))}

          {/* Duplicate Second Set for Infinite Loop */}
          {trustItems.map((item, idx) => (
            <div key={`top-trust-2-${idx}`} className="flex items-center gap-2">
              {item.icon}
              <span className="font-semibold text-gray-800">{item.label}</span>
              {item.sub && <span className="font-mono text-gray-500 font-normal text-[11px]">{item.sub}</span>}
              <span className="ml-6 sm:ml-8 text-gray-300 font-light">•</span>
            </div>
          ))}

          {/* Duplicate Third Set for Ultra Smooth Loop on Wide Screens */}
          {trustItems.map((item, idx) => (
            <div key={`top-trust-3-${idx}`} className="flex items-center gap-2">
              {item.icon}
              <span className="font-semibold text-gray-800">{item.label}</span>
              {item.sub && <span className="font-mono text-gray-500 font-normal text-[11px]">{item.sub}</span>}
              <span className="ml-6 sm:ml-8 text-gray-300 font-light">•</span>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
};
