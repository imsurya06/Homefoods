import { wcApi } from './src/config/woocommerce.js';

interface VariantInput {
  weight: string;
  regularPrice: number;
  salePrice: number;
}

interface ProductInput {
  name: string;
  tamilName?: string;
  category: string;
  description: string;
  ingredients: string;
  variants: VariantInput[];
  imageUrl: string;
}

const CATEGORIES_TO_CREATE = [
  { name: 'Flour/ Premix/ Malt', slug: 'flour-premix-malt' },
  { name: 'Thokku Varieties', slug: 'thokku-varieties' },
  { name: 'Beverage & Sweeteners', slug: 'beverage-sweeteners' },
  { name: 'Cookies & Brownies', slug: 'cookies-brownies' },
  { name: 'Masala Varieties', slug: 'masala-varieties' },
  { name: 'Non Veg Masalas', slug: 'non-veg-masalas' },
  { name: 'Idly Podi / Rice Mix / Soup Mix', slug: 'idly-podi-rice-mix-soup-mix' },
];

const PRODUCTS_DATA: ProductInput[] = [
  // --- 1. FLOUR / PREMIX / MALT ---
  {
    name: 'Black Urad Dal Kali Mix (கருப்பு உளுந்து களி மாவு)',
    category: 'Flour/ Premix/ Malt',
    description: 'Traditional nutrient-dense Black Urad Dal porridge mix rich in natural protein, iron, and calcium. Prepared using authentic Tamil grandma recipes.',
    ingredients: 'Whole Black Urad Dal, Raw Rice, Fenugreek Seeds, Cardamom.',
    variants: [{ weight: '250gms', regularPrice: 100, salePrice: 70 }],
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Vendaya Kali Mix (வெந்தயக் களி மாவு)',
    category: 'Flour/ Premix/ Malt',
    description: 'Cooling, digestive Fenugreek porridge mix crafted with roasted whole fenugreek and red rice. Excellent for body cooling and stamina.',
    ingredients: 'Fenugreek Seeds, Red Rice, Palm Jaggery Blend, Dry Ginger.',
    variants: [{ weight: '250gms', regularPrice: 100, salePrice: 70 }],
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Adai Dosa Premix (அடை மாவு ப்ரீமிக்ஸ்)',
    category: 'Flour/ Premix/ Malt',
    description: 'Protein-packed multi-lentil instant dosa mix for crisp, savory South Indian Adai dosas. Just add water and make fresh dosas.',
    ingredients: 'Toor Dal, Chana Dal, Urad Dal, Moong Dal, Raw Rice, Red Chillies, Asafoetida.',
    variants: [{ weight: '250gms', regularPrice: 100, salePrice: 70 }],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Ragi Flour (ராகி மாவு)',
    category: 'Flour/ Premix/ Malt',
    description: 'Pure stone-ground Finger Millet flour rich in calcium and fiber. Perfect for ragi roti, kanji, and puttu.',
    ingredients: '100% Whole Grain Sprouted Finger Millet (Ragi).',
    variants: [{ weight: '250gms', regularPrice: 100, salePrice: 50 }],
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Whole Wheat Flour (கோதுமை மாவு)',
    category: 'Flour/ Premix/ Malt',
    description: 'Traditional chakki-fresh whole wheat flour for soft, fluffy rotis and chapattis.',
    ingredients: '100% Whole Wheat Grains.',
    variants: [
      { weight: '250gms', regularPrice: 50, salePrice: 30 },
      { weight: '500gms', regularPrice: 70, salePrice: 50 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Puttu, Idiyappam Maavu (கொழுக்கட்டை/ இடியாப்பம்/ புட்டு மாவு)',
    category: 'Flour/ Premix/ Malt',
    description: 'Processed roasted rice flour specially milled for soft, stringy Idiyappam, steamy Puttu, and Kozhukattai.',
    ingredients: 'First Quality Steamed Raw Rice Flour.',
    variants: [{ weight: '250gms', regularPrice: 60, salePrice: 40 }],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Sivappu Arisi Puttu Maavu (சிவப்பு அரிசி புட்டு/ இடியாப்பம்/ மாவு)',
    category: 'Flour/ Premix/ Malt',
    description: 'Nutrient-rich Organic Red Rice flour ideal for healthy Red Rice Puttu and String Hoppers.',
    ingredients: '100% Traditional Sivappu Arisi (Red Rice).',
    variants: [{ weight: '250gms', regularPrice: 100, salePrice: 70 }],
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Millet Mix (சிறு தானிய மாவு)',
    category: 'Flour/ Premix/ Malt',
    description: 'Multi-millet health flour blend combining Kodo, Foxtail, Barnyard, and Little Millet for daily health.',
    ingredients: 'Foxtail Millet, Kodo Millet, Little Millet, Barnyard Millet, Urad Dal.',
    variants: [{ weight: '250gms', regularPrice: 150, salePrice: 90 }],
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Health Mix (சத்து மாவு)',
    category: 'Flour/ Premix/ Malt',
    description: 'Classic 24-ingredient sprouted multi-grain health drink mix for kids and adults. 100% homemade wellness.',
    ingredients: 'Sprouted Millets, Cereals, Pulses, Almonds, Cashews, Cardamom, Dry Ginger.',
    variants: [{ weight: '200gms', regularPrice: 200, salePrice: 150 }],
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Karuppu Kavuni Kanji Mix (கருப்பு கவுனி கஞ்சி மிக்ஸ்)',
    category: 'Flour/ Premix/ Malt',
    description: 'Heritage Black Rice porridge mix sourced from organic farms. High in anthocyanin antioxidants.',
    ingredients: 'Karuppu Kavuni Black Rice, Cardamom, Dry Ginger.',
    variants: [{ weight: '250gms', regularPrice: 150, salePrice: 120 }],
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
  },

  // --- 2. THOKKU VARIETIES ---
  {
    name: 'Garlic Thokku (பூண்டு தொக்கு)',
    category: 'Thokku Varieties',
    description: 'Slow-cooked garlic relish infused with cold-pressed gingelly oil, tamarind, and roasted spices.',
    ingredients: 'Country Garlic, Cold-Pressed Sesame Oil, Red Chilli, Tamarind, Mustard, Salt.',
    variants: [{ weight: '100gms', regularPrice: 100, salePrice: 80 }],
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Tomato Thokku (தக்காளி தொக்கு)',
    category: 'Thokku Varieties',
    description: 'Farm-fresh country tomatoes slow-simmered in gingelly oil with authentic roasted South Indian spices.',
    ingredients: 'Country Tomatoes, Gingelly Oil, Red Chillies, Mustard, Fenugreek, Asafoetida.',
    variants: [{ weight: '100gms', regularPrice: 70, salePrice: 50 }],
    imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Vatthal Kuzhambu Thokku (வத்தல் குழம்பு தொக்கு)',
    category: 'Thokku Varieties',
    description: 'Tangy, spicy Sundakkai and Manathakkali vatthal kuzhambu paste. Instant curry when mixed with hot rice.',
    ingredients: 'Sundakkai Vatthal, Tamarind, Sesame Oil, Sambar Powder, Jaggery, Asafoetida.',
    variants: [{ weight: '100gms', regularPrice: 70, salePrice: 50 }],
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Pudhina Thokku (புதინა தொக்கு)',
    category: 'Thokku Varieties',
    description: 'Aromatic mint leaf relish roasted with green chillies, tamarind, and gingelly oil. Tastes divine with tiffin items.',
    ingredients: 'Fresh Pudhina Mint Leaves, Tamarind, Red Chilli, Gingelly Oil, Asafoetida.',
    variants: [{ weight: '100gms', regularPrice: 70, salePrice: 50 }],
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Puliyotharai Paste (புளியோதரை பேஸ்ட்)',
    category: 'Thokku Varieties',
    description: 'Traditional temple-style tamarind rice mix paste cooked with roasted peanuts and chana dal.',
    ingredients: 'Tamarind Concentrate, Gingelly Oil, Peanuts, Chana Dal, Mustard, Red Chilli, Turmeric.',
    variants: [{ weight: '100gms', regularPrice: 70, salePrice: 50 }],
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Pirandai Thokku (பிரண்டை தொக்கு)',
    category: 'Thokku Varieties',
    description: 'Medicinal Cissus quadrangularis (Pirandai) thokku known in Tamil tradition for bone strength and digestion.',
    ingredients: 'Fresh Tender Pirandai, Tamarind, Red Chilli, Gingelly Oil, Salt.',
    variants: [{ weight: '100gms', regularPrice: 150, salePrice: 100 }],
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Karuveppilai Thokku (கருவேப்பிலை தொக்கு)',
    category: 'Thokku Varieties',
    description: 'Nutritious shade-dried curry leaf pickle cooked in gingelly oil. High in iron and natural vitamins.',
    ingredients: 'Curry Leaves, Tamarind, Red Chilli, Gingelly Oil, Mustard, Asafoetida.',
    variants: [{ weight: '100gms', regularPrice: 150, salePrice: 90 }],
    imageUrl: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?auto=format&fit=crop&w=800&q=80',
  },

  // --- 3. BEVERAGE & SWEETENERS ---
  {
    name: 'Nannari Sherbet (நன்னாரி சர்பத்)',
    category: 'Beverage & Sweeteners',
    description: 'Cooling Sarsaparilla root concentrate brewed naturally with organic sugar. Refreshing summer cooler.',
    ingredients: 'Nannari Roots, Natural Sugar, Water, Lemon Juice.',
    variants: [
      { weight: '275ml', regularPrice: 50, salePrice: 30 },
      { weight: '500ml', regularPrice: 70, salePrice: 50 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Country Sugar (நாட்டுச் சர்க்கரை)',
    category: 'Beverage & Sweeteners',
    description: 'Unrefined unbleached sugarcane jaggery powder rich in natural minerals.',
    ingredients: '100% Raw Sugarcane Jaggery Powder.',
    variants: [{ weight: '250gms', regularPrice: 50, salePrice: 30 }],
    imageUrl: 'https://images.unsplash.com/photo-1608797178974-15b35a64ede9?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Natural Honey (தேன்)',
    category: 'Beverage & Sweeteners',
    description: '100% pure raw unfiltered forest honey collected from natural mountain hives.',
    ingredients: 'Pure Forest Wild Honey.',
    variants: [{ weight: '250gms', regularPrice: 299, salePrice: 249 }],
    imageUrl: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Dates Powder (பேரீச்சை பொடி)',
    category: 'Beverage & Sweeteners',
    description: 'Dehydrated stone-ground Lion Arabian dates powder. Healthy natural sweetener for baby food & milk.',
    ingredients: '100% Dehydrated Arabian Dates.',
    variants: [{ weight: '200gms', regularPrice: 200, salePrice: 180 }],
    imageUrl: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Nuts Powder (நட்ஸ் பவுடர்)',
    category: 'Beverage & Sweeteners',
    description: 'Premium roasted Almond, Cashew, and Pistachio powder with saffron and cardamom for healthy milk drink.',
    ingredients: 'Almonds, Cashews, Pistachios, Saffron, Cardamom.',
    variants: [{ weight: '200gms', regularPrice: 300, salePrice: 250 }],
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Masala Chai (மசாலா டீ)',
    category: 'Beverage & Sweeteners',
    description: 'Aromatic Assam tea leaves blended with hand-ground cardamom, cinnamon, cloves, and ginger.',
    ingredients: 'Assam Tea, Cardamom, Cinnamon, Clove, Black Pepper, Dry Ginger.',
    variants: [{ weight: '100gms', regularPrice: 150, salePrice: 120 }],
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Masala Tea Powder (மசாலா டீ தூள்)',
    category: 'Beverage & Sweeteners',
    description: 'Concentrated tea spice powder. Add a pinch while brewing tea for authentic dhaba chai flavor.',
    ingredients: 'Cardamom, Dry Ginger, Cinnamon, Nutmeg, Cloves, Black Pepper.',
    variants: [{ weight: '50gms', regularPrice: 80, salePrice: 60 }],
    imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=800&q=80',
  },

  // --- 4. COOKIES / BROWNIES ---
  {
    name: 'Millet Cookies (சிறு தானிய குக்கீஸ்)',
    category: 'Cookies & Brownies',
    description: 'Crispy wholesome cookies baked with foxtail millet flour, country butter, and unrefined sugar.',
    ingredients: 'Millet Flour, Butter, Unrefined Sugar, Cardamom.',
    variants: [{ weight: '100gms', regularPrice: 100, salePrice: 80 }],
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Osmania Cookies (உஸ்மானியா குக்கீஸ்)',
    category: 'Cookies & Brownies',
    description: 'Melt-in-mouth sweet and salty Iranian bakery butter biscuits.',
    ingredients: 'Wheat Flour, Pure Butter, Milk, Sugar, Salt.',
    variants: [{ weight: '100gms', regularPrice: 100, salePrice: 80 }],
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Milk Cookies (மில்க் குக்கீஸ்)',
    category: 'Cookies & Brownies',
    description: 'Rich creamy milk cookies baked for tea time snacks.',
    ingredients: 'Milk Powder, Butter, Wheat Flour, Sugar.',
    variants: [{ weight: '100gms', regularPrice: 80, salePrice: 60 }],
    imageUrl: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Spicy Cookies (ஸ்பைசி குக்கீஸ்)',
    category: 'Cookies & Brownies',
    description: 'Savory spicy biscuits roasted with pepper, cumin, and curry leaves.',
    ingredients: 'Wheat Flour, Butter, Black Pepper, Cumin, Curry Leaves.',
    variants: [{ weight: '100gms', regularPrice: 80, salePrice: 60 }],
    imageUrl: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Choco Cookies (சாக்கோ குக்கீஸ்)',
    category: 'Cookies & Brownies',
    description: 'Crunchy chocolate chip cookies made with dark cocoa and pure butter.',
    ingredients: 'Cocoa Powder, Chocolate Chips, Wheat Flour, Butter.',
    variants: [{ weight: '100gms', regularPrice: 80, salePrice: 60 }],
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Classic Brownie (கிளாசிக் பிரவுனி)',
    category: 'Cookies & Brownies',
    description: 'Rich dark chocolate fudge brownies baked fresh in small batches.',
    ingredients: 'Dark Chocolate, Cocoa, Butter, Flour, Eggs/Yogurt.',
    variants: [{ weight: '500gms', regularPrice: 549, salePrice: 499 }],
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Nuts Overloaded Brownie (நட்ஸ் பிரவுனி)',
    category: 'Cookies & Brownies',
    description: 'Fudgy chocolate brownies loaded with crunchy almonds, walnuts, and cashews.',
    ingredients: 'Dark Cocoa, Roasted Almonds, Walnuts, Cashews, Butter.',
    variants: [{ weight: '500gms', regularPrice: 649, salePrice: 599 }],
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Walnut Brownie (வால்நட் பிரவுனி)',
    category: 'Cookies & Brownies',
    description: 'Decadent chocolate brownie topped with toasted Californian walnuts.',
    ingredients: 'Californian Walnuts, Dark Cocoa, Butter, Flour.',
    variants: [{ weight: '500gms', regularPrice: 649, salePrice: 599 }],
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Ragi Brownie (ராகி பிரவுனி)',
    category: 'Cookies & Brownies',
    description: 'Healthy guilt-free finger millet chocolate brownies sweetened with jaggery.',
    ingredients: 'Sprouted Ragi Flour, Dark Chocolate, Palm Jaggery, Cow Ghee.',
    variants: [{ weight: '500gms', regularPrice: 549, salePrice: 499 }],
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Karuppu Kavuni Brownie (கருப்பு கவுனி பிரவுனி)',
    category: 'Cookies & Brownies',
    description: 'Exquisite Black Rice gourmet fudge brownies rich in natural antioxidants.',
    ingredients: 'Karuppu Kavuni Flour, Dark Cocoa, Cow Ghee, Jaggery.',
    variants: [{ weight: '500gms', regularPrice: 649, salePrice: 599 }],
    imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80',
  },

  // --- 5. MASALA VARIETIES ---
  {
    name: 'Sambar Masala (சாம்பார் மசாலா)',
    category: 'Masala Varieties',
    description: 'Authentic Chettinad sambar spice powder hand-roasted for deep aroma.',
    ingredients: 'Coriander Seeds, Red Chillies, Toor Dal, Bengal Gram, Cumin, Pepper, Turmeric.',
    variants: [
      { weight: '100gms', regularPrice: 80, salePrice: 50 },
      { weight: '50gms', regularPrice: 50, salePrice: 30 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Coriander Powder (மல்லித் தூள்)',
    category: 'Masala Varieties',
    description: 'Pure sun-dried coriander seeds stone-ground for intense curry flavor.',
    ingredients: '100% Green Coriander Seeds.',
    variants: [
      { weight: '100gms', regularPrice: 70, salePrice: 40 },
      { weight: '50gms', regularPrice: 40, salePrice: 25 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Turmeric Powder (மஞ்சள் தூள்)',
    category: 'Masala Varieties',
    description: 'Organic Erode turmeric powder high in natural curcumin.',
    ingredients: '100% Natural Turmeric Roots.',
    variants: [
      { weight: '100gms', regularPrice: 70, salePrice: 40 },
      { weight: '50gms', regularPrice: 40, salePrice: 25 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Kuzhambu Masala (குழம்பு மசாலா)',
    category: 'Masala Varieties',
    description: 'All-in-one Tamil curry chilli powder for vegetable and tamarind gravies.',
    ingredients: 'Red Chilli, Coriander, Cumin, Mustard, Fenugreek, Black Pepper, Curry Leaves.',
    variants: [
      { weight: '100gms', regularPrice: 70, salePrice: 40 },
      { weight: '50gms', regularPrice: 40, salePrice: 25 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Chilli Powder (தனிமிளகாய் தூள்)',
    category: 'Masala Varieties',
    description: 'Pure spicy red chilli powder ground from sun-dried red chillies.',
    ingredients: '100% Red Chillies.',
    variants: [
      { weight: '100gms', regularPrice: 70, salePrice: 40 },
      { weight: '50gms', regularPrice: 40, salePrice: 25 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509358211425-d9d39b316492?auto=format&fit=crop&w=800&q=80',
  },

  // --- 6. NON VEG MASALAS ---
  {
    name: 'Garam Masala (கரம் மசாலா)',
    category: 'Non Veg Masalas',
    description: 'Rich whole spice gararn masala blend of cardamom, cloves, cinnamon, and star anise.',
    ingredients: 'Cardamom, Cinnamon, Cloves, Star Anise, Black Pepper, Cumin, Nutmeg.',
    variants: [
      { weight: '100gms', regularPrice: 200, salePrice: 180 },
      { weight: '50gms', regularPrice: 150, salePrice: 100 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Biryani Masala (பிரியாணி மசாலா)',
    category: 'Non Veg Masalas',
    description: 'Royal Dindigul & Ambur style biryani spice mix for aromatic meat & chicken biryanis.',
    ingredients: 'Mace, Star Anise, Cinnamon, Cardamom, Fennel, Cloves, Rose Petals.',
    variants: [
      { weight: '100gms', regularPrice: 200, salePrice: 170 },
      { weight: '50gms', regularPrice: 100, salePrice: 90 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Mutton Masala (மட்டன் மசாலா)',
    category: 'Non Veg Masalas',
    description: 'Spicy Tamil roasted spice powder crafted specifically for thick mutton gravy and chukka.',
    ingredients: 'Red Chillies, Coriander, Black Pepper, Fennel, Cumin, Poppy Seeds, Cloves.',
    variants: [
      { weight: '100gms', regularPrice: 120, salePrice: 85 },
      { weight: '50gms', regularPrice: 70, salePrice: 50 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Chicken Masala (சிக்கன் மசாலா)',
    category: 'Non Veg Masalas',
    description: 'Chettinad style roasted chicken curry powder for flavorful chicken gravy.',
    ingredients: 'Coriander, Red Chilli, Black Pepper, Cumin, Turmeric, Ginger, Garlic Powder.',
    variants: [
      { weight: '100gms', regularPrice: 120, salePrice: 85 },
      { weight: '50gms', regularPrice: 70, salePrice: 50 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Chicken 65 Masala (சிக்கன் 65 மசாலா)',
    category: 'Non Veg Masalas',
    description: 'Crispy spicy fry mix for authentic Hotel Style Chicken 65 and Gobi 65.',
    ingredients: 'Kashmiri Red Chilli, Corn Flour, Garlic, Ginger, Cumin, Pepper, Salt.',
    variants: [
      { weight: '100gms', regularPrice: 150, salePrice: 90 },
      { weight: '50gms', regularPrice: 70, salePrice: 50 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509358211425-d9d39b316492?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Fish Fry Masala (மீன் வறுவல் மசாலா)',
    category: 'Non Veg Masalas',
    description: 'Tangy spicy fish fry coating powder with tamarind, chilli, and roasted fennel.',
    ingredients: 'Red Chilli, Coriander, Fennel, Black Pepper, Rice Flour, Tamarind, Salt.',
    variants: [
      { weight: '100gms', regularPrice: 150, salePrice: 90 },
      { weight: '50gms', regularPrice: 70, salePrice: 50 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1509358211425-d9d39b316492?auto=format&fit=crop&w=800&q=80',
  },

  // --- 7. IDLY PODI / RICE MIX / SOUP MIX ---
  {
    name: 'Idly Podi (இட்லி பொடி)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Classic South Indian gunpowder chutney powder roasted with urad dal, chana dal, and sesame.',
    ingredients: 'Urad Dal, Chana Dal, White Sesame Seeds, Red Chilli, Asafoetida, Salt.',
    variants: [
      { weight: '100gms', regularPrice: 70, salePrice: 50 },
      { weight: '50gms', regularPrice: 50, salePrice: 30 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Ellu Podi (எள்ளு பொடி)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Nutritious roasted black sesame rice powder. Tastes divine with hot steamed rice and ghee.',
    ingredients: 'Black Sesame Seeds, Urad Dal, Red Chilli, Asafoetida, Salt.',
    variants: [{ weight: '50gms', regularPrice: 50, salePrice: 30 }],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Pirandai Podi (பிரண்டை பொடி)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Medicinal Pirandai rice powder for bone health and digestive wellness.',
    ingredients: 'Pirandai, Urad Dal, Pepper, Cumin, Red Chilli, Salt.',
    variants: [{ weight: '50gms', regularPrice: 70, salePrice: 50 }],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Mudavaattuakkaal Podi (முடவாட்டுக்கால் பொடி)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Traditional medicinal herb podi prepared from rare Mudavaattuakkaal goat-foot fern for joint health.',
    ingredients: 'Mudavaattuakkaal Fern Root, Urad Dal, Pepper, Cumin, Garlic, Salt.',
    variants: [
      { weight: '200gms', regularPrice: 300, salePrice: 240 },
      { weight: '100gms', regularPrice: 150, salePrice: 130 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Sundakkaai Podi (சுண்டக்காய் பொடி)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Roasted turkey berry rice podi known for stomach health and natural immunity.',
    ingredients: 'Dried Sundakkai Turkey Berry, Toor Dal, Pepper, Cumin, Asafoetida.',
    variants: [
      { weight: '200gms', regularPrice: 300, salePrice: 240 },
      { weight: '100gms', regularPrice: 150, salePrice: 130 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Murungai Podi (முருங்கை பொடி)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Superfood drumstick moringa leaf rice powder packed with iron and calcium.',
    ingredients: 'Organic Shade-Dried Moringa Leaves, Urad Dal, Pepper, Cumin, Salt.',
    variants: [
      { weight: '200gms', regularPrice: 300, salePrice: 280 },
      { weight: '100gms', regularPrice: 160, salePrice: 150 },
    ],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Andhra Paruppu Podi (ஆந்திரா பருப்பு பொடி)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Spicy Andhra style roasted lentil Kandi Podi for hot rice and ghee.',
    ingredients: 'Toor Dal, Roasted Gram, Kashmiri Chilli, Cumin, Garlic, Salt.',
    variants: [{ weight: '50gms', regularPrice: 50, salePrice: 35 }],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Kids Special Idly Podi (கிட்ஸ் ஸ்பெஷல் இட்லி பொடி)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Mild, non-spicy nutrient-rich idli podi specially crafted for children with nuts and ghee flavor.',
    ingredients: 'Urad Dal, Roasted Gram, Almonds, Cashews, Mild Red Pepper, Salt.',
    variants: [{ weight: '100gms', regularPrice: 100, salePrice: 80 }],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
  {
    name: 'Mudavaattuakkaal Soup Mix (முடவாட்டுக்கால் சூப் மிக்ஸ்)',
    category: 'Idly Podi / Rice Mix / Soup Mix',
    description: 'Nourishing herbal soup powder mix made from Mudavaattuakkaal fern root and aromatic spices.',
    ingredients: 'Mudavaattuakkaal Root, Pepper, Cumin, Coriander, Garlic, Ginger, Salt.',
    variants: [{ weight: '100gms', regularPrice: 250, salePrice: 200 }],
    imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80',
  },
];

async function seedWooCommerceDatabase() {
  console.log('🚀 Starting WooCommerce Product Database Seeding...');

  // 1. Fetch Existing Categories
  console.log('📦 Checking WooCommerce Categories...');
  const catRes = await wcApi.get('products/categories', { per_page: 100 });
  const existingCats: any[] = catRes.data || [];
  const categoryMap = new Map<string, number>();

  existingCats.forEach((c: any) => {
    categoryMap.set(c.name.toLowerCase(), c.id);
  });

  // Create missing categories
  for (const catObj of CATEGORIES_TO_CREATE) {
    if (!categoryMap.has(catObj.name.toLowerCase())) {
      try {
        console.log(`➕ Creating Category: "${catObj.name}"...`);
        const newCat = await wcApi.post('products/categories', {
          name: catObj.name,
          slug: catObj.slug,
        });
        categoryMap.set(catObj.name.toLowerCase(), newCat.data.id);
      } catch (err: any) {
        console.error(`Error creating category ${catObj.name}:`, err?.response?.data || err.message);
      }
    } else {
      console.log(`✅ Category "${catObj.name}" already exists.`);
    }
  }

  // 2. Insert Products
  console.log(`\n🛒 Seeding ${PRODUCTS_DATA.length} products into WooCommerce...`);
  let successCount = 0;

  for (const p of PRODUCTS_DATA) {
    try {
      const categoryId = categoryMap.get(p.category.toLowerCase()) || Array.from(categoryMap.values())[0];

      const primaryVariant = p.variants[0];
      const hasMultipleVariants = p.variants.length > 1;

      const productPayload: any = {
        name: p.name,
        type: 'simple',
        regular_price: primaryVariant.regularPrice.toString(),
        sale_price: primaryVariant.salePrice.toString(),
        description: `<p>${p.description}</p>`,
        short_description: `<p>${p.description}</p>`,
        categories: [{ id: categoryId }],
        attributes: [
          {
            name: 'Weight',
            visible: true,
            variation: false,
            options: p.variants.map((v) => v.weight),
          },
          {
            name: 'Ingredients',
            visible: true,
            variation: false,
            options: [p.ingredients],
          },
        ],
      };

      const res = await wcApi.post('products', productPayload);
      console.log(`✅ [${++successCount}/${PRODUCTS_DATA.length}] Inserted: "${p.name}" (ID: ${res.data.id})`);
    } catch (err: any) {
      console.error(`❌ Failed to insert "${p.name}":`, err?.response?.data || err.message);
    }
  }

  console.log('\n🎉 Woohoo! Seeding Completed Successfully!');
}

seedWooCommerceDatabase().catch(console.error);
