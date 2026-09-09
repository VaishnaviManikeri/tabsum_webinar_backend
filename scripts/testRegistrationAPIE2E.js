require('dotenv').config();

const axios = require('axios');
const db = require('../config/db');

const API_BASE_URL =
  process.env.TEST_API_URL || 'http://localhost:5000';

const TEST_EMAIL =
  `registration.api.test.${Date.now()}@example.com`;

const TEST_DATA = {
  firstName: 'API',
  lastName: 'Test User',
  email: TEST_EMAIL,
  phone: '9876543210',
  city: 'Pune',
  role: 'Business Owner',
  goal: 'Learn better decision making',
  consent: true,
  webinarId: 1,
  source: 'E2E API Test'
};

let registrationId = null;
let leadId = null;


// ==================================================
// CLEANUP TEST DATA
// ==================================================

async function cleanupTestData() {
  try {
    if (registrationId) {
      await db.query(
        'DELETE FROM registrations WHERE id = ?',
        [registrationId]
      );
    }

    if (leadId) {
      await db.query(
        'DELETE FROM leads WHERE id = ?',
        [leadId]
      );
    }

    console.log(
      'TEST DATA CLEANUP COMPLETED'
    );

  } catch (error) {
    console.error(
      'Cleanup error:',
      error.message
    );
  }
}


// ==================================================
// MAIN TEST
// ==================================================

