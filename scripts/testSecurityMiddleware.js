const assert = require('node:assert/strict');
const express = require('express');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');
const {
  apiLimiter,
  adminLoginLimiter
} = require('../middleware/rateLimiters');

const app = express();
app.disable('x-powered-by');

app.use(helmet({
  crossOriginResourcePolicy: {
    policy: 'cross-origin'
  }
}));
app.use('/api', apiLimiter);
app.use('/api/admin/login', adminLoginLimiter);
app.use(express.json());

app.get('/protected', authMiddleware, (req, res) => {
  res.sendStatus(200);
});

app.post('/api/admin/login', (req, res) => {
  res.sendStatus(401);
});
app.get('/api/health', (req, res) => res.sendStatus(200));
app.get('/api/payments/webhook', (req, res) => res.sendStatus(200));
app.get('/api/limited', (req, res) => res.sendStatus(200));

const server = app.listen(0, '127.0.0.1', async () => {
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const secret = 'a'.repeat(40);
    process.env.JWT_SECRET = secret;

    const acceptedTokenResponse = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: `Bearer ${jwt.sign({ id: 1 }, secret, { algorithm: 'HS256' })}`
      }
    });

    assert.equal(acceptedTokenResponse.status, 200);
    assert.equal(
      acceptedTokenResponse.headers.get('x-content-type-options'),
      'nosniff'
    );
    assert.equal(
      acceptedTokenResponse.headers.get('cross-origin-resource-policy'),
      'cross-origin'
    );
    assert.equal(
      acceptedTokenResponse.headers.get('x-powered-by'),
      null
    );

    const wrongAlgorithmResponse = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: `Bearer ${jwt.sign({ id: 1 }, secret, { algorithm: 'HS384' })}`
      }
    });

    assert.equal(wrongAlgorithmResponse.status, 401);

    process.env.JWT_SECRET = 'weak';

    const weakSecretResponse = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: `Bearer ${jwt.sign({ id: 1 }, 'weak')}`
      }
    });

    assert.equal(weakSecretResponse.status, 503);

    process.env.JWT_SECRET = secret;

    let finalLoginResponse;

    for (let attempt = 0; attempt < 11; attempt++) {
      finalLoginResponse = await fetch(`${baseUrl}/api/admin/login`, {
        method: 'POST'
      });
    }

    assert.equal(finalLoginResponse.status, 429);

    let finalApiResponse;

    for (let attempt = 0; attempt < 290; attempt++) {
      finalApiResponse = await fetch(`${baseUrl}/api/limited`);
    }

    assert.equal(finalApiResponse.status, 429);
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/payments/webhook`)).status, 200);
    console.log('Security middleware tests passed.');
  } catch (error) {
    console.error('Security middleware tests failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});