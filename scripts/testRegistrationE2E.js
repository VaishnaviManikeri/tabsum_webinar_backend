require('dotenv').config();

const db = require('../config/db');

const RegistrationModel =
  require('../models/registrationModel');


// =====================================================
// TEST DATA
// =====================================================

const TEST_EMAIL =
  `registration_e2e_${Date.now()}@example.com`;

const TEST_PHONE = '9999999999';

const TEST_DATA = {
  firstName: 'Registration',
  lastName: 'E2E Test',
  email: TEST_EMAIL,
  phone: TEST_PHONE,
  city: 'Pune',
  role: 'Developer',
  goal: 'Learn and transform',
  consent: true,
  webinarId: 1
};


// =====================================================
// CLEANUP HELPER
// =====================================================

async function cleanupTestData(
  registrationId,
  leadId
) {

  try {

    if (registrationId) {

      await db.query(
        `
        DELETE FROM registrations
        WHERE id = ?
        `,
        [registrationId]
      );

    }


    if (leadId) {

      await db.query(
        `
        DELETE FROM leads
        WHERE id = ?
        `,
        [leadId]
      );

    }

    return true;

  } catch (error) {

    console.error(
      'Cleanup failed:',
      error.message
    );

    return false;

  }
}


// =====================================================
// MAIN TEST
// =====================================================

