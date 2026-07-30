import { wcApi } from './src/config/woocommerce.js';

async function reassignCategories() {
  console.log('🔍 Fetching all WooCommerce categories...');
  const catRes = await wcApi.get('products/categories', { per_page: 100 });
  const categories = catRes.data;

  const getCatIdBySlug = (slug: string) => {
    const found = categories.find((c: any) => c.slug === slug);
    return found ? found.id : null;
  };

  const catMap = {
    flour: getCatIdBySlug('flour-premix-malt'),
    thokku: getCatIdBySlug('thokku-varieties'),
    beverage: getCatIdBySlug('beverage-sweeteners'),
    cookies: getCatIdBySlug('cookies-brownies'),
    masala: getCatIdBySlug('masala-varieties'),
    nonveg: getCatIdBySlug('non-veg-masalas'),
    idly: getCatIdBySlug('idly-podi-rice-mix-soup-mix'),
  };

  console.log('Category IDs Found:', catMap);

  console.log('📦 Fetching all products from WooCommerce...');
  const prodRes = await wcApi.get('products', { per_page: 100 });
  const products = prodRes.data;

  console.log(`Found ${products.length} products. Re-assigning correct categories...`);

  for (const p of products) {
    const name = p.name.toLowerCase();
    let targetCatId: number | null = null;

    if (name.includes('brownie') || name.includes('cookie')) {
      targetCatId = catMap.cookies;
    } else if (name.includes('thokku') || name.includes('puliyotharai')) {
      targetCatId = catMap.thokku;
    } else if (
      name.includes('sherbet') ||
      name.includes('nannari') ||
      name.includes('honey') ||
      name.includes('country sugar') ||
      name.includes('dates powder') ||
      name.includes('nuts powder') ||
      name.includes('chai') ||
      name.includes('tea')
    ) {
      targetCatId = catMap.beverage;
    } else if (
      name.includes('garam') ||
      name.includes('biryani') ||
      name.includes('mutton masala') ||
      name.includes('chicken') ||
      name.includes('fish fry')
    ) {
      targetCatId = catMap.nonveg;
    } else if (
      name.includes('sambar') ||
      name.includes('coriander') ||
      name.includes('turmeric') ||
      name.includes('kuzhambu masala') ||
      name.includes('chilli powder')
    ) {
      targetCatId = catMap.masala;
    } else if (name.includes('podi') || name.includes('soup mix')) {
      targetCatId = catMap.idly;
    } else if (
      name.includes('kali') ||
      name.includes('maavu') ||
      name.includes('flour') ||
      name.includes('premix') ||
      name.includes('malt') ||
      name.includes('ragi') ||
      name.includes('millet mix') ||
      name.includes('health mix') ||
      name.includes('wheat')
    ) {
      targetCatId = catMap.flour;
    }

    if (targetCatId && p.categories[0]?.id !== targetCatId) {
      try {
        console.log(`🔄 Updating "${p.name}" (ID: ${p.id}) -> Category ID: ${targetCatId}`);
        await wcApi.put(`products/${p.id}`, {
          categories: [{ id: targetCatId }],
        });
      } catch (err: any) {
        console.error(`Failed to update ${p.name}:`, err.message);
      }
    }
  }

  console.log('✅ Re-categorization Completed!');
}

reassignCategories().catch(console.error);
