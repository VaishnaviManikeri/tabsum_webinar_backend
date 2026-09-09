require('dotenv').config();

const PaymentWebhookModel =
  require('../models/paymentWebhookModel');

const db =
  require('../config/db');

const TEST_EVENT_ID =
  `evt_model_test_${Date.now()}`;

const runTest = async () => {

  console.log('');
  console.log('========================================');
  console.log('PAYMENT WEBHOOK MODEL TEST');
  console.log('========================================');

  try {

    // -----------------------------------------------
    // STEP 1: CREATE EVENT
    // -----------------------------------------------

    const webhookId =
      await PaymentWebhookModel.createEvent({
        eventId: TEST_EVENT_ID,
        eventType: 'payment.captured',
        paymentId: 'pay_model_test_123',
        orderId: 'order_model_test_123',
        signatureValid: true
      });

    console.log(
      'STEP 1 CREATE EVENT:',
      webhookId
    );

    if (!webhookId) {
      throw new Error(
        'Webhook event was not created'
      );
    }

    console.log(
      'STEP 1 CREATE EVENT PASSED'
    );


    // -----------------------------------------------
    // STEP 2: GET EVENT
    // -----------------------------------------------

    const event =
      await PaymentWebhookModel.getByEventId(
        TEST_EVENT_ID
      );

    console.log(
      'STEP 2 EVENT FOUND:',
      event
    );

    if (!event) {
      throw new Error(
        'Webhook event was not found'
      );
    }

    if (
      event.event_id !== TEST_EVENT_ID
    ) {
      throw new Error(
        'Event ID mismatch'
      );
    }

    if (
      event.processing_status !== 'received'
    ) {
      throw new Error(
        'Initial status should be received'
      );
    }

    console.log(
      'STEP 2 GET EVENT PASSED'
    );


    // -----------------------------------------------
    // STEP 3: DUPLICATE CHECK
    // -----------------------------------------------

    const duplicate =
      await PaymentWebhookModel.getByEventId(
        TEST_EVENT_ID
      );

    if (!duplicate) {
      throw new Error(
        'Duplicate event could not be detected'
      );
    }

    console.log(
      'STEP 3 DUPLICATE DETECTION PASSED'
    );


    // -----------------------------------------------
    // STEP 4: MARK PROCESSED
    // -----------------------------------------------

    await PaymentWebhookModel.markProcessed(
      TEST_EVENT_ID
    );

    const processedEvent =
      await PaymentWebhookModel.getByEventId(
        TEST_EVENT_ID
      );

    console.log(
      'STEP 4 PROCESSED EVENT:',
      processedEvent.processing_status
    );

    if (
      processedEvent.processing_status !==
      'processed'
    ) {
      throw new Error(
        'Event was not marked as processed'
      );
    }

    console.log(
      'STEP 4 MARK PROCESSED PASSED'
    );


    // -----------------------------------------------
    // STEP 5: STATS
    // -----------------------------------------------

    const stats =
      await PaymentWebhookModel.getStats();

    console.log(
      'STEP 5 WEBHOOK STATS:',
      stats
    );

    if (
      stats.total === undefined ||
      stats.total === null
    ) {
      throw new Error(
        'Webhook stats failed'
      );
    }

    console.log(
      'STEP 5 WEBHOOK STATS PASSED'
    );


    // -----------------------------------------------
    // CLEANUP
    // -----------------------------------------------

    await db.query(
      `
      DELETE FROM payment_webhook_logs
      WHERE event_id = ?
      `,
      [TEST_EVENT_ID]
    );

    console.log(
      'TEST WEBHOOK EVENT CLEANED UP'
    );


    console.log('');
    console.log(
      'PAYMENT WEBHOOK MODEL TEST PASSED'
    );
    console.log('========================================');
    console.log('');

  } catch (error) {

    console.error('');
    console.error(
      'PAYMENT WEBHOOK MODEL TEST FAILED'
    );

    console.error(
      error.message
    );

    console.error(error);

    process.exitCode = 1;

  } finally {

    setTimeout(() => {
      process.exit(
        process.exitCode || 0
      );
    }, 300);

  }

};


runTest();