export interface Category {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  itemCount: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'flours',
    title: 'Flours & Premixes',
    subtitle: 'Ragi, Rice & Healthy Grain Flours',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
    itemCount: '12 Items',
  },
  {
    id: 'thokku',
    title: 'Thokku Varieties',
    subtitle: 'Garlic, Tomato & Mango Relishes',
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
    itemCount: '8 Items',
  },
  {
    id: 'beverages',
    title: 'Beverages & Sweeteners',
    subtitle: 'Nannari Sherbet & Palm Jaggery',
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
    itemCount: '6 Items',
  },
  {
    id: 'cookies',
    title: 'Cookies & Brownies',
    subtitle: 'Healthy Millet & Whole Wheat Bakes',
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80',
    itemCount: '10 Items',
  },
  {
    id: 'masalas',
    title: 'Masala Varieties',
    subtitle: 'Hand-ground South Indian Spices',
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
    itemCount: '15 Items',
  },
  {
    id: 'podi',
    title: 'Idly Podi & Rice Mixes',
    subtitle: 'Traditional Gunpowder & Soup Powders',
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
    itemCount: '14 Items',
  },
];
