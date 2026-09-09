const EmailLogModel = require('../models/emailLogModel');
const RegistrationModel = require('../models/registrationModel');
const PaymentModel = require('../models/paymentModel');

const {
  sendRegistrationConfirmation
} = require('./emailService');

const MAX_EMAIL_RETRIES = 3;

const processFailedEmails = async () => {
  try {
    const failedEmails =
      await EmailLogModel.getRetryableEmails(
        MAX_EMAIL_RETRIES,
        20
      );

    if (!failedEmails.length) {
      console.log('📭 No failed emails ready for retry.');
      return {
        success: true,
        processed: 0,
        sent: 0,
        failed: 0
      };
    }

    console.log(
      `🔄 ${failedEmails.length} email(s) ready for retry.`
    );

    let sentCount = 0;
    let failedCount = 0;

    for (const emailLog of failedEmails) {
      try {
        console.log(
          `🔁 Retrying email log #${emailLog.id} → ${emailLog.email}`
        );

        const registration =
          await RegistrationModel
            .getRegistrationWithPaymentDetails(
              emailLog.registration_id
            );

        if (!registration) {
          console.error(
            `Registration ${emailLog.registration_id} not found.`
          );

          await EmailLogModel.markAsFailed(
            emailLog.id,
            'Registration not found for retry.'
          );

          failedCount++;
          continue;
        }

        const payment =
          await PaymentModel
            .getPaymentByRegistrationId(
              emailLog.registration_id
            );

        if (!payment) {
          console.error(
            `Payment not found for registration ${emailLog.registration_id}.`
          );

          await EmailLogModel.markAsFailed(
            emailLog.id,
            'Payment not found for retry.'
          );

          failedCount++;
          continue;
        }

        /*
         * Change failed → pending before attempting send.
         */
        await EmailLogModel.markAsPending(
          emailLog.id
        );

        const result =
          await sendRegistrationConfirmation({
            registration,
            payment
          });

        if (
          result &&
          (
            result.success ||
            result.alreadySent
          )
        ) {
          console.log(
            `✅ Retry successful for email log #${emailLog.id}`
          );

          sentCount++;
        } else {
          throw new Error(
            'Email retry did not return success.'
          );
        }

      } catch (error) {
        console.error(
          `❌ Retry failed for email log #${emailLog.id}:`,
          error.message
        );

        /*
         * Existing retry count from DB.
         * markAsFailed() increments it.
         */
        const newRetryCount =
          Number(emailLog.retry_count || 0) + 1;

        await EmailLogModel.markAsFailed(
          emailLog.id,
          error.message
        );

        /*
         * Schedule next retry only if
         * maximum retry count is not reached.
         */
        if (newRetryCount < MAX_EMAIL_RETRIES) {
          await EmailLogModel.scheduleRetry(
            emailLog.id,
            newRetryCount
          );

          console.log(
            `⏰ Next retry scheduled for email log #${emailLog.id}`
          );
        } else {
          console.error(
            `🛑 Maximum email retries reached for log #${emailLog.id}`
          );
        }

        failedCount++;
      }
    }

    return {
      success: true,
      processed: failedEmails.length,
      sent: sentCount,
      failed: failedCount
    };

  } catch (error) {
    console.error(
      'Email retry worker error:',
      error
    );

    return {
      success: false,
      processed: 0,
      sent: 0,
      failed: 0,
      error: error.message
    };
  }
};

module.exports = {
  processFailedEmails,
  MAX_EMAIL_RETRIES
};