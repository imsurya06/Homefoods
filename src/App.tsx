import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { CuratedProcessSection } from './components/CuratedProcessSection';
import { ShopCatalog } from './components/ShopCatalog';
import { Footer } from './components/Footer';
import { CheckCircle } from 'lucide-react';
import { CATEGORY_FILTERS } from './data/products';

export function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'shop'>('home');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-white text-[#1F2937] font-sans flex flex-col justify-between">
      
      {/* Bottom Floating Toast Notification */}
      {activeNotification && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1F2937] text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-gray-700/80 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle className="w-5 h-5 text-[#95CD1A] shrink-0" />
          <span className="text-xs sm:text-sm font-bold tracking-wide whitespace-nowrap">{activeNotification}</span>
        </div>
      )}

      {/* Persistent Header */}
      <Header
        currentPage={currentPage}
        onNavigate={(page) => handleNavigatePage(page, 'all', '')}
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
          />
        )}
      </main>

      {/* Persistent Footer */}
      <Footer onNavigatePage={(page, categoryId) => handleNavigatePage(page, categoryId || 'all', '')} />
    </div>
  );
}

export default App;
