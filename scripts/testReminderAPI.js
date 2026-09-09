require('dotenv').config({
  path: '.env.local'
});

require('dotenv').config();

const http = require('http');


// ======================================================
// CONFIG
// ======================================================

const PORT =
  process.env.PORT || 5000;

const HOST =
  'localhost';


// ======================================================
// HTTP REQUEST HELPER
// ======================================================

const makeRequest = ({
  method = 'GET',
  path,
  token = null
}) => {

  return new Promise(
    (resolve, reject) => {

      const headers = {
        'Content-Type':
          'application/json'
      };


      if (token) {

        headers.Authorization =
          `Bearer ${token}`;
      }


      const options = {
        hostname: HOST,
        port: PORT,
        path,
        method,
        headers
      };


      const request =
        http.request(
          options,
          (response) => {

            let body = '';

            response.on(
              'data',
              (chunk) => {
                body += chunk;
              }
            );


            response.on(
              'end',
              () => {

                let parsedBody =
                  null;

                try {

                  parsedBody =
                    body
                      ? JSON.parse(body)
                      : null;

                } catch {

                  parsedBody = body;
                }


                resolve({
                  statusCode:
                    response.statusCode,

                  headers:
                    response.headers,

                  body:
                    parsedBody
                });

              }
            );

          }
        );


      request.on(
        'error',
        reject
      );


      request.end();
    }
  );
};


// ======================================================
// MAIN TEST
// ======================================================

