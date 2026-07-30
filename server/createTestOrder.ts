import { wcApi } from './src/config/woocommerce.js';

async function createTestOrder() {
  console.log('🛒 Creating Live Test Order in WooCommerce...');

  // Fetch product IDs for Garlic Thokku and Nannari Sherbet
  const prodRes = await wcApi.get('products', { per_page: 10 });
  const products = prodRes.data;

  const thokku = products.find((p: any) => p.name.includes('Garlic Thokku')) || products[0];
  const sherbet = products.find((p: any) => p.name.includes('Nannari')) || products[1];

  const testOrderPayload = {
    payment_method: 'cod',
    payment_method_title: 'Cash on Delivery (Test)',
    set_paid: false,
    status: 'processing',
    billing: {
      first_name: 'Surya',
      last_name: 'Kumar (Test Order)',
      address_1: 'No 45, West Masi Street',
      address_2: 'Near Meenakshi Amman Temple',
      city: 'Madurai',
      state: 'TN',
      postcode: '625001',
      country: 'IN',
      email: 'surya2930m@gmail.com',
      phone: '9876543210',
    },
    shipping: {
      first_name: 'Surya',
      last_name: 'Kumar (Test Order)',
      address_1: 'No 45, West Masi Street',
      address_2: 'Near Meenakshi Amman Temple',
      city: 'Madurai',
      state: 'TN',
      postcode: '625001',
      country: 'IN',
    },
    line_items: [
      {
        product_id: thokku.id,
        quantity: 2,
      },
      {
        product_id: sherbet.id,
        quantity: 1,
      },
    ],
    customer_note: 'This is an automated test order to verify order management in WordPress Admin.',
  };

  try {
    const res = await wcApi.post('orders', testOrderPayload);
    const order = res.data;

    console.log('\n🎉 TEST ORDER CREATED SUCCESSFULLY!');
    console.log(`-----------------------------------`);
    console.log(`Order ID        : #${order.id}`);
    console.log(`Status          : ${order.status}`);
    console.log(`Customer        : ${order.billing.first_name} ${order.billing.last_name}`);
    console.log(`Phone           : ${order.billing.phone}`);
    console.log(`City            : ${order.billing.city}`);
    console.log(`Total Amount    : ₹${order.total}`);
    console.log(`Payment Method  : ${order.payment_method_title}`);
    console.log(`Items Purchased : ${order.line_items.map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}`);
    console.log(`-----------------------------------`);
    console.log(`👉 View in WP Admin: https://admin.homemadefoodsmadurai.com/wp-admin/post.php?post=${order.id}&action=edit`);
  } catch (err: any) {
    console.error('❌ Failed to create test order:', err?.response?.data || err.message);
  }
}

createTestOrder().catch(console.error);
