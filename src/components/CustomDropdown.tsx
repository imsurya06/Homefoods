import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption {
  weight: string;
  basePrice: number;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  id?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  selectedIndex,
  onSelect,
  id,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options[selectedIndex] || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!options || options.length === 0) return null;

  // Single option display (No dropdown needed if only 1 weight)
  if (options.length === 1) {
    return (
      <div className="w-full bg-gray-100 border border-gray-200 text-gray-800 text-xs sm:text-sm font-extrabold py-2 px-3 rounded-xl flex items-center justify-between">
        <span>{selectedOption.weight}</span>
        <span className="text-gray-500 font-bold">₹{selectedOption.basePrice}</span>
      </div>
    );
  }

  return (
    <div className="relative w-full text-left" ref={dropdownRef} id={id}>
      {/* Custom Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={`w-full flex items-center justify-between bg-gray-50 hover:bg-white border text-gray-900 text-xs sm:text-sm font-extrabold py-2 px-3.5 rounded-xl transition-all cursor-pointer shadow-xs ${isOpen
            ? 'border-[#95CD1A] ring-2 ring-[#95CD1A]/20 bg-white'
            : 'border-gray-300 hover:border-gray-400'
          }`}
      >
        <div className="flex items-center gap-2">
          <span>{selectedOption.weight}</span>
          <span className="text-[#95CD1A] font-black">₹{selectedOption.basePrice}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#95CD1A]' : ''
            }`}
        />
      </button>

      {/* Floating Animated Custom Popover Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-150">
          <div role="listbox" className="max-h-48 overflow-y-auto divide-y divide-gray-100">
            {options.map((opt, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${opt.weight}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelect(idx);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between px-3.5 py-2.5 text-xs sm:text-sm font-bold cursor-pointer transition-colors ${isSelected
                      ? 'bg-[#95CD1A]/10 text-[#95CD1A] font-extrabold'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected ? (
                      <Check className="w-4 h-4 text-[#95CD1A] shrink-0" />
                    ) : (
                      <span className="w-4 h-4 shrink-0" />
                    )}
                    <span>{opt.weight}</span>
                  </div>
                  <span className={isSelected ? 'text-[#95CD1A] font-black' : 'text-gray-500 font-bold'}>
                    ₹{opt.basePrice}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
