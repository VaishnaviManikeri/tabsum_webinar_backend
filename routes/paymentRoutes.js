const express = require('express');

const PaymentController =
  require('../controllers/paymentController');

const {
  handleRazorpayWebhook
} = require('../controllers/paymentWebhookController');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Create Razorpay Order
|--------------------------------------------------------------------------
| Public endpoint
| POST /api/payments/create-order
*/
router.post(
  '/create-order',
  PaymentController.createPaymentOrder
);

/*
|--------------------------------------------------------------------------
| Verify Razorpay Payment
|--------------------------------------------------------------------------
| Public endpoint
| POST /api/payments/verify
*/
router.post(
  '/verify',
  PaymentController.verifyPayment
);

/*
|--------------------------------------------------------------------------
| Razorpay Webhook
|--------------------------------------------------------------------------
| Public endpoint
| POST /api/payments/webhook
|
| IMPORTANT:
| This route must remain public because Razorpay
| calls this endpoint directly.
|--------------------------------------------------------------------------
*/
router.post(
  '/webhook',
  handleRazorpayWebhook
);

module.exports = router;