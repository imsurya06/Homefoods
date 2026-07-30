import { app } from './app.js';

const PORT = process.env.PORT || 5001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.listen(PORT, () => {
  console.log(`🚀 Headless WooCommerce API Proxy Server running on port ${PORT}`);
  console.log(`📡 CORS Origin configured for: ${CLIENT_ORIGIN}`);
});

export default app;