async function runTest() {

  console.log(
    '========================================'
  );

  console.log(
    'REGISTRATION E2E TEST STARTED'
  );

  console.log(
    '========================================'
  );


  let createdRegistrationId = null;
  let createdLeadId = null;


  try {

    // =================================================
    // STEP 1: DATABASE CONNECTION
    // =================================================

    console.log(
      '\nSTEP 1: DATABASE CONNECTION'
    );

    /*
     * config/db.js exports pool.promise().
     * Therefore db.query() can be directly awaited.
     */

    await db.query(
      'SELECT 1 AS database_test'
    );

    console.log(
      'STEP 1 DATABASE CONNECTION PASSED'
    );


    // =================================================
    // STEP 2: CREATE TEST REGISTRATION
    // =================================================

    console.log(
      '\nSTEP 2: CREATE TEST REGISTRATION'
    );

    const result =
      await RegistrationModel.createRegistration(
        TEST_DATA
      );


    console.log(
      'STEP 2 CREATE RESULT:',
      result
    );


    if (
      !result ||
      !result.registrationId
    ) {

      throw new Error(
        'Registration ID was not returned'
      );

    }


    createdRegistrationId =
      result.registrationId;

    createdLeadId =
      result.leadId;


    console.log(
      'STEP 2 REGISTRATION CREATED:',
      createdRegistrationId
    );

    console.log(
      'STEP 2 LEAD CREATED:',
      createdLeadId
    );


    // =================================================
    // STEP 3: FETCH CREATED REGISTRATION
    // =================================================

    console.log(
      '\nSTEP 3: FETCH CREATED REGISTRATION'
    );


    const registration =
      await RegistrationModel.getRegistrationById(
        createdRegistrationId
      );


    console.log(
      'STEP 3 REGISTRATION:',
      registration
    );


    if (!registration) {

      throw new Error(
        'Created registration could not be fetched'
      );

    }


    if (
      Number(registration.id) !==
      Number(createdRegistrationId)
    ) {

      throw new Error(
        'Registration ID mismatch'
      );

    }


    console.log(
      'STEP 3 REGISTRATION FETCH PASSED'
    );


    // =================================================
    // STEP 4: VALIDATE REGISTRATION DATA
    // =================================================

    console.log(
      '\nSTEP 4: VALIDATE REGISTRATION DATA'
    );


    if (
      registration.email !==
      TEST_EMAIL
    ) {

      throw new Error(
        `Email mismatch. Expected ${TEST_EMAIL}, received ${registration.email}`
      );

    }


    if (
      registration.phone !==
      TEST_PHONE
    ) {

      throw new Error(
        `Phone mismatch. Expected ${TEST_PHONE}, received ${registration.phone}`
      );

    }


    if (
      Number(registration.webinar_id) !==
      Number(TEST_DATA.webinarId)
    ) {

      throw new Error(
        `Webinar mismatch. Expected ${TEST_DATA.webinarId}, received ${registration.webinar_id}`
      );

    }


    if (
      registration.first_name !==
      TEST_DATA.firstName
    ) {

      throw new Error(
        'First name mismatch'
      );

    }


    if (
      registration.last_name !==
      TEST_DATA.lastName
    ) {

      throw new Error(
        'Last name mismatch'
      );

    }


    if (
      registration.city !==
      TEST_DATA.city
    ) {

      throw new Error(
        'City mismatch'
      );

    }


    if (
      registration.role !==
      TEST_DATA.role
    ) {

      throw new Error(
        'Role mismatch'
      );

    }


    if (
      registration.goal !==
      TEST_DATA.goal
    ) {

      throw new Error(
        'Goal mismatch'
      );

    }


    if (
      Number(registration.consent) !==
      1
    ) {

      throw new Error(
        'Consent was not stored correctly'
      );

    }


    console.log(
      'STEP 4 REGISTRATION DATA VALIDATION PASSED'
    );


    // =================================================
    // STEP 5: VALIDATE INITIAL PAYMENT STATUS
    // =================================================

    console.log(
      '\nSTEP 5: VALIDATE INITIAL PAYMENT STATUS'
    );


    if (
      registration.payment_status !==
      'pending'
    ) {

      throw new Error(
        `Expected payment_status=pending, received ${registration.payment_status}`
      );

    }


    if (
      registration.registration_status !==
      'registered'
    ) {

      throw new Error(
        `Expected registration_status=registered, received ${registration.registration_status}`
      );

    }


    console.log(
      'PAYMENT STATUS:',
      registration.payment_status
    );


    console.log(
      'REGISTRATION STATUS:',
      registration.registration_status
    );


    console.log(
      'STEP 5 INITIAL STATUS VALIDATION PASSED'
    );


    // =================================================
    // STEP 6: FETCH REGISTRATION + WEBINAR DETAILS
    // =================================================

    console.log(
      '\nSTEP 6: FETCH REGISTRATION WITH WEBINAR DETAILS'
    );


    const details =
      await RegistrationModel
        .getRegistrationWithPaymentDetails(
          createdRegistrationId
        );


    console.log(
      'STEP 6 DETAILS:',
      details
    );


    if (!details) {

      throw new Error(
        'Registration details could not be fetched'
      );

    }


    if (
      Number(details.id) !==
      Number(createdRegistrationId)
    ) {

      throw new Error(
        'Registration details ID mismatch'
      );

    }


    if (
      details.email !==
      TEST_EMAIL
    ) {

      throw new Error(
        'Registration detail email mismatch'
      );

    }


    if (!details.webinar_title) {

      throw new Error(
        'Webinar title is missing'
      );

    }


    if (!details.webinar_date) {

      throw new Error(
        'Webinar date is missing'
      );

    }


    if (!details.webinar_time) {

      throw new Error(
        'Webinar time is missing'
      );

    }


    if (!details.webinar_duration) {

      throw new Error(
        'Webinar duration is missing'
      );

    }


    if (!details.webinar_platform) {

      throw new Error(
        'Webinar platform is missing'
      );

    }


    if (
      Number(details.price) !==
      249
    ) {

      throw new Error(
        `Expected webinar price 249, received ${details.price}`
      );

    }


    console.log(
      'STEP 6 REGISTRATION + WEBINAR DETAILS PASSED'
    );


    // =================================================
    // STEP 7: FINAL DATABASE VALIDATION
    // =================================================

    console.log(
      '\nSTEP 7: FINAL DATABASE VALIDATION'
    );


    const finalRegistration =
      await RegistrationModel.getRegistrationById(
        createdRegistrationId
      );


    if (!finalRegistration) {

      throw new Error(
        'Final registration record not found'
      );

    }


    if (
      finalRegistration.payment_status !==
      'pending'
    ) {

      throw new Error(
        'Final payment status is not pending'
      );

    }


    if (
      finalRegistration.registration_status !==
      'registered'
    ) {

      throw new Error(
        'Final registration status is not registered'
      );

    }


    console.log(
      'STEP 7 FINAL DATABASE STATE:',
      {
        id:
          finalRegistration.id,

        email:
          finalRegistration.email,

        payment_status:
          finalRegistration.payment_status,

        registration_status:
          finalRegistration.registration_status
      }
    );


    console.log(
      'STEP 7 DATABASE VALIDATION PASSED'
    );


    // =================================================
    // STEP 8: CLEANUP TEST DATA
    // =================================================

    console.log(
      '\nSTEP 8: CLEANUP TEST DATA'
    );


    const cleanupSuccessful =
      await cleanupTestData(
        createdRegistrationId,
        createdLeadId
      );


    if (!cleanupSuccessful) {

      throw new Error(
        'Test data cleanup failed'
      );

    }


    console.log(
      'STEP 8 TEST DATA CLEANED UP'
    );


    // =================================================
    // STEP 9: VERIFY CLEANUP
    // =================================================

    console.log(
      '\nSTEP 9: VERIFY CLEANUP'
    );


    const [remainingRegistrations] =
      await db.query(
        `
        SELECT id
        FROM registrations
        WHERE id = ?
        `,
        [createdRegistrationId]
      );


    if (
      remainingRegistrations.length !==
      0
    ) {

      throw new Error(
        'Registration test data still exists'
      );

    }


    const [remainingLeads] =
      await db.query(
        `
        SELECT id
        FROM leads
        WHERE id = ?
        `,
        [createdLeadId]
      );


    if (
      remainingLeads.length !==
      0
    ) {

      throw new Error(
        'Lead test data still exists'
      );

    }


    console.log(
      'STEP 9 CLEANUP VALIDATION PASSED'
    );


    // =================================================
    // FINAL RESULT
    // =================================================

    console.log(
      '\n========================================'
    );

    console.log(
      'REGISTRATION E2E TEST PASSED'
    );

    console.log(
      '========================================'
    );


  } catch (error) {

    console.error(
      '\n========================================'
    );

    console.error(
      'REGISTRATION E2E TEST FAILED'
    );

    console.error(
      '========================================'
    );


    console.error(
      'ERROR:',
      error.message
    );


    console.error(
      error.stack
    );


    // =================================================
    // FAILURE CLEANUP
    // =================================================

    if (
      createdRegistrationId ||
      createdLeadId
    ) {

      console.log(
        '\nATTEMPTING FAILURE CLEANUP...'
      );


      const cleanupSuccessful =
        await cleanupTestData(
          createdRegistrationId,
          createdLeadId
        );


      if (cleanupSuccessful) {

        console.log(
          'FAILED TEST DATA CLEANED UP'
        );

      } else {

        console.error(
          'FAILED TEST DATA COULD NOT BE CLEANED UP'
        );

      }

    }


    process.exitCode = 1;

  }

}


// =====================================================
// RUN TEST
// =====================================================

runTest();