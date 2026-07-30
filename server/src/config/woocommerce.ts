import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import dotenv from 'dotenv';

dotenv.config();

const storeUrl = process.env.WC_STORE_URL || 'https://admin.homemadefoodsmadurai.com';
const consumerKey = process.env.WC_CONSUMER_KEY || 'ck_mock_key';
const consumerSecret = process.env.WC_CONSUMER_SECRET || 'cs_mock_secret';

// WooCommerce REST API Client instance (Runs strictly server-side)
export const wcApi = new WooCommerceRestApi({
  url: storeUrl,
  consumerKey,
  consumerSecret,
  version: 'wc/v3',
  queryStringAuth: true,
});

export const isWooCommerceConfigured = () => {
  return (
    process.env.WC_CONSUMER_KEY &&
    process.env.WC_CONSUMER_KEY !== 'ck_mock_key' &&
    process.env.WC_CONSUMER_SECRET &&
    process.env.WC_CONSUMER_SECRET !== 'cs_mock_secret'
  );
};
