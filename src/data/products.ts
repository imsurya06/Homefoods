export interface ProductVariant {
  weight: string;
  basePrice: number;
  regularPrice?: number;
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
  stockQuantity?: number;
  isBestseller?: boolean;
  variants: ProductVariant[];
  images?: ProductImage[];
}

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'All Products', count: 54 },
  { id: 'flour-premix-malt', label: 'Flours & Premixes', count: 10 },
  { id: 'thokku-varieties', label: 'Thokku Varieties', count: 7 },
  { id: 'beverage-sweeteners', label: 'Beverages & Sweeteners', count: 7 },
  { id: 'cookies-brownies', label: 'Cookies & Brownies', count: 10 },
  { id: 'masala-varieties', label: 'Masala Varieties', count: 11 },
  { id: 'idly-podi-rice-mixes', label: 'Idly Podi & Rice Mixes', count: 9 },
];

export const PRODUCTS: Product[] = [
  {
    "id": "88",
    "name": "Mudavaattuakkaal Soup Mix (முடவாட்டுக்கால் சூப் மிக்ஸ்)",
    "slug": "mudavaattuakkaal-soup-mix-%e0%ae%ae%e0%af%81%e0%ae%9f%e0%ae%b5%e0%ae%be%e0%ae%9f%e0%af%8d%e0%ae%9f%e0%af%81%e0%ae%95%e0%af%8d%e0%ae%95%e0%ae%be%e0%ae%b2%e0%af%8d-%e0%ae%9a%e0%af%82%e0%ae%aa%e0%af%8d",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Nourishing herbal soup powder mix made from Mudavaattuakkaal fern root and aromatic spices.\n",
    "ingredients": "Mudavaattuakkaal Root, Pepper, Cumin, Coriander, Garlic, Ginger, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Mudavaattuakkaal Soup Mix (முடவாட்டுக்கால் சூப் மிக்ஸ்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 200,
        "regularPrice": 250
      }
    ]
  },
  {
    "id": "87",
    "name": "Kids Special Idly Podi (கிட்ஸ் ஸ்பெஷல் இட்லி பொடி)",
    "slug": "kids-special-idly-podi-%e0%ae%95%e0%ae%bf%e0%ae%9f%e0%af%8d%e0%ae%b8%e0%af%8d-%e0%ae%b8%e0%af%8d%e0%ae%aa%e0%af%86%e0%ae%b7%e0%ae%b2%e0%af%8d-%e0%ae%87%e0%ae%9f%e0%af%8d%e0%ae%b2%e0%ae%bf-%e0%ae%aa",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Mild, non-spicy nutrient-rich idli podi specially crafted for children with nuts and ghee flavor.\n",
    "ingredients": "Urad Dal, Roasted Gram, Almonds, Cashews, Mild Red Pepper, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Kids Special Idly Podi (கிட்ஸ் ஸ்பெஷல் இட்லி பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 80,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "86",
    "name": "Andhra Paruppu Podi (ஆந்திரா பருப்பு பொடி)",
    "slug": "andhra-paruppu-podi-%e0%ae%86%e0%ae%a8%e0%af%8d%e0%ae%a4%e0%ae%bf%e0%ae%b0%e0%ae%be-%e0%ae%aa%e0%ae%b0%e0%af%81%e0%ae%aa%e0%af%8d%e0%ae%aa%e0%af%81-%e0%ae%aa%e0%af%8a%e0%ae%9f%e0%ae%bf",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Spicy Andhra style roasted lentil Kandi Podi for hot rice and ghee.\n",
    "ingredients": "Toor Dal, Roasted Gram, Kashmiri Chilli, Cumin, Garlic, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Andhra Paruppu Podi (ஆந்திரா பருப்பு பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 35,
        "regularPrice": 50
      }
    ]
  },
  {
    "id": "85",
    "name": "Murungai Podi (முருங்கை பொடி)",
    "slug": "murungai-podi-%e0%ae%ae%e0%af%81%e0%ae%b0%e0%af%81%e0%ae%99%e0%af%8d%e0%ae%95%e0%af%88-%e0%ae%aa%e0%af%8a%e0%ae%9f%e0%ae%bf",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Superfood drumstick moringa leaf rice powder packed with iron and calcium.\n",
    "ingredients": "Organic Shade-Dried Moringa Leaves, Urad Dal, Pepper, Cumin, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Murungai Podi (முருங்கை பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 280,
        "regularPrice": 300
      },
      {
        "weight": "200gms",
        "basePrice": 560,
        "regularPrice": 600
      }
    ]
  },
  {
    "id": "84",
    "name": "Sundakkaai Podi (சுண்டக்காய் பொடி)",
    "slug": "sundakkaai-podi-%e0%ae%9a%e0%af%81%e0%ae%a3%e0%af%8d%e0%ae%9f%e0%ae%95%e0%af%8d%e0%ae%95%e0%ae%be%e0%ae%af%e0%af%8d-%e0%ae%aa%e0%af%8a%e0%ae%9f%e0%ae%bf",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Roasted turkey berry rice podi known for stomach health and natural immunity.\n",
    "ingredients": "Dried Sundakkai Turkey Berry, Toor Dal, Pepper, Cumin, Asafoetida.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Sundakkaai Podi (சுண்டக்காய் பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 240,
        "regularPrice": 300
      },
      {
        "weight": "200gms",
        "basePrice": 480,
        "regularPrice": 600
      }
    ]
  },
  {
    "id": "83",
    "name": "Mudavaattuakkaal Podi (முடவாட்டுக்கால் பொடி)",
    "slug": "mudavaattuakkaal-podi-%e0%ae%ae%e0%af%81%e0%ae%9f%e0%ae%b5%e0%ae%be%e0%ae%9f%e0%af%8d%e0%ae%9f%e0%af%81%e0%ae%95%e0%af%8d%e0%ae%95%e0%ae%be%e0%ae%b2%e0%af%8d-%e0%ae%aa%e0%af%8a%e0%ae%9f%e0%ae%bf",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Traditional medicinal herb podi prepared from rare Mudavaattuakkaal goat-foot fern for joint health.\n",
    "ingredients": "Mudavaattuakkaal Fern Root, Urad Dal, Pepper, Cumin, Garlic, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Mudavaattuakkaal Podi (முடவாட்டுக்கால் பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 240,
        "regularPrice": 300
      },
      {
        "weight": "200gms",
        "basePrice": 480,
        "regularPrice": 600
      }
    ]
  },
  {
    "id": "82",
    "name": "Pirandai Podi (பிரண்டை பொடி)",
    "slug": "pirandai-podi-%e0%ae%aa%e0%ae%bf%e0%ae%b0%e0%ae%a3%e0%af%8d%e0%ae%9f%e0%af%88-%e0%ae%aa%e0%af%8a%e0%ae%9f%e0%ae%bf",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Medicinal Pirandai rice powder for bone health and digestive wellness.\n",
    "ingredients": "Pirandai, Urad Dal, Pepper, Cumin, Red Chilli, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Pirandai Podi (பிரண்டை பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 50,
        "regularPrice": 70
      }
    ]
  },
  {
    "id": "81",
    "name": "Ellu Podi (எள்ளு பொடி)",
    "slug": "ellu-podi-%e0%ae%8e%e0%ae%b3%e0%af%8d%e0%ae%b3%e0%af%81-%e0%ae%aa%e0%af%8a%e0%ae%9f%e0%ae%bf",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Nutritious roasted black sesame rice powder. Tastes divine with hot steamed rice and ghee.\n",
    "ingredients": "Black Sesame Seeds, Urad Dal, Red Chilli, Asafoetida, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Ellu Podi (எள்ளு பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 30,
        "regularPrice": 50
      }
    ]
  },
  {
    "id": "80",
    "name": "Idly Podi (இட்லி பொடி)",
    "slug": "idly-podi-%e0%ae%87%e0%ae%9f%e0%af%8d%e0%ae%b2%e0%ae%bf-%e0%ae%aa%e0%af%8a%e0%ae%9f%e0%ae%bf",
    "categoryId": "idly-podi-rice-mix-soup-mix",
    "categoryName": "Idly Podi / Rice Mix / Soup Mix",
    "description": "Classic South Indian gunpowder chutney powder roasted with urad dal, chana dal, and sesame.\n",
    "ingredients": "Urad Dal, Chana Dal, White Sesame Seeds, Red Chilli, Asafoetida, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Idly Podi (இட்லி பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 50,
        "regularPrice": 70
      },
      {
        "weight": "100gms",
        "basePrice": 100,
        "regularPrice": 140
      }
    ]
  },
  {
    "id": "79",
    "name": "Fish Fry Masala (மீன் வறுவல் மசாலா)",
    "slug": "fish-fry-masala-%e0%ae%ae%e0%af%80%e0%ae%a9%e0%af%8d-%e0%ae%b5%e0%ae%b1%e0%af%81%e0%ae%b5%e0%ae%b2%e0%af%8d-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be",
    "categoryId": "non-veg-masalas",
    "categoryName": "Non Veg Masalas",
    "description": "Tangy spicy fish fry coating powder with tamarind, chilli, and roasted fennel.\n",
    "ingredients": "Red Chilli, Coriander, Fennel, Black Pepper, Rice Flour, Tamarind, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/fish-fry-studio.png",
    "images": [
      {
        "id": 259,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/fish-fry-studio.png",
        "alt": "Fish Fry Masala (மீன் வறுவல் மசாலா)"
      },
      {
        "id": 260,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/fish-fry-masala.png",
        "alt": "Fish Fry Masala (மீன் வறுவல் மசாலா)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 90,
        "regularPrice": 150
      },
      {
        "weight": "100gms",
        "basePrice": 180,
        "regularPrice": 300
      }
    ]
  },
  {
    "id": "78",
    "name": "Chicken 65 Masala (சிக்கன் 65 மசாலா)",
    "slug": "chicken-65-masala-%e0%ae%9a%e0%ae%bf%e0%ae%95%e0%af%8d%e0%ae%95%e0%ae%a9%e0%af%8d-65-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be",
    "categoryId": "non-veg-masalas",
    "categoryName": "Non Veg Masalas",
    "description": "Crispy spicy fry mix for authentic Hotel Style Chicken 65 and Gobi 65.\n",
    "ingredients": "Kashmiri Red Chilli, Corn Flour, Garlic, Ginger, Cumin, Pepper, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/chicken-65-studio.jpg",
    "images": [
      {
        "id": 261,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/chicken-65-studio.jpg",
        "alt": "Chicken 65 Masala (சிக்கன் 65 மசாலா)"
      },
      {
        "id": 158,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/chicken-masala.jpg",
        "alt": "Chicken 65 Masala (சிக்கன் 65 மசாலா)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 90,
        "regularPrice": 150
      },
      {
        "weight": "100gms",
        "basePrice": 180,
        "regularPrice": 300
      }
    ]
  },
  {
    "id": "77",
    "name": "Chicken Masala (சிக்கன் மசாலா)",
    "slug": "chicken-masala-%e0%ae%9a%e0%ae%bf%e0%ae%95%e0%af%8d%e0%ae%95%e0%ae%a9%e0%af%8d-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be",
    "categoryId": "non-veg-masalas",
    "categoryName": "Non Veg Masalas",
    "description": "Chettinad style roasted chicken curry powder for flavorful chicken gravy.\n",
    "ingredients": "Coriander, Red Chilli, Black Pepper, Cumin, Turmeric, Ginger, Garlic Powder.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/chicken-masala-studio.jpg",
    "images": [
      {
        "id": 262,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/chicken-masala-studio.jpg",
        "alt": "Chicken Masala (சிக்கன் மசாலா)"
      },
      {
        "id": 158,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/chicken-masala.jpg",
        "alt": "Chicken Masala (சிக்கன் மசாலா)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 85,
        "regularPrice": 120
      },
      {
        "weight": "100gms",
        "basePrice": 170,
        "regularPrice": 240
      }
    ]
  },
  {
    "id": "76",
    "name": "Mutton Masala (மட்டன் மசாலா)",
    "slug": "mutton-masala-%e0%ae%ae%e0%ae%9f%e0%af%8d%e0%ae%9f%e0%ae%a9%e0%af%8d-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be",
    "categoryId": "non-veg-masalas",
    "categoryName": "Non Veg Masalas",
    "description": "Spicy Tamil roasted spice powder crafted specifically for thick mutton gravy and chukka.\n",
    "ingredients": "Red Chillies, Coriander, Black Pepper, Fennel, Cumin, Poppy Seeds, Cloves.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/mutton-fry-studio.png",
    "images": [
      {
        "id": 257,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/mutton-fry-studio.png",
        "alt": "Mutton Masala (மட்டன் மசாலா)"
      },
      {
        "id": 258,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/mutton-fry.png",
        "alt": "Mutton Masala (மட்டன் மசாலா)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 85,
        "regularPrice": 120
      },
      {
        "weight": "100gms",
        "basePrice": 170,
        "regularPrice": 240
      }
    ]
  },
  {
    "id": "75",
    "name": "Biryani Masala (பிரியாணி மசாலா)",
    "slug": "biryani-masala-%e0%ae%aa%e0%ae%bf%e0%ae%b0%e0%ae%bf%e0%ae%af%e0%ae%be%e0%ae%a3%e0%ae%bf-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be",
    "categoryId": "non-veg-masalas",
    "categoryName": "Non Veg Masalas",
    "description": "Royal Dindigul & Ambur style biryani spice mix for aromatic meat & chicken biryanis.\n",
    "ingredients": "Mace, Star Anise, Cinnamon, Cardamom, Fennel, Cloves, Rose Petals.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/briyani-masala-studio.png",
    "images": [
      {
        "id": 255,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/briyani-masala-studio.png",
        "alt": "Biryani Masala (பிரியாணி மசாலா)"
      },
      {
        "id": 256,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/briyani-masala.png",
        "alt": "Biryani Masala (பிரியாணி மசாலா)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 170,
        "regularPrice": 200
      },
      {
        "weight": "100gms",
        "basePrice": 340,
        "regularPrice": 400
      }
    ]
  },
  {
    "id": "74",
    "name": "Garam Masala (கரம் மசாலா)",
    "slug": "garam-masala-%e0%ae%95%e0%ae%b0%e0%ae%ae%e0%af%8d-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be",
    "categoryId": "non-veg-masalas",
    "categoryName": "Non Veg Masalas",
    "description": "Rich whole spice gararn masala blend of cardamom, cloves, cinnamon, and star anise.\n",
    "ingredients": "Cardamom, Cinnamon, Cloves, Star Anise, Black Pepper, Cumin, Nutmeg.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/garam-masala-studio.jpg",
    "images": [
      {
        "id": 263,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/garam-masala-studio.jpg",
        "alt": "Garam Masala (கரம் மசாலா)"
      },
      {
        "id": 158,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/chicken-masala.jpg",
        "alt": "Garam Masala (கரம் மசாலா)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 180,
        "regularPrice": 200
      },
      {
        "weight": "100gms",
        "basePrice": 360,
        "regularPrice": 400
      }
    ]
  },
  {
    "id": "73",
    "name": "Chilli Powder (தனிமிளகாய் தூள்)",
    "slug": "chilli-powder-%e0%ae%a4%e0%ae%a9%e0%ae%bf%e0%ae%ae%e0%ae%bf%e0%ae%b3%e0%ae%95%e0%ae%be%e0%ae%af%e0%af%8d-%e0%ae%a4%e0%af%82%e0%ae%b3%e0%af%8d",
    "categoryId": "masala-varieties",
    "categoryName": "Masala Varieties",
    "description": "Pure spicy red chilli powder ground from sun-dried red chillies.\n",
    "ingredients": "100% Red Chillies.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
        "alt": "Chilli Powder (தனிமிளகாய் தூள்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 40,
        "regularPrice": 70
      },
      {
        "weight": "100gms",
        "basePrice": 80,
        "regularPrice": 140
      }
    ]
  },
  {
    "id": "72",
    "name": "Kuzhambu Masala (குழம்பு மசாலா)",
    "slug": "kuzhambu-masala-%e0%ae%95%e0%af%81%e0%ae%b4%e0%ae%ae%e0%af%8d%e0%ae%aa%e0%af%81-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be",
    "categoryId": "masala-varieties",
    "categoryName": "Masala Varieties",
    "description": "All-in-one Tamil curry chilli powder for vegetable and tamarind gravies.\n",
    "ingredients": "Red Chilli, Coriander, Cumin, Mustard, Fenugreek, Black Pepper, Curry Leaves.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
        "alt": "Kuzhambu Masala (குழம்பு மசாலா)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 40,
        "regularPrice": 70
      },
      {
        "weight": "100gms",
        "basePrice": 80,
        "regularPrice": 140
      }
    ]
  },
  {
    "id": "71",
    "name": "Turmeric Powder (மஞ்சள் தூள்)",
    "slug": "turmeric-powder-%e0%ae%ae%e0%ae%9e%e0%af%8d%e0%ae%9a%e0%ae%b3%e0%af%8d-%e0%ae%a4%e0%af%82%e0%ae%b3%e0%af%8d",
    "categoryId": "masala-varieties",
    "categoryName": "Masala Varieties",
    "description": "Organic Erode turmeric powder high in natural curcumin.\n",
    "ingredients": "100% Natural Turmeric Roots.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
        "alt": "Turmeric Powder (மஞ்சள் தூள்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 40,
        "regularPrice": 70
      },
      {
        "weight": "100gms",
        "basePrice": 80,
        "regularPrice": 140
      }
    ]
  },
  {
    "id": "70",
    "name": "Coriander Powder (மல்லித் தூள்)",
    "slug": "coriander-powder-%e0%ae%ae%e0%ae%b2%e0%af%8d%e0%ae%b2%e0%ae%bf%e0%ae%a4%e0%af%8d-%e0%ae%a4%e0%af%82%e0%ae%b3%e0%af%8d",
    "categoryId": "masala-varieties",
    "categoryName": "Masala Varieties",
    "description": "Pure sun-dried coriander seeds stone-ground for intense curry flavor.\n",
    "ingredients": "100% Green Coriander Seeds.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
        "alt": "Coriander Powder (மல்லித் தூள்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 40,
        "regularPrice": 70
      },
      {
        "weight": "100gms",
        "basePrice": 80,
        "regularPrice": 140
      }
    ]
  },
  {
    "id": "69",
    "name": "Sambar Masala (சாம்பார் மசாலா)",
    "slug": "sambar-masala-%e0%ae%9a%e0%ae%be%e0%ae%ae%e0%af%8d%e0%ae%aa%e0%ae%be%e0%ae%b0%e0%af%8d-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be",
    "categoryId": "masala-varieties",
    "categoryName": "Masala Varieties",
    "description": "Authentic Chettinad sambar spice powder hand-roasted for deep aroma.\n",
    "ingredients": "Coriander Seeds, Red Chillies, Toor Dal, Bengal Gram, Cumin, Pepper, Turmeric.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80",
        "alt": "Sambar Masala (சாம்பார் மசாலா)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 50,
        "regularPrice": 80
      },
      {
        "weight": "100gms",
        "basePrice": 100,
        "regularPrice": 160
      }
    ]
  },
  {
    "id": "68",
    "name": "Karuppu Kavuni Brownie (கருப்பு கவுனி பிரவுனி)",
    "slug": "karuppu-kavuni-brownie-%e0%ae%95%e0%ae%b0%e0%af%81%e0%ae%aa%e0%af%8d%e0%ae%aa%e0%af%81-%e0%ae%95%e0%ae%b5%e0%af%81%e0%ae%a9%e0%ae%bf-%e0%ae%aa%e0%ae%bf%e0%ae%b0%e0%ae%b5%e0%af%81%e0%ae%a9%e0%ae%bf",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Exquisite Black Rice gourmet fudge brownies rich in natural antioxidants.\n",
    "ingredients": "Karuppu Kavuni Flour, Dark Cocoa, Cow Ghee, Jaggery.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Karuppu Kavuni Brownie (கருப்பு கவுனி பிரவுனி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "500gms",
        "basePrice": 599,
        "regularPrice": 649
      }
    ]
  },
  {
    "id": "67",
    "name": "Ragi Brownie (ராகி பிரவுனி)",
    "slug": "ragi-brownie-%e0%ae%b0%e0%ae%be%e0%ae%95%e0%ae%bf-%e0%ae%aa%e0%ae%bf%e0%ae%b0%e0%ae%b5%e0%af%81%e0%ae%a9%e0%ae%bf",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Healthy guilt-free finger millet chocolate brownies sweetened with jaggery.\n",
    "ingredients": "Sprouted Ragi Flour, Dark Chocolate, Palm Jaggery, Cow Ghee.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Ragi Brownie (ராகி பிரவுனி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "500gms",
        "basePrice": 499,
        "regularPrice": 549
      }
    ]
  },
  {
    "id": "66",
    "name": "Walnut Brownie (வால்நட் பிரவுனி)",
    "slug": "walnut-brownie-%e0%ae%b5%e0%ae%be%e0%ae%b2%e0%af%8d%e0%ae%a8%e0%ae%9f%e0%af%8d-%e0%ae%aa%e0%ae%bf%e0%ae%b0%e0%ae%b5%e0%af%81%e0%ae%a9%e0%ae%bf",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Decadent chocolate brownie topped with toasted Californian walnuts.\n",
    "ingredients": "Californian Walnuts, Dark Cocoa, Butter, Flour.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Walnut Brownie (வால்நட் பிரவுனி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "500gms",
        "basePrice": 599,
        "regularPrice": 649
      }
    ]
  },
  {
    "id": "65",
    "name": "Nuts Overloaded Brownie (நட்ஸ் பிரவுனி)",
    "slug": "nuts-overloaded-brownie-%e0%ae%a8%e0%ae%9f%e0%af%8d%e0%ae%b8%e0%af%8d-%e0%ae%aa%e0%ae%bf%e0%ae%b0%e0%ae%b5%e0%af%81%e0%ae%a9%e0%ae%bf",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Fudgy chocolate brownies loaded with crunchy almonds, walnuts, and cashews.\n",
    "ingredients": "Dark Cocoa, Roasted Almonds, Walnuts, Cashews, Butter.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Nuts Overloaded Brownie (நட்ஸ் பிரவுனி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "500gms",
        "basePrice": 599,
        "regularPrice": 649
      }
    ]
  },
  {
    "id": "64",
    "name": "Classic Brownie (கிளாசிக் பிரவுனி)",
    "slug": "classic-brownie-%e0%ae%95%e0%ae%bf%e0%ae%b3%e0%ae%be%e0%ae%9a%e0%ae%bf%e0%ae%95%e0%af%8d-%e0%ae%aa%e0%ae%bf%e0%ae%b0%e0%ae%b5%e0%af%81%e0%ae%a9%e0%ae%bf",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Rich dark chocolate fudge brownies baked fresh in small batches.\n",
    "ingredients": "Dark Chocolate, Cocoa, Butter, Flour, Eggs/Yogurt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Classic Brownie (கிளாசிக் பிரவுனி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "500gms",
        "basePrice": 499,
        "regularPrice": 549
      }
    ]
  },
  {
    "id": "63",
    "name": "Choco Cookies (சாக்கோ குக்கீஸ்)",
    "slug": "choco-cookies-%e0%ae%9a%e0%ae%be%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%8b-%e0%ae%95%e0%af%81%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%80%e0%ae%b8%e0%af%8d",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Crunchy chocolate chip cookies made with dark cocoa and pure butter.\n",
    "ingredients": "Cocoa Powder, Chocolate Chips, Wheat Flour, Butter.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Choco Cookies (சாக்கோ குக்கீஸ்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 60,
        "regularPrice": 80
      }
    ]
  },
  {
    "id": "62",
    "name": "Spicy Cookies (ஸ்பைசி குக்கீஸ்)",
    "slug": "spicy-cookies-%e0%ae%b8%e0%af%8d%e0%ae%aa%e0%af%88%e0%ae%9a%e0%ae%bf-%e0%ae%95%e0%af%81%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%80%e0%ae%b8%e0%af%8d",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Savory spicy biscuits roasted with pepper, cumin, and curry leaves.\n",
    "ingredients": "Wheat Flour, Butter, Black Pepper, Cumin, Curry Leaves.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Spicy Cookies (ஸ்பைசி குக்கீஸ்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 60,
        "regularPrice": 80
      }
    ]
  },
  {
    "id": "61",
    "name": "Milk Cookies (மில்க் குக்கீஸ்)",
    "slug": "milk-cookies-%e0%ae%ae%e0%ae%bf%e0%ae%b2%e0%af%8d%e0%ae%95%e0%af%8d-%e0%ae%95%e0%af%81%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%80%e0%ae%b8%e0%af%8d",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Rich creamy milk cookies baked for tea time snacks.\n",
    "ingredients": "Milk Powder, Butter, Wheat Flour, Sugar.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Milk Cookies (மில்க் குக்கீஸ்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 60,
        "regularPrice": 80
      }
    ]
  },
  {
    "id": "60",
    "name": "Osmania Cookies (உஸ்மானியா குக்கீஸ்)",
    "slug": "osmania-cookies-%e0%ae%89%e0%ae%b8%e0%af%8d%e0%ae%ae%e0%ae%be%e0%ae%a9%e0%ae%bf%e0%ae%af%e0%ae%be-%e0%ae%95%e0%af%81%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%80%e0%ae%b8%e0%af%8d",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Melt-in-mouth sweet and salty Iranian bakery butter biscuits.\n",
    "ingredients": "Wheat Flour, Pure Butter, Milk, Sugar, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Osmania Cookies (உஸ்மானியா குக்கீஸ்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 80,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "59",
    "name": "Millet Cookies (சிறு தானிய குக்கீஸ்)",
    "slug": "millet-cookies-%e0%ae%9a%e0%ae%bf%e0%ae%b1%e0%af%81-%e0%ae%a4%e0%ae%be%e0%ae%a9%e0%ae%bf%e0%ae%af-%e0%ae%95%e0%af%81%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%80%e0%ae%b8%e0%af%8d",
    "categoryId": "cookies-brownies",
    "categoryName": "Cookies & Brownies",
    "description": "Crispy wholesome cookies baked with foxtail millet flour, country butter, and unrefined sugar.\n",
    "ingredients": "Millet Flour, Butter, Unrefined Sugar, Cardamom.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80",
        "alt": "Millet Cookies (சிறு தானிய குக்கீஸ்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 80,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "58",
    "name": "Masala Tea Powder (மசாலா டீ தூள்)",
    "slug": "masala-tea-powder-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be-%e0%ae%9f%e0%af%80-%e0%ae%a4%e0%af%82%e0%ae%b3%e0%af%8d",
    "categoryId": "beverage-sweeteners",
    "categoryName": "Beverage & Sweeteners",
    "description": "Concentrated tea spice powder. Add a pinch while brewing tea for authentic dhaba chai flavor.\n",
    "ingredients": "Cardamom, Dry Ginger, Cinnamon, Nutmeg, Cloves, Black Pepper.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
        "alt": "Masala Tea Powder (மசாலா டீ தூள்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "50gms",
        "basePrice": 60,
        "regularPrice": 80
      }
    ]
  },
  {
    "id": "57",
    "name": "Masala Chai (மசாலா டீ)",
    "slug": "masala-chai-%e0%ae%ae%e0%ae%9a%e0%ae%be%e0%ae%b2%e0%ae%be-%e0%ae%9f%e0%af%80",
    "categoryId": "beverage-sweeteners",
    "categoryName": "Beverage & Sweeteners",
    "description": "Aromatic Assam tea leaves blended with hand-ground cardamom, cinnamon, cloves, and ginger.\n",
    "ingredients": "Assam Tea, Cardamom, Cinnamon, Clove, Black Pepper, Dry Ginger.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
        "alt": "Masala Chai (மசாலா டீ)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 120,
        "regularPrice": 150
      }
    ]
  },
  {
    "id": "56",
    "name": "Nuts Powder (நட்ஸ் பவுடர்)",
    "slug": "nuts-powder-%e0%ae%a8%e0%ae%9f%e0%af%8d%e0%ae%b8%e0%af%8d-%e0%ae%aa%e0%ae%b5%e0%af%81%e0%ae%9f%e0%ae%b0%e0%af%8d",
    "categoryId": "beverage-sweeteners",
    "categoryName": "Beverage & Sweeteners",
    "description": "Premium roasted Almond, Cashew, and Pistachio powder with saffron and cardamom for healthy milk drink.\n",
    "ingredients": "Almonds, Cashews, Pistachios, Saffron, Cardamom.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
        "alt": "Nuts Powder (நட்ஸ் பவுடர்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "200gms",
        "basePrice": 250,
        "regularPrice": 300
      }
    ]
  },
  {
    "id": "55",
    "name": "Dates Powder (பேரீச்சை பொடி)",
    "slug": "dates-powder-%e0%ae%aa%e0%af%87%e0%ae%b0%e0%af%80%e0%ae%9a%e0%af%8d%e0%ae%9a%e0%af%88-%e0%ae%aa%e0%af%8a%e0%ae%9f%e0%ae%bf",
    "categoryId": "beverage-sweeteners",
    "categoryName": "Beverage & Sweeteners",
    "description": "Dehydrated stone-ground Lion Arabian dates powder. Healthy natural sweetener for baby food & milk.\n",
    "ingredients": "100% Dehydrated Arabian Dates.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
        "alt": "Dates Powder (பேரீச்சை பொடி)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "200gms",
        "basePrice": 180,
        "regularPrice": 200
      }
    ]
  },
  {
    "id": "54",
    "name": "Natural Honey (தேன்)",
    "slug": "natural-honey-%e0%ae%a4%e0%af%87%e0%ae%a9%e0%af%8d",
    "categoryId": "beverage-sweeteners",
    "categoryName": "Beverage & Sweeteners",
    "description": "100% pure raw unfiltered forest honey collected from natural mountain hives.\n",
    "ingredients": "Pure Forest Wild Honey.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
        "alt": "Natural Honey (தேன்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 249,
        "regularPrice": 299
      }
    ]
  },
  {
    "id": "53",
    "name": "Country Sugar (நாட்டுச் சர்க்கரை)",
    "slug": "country-sugar-%e0%ae%a8%e0%ae%be%e0%ae%9f%e0%af%8d%e0%ae%9f%e0%af%81%e0%ae%9a%e0%af%8d-%e0%ae%9a%e0%ae%b0%e0%af%8d%e0%ae%95%e0%af%8d%e0%ae%95%e0%ae%b0%e0%af%88",
    "categoryId": "beverage-sweeteners",
    "categoryName": "Beverage & Sweeteners",
    "description": "Unrefined unbleached sugarcane jaggery powder rich in natural minerals.\n",
    "ingredients": "100% Raw Sugarcane Jaggery Powder.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
        "alt": "Country Sugar (நாட்டுச் சர்க்கரை)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 30,
        "regularPrice": 50
      }
    ]
  },
  {
    "id": "52",
    "name": "Nannari Sherbet (நன்னாரி சர்பத்)",
    "slug": "nannari-sherbet-%e0%ae%a8%e0%ae%a9%e0%af%8d%e0%ae%a9%e0%ae%be%e0%ae%b0%e0%ae%bf-%e0%ae%9a%e0%ae%b0%e0%af%8d%e0%ae%aa%e0%ae%a4%e0%af%8d",
    "categoryId": "beverage-sweeteners",
    "categoryName": "Beverage & Sweeteners",
    "description": "Cooling Sarsaparilla root concentrate brewed naturally with organic sugar. Refreshing summer cooler.\n",
    "ingredients": "Nannari Roots, Natural Sugar, Water, Lemon Juice.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80",
        "alt": "Nannari Sherbet (நன்னாரி சர்பத்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "275ml",
        "basePrice": 30,
        "regularPrice": 50
      },
      {
        "weight": "500ml",
        "basePrice": 55,
        "regularPrice": 91
      }
    ]
  },
  {
    "id": "51",
    "name": "Karuveppilai Thokku (கருவேப்பிலை தொக்கு)",
    "slug": "karuveppilai-thokku-%e0%ae%95%e0%ae%b0%e0%af%81%e0%ae%b5%e0%af%87%e0%ae%aa%e0%af%8d%e0%ae%aa%e0%ae%bf%e0%ae%b2%e0%af%88-%e0%ae%a4%e0%af%8a%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%81",
    "categoryId": "thokku-varieties",
    "categoryName": "Thokku Varieties",
    "description": "Nutritious shade-dried curry leaf pickle cooked in gingelly oil. High in iron and natural vitamins.\n",
    "ingredients": "Curry Leaves, Tamarind, Red Chilli, Gingelly Oil, Mustard, Asafoetida.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        "alt": "Karuveppilai Thokku (கருவேப்பிலை தொக்கு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 90,
        "regularPrice": 150
      }
    ]
  },
  {
    "id": "50",
    "name": "Pirandai Thokku (பிரண்டை தொக்கு)",
    "slug": "pirandai-thokku-%e0%ae%aa%e0%ae%bf%e0%ae%b0%e0%ae%a3%e0%af%8d%e0%ae%9f%e0%af%88-%e0%ae%a4%e0%af%8a%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%81",
    "categoryId": "thokku-varieties",
    "categoryName": "Thokku Varieties",
    "description": "Medicinal Cissus quadrangularis (Pirandai) thokku known in Tamil tradition for bone strength and digestion.\n",
    "ingredients": "Fresh Tender Pirandai, Tamarind, Red Chilli, Gingelly Oil, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        "alt": "Pirandai Thokku (பிரண்டை தொக்கு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 100,
        "regularPrice": 150
      }
    ]
  },
  {
    "id": "49",
    "name": "Puliyotharai Paste (புளியோதரை பேஸ்ட்)",
    "slug": "puliyotharai-paste-%e0%ae%aa%e0%af%81%e0%ae%b3%e0%ae%bf%e0%ae%af%e0%af%8b%e0%ae%a4%e0%ae%b0%e0%af%88-%e0%ae%aa%e0%af%87%e0%ae%b8%e0%af%8d%e0%ae%9f%e0%af%8d",
    "categoryId": "thokku-varieties",
    "categoryName": "Thokku Varieties",
    "description": "Traditional temple-style tamarind rice mix paste cooked with roasted peanuts and chana dal.\n",
    "ingredients": "Tamarind Concentrate, Gingelly Oil, Peanuts, Chana Dal, Mustard, Red Chilli, Turmeric.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        "alt": "Puliyotharai Paste (புளியோதரை பேஸ்ட்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 50,
        "regularPrice": 70
      }
    ]
  },
  {
    "id": "48",
    "name": "Pudhina Thokku (புதინა தொக்கு)",
    "slug": "pudhina-thokku-%e0%ae%aa%e0%af%81%e0%ae%a4%e1%83%98%e1%83%9c%e1%83%90-%e0%ae%a4%e0%af%8a%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%81",
    "categoryId": "thokku-varieties",
    "categoryName": "Thokku Varieties",
    "description": "Aromatic mint leaf relish roasted with green chillies, tamarind, and gingelly oil. Tastes divine with tiffin items.\n",
    "ingredients": "Fresh Pudhina Mint Leaves, Tamarind, Red Chilli, Gingelly Oil, Asafoetida.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        "alt": "Pudhina Thokku (புதინა தொக்கு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 50,
        "regularPrice": 70
      }
    ]
  },
  {
    "id": "47",
    "name": "Vatthal Kuzhambu Thokku (வத்தல் குழம்பு தொக்கு)",
    "slug": "vatthal-kuzhambu-thokku-%e0%ae%b5%e0%ae%a4%e0%af%8d%e0%ae%a4%e0%ae%b2%e0%af%8d-%e0%ae%95%e0%af%81%e0%ae%b4%e0%ae%ae%e0%af%8d%e0%ae%aa%e0%af%81-%e0%ae%a4%e0%af%8a%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%81",
    "categoryId": "thokku-varieties",
    "categoryName": "Thokku Varieties",
    "description": "Tangy, spicy Sundakkai and Manathakkali vatthal kuzhambu paste. Instant curry when mixed with hot rice.\n",
    "ingredients": "Sundakkai Vatthal, Tamarind, Sesame Oil, Sambar Powder, Jaggery, Asafoetida.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        "alt": "Vatthal Kuzhambu Thokku (வத்தல் குழம்பு தொக்கு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 50,
        "regularPrice": 70
      }
    ]
  },
  {
    "id": "46",
    "name": "Tomato Thokku (தக்காளி தொக்கு)",
    "slug": "tomato-thokku-%e0%ae%a4%e0%ae%95%e0%af%8d%e0%ae%95%e0%ae%be%e0%ae%b3%e0%ae%bf-%e0%ae%a4%e0%af%8a%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%81",
    "categoryId": "thokku-varieties",
    "categoryName": "Thokku Varieties",
    "description": "Farm-fresh country tomatoes slow-simmered in gingelly oil with authentic roasted South Indian spices.\n",
    "ingredients": "Country Tomatoes, Gingelly Oil, Red Chillies, Mustard, Fenugreek, Asafoetida.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        "alt": "Tomato Thokku (தக்காளி தொக்கு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 50,
        "regularPrice": 70
      }
    ]
  },
  {
    "id": "45",
    "name": "Garlic Thokku (பூண்டு தொக்கு)",
    "slug": "garlic-thokku-%e0%ae%aa%e0%af%82%e0%ae%a3%e0%af%8d%e0%ae%9f%e0%af%81-%e0%ae%a4%e0%af%8a%e0%ae%95%e0%af%8d%e0%ae%95%e0%af%81",
    "categoryId": "thokku-varieties",
    "categoryName": "Thokku Varieties",
    "description": "Slow-cooked garlic relish infused with cold-pressed gingelly oil, tamarind, and roasted spices.\n",
    "ingredients": "Country Garlic, Cold-Pressed Sesame Oil, Red Chilli, Tamarind, Mustard, Salt.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80",
        "alt": "Garlic Thokku (பூண்டு தொக்கு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "100gms",
        "basePrice": 80,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "44",
    "name": "Karuppu Kavuni Kanji Mix (கருப்பு கவுனி கஞ்சி மிக்ஸ்)",
    "slug": "karuppu-kavuni-kanji-mix-%e0%ae%95%e0%ae%b0%e0%af%81%e0%ae%aa%e0%af%8d%e0%ae%aa%e0%af%81-%e0%ae%95%e0%ae%b5%e0%af%81%e0%ae%a9%e0%ae%bf-%e0%ae%95%e0%ae%9e%e0%af%8d%e0%ae%9a%e0%ae%bf-%e0%ae%ae%e0%ae%bf",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Heritage Black Rice porridge mix sourced from organic farms. High in anthocyanin antioxidants.\n",
    "ingredients": "Karuppu Kavuni Black Rice, Cardamom, Dry Ginger.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        "alt": "Karuppu Kavuni Kanji Mix (கருப்பு கவுனி கஞ்சி மிக்ஸ்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 120,
        "regularPrice": 150
      }
    ]
  },
  {
    "id": "43",
    "name": "Health Mix (சத்து மாவு)",
    "slug": "health-mix-%e0%ae%9a%e0%ae%a4%e0%af%8d%e0%ae%a4%e0%af%81-%e0%ae%ae%e0%ae%be%e0%ae%b5%e0%af%81",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Classic 24-ingredient sprouted multi-grain health drink mix for kids and adults. 100% homemade wellness.\n",
    "ingredients": "Sprouted Millets, Cereals, Pulses, Almonds, Cashews, Cardamom, Dry Ginger.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/saathumaavu-studio.jpg",
    "images": [
      {
        "id": 264,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/saathumaavu-studio.jpg",
        "alt": "Health Mix (சத்து மாவு)"
      },
      {
        "id": 160,
        "src": "https://admin.homemadefoodsmadurai.com/wp-content/uploads/2026/07/saathumaavu-1.jpg",
        "alt": "Health Mix (சத்து மாவு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "200gms",
        "basePrice": 150,
        "regularPrice": 200
      }
    ]
  },
  {
    "id": "42",
    "name": "Millet Mix (சிறு தானிய மாவு)",
    "slug": "millet-mix-%e0%ae%9a%e0%ae%bf%e0%ae%b1%e0%af%81-%e0%ae%a4%e0%ae%be%e0%ae%a9%e0%ae%bf%e0%ae%af-%e0%ae%ae%e0%ae%be%e0%ae%b5%e0%af%81",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Multi-millet health flour blend combining Kodo, Foxtail, Barnyard, and Little Millet for daily health.\n",
    "ingredients": "Foxtail Millet, Kodo Millet, Little Millet, Barnyard Millet, Urad Dal.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        "alt": "Millet Mix (சிறு தானிய மாவு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 90,
        "regularPrice": 150
      }
    ]
  },
  {
    "id": "41",
    "name": "Sivappu Arisi Puttu Maavu (சிவப்பு அரிசி புட்டு/ இடியாப்பம்/ மாவு)",
    "slug": "sivappu-arisi-puttu-maavu-%e0%ae%9a%e0%ae%bf%e0%ae%b5%e0%ae%aa%e0%af%8d%e0%ae%aa%e0%af%81-%e0%ae%85%e0%ae%b0%e0%ae%bf%e0%ae%9a%e0%ae%bf-%e0%ae%aa%e0%af%81%e0%ae%9f%e0%af%8d%e0%ae%9f%e0%af%81",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Nutrient-rich Organic Red Rice flour ideal for healthy Red Rice Puttu and String Hoppers.\n",
    "ingredients": "100% Traditional Sivappu Arisi (Red Rice).",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        "alt": "Sivappu Arisi Puttu Maavu (சிவப்பு அரிசி புட்டு/ இடியாப்பம்/ மாவு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 70,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "40",
    "name": "Puttu, Idiyappam Maavu (கொழுக்கட்டை/ இடியாப்பம்/ புட்டு மாவு)",
    "slug": "puttu-idiyappam-maavu-%e0%ae%95%e0%af%8a%e0%ae%b4%e0%af%81%e0%ae%95%e0%af%8d%e0%ae%95%e0%ae%9f%e0%af%8d%e0%ae%9f%e0%af%88-%e0%ae%87%e0%ae%9f%e0%ae%bf%e0%ae%af%e0%ae%be%e0%ae%aa%e0%af%8d%e0%ae%aa",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Processed roasted rice flour specially milled for soft, stringy Idiyappam, steamy Puttu, and Kozhukattai.\n",
    "ingredients": "First Quality Steamed Raw Rice Flour.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        "alt": "Puttu, Idiyappam Maavu (கொழுக்கட்டை/ இடியாப்பம்/ புட்டு மாவு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 40,
        "regularPrice": 60
      }
    ]
  },
  {
    "id": "39",
    "name": "Whole Wheat Flour (கோதுமை மாவு)",
    "slug": "whole-wheat-flour-%e0%ae%95%e0%af%8b%e0%ae%a4%e0%af%81%e0%ae%ae%e0%af%88-%e0%ae%ae%e0%ae%be%e0%ae%b5%e0%af%81",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Traditional chakki-fresh whole wheat flour for soft, fluffy rotis and chapattis.\n",
    "ingredients": "100% Whole Wheat Grains.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        "alt": "Whole Wheat Flour (கோதுமை மாவு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 30,
        "regularPrice": 50
      },
      {
        "weight": "500gms",
        "basePrice": 60,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "38",
    "name": "Ragi Flour (ராகி மாவு)",
    "slug": "ragi-flour-%e0%ae%b0%e0%ae%be%e0%ae%95%e0%ae%bf-%e0%ae%ae%e0%ae%be%e0%ae%b5%e0%af%81",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Pure stone-ground Finger Millet flour rich in calcium and fiber. Perfect for ragi roti, kanji, and puttu.\n",
    "ingredients": "100% Whole Grain Sprouted Finger Millet (Ragi).",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        "alt": "Ragi Flour (ராகி மாவு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 50,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "37",
    "name": "Adai Dosa Premix (அடை மாவு ப்ரீமிக்ஸ்)",
    "slug": "adai-dosa-premix-%e0%ae%85%e0%ae%9f%e0%af%88-%e0%ae%ae%e0%ae%be%e0%ae%b5%e0%af%81-%e0%ae%aa%e0%af%8d%e0%ae%b0%e0%af%80%e0%ae%ae%e0%ae%bf%e0%ae%95%e0%af%8d%e0%ae%b8%e0%af%8d",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Protein-packed multi-lentil instant dosa mix for crisp, savory South Indian Adai dosas. Just add water and make fresh dosas.\n",
    "ingredients": "Toor Dal, Chana Dal, Urad Dal, Moong Dal, Raw Rice, Red Chillies, Asafoetida.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80",
        "alt": "Adai Dosa Premix (அடை மாவு ப்ரீமிக்ஸ்)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 70,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "36",
    "name": "Vendaya Kali Mix (வெந்தயக் களி மாவு)",
    "slug": "vendaya-kali-mix-%e0%ae%b5%e0%af%86%e0%ae%a8%e0%af%8d%e0%ae%a4%e0%ae%af%e0%ae%95%e0%af%8d-%e0%ae%95%e0%ae%b3%e0%ae%bf-%e0%ae%ae%e0%ae%be%e0%ae%b5%e0%af%81",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Cooling, digestive Fenugreek porridge mix crafted with roasted whole fenugreek and red rice. Excellent for body cooling and stamina.\n",
    "ingredients": "Fenugreek Seeds, Red Rice, Palm Jaggery Blend, Dry Ginger.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
        "alt": "Vendaya Kali Mix (வெந்தயக் களி மாவு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 70,
        "regularPrice": 100
      }
    ]
  },
  {
    "id": "35",
    "name": "Black Urad Dal Kali Mix (கருப்பு உளுந்து களி மாவு)",
    "slug": "black-urad-dal-kali-mix-%e0%ae%95%e0%ae%b0%e0%af%81%e0%ae%aa%e0%af%8d%e0%ae%aa%e0%af%81-%e0%ae%89%e0%ae%b3%e0%af%81%e0%ae%a8%e0%af%8d%e0%ae%a4%e0%af%81-%e0%ae%95%e0%ae%b3%e0%ae%bf-%e0%ae%ae%e0%ae%be",
    "categoryId": "flour-premix-malt",
    "categoryName": "Flour/ Premix/ Malt",
    "description": "Traditional nutrient-dense Black Urad Dal porridge mix rich in natural protein, iron, and calcium. Prepared using authentic Tamil grandma recipes.\n",
    "ingredients": "Whole Black Urad Dal, Raw Rice, Fenugreek Seeds, Cardamom.",
    "shelfLife": "6 Months",
    "storageInstructions": "Store in a cool dry place.",
    "imageUrl": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    "images": [
      {
        "id": 0,
        "src": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
        "alt": "Black Urad Dal Kali Mix (கருப்பு உளுந்து களி மாவு)"
      }
    ],
    "gstPercentage": 0,
    "isAvailable": true,
    "variants": [
      {
        "weight": "250gms",
        "basePrice": 70,
        "regularPrice": 100
      }
    ]
  }
];
