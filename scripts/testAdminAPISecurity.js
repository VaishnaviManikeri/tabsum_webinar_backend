const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });
dotenv.config();

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

const TEST_ADMIN_EMAIL = 'security-test@example.com';
const TEST_ADMIN_PASSWORD = 'SecurityTest@123';

const protectedEndpoints = [
  '/api/leads',
  '/api/leads/stats',
  '/api/registrations/stats',
  '/api/registrations',
  '/api/reminders/stats',
  '/api/reminders/pending',
  '/api/reminders/upcoming',
  '/api/reminders'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(method, url, config = {}) {
  return axios({
    method,
    url: `${BASE_URL}${url}`,
    validateStatus: () => true,
    ...config
  });
}

async function run() {
  console.log('\n==============================================');
  console.log('ADMIN API SECURITY TEST');
  console.log('==============================================');

  try {
    // --------------------------------------------------
    // STEP 1: Login with test admin credentials
    // --------------------------------------------------
    console.log('\nSTEP 1: Testing admin login...');

    const loginResponse = await request(
      'POST',
      '/api/admin/login',
      {
        data: {
          email: TEST_ADMIN_EMAIL,
          password: TEST_ADMIN_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Login status:', loginResponse.status);

    assert(
      loginResponse.status === 200,
      `Expected login 200 but received ${loginResponse.status}: ${JSON.stringify(loginResponse.data)}`
    );

    assert(
      loginResponse.data &&
      loginResponse.data.success === true,
      'Login response success should be true'
    );

    assert(
      loginResponse.data.token,
      'Login response should contain JWT token'
    );

    const token = loginResponse.data.token;

    console.log('Admin login passed.');
    console.log('JWT token received.');

    // --------------------------------------------------
    // STEP 2: Protected endpoint without token
    // --------------------------------------------------
    console.log('\nSTEP 2: Testing protected endpoints without token...');

    for (const endpoint of protectedEndpoints) {
      const response = await request('GET', endpoint);

      console.log(`${endpoint} -> ${response.status}`);

      assert(
        response.status === 401,
        `${endpoint} should return 401 without token, received ${response.status}`
      );
    }

    console.log('Unauthenticated access protection passed.');

    // --------------------------------------------------
    // STEP 3: Invalid token
    // --------------------------------------------------
    console.log('\nSTEP 3: Testing invalid JWT token...');

    for (const endpoint of protectedEndpoints) {
      const response = await request(
        'GET',
        endpoint,
        {
          headers: {
            Authorization: 'Bearer invalid-token'
          }
        }
      );

      console.log(`${endpoint} -> ${response.status}`);

      assert(
        response.status === 401,
        `${endpoint} should return 401 with invalid token, received ${response.status}`
      );
    }

    console.log('Invalid token protection passed.');

    // --------------------------------------------------
    // STEP 4: Valid token
    // --------------------------------------------------
    console.log('\nSTEP 4: Testing protected endpoints with valid JWT...');

    for (const endpoint of protectedEndpoints) {
      const response = await request(
        'GET',
        endpoint,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      console.log(`${endpoint} -> ${response.status}`);

      assert(
        response.status !== 401,
        `${endpoint} rejected a valid JWT token with 401`
      );
    }

    console.log('Valid JWT authentication passed.');

    // --------------------------------------------------
    // STEP 5: Invalid login password
    // --------------------------------------------------
    console.log('\nSTEP 5: Testing invalid admin password...');

    const invalidPasswordResponse = await request(
      'POST',
      '/api/admin/login',
      {
        data: {
          email: TEST_ADMIN_EMAIL,
          password: 'WrongPassword@999'
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      'Invalid password status:',
      invalidPasswordResponse.status
    );

    assert(
      invalidPasswordResponse.status === 401,
      `Invalid password should return 401, received ${invalidPasswordResponse.status}`
    );

    console.log('Invalid password protection passed.');

    // --------------------------------------------------
    // STEP 6: Invalid email
    // --------------------------------------------------
    console.log('\nSTEP 6: Testing invalid admin email...');

    const invalidEmailResponse = await request(
      'POST',
      '/api/admin/login',
      {
        data: {
          email: 'nonexistent-security-test@example.com',
          password: TEST_ADMIN_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      'Invalid email status:',
      invalidEmailResponse.status
    );

    assert(
      invalidEmailResponse.status === 401,
      `Invalid email should return 401, received ${invalidEmailResponse.status}`
    );

    console.log('Invalid email protection passed.');

    // --------------------------------------------------
    // STEP 7: Missing credentials
    // --------------------------------------------------
    console.log('\nSTEP 7: Testing missing login credentials...');

    const missingCredentialsResponse = await request(
      'POST',
      '/api/admin/login',
      {
        data: {},
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      'Missing credentials status:',
      missingCredentialsResponse.status
    );

    assert(
      missingCredentialsResponse.status === 400,
      `Missing credentials should return 400, received ${missingCredentialsResponse.status}`
    );

    console.log('Missing credentials validation passed.');

    // --------------------------------------------------
    // FINAL
    // --------------------------------------------------
    console.log('\n==============================================');
    console.log('ADMIN API SECURITY TEST PASSED');
    console.log('==============================================');

    process.exit(0);

  } catch (error) {
    console.error('\n==============================================');
    console.error('ADMIN API SECURITY TEST FAILED');
    console.error('==============================================');

    console.error(
      error.response?.data || error.message
    );

    process.exit(1);
  }
}

run();