async function runTest() {

  console.log('');
  console.log('==========================================');
  console.log('REGISTRATION API E2E TEST STARTED');
  console.log('==========================================');
  console.log('');

  try {

    // ==================================================
    // STEP 1: DATABASE CONNECTION
    // ==================================================

    await db.query(
      'SELECT 1 AS database_test'
    );

    console.log(
      'STEP 1 DATABASE CONNECTION PASSED'
    );


    // ==================================================
    // STEP 2: PUBLIC REGISTRATION API
    // ==================================================

    const response = await axios.post(
      `${API_BASE_URL}/api/registrations`,
      TEST_DATA,
      {
        headers: {
          'Content-Type': 'application/json'
        },

        // Allows us to inspect non-2xx responses
        validateStatus: () => true
      }
    );

    console.log(
      'STEP 2 HTTP STATUS:',
      response.status
    );

    console.log(
      'STEP 2 API RESPONSE:',
      response.data
    );


    // --------------------------------------------------
    // Validate HTTP status
    // --------------------------------------------------

    if (response.status !== 201) {
      throw new Error(
        `Expected HTTP 201 but received ${response.status}`
      );
    }


    // --------------------------------------------------
    // Validate success flag
    // --------------------------------------------------

    if (!response.data?.success) {
      throw new Error(
        'API success flag is not true'
      );
    }


    // --------------------------------------------------
    // Validate response data
    // --------------------------------------------------

    if (!response.data?.data) {
      throw new Error(
        'API response data is missing'
      );
    }


    registrationId =
      response.data.data.registrationId;

    leadId =
      response.data.data.leadId;


    if (!registrationId) {
      throw new Error(
        'registrationId missing from API response'
      );
    }


    if (!leadId) {
      throw new Error(
        'leadId missing from API response'
      );
    }


    console.log(
      'STEP 2 REGISTRATION CREATED:',
      registrationId
    );

    console.log(
      'STEP 2 LEAD CREATED:',
      leadId
    );


    // ==================================================
    // STEP 3: VERIFY REGISTRATION IN DATABASE
    // ==================================================

    const [registrationRows] =
      await db.query(
        `
        SELECT
          id,
          lead_id,
          webinar_id,
          first_name,
          last_name,
          email,
          phone,
          city,
          role,
          goal,
          consent,
          registration_status,
          payment_status
        FROM registrations
        WHERE id = ?
        LIMIT 1
        `,
        [registrationId]
      );


    if (registrationRows.length !== 1) {
      throw new Error(
        'Registration was not found in database'
      );
    }


    const registration =
      registrationRows[0];


    console.log(
      'STEP 3 DATABASE REGISTRATION FOUND'
    );


    // ==================================================
    // STEP 4: VERIFY REGISTRATION DATA MAPPING
    // ==================================================

    if (
      registration.first_name !==
      TEST_DATA.firstName
    ) {
      throw new Error(
        'firstName mapping failed'
      );
    }


    if (
      registration.last_name !==
      TEST_DATA.lastName
    ) {
      throw new Error(
        'lastName mapping failed'
      );
    }


    if (
      registration.email !==
      TEST_DATA.email.toLowerCase()
    ) {
      throw new Error(
        'email mapping failed'
      );
    }


    if (
      registration.phone !==
      TEST_DATA.phone
    ) {
      throw new Error(
        'phone mapping failed'
      );
    }


    if (
      registration.city !==
      TEST_DATA.city
    ) {
      throw new Error(
        'city mapping failed'
      );
    }


    if (
      registration.role !==
      TEST_DATA.role
    ) {
      throw new Error(
        'role mapping failed'
      );
    }


    if (
      registration.goal !==
      TEST_DATA.goal
    ) {
      throw new Error(
        'goal mapping failed'
      );
    }


    if (
      Number(registration.consent) !== 1
    ) {
      throw new Error(
        'consent mapping failed'
      );
    }


    if (
      Number(registration.webinar_id) !==
      Number(TEST_DATA.webinarId)
    ) {
      throw new Error(
        'webinarId mapping failed'
      );
    }


    console.log(
      'STEP 4 API DATA MAPPING PASSED'
    );


    // ==================================================
    // STEP 5: VERIFY INITIAL STATUS
    // ==================================================

    if (
      registration.registration_status !==
      'registered'
    ) {
      throw new Error(
        `Expected registration_status=registered but received ${registration.registration_status}`
      );
    }


    if (
      registration.payment_status !==
      'pending'
    ) {
      throw new Error(
        `Expected payment_status=pending but received ${registration.payment_status}`
      );
    }


    console.log(
      'STEP 5 INITIAL STATUS VALIDATION PASSED'
    );


    // ==================================================
    // STEP 6: VERIFY LEAD CREATION
    // ==================================================

    /*
      IMPORTANT:

      The actual leads table does NOT contain a goal
      column.

      Actual columns include:

      id
      first_name
      last_name
      email
      phone
      city
      role
      source
      lead_status
      created_at
      updated_at
    */

    const [leadRows] =
      await db.query(
        `
        SELECT
          id,
          first_name,
          last_name,
          email,
          phone,
          city,
          role,
          source,
          lead_status
        FROM leads
        WHERE id = ?
        LIMIT 1
        `,
        [leadId]
      );


    if (leadRows.length !== 1) {
      throw new Error(
        'Lead was not found in database'
      );
    }


    const lead =
      leadRows[0];


    // --------------------------------------------------
    // Validate lead ID
    // --------------------------------------------------

    if (
      Number(lead.id) !==
      Number(leadId)
    ) {
      throw new Error(
        'Lead ID mismatch'
      );
    }


    // --------------------------------------------------
    // Validate first name
    // --------------------------------------------------

    if (
      lead.first_name !==
      TEST_DATA.firstName
    ) {
      throw new Error(
        'Lead firstName mismatch'
      );
    }


    // --------------------------------------------------
    // Validate last name
    // --------------------------------------------------

    if (
      lead.last_name !==
      TEST_DATA.lastName
    ) {
      throw new Error(
        'Lead lastName mismatch'
      );
    }


    // --------------------------------------------------
    // Validate email
    // --------------------------------------------------

    if (
      lead.email !==
      TEST_DATA.email.toLowerCase()
    ) {
      throw new Error(
        'Lead email mismatch'
      );
    }


    // --------------------------------------------------
    // Validate phone
    // --------------------------------------------------

    if (
      lead.phone !==
      TEST_DATA.phone
    ) {
      throw new Error(
        'Lead phone mismatch'
      );
    }


    // --------------------------------------------------
    // Validate city
    // --------------------------------------------------

    if (
      lead.city !==
      TEST_DATA.city
    ) {
      throw new Error(
        'Lead city mismatch'
      );
    }


    // --------------------------------------------------
    // Validate role
    // --------------------------------------------------

    if (
      lead.role !==
      TEST_DATA.role
    ) {
      throw new Error(
        'Lead role mismatch'
      );
    }


    // --------------------------------------------------
    // Validate source
    // --------------------------------------------------

    if (
      lead.source !==
      TEST_DATA.source
    ) {
      throw new Error(
        `Lead source mismatch: expected ${TEST_DATA.source}, received ${lead.source}`
      );
    }


    // --------------------------------------------------
    // Validate lead status
    // --------------------------------------------------

    if (
      lead.lead_status !==
      'registered'
    ) {
      throw new Error(
        `Expected lead_status=registered but received ${lead.lead_status}`
      );
    }


    console.log(
      'STEP 6 LEAD CREATION VALIDATION PASSED'
    );


    // ==================================================
    // STEP 7: VERIFY WEBINAR
    // ==================================================

    const [webinarRows] =
      await db.query(
        `
        SELECT
          id,
          title,
          price
        FROM webinars
        WHERE id = ?
        LIMIT 1
        `,
        [TEST_DATA.webinarId]
      );


    if (webinarRows.length !== 1) {
      throw new Error(
        'Webinar was not found'
      );
    }


    const webinar =
      webinarRows[0];


    if (
      Number(webinar.id) !==
      Number(TEST_DATA.webinarId)
    ) {
      throw new Error(
        'Webinar ID mismatch'
      );
    }


    if (
      !webinar.title
    ) {
      throw new Error(
        'Webinar title is missing'
      );
    }


    if (
      Number(webinar.price) !==
      249
    ) {
      throw new Error(
        `Expected webinar price 249 but received ${webinar.price}`
      );
    }


    console.log(
      'STEP 7 WEBINAR VALIDATION PASSED'
    );


    // ==================================================
    // STEP 8: CLEANUP
    // ==================================================

    await cleanupTestData();


    // ==================================================
    // STEP 9: CLEANUP VALIDATION
    // ==================================================

    const [registrationCheck] =
      await db.query(
        `
        SELECT id
        FROM registrations
        WHERE id = ?
        `,
        [registrationId]
      );


    const [leadCheck] =
      await db.query(
        `
        SELECT id
        FROM leads
        WHERE id = ?
        `,
        [leadId]
      );


    if (
      registrationCheck.length !== 0
    ) {
      throw new Error(
        'Registration cleanup failed'
      );
    }


    if (
      leadCheck.length !== 0
    ) {
      throw new Error(
        'Lead cleanup failed'
      );
    }


    console.log(
      'STEP 9 CLEANUP VALIDATION PASSED'
    );


    // ==================================================
    // FINAL SUCCESS
    // ==================================================

    console.log('');
    console.log(
      '=========================================='
    );
    console.log(
      'REGISTRATION API E2E TEST PASSED'
    );
    console.log(
      '=========================================='
    );
    console.log('');

  } catch (error) {

    console.error('');
    console.error(
      'REGISTRATION API E2E TEST FAILED'
    );

    console.error(
      'ERROR:',
      error.message
    );

    console.error('');

    // --------------------------------------------------
    // Cleanup after failure
    // --------------------------------------------------

    await cleanupTestData();

    process.exitCode = 1;
  }
}


// ==================================================
// START TEST
// ==================================================

runTest();