const runTest = async () => {

  console.log('');
  console.log(
    '===================================================='
  );
  console.log(
    'REMINDER API JWT PROTECTION TEST'
  );
  console.log(
    '===================================================='
  );
  console.log('');


  // ====================================================
  // STEP 1
  // Server check
  // ====================================================

  console.log(
    'STEP 1: CHECKING BACKEND SERVER...'
  );


  let serverCheck;

  try {

    serverCheck =
      await makeRequest({
        method: 'GET',
        path: '/api/health'
      });

  } catch (error) {

    console.error(
      'BACKEND SERVER IS NOT RUNNING.'
    );

    console.error(
      'Start the backend using:'
    );

    console.error(
      'npm run dev'
    );

    console.error('');

    throw error;
  }


  console.log(
    'Health Status:',
    serverCheck.statusCode
  );


  if (
    serverCheck.statusCode !== 200
  ) {

    throw new Error(
      `Backend health check failed with HTTP ${serverCheck.statusCode}`
    );
  }


  console.log(
    'BACKEND SERVER CHECK PASSED'
  );


  // ====================================================
  // STEP 2
  // Request without token
  // ====================================================

  console.log('');
  console.log(
    'STEP 2: TESTING REQUEST WITHOUT JWT...'
  );


  const noTokenResponse =
    await makeRequest({
      method: 'GET',
      path: '/api/reminders'
    });


  console.log(
    'HTTP Status:',
    noTokenResponse.statusCode
  );


  console.log(
    'Response:',
    JSON.stringify(
      noTokenResponse.body,
      null,
      2
    )
  );


  if (
    noTokenResponse.statusCode !== 401
  ) {

    throw new Error(
      `Expected 401 without JWT, received ${noTokenResponse.statusCode}`
    );
  }


  console.log(
    'NO TOKEN → 401 UNAUTHORIZED PASSED'
  );


  // ====================================================
  // STEP 3
  // Invalid token
  // ====================================================

  console.log('');
  console.log(
    'STEP 3: TESTING INVALID JWT...'
  );


  const invalidTokenResponse =
    await makeRequest({
      method: 'GET',
      path: '/api/reminders',
      token:
        'invalid.jwt.token'
    });


  console.log(
    'HTTP Status:',
    invalidTokenResponse.statusCode
  );


  console.log(
    'Response:',
    JSON.stringify(
      invalidTokenResponse.body,
      null,
      2
    )
  );


  if (
    invalidTokenResponse.statusCode !==
    401
  ) {

    throw new Error(
      `Expected 401 for invalid JWT, received ${invalidTokenResponse.statusCode}`
    );
  }


  console.log(
    'INVALID JWT → 401 UNAUTHORIZED PASSED'
  );


  // ====================================================
  // STEP 4
  // IMPORTANT
  // ====================================================
  //
  // For valid JWT testing we need the actual
  // admin login credentials/token.
  //
  // We intentionally do not hard-code credentials
  // inside this test.
  //
  // Set ADMIN_TEST_TOKEN in .env.local.
  //
  // Example:
  //
  // ADMIN_TEST_TOKEN=your_jwt_token
  //
  // ====================================================

  console.log('');
  console.log(
    'STEP 4: CHECKING VALID ADMIN JWT...'
  );


  const adminToken =
    process.env.ADMIN_TEST_TOKEN;


  if (!adminToken) {

    console.log('');
    console.log(
      'VALID ADMIN JWT TEST SKIPPED.'
    );

    console.log(
      'Reason: ADMIN_TEST_TOKEN is not configured.'
    );

    console.log('');

    console.log(
      'Add the JWT generated by your admin login'
    );

    console.log(
      'to .env.local as:'
    );

    console.log('');

    console.log(
      'ADMIN_TEST_TOKEN=YOUR_JWT_TOKEN'
    );

    console.log('');

    console.log(
      'NO TOKEN + INVALID TOKEN TESTS PASSED'
    );

    console.log(
      'REMINDER API JWT BASIC TEST PASSED'
    );

    return;
  }


  // ====================================================
  // STEP 5
  // Valid JWT
  // ====================================================

  console.log(
    'VALID ADMIN TOKEN FOUND'
  );


  const validTokenResponse =
    await makeRequest({
      method: 'GET',
      path:
        '/api/reminders?page=1&limit=10',
      token:
        adminToken
    });


  console.log('');
  console.log(
    'STEP 5: VALID JWT API RESPONSE'
  );


  console.log(
    'HTTP Status:',
    validTokenResponse.statusCode
  );


  console.log(
    'Response:',
    JSON.stringify(
      validTokenResponse.body,
      null,
      2
    )
  );


  if (
    validTokenResponse.statusCode !==
    200
  ) {

    throw new Error(
      `Expected 200 with valid JWT, received ${validTokenResponse.statusCode}`
    );
  }


  if (
    !validTokenResponse.body ||
    validTokenResponse.body.success !==
      true
  ) {

    throw new Error(
      'Reminder API did not return success=true.'
    );
  }


  if (
    !Array.isArray(
      validTokenResponse.body.data
    )
  ) {

    throw new Error(
      'Reminder API data is not an array.'
    );
  }


  console.log(
    'VALID JWT → 200 OK PASSED'
  );


  // ====================================================
  // STEP 6
  // Stats endpoint
  // ====================================================

  console.log('');
  console.log(
    'STEP 6: TESTING STATS ENDPOINT...'
  );


  const statsResponse =
    await makeRequest({
      method: 'GET',
      path:
        '/api/reminders/stats',
      token:
        adminToken
    });


  console.log(
    'HTTP Status:',
    statsResponse.statusCode
  );


  console.log(
    'Stats:',
    JSON.stringify(
      statsResponse.body,
      null,
      2
    )
  );


  if (
    statsResponse.statusCode !==
    200
  ) {

    throw new Error(
      `Stats endpoint failed with HTTP ${statsResponse.statusCode}`
    );
  }


  if (
    !statsResponse.body ||
    statsResponse.body.success !==
      true
  ) {

    throw new Error(
      'Stats endpoint did not return success=true.'
    );
  }


  console.log(
    'STATS ENDPOINT PASSED'
  );


  // ====================================================
  // STEP 7
  // Pending endpoint
  // ====================================================

  console.log('');
  console.log(
    'STEP 7: TESTING PENDING ENDPOINT...'
  );


  const pendingResponse =
    await makeRequest({
      method: 'GET',
      path:
        '/api/reminders/pending?limit=10',
      token:
        adminToken
    });


  console.log(
    'HTTP Status:',
    pendingResponse.statusCode
  );


  if (
    pendingResponse.statusCode !==
    200
  ) {

    throw new Error(
      `Pending endpoint failed with HTTP ${pendingResponse.statusCode}`
    );
  }


  if (
    !pendingResponse.body ||
    pendingResponse.body.success !==
      true
  ) {

    throw new Error(
      'Pending endpoint did not return success=true.'
    );
  }


  console.log(
    'PENDING ENDPOINT PASSED'
  );


  // ====================================================
  // STEP 8
  // Upcoming endpoint
  // ====================================================

  console.log('');
  console.log(
    'STEP 8: TESTING UPCOMING ENDPOINT...'
  );


  const upcomingResponse =
    await makeRequest({
      method: 'GET',
      path:
        '/api/reminders/upcoming?minutes=60&limit=10',
      token:
        adminToken
    });


  console.log(
    'HTTP Status:',
    upcomingResponse.statusCode
  );


  if (
    upcomingResponse.statusCode !==
    200
  ) {

    throw new Error(
      `Upcoming endpoint failed with HTTP ${upcomingResponse.statusCode}`
    );
  }


  if (
    !upcomingResponse.body ||
    upcomingResponse.body.success !==
      true
  ) {

    throw new Error(
      'Upcoming endpoint did not return success=true.'
    );
  }


  console.log(
    'UPCOMING ENDPOINT PASSED'
  );


  // ====================================================
  // FINAL
  // ====================================================

  console.log('');
  console.log(
    '===================================================='
  );

  console.log(
    'REMINDER API JWT PROTECTION TEST PASSED'
  );

  console.log(
    '===================================================='
  );

  console.log('');
};


// ======================================================
// RUN
// ======================================================

runTest()
  .then(() => {

    console.log(
      'TEST SCRIPT FINISHED'
    );

    process.exit(0);

  })
  .catch((error) => {

    console.error('');
    console.error(
      'REMINDER API JWT PROTECTION TEST FAILED'
    );

    console.error(
      error.message
    );

    console.error('');

    process.exit(1);
  });