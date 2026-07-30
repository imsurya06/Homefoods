import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { wcApi, isWooCommerceConfigured } from '../config/woocommerce.js';
import { authenticateJwt, AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'homemade_foods_super_secret_jwt_key_2026';

// Helper: Link Guest Orders to Registered Customer
async function linkGuestOrdersToCustomer(customerId: number, email: string, phone?: string) {
  if (!isWooCommerceConfigured()) return;
  try {
    const searchTarget = email || phone;
    if (!searchTarget) return;

    // Fetch guest orders (customer_id = 0)
    const guestOrdersResponse = await wcApi.get('orders', {
      customer: 0,
      search: searchTarget,
      per_page: 50,
    });

    const matchingOrders = guestOrdersResponse.data.filter((order: any) => {
      const orderEmail = order.billing?.email?.toLowerCase();
      const orderPhone = order.billing?.phone;
      return (
        (email && orderEmail === email.toLowerCase()) ||
        (phone && orderPhone && orderPhone.replace(/\D/g, '') === phone.replace(/\D/g, ''))
      );
    });

    // Update matching orders with customer ID
    for (const order of matchingOrders) {
      await wcApi.put(`orders/${order.id}`, {
        customer_id: customerId,
      });
    }
  } catch (err) {
    console.error('Error linking guest orders to customer:', err);
  }
}

// POST /api/v1/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    if (!isWooCommerceConfigured()) {
      // Mock mode registration
      const mockCustomerId = Date.now();
      const token = jwt.sign({ customerId: mockCustomerId, email, phone }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        source: 'mock_mode',
        token,
        customer: { id: mockCustomerId, firstName, lastName, email, phone },
      });
    }

    // 1. Create WooCommerce Customer Account
    const createCustomerRes = await wcApi.post('customers', {
      email,
      first_name: firstName,
      last_name: lastName,
      username: email,
      password,
      billing: {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
      },
    });

    const customer = createCustomerRes.data;

    // 2. Link Guest Orders to this newly created account permanently
    await linkGuestOrdersToCustomer(customer.id, email, phone);

    // 3. Issue JWT Token
    const token = jwt.sign(
      { customerId: customer.id, email: customer.email, phone: customer.billing?.phone },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        phone: customer.billing?.phone || phone,
        billing: customer.billing,
        shipping: customer.shipping,
      },
    });
  } catch (error: any) {
    console.error('Registration Error:', error?.response?.data || error.message);
    const message = error?.response?.data?.message || 'Failed to register customer account';
    return res.status(400).json({ success: false, message });
  }
});

// POST /api/v1/auth/login (Support Email or Phone Number Login)
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or phone

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/Phone and Password required' });
    }

    if (!isWooCommerceConfigured()) {
      const mockCustomerId = 101;
      const token = jwt.sign({ customerId: mockCustomerId, email: identifier }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        success: true,
        source: 'mock_mode',
        token,
        customer: { id: mockCustomerId, email: identifier, firstName: 'Homemade Foods Customer' },
      });
    }

    // Search customer in WooCommerce by email or phone
    const customerSearchRes = await wcApi.get('customers', {
      search: identifier,
    });

    if (!customerSearchRes.data || customerSearchRes.data.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or user not found' });
    }

    const customer = customerSearchRes.data[0];

    // Link any unlinked guest orders placed with this email/phone
    await linkGuestOrdersToCustomer(customer.id, customer.email, customer.billing?.phone);

    const token = jwt.sign(
      { customerId: customer.id, email: customer.email, phone: customer.billing?.phone },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      customer: {
        id: customer.id,
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        phone: customer.billing?.phone,
        billing: customer.billing,
        shipping: customer.shipping,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/auth/profile - Protected endpoint
authRouter.get('/profile', authenticateJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isWooCommerceConfigured()) {
      return res.json({
        success: true,
        customer: { id: req.user?.customerId, email: req.user?.email },
      });
    }

    const response = await wcApi.get(`customers/${req.user?.customerId}`);
    const customer = response.data;

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        firstName: customer.first_name,
        lastName: customer.last_name,
        email: customer.email,
        phone: customer.billing?.phone,
        billing: customer.billing,
        shipping: customer.shipping,
        totalSpent: parseFloat(customer.total_spent || '0'),
        ordersCount: customer.orders_count || 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/v1/auth/orders - Protected endpoint for customer order history
authRouter.get('/orders', authenticateJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isWooCommerceConfigured()) {
      return res.json({ success: true, source: 'mock_mode', orders: [] });
    }

    const response = await wcApi.get('orders', {
      customer: req.user?.customerId,
      per_page: 50,
    });

    const orders = response.data.map((o: any) => ({
      id: o.id,
      orderNumber: o.number,
      status: o.status,
      dateCreated: o.date_created,
      total: parseFloat(o.total),
      paymentMethod: o.payment_method_title,
      items: o.line_items.map((i: any) => ({
        id: i.id,
        productId: i.product_id,
        name: i.name,
        quantity: i.quantity,
        total: parseFloat(i.total),
      })),
      shippingAddress: o.shipping,
    }));

    return res.json({ success: true, orders });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});
