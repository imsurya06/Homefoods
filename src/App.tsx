import { useState, useEffect, useRef } from 'react';
import { CheckCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { CuratedProcessSection } from './components/CuratedProcessSection';
import { ShopCatalog } from './components/ShopCatalog';
import { Footer } from './components/Footer';
import { CartDrawer } from './components/CartDrawer';
import { AuthModal } from './components/AuthModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';
import { AccountModal } from './components/AccountModal';
import { MobileBottomNav, type MobileTab } from './components/MobileBottomNav';
import { CATEGORY_FILTERS } from './data/products';
import { CATEGORIES } from './data/categories';
import { type CartItem } from './data/bestsellers';
import { fetchCustomerOrders, validateSession, type UserProfile } from './services/authService';
import { useSyncStore } from './store/useSyncStore';
import { initSyncManager, bootstrapSync, replayOfflineQueue, updatePollingInterval } from './services/syncManager';

export function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'shop'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // Read state from Zustand store
  const user = useSyncStore((state) => state.user);
  const isLoggedIn = useSyncStore((state) => state.isLoggedIn);
  const cartItems = useSyncStore((state) => state.cartItems);
  const cartRevision = useSyncStore((state) => state.cartRevision);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);

  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cartDrawerInitialTab, setCartDrawerInitialTab] = useState<'cart' | 'orders'>('cart');

  // Initialize Sync Manager, Background Session Revalidation, and Adaptive Polling
  useEffect(() => {
    initSyncManager();
    updatePollingInterval('general');

    const hasToken = localStorage.getItem('hf_auth_token') || localStorage.getItem('hf_refresh_token');
    if (hasToken) {
      // Parallel background session revalidation & bootstrap sync without blocking instant UI restore
      Promise.all([
        validateSession().catch(() => null),
        bootstrapSync().catch(() => null)
      ]).then(([res]) => {
        if (res && res.valid && res.user) {
          useSyncStore.setState({ user: res.user, isLoggedIn: true, isAuthValidating: false });
          localStorage.setItem('hf_user_profile', JSON.stringify(res.user));
        } else if (res && res.valid === false) {
          // Explicit session invalidation (401 / account deleted)
          useSyncStore.getState().logout();
          useSyncStore.setState({ isAuthValidating: false });
        } else {
          useSyncStore.setState({ isAuthValidating: false });
        }
      }).catch(() => {
        useSyncStore.setState({ isAuthValidating: false });
      });
    } else {
      useSyncStore.setState({ isAuthValidating: false });
    }
  }, []);

  // Listen for session expiry and administrative account deletion events
  useEffect(() => {
    const handleAuthExpired = () => {
      useSyncStore.getState().logout();
      showToast('Your session has expired. Please log in again.');
      setIsAuthModalOpen(true);
    };

    const handleAccountDeleted = () => {
      useSyncStore.getState().logout();
      showToast('Your account no longer exists. Please sign in or create a new account.');
      setIsAuthModalOpen(true);
    };

    window.addEventListener('hf_auth_expired', handleAuthExpired);
    window.addEventListener('hf_account_deleted', handleAccountDeleted);

    return () => {
      window.removeEventListener('hf_auth_expired', handleAuthExpired);
      window.removeEventListener('hf_account_deleted', handleAccountDeleted);
    };
  }, []);

  // Sync hash URL navigation
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

  // Adjust polling interval when cart drawer state changes
  useEffect(() => {
    updatePollingInterval(isCartOpen ? 'cart' : 'general');
  }, [isCartOpen]);


  // Background Order Status Polling & Real-time Push Notifications
  const prevOrderStatusMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let intervalId: any = null;

    const checkOrderStatusChanges = async () => {
      if (!isLoggedIn) return;
      try {
        const remoteOrders = await fetchCustomerOrders();
        if (Array.isArray(remoteOrders) && remoteOrders.length > 0) {
          const prevMap = prevOrderStatusMapRef.current;
          let hasChanged = false;

          remoteOrders.forEach((ord) => {
            const ordKey = ord.id.toString();
            const currentStatus = (ord.status || '').toLowerCase().trim();
            const prevStatus = prevMap.get(ordKey);

            if (prevStatus && prevStatus !== currentStatus) {
              hasChanged = true;
            }

            prevMap.set(ordKey, currentStatus);
          });

          if (hasChanged) {
            window.dispatchEvent(new Event('hf_orders_updated'));
          }
        }
      } catch (err) {
        console.warn('Background order status poll warning:', err);
      }
    };

    if (isLoggedIn) {
      checkOrderStatusChanges();
      intervalId = setInterval(checkOrderStatusChanges, 10000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isLoggedIn]);

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
    const catObj = CATEGORY_FILTERS.find((c) => c.id === categoryId) || CATEGORIES.find((c) => c.id === categoryId);
    const categoryName = catObj ? ((catObj as any).title || (catObj as any).label || categoryId) : categoryId;
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
  const handleAuthSuccess = async (loggedUser: UserProfile, accessToken: string, refreshToken: string) => {
    const guestItems = [...useSyncStore.getState().cartItems];
    useSyncStore.getState().login(loggedUser, accessToken, refreshToken);
    
    // Instantly load data from WooCommerce customer database
    await bootstrapSync();

    const accountItems = useSyncStore.getState().cartItems;
    if (guestItems.length > 0) {
      // Merge guest items with server items using union/quantity merge algorithm
      const mergedMap = new Map<string, CartItem>();
      for (const item of accountItems) {
        mergedMap.set(item.id, item);
      }
      for (const gItem of guestItems) {
        if (mergedMap.has(gItem.id)) {
          const existing = mergedMap.get(gItem.id)!;
          existing.quantity = Math.max(existing.quantity, gItem.quantity);
        } else {
          mergedMap.set(gItem.id, gItem);
        }
      }
      const merged = Array.from(mergedMap.values());
      useSyncStore.getState().setCart(merged);
      
      // Sync merged cart items to WooCommerce Customer Metadata
      useSyncStore.getState().addOfflineOperation({
        type: 'UPDATE_CART',
        payload: { items: merged }
      });
      replayOfflineQueue();
      
      showToast(`Welcome, ${loggedUser.firstName}! Your guest cart was merged.`);
    } else {
      showToast(`Welcome to Homemade Foods, ${loggedUser.firstName}!`);
    }
  };

  const handleUserLogout = () => {
    useSyncStore.getState().logout();
    showToast('Logged out successfully');
  };

  // Cart Operations
  const handleAddToCart = (newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    const compositeId = `${newItem.productId}-${newItem.weight}`;
    const currentItems = useSyncStore.getState().cartItems;
    const existingItem = currentItems.find((item: CartItem) => item.id === compositeId);
    let updated: CartItem[];
    if (existingItem) {
      updated = currentItems.map((item: CartItem) =>
        item.id === compositeId ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updated = [...currentItems, { ...newItem, id: compositeId, quantity: 1 }];
    }
    useSyncStore.getState().setCart(updated);
    showToast('Item added to cart!');
  };

  const handleOrderNow = (newItem: Omit<CartItem, 'id' | 'quantity'>) => {
    const compositeId = `${newItem.productId}-${newItem.weight}`;
    const currentItems = useSyncStore.getState().cartItems;
    const existingItem = currentItems.find((item: CartItem) => item.id === compositeId);
    let updated: CartItem[];
    if (existingItem) {
      updated = currentItems.map((item: CartItem) =>
        item.id === compositeId ? { ...item, quantity: item.quantity + 1 } : item
      );
    } else {
      updated = [...currentItems, { ...newItem, id: compositeId, quantity: 1 }];
    }
    useSyncStore.getState().setCart(updated);
    setCartDrawerInitialTab('cart');
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(id);
      return;
    }
    const currentItems = useSyncStore.getState().cartItems;
    const updated = currentItems.map((item: CartItem) => (item.id === id ? { ...item, quantity: newQty } : item));
    useSyncStore.getState().setCart(updated);
  };

  const handleRemoveFromCart = (id: string) => {
    const currentItems = useSyncStore.getState().cartItems;
    const updated = currentItems.filter((item: CartItem) => item.id !== id);
    useSyncStore.getState().setCart(updated);
    showToast('Cart updated');
  };

  const handleClearCart = () => {
    useSyncStore.getState().setCart([]);
    showToast('Cart cleared');
  };

  const handleUpdateItemWeight = (oldId: string, newWeight: string, newPricePerUnit: number) => {
    const currentItems = useSyncStore.getState().cartItems;
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
    useSyncStore.getState().setCart(finalItems);
    showToast('Pack weight updated');
  };

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];
  const totalCartItemCount = safeCartItems.reduce((sum, item) => sum + (item?.quantity || 1), 0);
  const cartSubtotal = safeCartItems.reduce((sum, item) => sum + (item?.pricePerUnit || 0) * (item?.quantity || 1), 0);
  const shippingFee = (cartSubtotal >= 499 || cartSubtotal === 0) ? 0 : 40;
  const cartGrandTotal = cartSubtotal > 0 ? cartSubtotal + shippingFee : 0;

  const activeMobileTab: MobileTab = isAccountModalOpen
    ? 'profile'
    : (isCartOpen && cartDrawerInitialTab === 'orders')
    ? 'orders'
    : currentPage === 'shop'
    ? 'store'
    : 'home';

  const handleMobileTabChange = (tab: MobileTab) => {
    if (tab === 'home') {
      setCurrentPage('home');
      setIsCartOpen(false);
      setIsAccountModalOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'store') {
      setCurrentPage('shop');
      setSelectedCategory('all');
      setIsCartOpen(false);
      setIsAccountModalOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'orders') {
      setIsAccountModalOpen(false);
      setCartDrawerInitialTab('orders');
      setIsCartOpen(true);
    } else if (tab === 'profile') {
      setIsAccountModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1F2937] font-sans flex flex-col justify-between">
      
      {/* Bottom Floating Toast Notification */}
      {activeNotification && (
        <div
          onClick={() => {
            if (activeNotification.toLowerCase().includes('cart') || activeNotification.toLowerCase().includes('item')) {
              setCartDrawerInitialTab('cart');
              setIsCartOpen(true);
            }
          }}
          className={`fixed ${cartItems.length > 0 && !isCartOpen ? 'bottom-32 sm:bottom-28' : 'bottom-20 sm:bottom-8'} left-1/2 -translate-x-1/2 z-[60] bg-[#1F2937] text-white px-4 py-3 rounded-2xl shadow-2xl border border-gray-700/80 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300 transition-all max-w-[92vw] sm:max-w-lg w-auto cursor-pointer`}
        >
          <div className="w-6 h-6 rounded-full bg-[#95CD1A] text-white flex items-center justify-center shrink-0 shadow-md">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold tracking-wide break-words line-clamp-2">
            {activeNotification}
          </span>
        </div>
      )}

      {/* Floating Bottom Cart Checkout Bar */}
      {cartItems.length > 0 && !isCartOpen && (
        <div className="fixed bottom-20 left-3 right-3 md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl z-40 animate-in slide-in-from-bottom-6 duration-300">
          <div
            onClick={() => {
              setCartDrawerInitialTab('cart');
              setIsCartOpen(true);
            }}
            className="bg-[#1F2937] text-white p-3 sm:p-3.5 rounded-2xl shadow-2xl border border-gray-700/80 flex items-center justify-between gap-3 cursor-pointer group hover:bg-black transition-all transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#95CD1A] text-white flex items-center justify-center font-bold relative shrink-0 shadow-md">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="absolute -top-1.5 -right-1.5 bg-white text-[#1F2937] text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1F2937]">
                  {totalCartItemCount}
                </span>
              </div>
              <div className="text-[#1F2937] font-numeric text-left">
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

      {/* Mobile & Desktop Account Profile Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        user={user}
        onOpenAuthModal={() => {
          setIsAccountModalOpen(false);
          setIsAuthModalOpen(true);
        }}
        onOpenOrders={() => {
          setIsAccountModalOpen(false);
          setCartDrawerInitialTab('orders');
          setIsCartOpen(true);
        }}
        onLogout={() => {
          setIsAccountModalOpen(false);
          setIsLogoutConfirmOpen(true);
        }}
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
        cartRevision={cartRevision}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateItemWeight={handleUpdateItemWeight}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onExploreShop={() => handleNavigatePage('shop', 'all', '')}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        isLoggedIn={isLoggedIn}
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

      {/* Mobile Native-Style App Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeMobileTab}
        onTabChange={handleMobileTabChange}
        user={user}
        cartItemCount={totalCartItemCount}
      />

    </div>
  );
}

export default App;
