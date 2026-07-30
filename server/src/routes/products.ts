import { Router, Request, Response } from 'express';
import { wcApi, isWooCommerceConfigured } from '../config/woocommerce.js';

export const productsRouter = Router();

// In-Memory Server Cache for Ultra-Fast Responses (<5ms)
let cachedProductsResponse: any = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds cache

// Utility function to decode HTML entities (e.g. &amp; -> &, &#039; -> ')
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// GET /api/v1/products - Fetch catalog with search, category filtering & pagination
productsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { category, search, inStock, forceRefresh } = req.query;

    if (!isWooCommerceConfigured()) {
      return res.json({
        success: true,
        source: 'mock_fallback',
        message: 'WooCommerce API keys not configured yet.',
        data: [],
      });
    }

    const now = Date.now();
    // Return cached full catalog if fresh (< 30s) and no search/forceRefresh requested
    if (!forceRefresh && !search && cachedProductsResponse && (now - lastCacheTime < CACHE_TTL_MS)) {
      let filtered = cachedProductsResponse;
      if (category && category !== 'all') {
        const rawCat = String(category).toLowerCase().trim();
        const catQuery = rawCat.endsWith('s') ? rawCat.slice(0, -1) : rawCat;
        filtered = filtered.filter((p: any) =>
          p.categoryId.toLowerCase().includes(catQuery) ||
          catQuery.includes(p.categoryId.toLowerCase()) ||
          p.categoryName.toLowerCase().includes(catQuery)
        );
      }
      if (inStock === 'true') {
        filtered = filtered.filter((p: any) => p.isAvailable);
      }
      return res.json({
        success: true,
        source: 'cache',
        total: filtered.length,
        data: filtered,
      });
    }

    // Fetch up to 100 published products directly from WooCommerce
    const response = await wcApi.get('products', {
      per_page: 100,
      status: 'publish',
    });

    const formattedProducts = await Promise.all(
      response.data.map(async (p: any) => {
        const primaryCategory = p.categories[0] || {};
        const basePrice = parseFloat(p.price || p.regular_price || '0');

        let variants: { weight: string; basePrice: number }[] = [];

        // Option A: If product is a WooCommerce "Variable Product" with separate prices per variation
        if (p.type === 'variable' && p.variations?.length > 0) {
          try {
            const varRes = await wcApi.get(`products/${p.id}/variations`, { per_page: 20 });
            if (varRes.data && varRes.data.length > 0) {
              variants = varRes.data.map((v: any) => {
                const weightOption = v.attributes?.find((a: any) => a.name.toLowerCase() === 'weight')?.option || v.attributes[0]?.option || 'Pack';
                return {
                  weight: decodeHtmlEntities(weightOption.trim()),
                  basePrice: parseFloat(v.price || v.regular_price || '0'),
                };
              });
            }
          } catch (err) {
            console.warn(`Could not fetch variations for product ${p.id}:`, err);
          }
        }

        // Option B: Fallback to Product Attributes (e.g. Attribute Name "Weight" -> "250gms", "500gms")
        if (variants.length === 0) {
          const weightAttr = p.attributes?.find((a: any) => a.name.toLowerCase() === 'weight')?.options || [];
          if (weightAttr.length > 0) {
            variants = weightAttr.map((opt: string, idx: number) => ({
              weight: decodeHtmlEntities(opt.trim()),
              basePrice: idx === 0 ? basePrice : Math.round(basePrice * (idx === 1 ? 1.8 : 3.4)),
            }));
          }
        }

        // Option C: Fallback to WooCommerce Shipping Tab Weight (e.g. 0.25 -> 250gms)
        if (variants.length === 0 && p.weight) {
          const numericWeight = parseFloat(p.weight);
          let shippingWeightLabel = p.weight;
          if (!isNaN(numericWeight)) {
            shippingWeightLabel = numericWeight < 1 ? `${Math.round(numericWeight * 1000)}gms` : `${numericWeight}kg`;
          }
          variants = [{ weight: decodeHtmlEntities(shippingWeightLabel), basePrice }];
        }

        // Default fallback if no weight specified anywhere
        if (variants.length === 0) {
          variants = [{ weight: 'Standard Pack', basePrice }];
        }

        return {
          id: p.id.toString(),
          name: decodeHtmlEntities(p.name),
          slug: p.slug,
          categoryId: primaryCategory.slug || 'all',
          categoryName: decodeHtmlEntities(primaryCategory.name || 'Homemade Foods'),
          description: decodeHtmlEntities(p.description?.replace(/<[^>]*>?/gm, '') || p.short_description?.replace(/<[^>]*>?/gm, '') || ''),
          ingredients: decodeHtmlEntities(p.attributes?.find((a: any) => a.name.toLowerCase() === 'ingredients')?.options?.join(', ') || ''),
          shelfLife: decodeHtmlEntities(p.attributes?.find((a: any) => a.name.toLowerCase() === 'shelf life')?.options?.join(', ') || '6 Months'),
          storageInstructions: decodeHtmlEntities(p.attributes?.find((a: any) => a.name.toLowerCase() === 'storage')?.options?.join(', ') || 'Store in a cool dry place.'),
          imageUrl: p.images[0]?.src || 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
          gstPercentage: p.tax_class === 'zero-rate' ? 0 : 5,
          isAvailable: p.stock_status === 'instock',
          stockQuantity: p.stock_quantity ?? 100,
          variants,
        };
      })
    );

    // Update in-memory cache
    cachedProductsResponse = formattedProducts;
    lastCacheTime = now;

    let filtered = formattedProducts;
    if (category && category !== 'all') {
      const rawCat = String(category).toLowerCase().trim();
      const catQuery = rawCat.endsWith('s') ? rawCat.slice(0, -1) : rawCat;
      filtered = filtered.filter((p: any) =>
        p.categoryId.toLowerCase().includes(catQuery) ||
        catQuery.includes(p.categoryId.toLowerCase()) ||
        p.categoryName.toLowerCase().includes(catQuery)
      );
    }
    if (search) {
      const sQuery = String(search).toLowerCase().trim();
      filtered = filtered.filter((p: any) =>
        p.name.toLowerCase().includes(sQuery) ||
        p.categoryName.toLowerCase().includes(sQuery) ||
        p.description.toLowerCase().includes(sQuery)
      );
    }
    if (inStock === 'true') {
      filtered = filtered.filter((p: any) => p.isAvailable);
    }

    return res.json({
      success: true,
      source: 'woocommerce',
      total: filtered.length,
      data: filtered,
    });
  } catch (error: any) {
    console.error('Error fetching WooCommerce products:', error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to synchronize products from WooCommerce',
      error: error.message,
    });
  }
});

