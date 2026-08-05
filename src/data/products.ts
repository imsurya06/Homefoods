export interface ProductVariant {
  weight: string;
  basePrice: number;
}

export interface ProductImage {
  id: number;
  src: string;
  alt: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  description: string;
  ingredients: string;
  shelfLife: string;
  storageInstructions: string;
  imageUrl: string;
  gstPercentage: number;
  isAvailable: boolean;
  variants: ProductVariant[];
  images?: ProductImage[];
}

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'All Products', count: 6 },
  { id: 'flour-premix-malt', label: 'Flours & Premixes', count: 4 },
  { id: 'thokku-varieties', label: 'Thokku Varieties', count: 2 },
];

export const PRODUCTS: Product[] = [
  {
    id: '35',
    name: 'Black Urad Dal Kali Mix (கருப்பு உளுந்து களி மாவு)',
    slug: 'black-urad-dal-kali-mix',
    categoryId: 'flour-premix-malt',
    categoryName: 'Flours & Premixes',
    description: 'Traditional nutrient-dense Black Urad Dal porridge mix rich in natural protein, iron, and calcium. Prepared using authentic Tamil grandma recipes.',
    ingredients: 'Whole Black Urad Dal, Raw Rice, Fenugreek Seeds, Cardamom.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250g', basePrice: 70 },
      { weight: '500g', basePrice: 130 },
      { weight: '1kg', basePrice: 250 },
    ],
  },
  {
    id: '36',
    name: 'Vendaya Kali Mix (வெந்தயக் களி மாவு)',
    slug: 'vendaya-kali-mix',
    categoryId: 'flour-premix-malt',
    categoryName: 'Flours & Premixes',
    description: 'Cooling, digestive Fenugreek porridge mix crafted with roasted whole fenugreek and red rice. Excellent for body cooling and stamina.',
    ingredients: 'Fenugreek Seeds, Red Rice, Palm Jaggery Blend, Dry Ginger.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250g', basePrice: 70 },
      { weight: '500g', basePrice: 130 },
    ],
  },
  {
    id: '37',
    name: 'Adai Dosa Premix (அடை மாவு ப்ரீமிக்ஸ்)',
    slug: 'adai-dosa-premix',
    categoryId: 'flour-premix-malt',
    categoryName: 'Flours & Premixes',
    description: 'Protein-packed multi-lentil instant dosa mix for crisp, savory South Indian Adai dosas. Just add water and make fresh dosas.',
    ingredients: 'Toor Dal, Chana Dal, Urad Dal, Moong Dal, Raw Rice, Red Chillies, Asafoetida.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250g', basePrice: 70 },
      { weight: '500g', basePrice: 130 },
    ],
  },
  {
    id: '43',
    name: 'Health Mix / Sathu Maavu (சத்து மாவு)',
    slug: 'health-mix',
    categoryId: 'flour-premix-malt',
    categoryName: 'Flours & Premixes',
    description: 'Classic 24-ingredient sprouted multi-grain health drink mix for kids and adults. 100% homemade wellness.',
    ingredients: 'Sprouted Millets, Cereals, Pulses, Almonds, Cashews, Cardamom, Dry Ginger.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '200g', basePrice: 150 },
      { weight: '500g', basePrice: 350 },
    ],
  },
  {
    id: '50',
    name: 'Garlic Thokku (பூண்டு தொக்கு)',
    slug: 'garlic-thokku',
    categoryId: 'thokku-varieties',
    categoryName: 'Thokku Varieties',
    description: 'Spicy, tangy homemade garlic thokku slow-cooked in cold-pressed gingelly oil.',
    ingredients: 'Fresh Small Garlic, Gingelly Oil, Red Chilli Powder, Mustard, Tamarind, Asafoetida.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250g', basePrice: 120 },
      { weight: '500g', basePrice: 220 },
    ],
  },
  {
    id: '51',
    name: 'Tomato Thokku (தக்காளி தொக்கு)',
    slug: 'tomato-thokku',
    categoryId: 'thokku-varieties',
    categoryName: 'Thokku Varieties',
    description: 'Rich, authentic South Indian tomato relish cooked with traditional spices and sesame oil.',
    ingredients: 'Farm Tomatoes, Cold-Pressed Sesame Oil, Chilli, Fenugreek, Mustard.',
    shelfLife: '6 Months',
    storageInstructions: 'Store in a cool dry place.',
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
    gstPercentage: 5,
    isAvailable: true,
    variants: [
      { weight: '250g', basePrice: 110 },
      { weight: '500g', basePrice: 200 },
    ],
  },
];
