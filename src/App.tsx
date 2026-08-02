import { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { CuratedProcessSection } from './components/CuratedProcessSection';
import { ShopCatalog } from './components/ShopCatalog';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { CheckCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { CATEGORY_FILTERS } from './data/products';
import { type CartItem } from './data/bestsellers';
import { fetchCurrentUser, logoutCustomer, getSavedUserProfile, type UserProfile } from './services/authService';
import { getStoredCart, fetchRemoteCart, saveCartItems, clearCartStorage, mergeCartItems } from './services/cartStorage';

export function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'shop'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // User Auth & Modal States with instant persistence across page refreshes
  const [user, setUser] = useState<UserProfile | null>(() => getSavedUserProfile());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);

  // Cart & Orders Drawer State
  const [cartItems, setCartItems] = useState<CartItem[]>(() => getStoredCart(!!getSavedUserProfile()));
  const cartItemsRef = useRef<CartItem[]>(cartItems);
  useEffect(() => {
    cartItemsRef.current = cartItems;
  }, [cartItems]);

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cartDrawerInitialTab, setCartDrawerInitialTab] = useState<'cart' | 'orders'>('cart');

  // Sync logged-in user details & cart on mount and 3-second live polling across devices
  useEffect(() => {
    let isMounted = true;

    const syncUserAndCart = () => {
      fetchCurrentUser().then((u) => {
        if (isMounted && u) setUser(u);
      });
      fetchRemoteCart().then(({ items: remoteItems, cartCleared }) => {
        if (isMounted && remoteItems && Array.isArray(remoteItems)) {
          setCartItems((prev) => {
            if (cartCleared && remoteItems.length === 0) {
              cartItemsRef.current = [];
              return [];
            }
            if (!cartCleared && prev.length > 0 && remoteItems.length === 0) {
              return prev;
            }
            if (JSON.stringify(prev) === JSON.stringify(remoteItems)) {
              return prev;
            }
            cartItemsRef.current = remoteItems;
            return remoteItems;
          });
        }
      });
    };

    syncUserAndCart();

    let timerId: ReturnType<typeof setTimeout>;

    const scheduleNextPoll = () => {
      if (!isMounted) return;
      timerId = setTimeout(async () => {
        const token = localStorage.getItem('hf_auth_token');
        if (token) {
          try {
            const { items: remoteItems, cartCleared } = await fetchRemoteCart();
            if (isMounted && remoteItems && Array.isArray(remoteItems)) {
              setCartItems((prev) => {
                if (cartCleared && remoteItems.length === 0) {
                  cartItemsRef.current = [];
                  return [];
                }
                if (JSON.stringify(prev) === JSON.stringify(remoteItems)) return prev;
                cartItemsRef.current = remoteItems;
                return remoteItems;
              });
            }
          } catch {}
        }
        scheduleNextPoll();
      }, 2500);
    };

    scheduleNextPoll();

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncUserAndCart();
      }
    };

    const handleCartCleared = () => {
      if (isMounted) {
        cartItemsRef.current = [];
        setCartItems([]);
      }
    };
    const handleAccountDeleted = () => {
      if (isMounted) {
        setUser(null);
        cartItemsRef.current = [];
        setCartItems([]);
        setIsCartOpen(false);
      }
    };

    window.addEventListener('focus', handleFocusOrVisibility);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);
    window.addEventListener('hf_cart_cleared', handleCartCleared);
    window.addEventListener('hf_account_deleted', handleAccountDeleted);

    return () => {
      isMounted = false;
      clearTimeout(timerId);
      window.removeEventListener('focus', handleFocusOrVisibility);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      window.removeEventListener('hf_cart_cleared', handleCartCleared);
      window.removeEventListener('hf_account_deleted', handleAccountDeleted);
    };
  }, [user]);

  // Sync hash URL navigation (e.g. #shop, #track)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#shop') {
        setCurrentPage('shop');
      } else if (hash === '#home' || hash === '') {
        setCurrentPage('home');
      } else if (hash.startsWith('#track')) {
        setCartDrawerInitialTab('orders');
        setIsCartOpen(true);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Bottom Toast Notification
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

  // Auth Callbacks
  const handleAuthSuccess = (loggedUser: UserProfile) => {
    setUser(loggedUser);
    const guestCart = getStoredCart(false);

    fetchRemoteCart().then(({ items: remoteItems }) => {
      const accountCart = (remoteItems && remoteItems.length > 0) ? remoteItems : getStoredCart(true);
      if (guestCart && guestCart.length > 0) {
        const merged = mergeCartItems(accountCart, guestCart);
        cartItemsRef.current = merged;
        setCartItems(merged);
        saveCartItems(merged, true);
        try {
          sessionStorage.removeItem('hf_guest_cart');
        } catch {}
        showToast(`Welcome, ${loggedUser.firstName}! Your guest cart was merged.`);
      } else {
        cartItemsRef.current = accountCart;
        setCartItems(accountCart);
        showToast(`Welcome to Homemade Foods, ${loggedUser.firstName}!`);
      }
    });
  };

  const handleUserLogout = () => {
    logoutCustomer();
    setUser(null);
    const stored = getStoredCart(false);
    cartItemsRef.current = stored;
    setCartItems(stored);
    showToast('Logged out successfully');
  };

  // Cart Operations: Add to Cart (Shows interactive Toast) vs Order Now (Opens Cart Directly)
  const handleAddToCart = (newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    const compositeId = `${newItem.productId}-${newItem.weight}`;
    const currentItems = cartItemsRef.current;
    const existingItem = currentItems.find((item: CartItem) => item.id === compositeId);
    let updated: CartItem[];
    if (existingItem) {
      updated = currentItems.map((item: CartItem) =>
        item.id === compositeId ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updated = [...currentItems, { ...newItem, id: compositeId, quantity: 1 }];
    }
    cartItemsRef.current = updated;
    setCartItems(updated);
    saveCartItems(updated, !!user);
    showToast('Item added to cart!');
  };

  const handleOrderNow = (newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    const compositeId = `${newItem.productId}-${newItem.weight}`;
    const currentItems = cartItemsRef.current;
    const existingItem = currentItems.find((item: CartItem) => item.id === compositeId);
    let updated: CartItem[];
    if (existingItem) {
      updated = currentItems.map((item: CartItem) =>
        item.id === compositeId ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updated = [...currentItems, { ...newItem, id: compositeId, quantity: 1 }];
    }
    cartItemsRef.current = updated;
    setCartItems(updated);
    saveCartItems(updated, !!user);
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(id);
      return;
    }
    const currentItems = cartItemsRef.current;
    const updated = currentItems.map((item: CartItem) => (item.id === id ? { ...item, quantity: newQty } : item));
    cartItemsRef.current = updated;
    setCartItems(updated);
    saveCartItems(updated, !!user);
  };

  const handleRemoveFromCart = (id: string) => {
    const currentItems = cartItemsRef.current;
    const updated = currentItems.filter((item: CartItem) => item.id !== id);
    cartItemsRef.current = updated;
    setCartItems(updated);
    saveCartItems(updated, !!user);
    showToast('Cart updated');
  };

  const handleClearCart = () => {
    cartItemsRef.current = [];
    setCartItems([]);
    clearCartStorage(!!user);
    showToast('Cart cleared');
  };

  const handleUpdateItemWeight = (oldId: string, newWeight: string, newPricePerUnit: number) => {
    const currentItems = cartItemsRef.current;
    const targetItem = currentItems.find((i: CartItem) => i.id === oldId);
    if (!targetItem) return;

    const newId = `${targetItem.productId}-${newWeight}`;

    const updatedList = currentItems.map((i: CartItem) =>
      i.id === oldId
        ? { ...i, id: newId, weight: newWeight, pricePerUnit: newPricePerUnit }
        : i
    );

    const consolidatedMap = new Map<string, CartItem>();
    for (const item of updatedList) {
      if (consolidatedMap.has(item.id)) {
        const existing = consolidatedMap.get(item.id)!;
        consolidatedMap.set(item.id, {
          ...existing,
          quantity: existing.quantity + item.quantity,
        });
      } else {
        consolidatedMap.set(item.id, { ...item });
      }
    }

    const finalItems = Array.from(consolidatedMap.values());
    cartItemsRef.current = finalItems;
    setCartItems(finalItems);
    saveCartItems(finalItems, !!user);
    showToast('Pack weight updated');
  };

  const SHIPPING_FEE = 40;
  const totalCartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartItems.reduce((sum, item) => sum + item.pricePerUnit * item.quantity, 0);
  const cartGrandTotal = cartSubtotal > 0 ? cartSubtotal + SHIPPING_FEE : 0;

  return (
    <div className="min-h-screen bg-white text-[#1F2937] font-sans flex flex-col justify-between">
      
      {/* Bottom Floating Toast Notification */}
      {activeNotification && (
        <div
          onClick={() => {
            if (activeNotification.toLowerCase().includes('cart') || activeNotification.toLowerCase().includes('item')) {
              setIsCartOpen(true);
            }
          }}
          className={`fixed ${cartItems.length > 0 && !isCartOpen ? 'bottom-24 sm:bottom-28' : 'bottom-8'} left-1/2 -translate-x-1/2 z-[60] bg-[#1F2937] text-white px-4.5 py-3 rounded-2xl shadow-2xl border border-gray-700/80 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 transition-all`}
        >
          <div className="w-6 h-6 rounded-full bg-[#95CD1A] text-white flex items-center justify-center shrink-0 shadow-md">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold tracking-wide whitespace-nowrap">
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
                <span className="absolute -top-1.5 -right-1.5 bg-white text-[#1F2937] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1F2937]">
                  {totalCartItemCount}
                </span>
              </div>
              <div className="text-left">
                <div className="text-xs font-black tracking-wide text-[#95CD1A] flex items-center gap-1.5">
                  <span>{totalCartItemCount} {totalCartItemCount === 1 ? 'item' : 'items'} added</span>
                </div>
                <div className="text-sm font-black text-white font-numeric">
                  ₹{cartGrandTotal} <span className="text-[10px] font-normal text-gray-400 font-sans">(Incl. Shipping & GST)</span>
                </div>
              </div>
            </div>

            <div className="px-4 py-2 bg-[#95CD1A] group-hover:bg-[#83B812] text-white font-extrabold text-xs rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-md">
              <span>View Cart & Checkout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      )}

      {/* Persistent Header */}
      <Header
        currentPage={currentPage}
        onNavigate={(page) => handleNavigatePage(page, 'all', '')}
        cartItemCount={totalCartItemCount}
        onOpenCart={() => {
          setCartDrawerInitialTab('cart');
          setIsCartOpen(true);
        }}
        onOpenTrackModal={() => {
          setCartDrawerInitialTab('orders');
          setIsCartOpen(true);
        }}
        user={user}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={() => setIsLogoutConfirmOpen(true)}
      />

      {/* Auth Modal (Login / Sign Up) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* Logout Confirmation Dialog Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirmLogout={handleUserLogout}
      />

      {/* Sliding Cart & Orders Panel Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateItemWeight={handleUpdateItemWeight}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onExploreShop={() => handleNavigatePage('shop', 'all', '')}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isLoggedIn={!!user}
        user={user}
        initialTab={cartDrawerInitialTab}
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
            <CuratedProcessSection
              onAddToCart={handleAddToCart}
              onOrderNow={handleOrderNow}
            />
          </>
        ) : (
          /* Separate Shop Catalog Page View */
          <ShopCatalog
            initialCategory={selectedCategory}
            initialSearchQuery={searchQuery}
            onNavigateHome={() => handleNavigatePage('home', 'all', '')}
            onAddToCart={handleAddToCart}
            onOrderNow={handleOrderNow}
          />
        )}
      </main>

      {/* Persistent Footer */}
      <Footer
        onNavigatePage={(page, categoryId) => handleNavigatePage(page, categoryId || 'all', '')}
        onOpenTrackModal={() => {
          setCartDrawerInitialTab('orders');
          setIsCartOpen(true);
        }}
      />
    </div>
  );
}

export default App;
