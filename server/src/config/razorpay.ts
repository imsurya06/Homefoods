import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_mock';
const keySecret = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';

export const razorpayClient = new Razorpay({
  key_id: keyId,
  key_secret: keySecret,
});

export const isRazorpayConfigured = () => {
  return keyId !== 'rzp_test_mock' && keySecret !== 'mock_secret';
};
