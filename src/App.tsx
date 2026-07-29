import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { CuratedProcessSection } from './components/CuratedProcessSection';
import { ShopCatalog } from './components/ShopCatalog';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { CheckCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { CATEGORY_FILTERS } from './data/products';
import { type CartItem } from './data/bestsellers';

export function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'shop'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // Cart State with LocalStorage Persistence
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('hf_cart_items');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch {
      return [];
    }
  });

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('hf_cart_items', JSON.stringify(cartItems));
    } catch (err) {
      console.error('Failed to save cart to localStorage', err);
    }
  }, [cartItems]);

  // Sync hash URL navigation (e.g. #shop)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#shop') {
        setCurrentPage('shop');
      } else if (hash === '#home' || hash === '') {
        setCurrentPage('home');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const showToast = (message: string) => {
    setActiveNotification(message);
    setTimeout(() => {
      setActiveNotification(null);
    }, 4000);
  };

  const handleNavigatePage = (page: 'home' | 'shop', categoryId: string = 'all', query: string = '') => {
    setCurrentPage(page);
    setSelectedCategory(categoryId);
    setSearchQuery(query);
    window.location.hash = page === 'shop' ? '#shop' : '#home';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (searchTerm: string) => {
    const queryTerm = searchTerm.trim();
    if (queryTerm) {
      showToast(`Filter applied for "${queryTerm}"`);
    } else {
      showToast('Filter applied for "All Products"');
    }
    handleNavigatePage('shop', 'all', queryTerm);
  };

  const handleCategorySelect = (categoryId: string) => {
    const catObj = CATEGORY_FILTERS.find((c) => c.id === categoryId);
    const categoryName = catObj ? catObj.label : categoryId;
    showToast(`Filter applied for "${categoryName}"`);
    handleNavigatePage('shop', categoryId, '');
  };

  const handleViewInventory = () => {
    showToast('Filter applied for "All Inventory"');
    handleNavigatePage('shop', 'all', '');
  };

  const handleViewMenu = () => {
    showToast('Filter applied for "Full Menu"');
    handleNavigatePage('shop', 'all', '');
  };

  // Cart Operations
  const handleAddToCart = (newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    const compositeId = `${newItem.productId}-${newItem.weight}`;
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === compositeId);
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === compositeId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevItems, { ...newItem, id: compositeId, quantity: 1 }];
    });
    showToast('Cart updated');
  };

  const handleUpdateQuantity = (id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(id);
      return;
    }
    setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item)));
  };

  const handleRemoveFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    showToast('Cart updated');
  };

  const handleClearCart = () => {
    setCartItems([]);
    showToast('Cart cleared');
  };

  const totalCartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartGrandTotal = cartItems.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);

  return (
    <div className="min-h-screen bg-white text-[#1F2937] font-sans flex flex-col justify-between">
      
      {/* Bottom Floating Toast Notification */}
      {activeNotification && (
        <div className={`fixed ${cartItems.length > 0 && !isCartOpen ? 'bottom-24 sm:bottom-28' : 'bottom-8'} left-1/2 -translate-x-1/2 z-[60] bg-white text-[#1F2937] px-4 py-2 rounded-xl shadow-xl border border-gray-200/90 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-none`}>
          <div className="w-5 h-5 rounded-full bg-[#F7FCE8] text-[#95CD1A] flex items-center justify-center shrink-0">
            <CheckCircle className="w-3.5 h-3.5 text-[#95CD1A]" />
          </div>
          <span className="text-xs font-bold text-[#1F2937] tracking-wide whitespace-nowrap">
            {activeNotification}
          </span>
        </div>
      )}

      {/* Floating Bottom Cart Checkout Bar */}
      {cartItems.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-3 right-3 sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-50 animate-in slide-in-from-bottom-6 duration-300">
          <div
            onClick={() => setIsCartOpen(true)}
            className="bg-[#1F2937] text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-gray-700/80 flex items-center justify-between gap-3 cursor-pointer group hover:bg-black transition-all transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#95CD1A] text-white flex items-center justify-center font-bold relative shrink-0 shadow-md">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-[#1F2937] text-[10px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-gray-200">
                  {totalCartItemCount}
                </span>
              </div>
              <div className="text-left font-numeric">
                <span className="text-xs text-gray-400 font-medium block leading-none">
                  {totalCartItemCount} {totalCartItemCount === 1 ? 'item' : 'items'} added
                </span>
                <span className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-snug">
                  ₹{cartGrandTotal} <span className="text-[10px] text-gray-400 font-normal">(Incl. GST)</span>
                </span>
              </div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsCartOpen(true);
              }}
              className="px-4 py-2.5 bg-[#95CD1A] hover:bg-[#7EB30E] text-white text-xs sm:text-sm font-extrabold rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <span>View Cart & Checkout</span>
              <ArrowRight className="w-4 h-4 text-white stroke-[3] group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* Persistent Header */}
      <Header
        currentPage={currentPage}
        onNavigate={(page) => handleNavigatePage(page, 'all', '')}
        cartItemCount={totalCartItemCount}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Sliding Cart Panel Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onExploreShop={() => handleNavigatePage('shop', 'all', '')}
      />

      {/* Main Page Routing View */}
      <main className="grow">
        {currentPage === 'home' ? (
          <>
            {/* Home Page View */}
            <HeroSection
              onSearchSubmit={handleSearchSubmit}
              onCategorySelect={handleCategorySelect}
              onViewInventory={handleViewInventory}
              onViewMenu={handleViewMenu}
            />
            <CuratedProcessSection />
          </>
        ) : (
          /* Separate Shop Catalog Page View */
          <ShopCatalog
            initialCategory={selectedCategory}
            initialSearchQuery={searchQuery}
            onNavigateHome={() => handleNavigatePage('home', 'all', '')}
            onAddToCart={handleAddToCart}
          />
        )}
      </main>

      {/* Persistent Footer */}
      <Footer onNavigatePage={(page, categoryId) => handleNavigatePage(page, categoryId || 'all', '')} />
    </div>
  );
}

export default App;

