export interface SearchableProduct {
  name: string;
  categoryName?: string;
  description?: string;
  ingredients?: string;
}

/**
 * Calculates a search relevance score for a product given a user search query.
 * Higher scores indicate higher relevance.
 */
export function getSearchRelevanceScore(
  product: SearchableProduct,
  searchQuery: string
): number {
  if (!searchQuery) return 0;
  const q = searchQuery.toLowerCase().trim();
  if (!q) return 0;

  const rawName = (product.name || '').toLowerCase();
  // Strip parenthetical text (e.g. Tamil translations like "(மஞ்சள் தூள்)") for clean English title matching
  const englishName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
  const catName = (product.categoryName || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const ingr = (product.ingredients || '').toLowerCase();

  let score = 0;

  // 1. Exact Match on Title (English name or Full raw name)
  if (englishName === q || rawName === q) {
    score += 5000;
  }
  // 2. Title Starts With Full Query (e.g. "Turmeric Powder" starts with "turmeric", "Coriander Powder" starts with "coriand")
  else if (englishName.startsWith(q) || rawName.startsWith(q)) {
    score += 3000;
  }
  // 3. Any Word in Title Starts With Full Query (e.g. "Chettinad Turmeric Powder" contains word starting with "turmeric")
  else if (rawName.split(/[\s,()/]+/).some((w) => w.startsWith(q))) {
    score += 2000;
  }
  // 4. Title Contains Substring of Full Query
  else if (rawName.includes(q)) {
    score += 1000;
  }

  // Tokenize query into words (e.g., "coriander powder")
  const queryTokens = q.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 1) {
    let matchedInTitle = 0;
    queryTokens.forEach((token) => {
      if (rawName.includes(token)) matchedInTitle++;
    });
    if (matchedInTitle === queryTokens.length) {
      score += 800; // All tokens present in title
    } else {
      score += matchedInTitle * 200;
    }
  }

  // Category name match
  if (catName === q) {
    score += 500;
  } else if (catName.startsWith(q)) {
    score += 300;
  } else if (catName.includes(q)) {
    score += 150;
  }

  // Ingredients match
  const ingrWords = ingr.split(/[\s,()/.]+/);
  if (ingrWords.some((w) => w === q)) {
    score += 100;
  } else if (ingrWords.some((w) => w.startsWith(q))) {
    score += 70;
  } else if (ingr.includes(q)) {
    score += 40;
  }

  // Description match
  const descWords = desc.split(/[\s,()/.]+/);
  if (descWords.some((w) => w === q)) {
    score += 30;
  } else if (descWords.some((w) => w.startsWith(q))) {
    score += 20;
  } else if (desc.includes(q)) {
    score += 10;
  }

  return score;
}

/**
 * Filters and sorts products by relevance to the given search query.
 */
export function filterAndSortProductsBySearch<T extends SearchableProduct>(
  products: T[],
  searchQuery: string
): T[] {
  if (!searchQuery || !searchQuery.trim()) {
    return products;
  }

  const scored = products
    .map((product) => ({
      product,
      score: getSearchRelevanceScore(product, searchQuery),
    }))
    .filter((item) => item.score > 0);

  // Sort descending by relevance score
  scored.sort((a, b) => b.score - a.score);

  return scored.map((item) => item.product);
}
