const { rateLimit } = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => [
    '/health',
    '/payments/webhook'
  ].includes(req.path),
  message: {
    success: false,
    message: 'Too many requests. Please try again later.'
  }
});

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many failed login attempts. Please try again later.'
  }
});

module.exports = {
  apiLimiter,
  adminLoginLimiter
};