// GET /api/v1/products/categories - Fetch categories
productsRouter.get('/categories', async (_req: Request, res: Response) => {
  try {
    if (!isWooCommerceConfigured()) {
      return res.json({ success: true, source: 'mock_fallback', data: [] });
    }

    const response = await wcApi.get('products/categories', { per_page: 100, hide_empty: false });
    const categories = response.data.map((c: any) => ({
      id: c.slug,
      label: decodeHtmlEntities(c.name),
      count: c.count,
    }));

    return res.json({ success: true, source: 'woocommerce', data: categories });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/products/:id - Single product details
productsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!isWooCommerceConfigured()) {
      return res.status(404).json({ success: false, message: 'WooCommerce credentials required' });
    }

    const response = await wcApi.get(`products/${req.params.id}`);
    const p = response.data;

    return res.json({
      success: true,
      data: {
        id: p.id.toString(),
        name: decodeHtmlEntities(p.name),
        slug: p.slug,
        categoryId: p.categories[0]?.slug || 'all',
        categoryName: decodeHtmlEntities(p.categories[0]?.name || ''),
        description: decodeHtmlEntities(p.description?.replace(/<[^>]*>?/gm, '') || ''),
        imageUrl: p.images[0]?.src || '',
        isAvailable: p.stock_status === 'instock',
        stockQuantity: p.stock_quantity ?? 100,
        price: parseFloat(p.price || '0'),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
