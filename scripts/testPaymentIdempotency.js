const db = require('../config/db');
const PaymentModel = require('../models/paymentModel');

const TEST_REGISTRATION_ID = 87;

const runTest = async () => {
  let testPaymentId = null;
  const testOrderId = `idempotency_test_${Date.now()}`;

  try {
    console.log('\n========================================');
    console.log('PAYMENT IDEMPOTENCY TEST');
    console.log('========================================\n');

    // ==================================================
    // STEP 1: CREATE TEMPORARY PENDING PAYMENT
    // ==================================================

    console.log('STEP 1: Creating temporary pending payment...');

    testPaymentId = await PaymentModel.createPayment({
      registrationId: TEST_REGISTRATION_ID,
      orderId: testOrderId,
      amount: 1,
      currency: 'INR',
      status: 'pending'
    });

    console.log('Temporary Payment ID:', testPaymentId);
    console.log('Temporary Order ID:', testOrderId);
    console.log('Initial Status: pending');

    // ==================================================
    // STEP 2: FIRST PAYMENT UPDATE
    // ==================================================

    console.log('\nSTEP 2: First payment update...');

    const firstUpdate =
      await PaymentModel.updatePayment({
        orderId: testOrderId,
        paymentId: 'test_payment_first',
        status: 'paid',
        method: 'card'
      });

    console.log(
      'First update affectedRows:',
      firstUpdate.affectedRows
    );

    // ==================================================
    // STEP 3: SECOND PAYMENT UPDATE
    // ==================================================

    console.log('\nSTEP 3: Second payment update...');

    const secondUpdate =
      await PaymentModel.updatePayment({
        orderId: testOrderId,
        paymentId: 'test_payment_second',
        status: 'paid',
        method: 'card'
      });

    console.log(
      'Second update affectedRows:',
      secondUpdate.affectedRows
    );

    // ==================================================
    // STEP 4: CHECK FINAL DATABASE RECORD
    // ==================================================

    console.log('\nSTEP 4: Checking final payment record...');

    const [rows] = await db.query(
      `
      SELECT
        id,
        registration_id,
        order_id,
        amount,
        currency,
        status,
        payment_id,
        method,
        paid_at
      FROM payments
      WHERE id = ?
      LIMIT 1
      `,
      [testPaymentId]
    );

    const payment = rows[0];

    console.log('\nFinal payment record:');
    console.log(payment);

    // ==================================================
    // STEP 5: VALIDATE RESULTS
    // ==================================================

    console.log('\n========================================');
    console.log('VALIDATING IDEMPOTENCY');
    console.log('========================================');

    const firstPassed =
      firstUpdate.affectedRows === 1;

    const secondPassed =
      secondUpdate.affectedRows === 0;

    const statusPassed =
      payment &&
      payment.status === 'paid';

    const paymentIdPassed =
      payment &&
      payment.payment_id === 'test_payment_first';

    if (firstPassed) {
      console.log('PASS: First update changed pending → paid');
    } else {
      console.error(
        'FAIL: First update did not affect exactly 1 row'
      );
    }

    if (secondPassed) {
      console.log(
        'PASS: Second update was blocked'
      );
    } else {
      console.error(
        'FAIL: Second update affected a row'
      );
    }

    if (statusPassed) {
      console.log(
        'PASS: Final payment status is paid'
      );
    } else {
      console.error(
        'FAIL: Final payment status is incorrect'
      );
    }

    if (paymentIdPassed) {
      console.log(
        'PASS: Original payment ID remained unchanged'
      );
    } else {
      console.error(
        'FAIL: Payment ID was overwritten'
      );
    }

    // ==================================================
    // FINAL RESULT
    // ==================================================

    if (
      firstPassed &&
      secondPassed &&
      statusPassed &&
      paymentIdPassed
    ) {
      console.log('\n========================================');
      console.log('PAYMENT IDEMPOTENCY TEST PASSED');
      console.log('========================================\n');
    } else {
      throw new Error(
        'PAYMENT IDEMPOTENCY TEST FAILED'
      );
    }

  } catch (error) {

    console.error('\n========================================');
    console.error('PAYMENT IDEMPOTENCY TEST FAILED');
    console.error('========================================');

    console.error(error);

    process.exitCode = 1;

  } finally {

    // ==================================================
    // CLEANUP TEST RECORD
    // ==================================================

    if (testPaymentId) {

      try {

        await db.query(
          `
          DELETE FROM payments
          WHERE id = ?
          `,
          [testPaymentId]
        );

        console.log(
          '\nTemporary test payment deleted.'
        );

      } catch (cleanupError) {

        console.error(
          'Cleanup error:',
          cleanupError
        );
      }
    }
  }
};

runTest();