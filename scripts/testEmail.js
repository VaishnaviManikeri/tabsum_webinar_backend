const dotenv = require('dotenv');

dotenv.config({
  path: ['.env.local', '.env']
});

const {
  transporter
} = require('../services/emailService');


// ==================================================
// TEST EMAIL
// ==================================================

const sendTestEmail = async () => {

  try {

    console.log(
      'Starting Amazon SES test email...'
    );


    // ==================================================
    // CHECK REQUIRED ENV VARIABLES
    // ==================================================

    if (!process.env.MAIL_USER) {

      throw new Error(
        'MAIL_USER is not configured in .env'
      );

    }

    if (!process.env.MAIL_PASSWORD) {

      throw new Error(
        'MAIL_PASSWORD is not configured in .env'
      );

    }

    if (!process.env.MAIL_FROM) {

      throw new Error(
        'MAIL_FROM is not configured in .env'
      );

    }


    // ==================================================
    // TEST EMAIL
    // ==================================================

    const mailOptions = {

      from:
        process.env.MAIL_FROM,

      // IMPORTANT:
      // For SES sandbox testing,
      // use a verified recipient email.

      to:
        process.env.TEST_EMAIL,

      subject:
        'Amazon SES Test — The Abundance Crossroad™',

      text: `
Hello,

This is a test email from
The Abundance Crossroad™ webinar system.

Amazon SES SMTP integration is working successfully.

Node.js
+
Nodemailer
+
Amazon SES

are connected successfully.

This is only a testing email.

Regards,
The Abundance Crossroad™
      `,

      html: `
        <!DOCTYPE html>

        <html>

        <head>

          <meta charset="UTF-8" />

          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />

          <title>
            Amazon SES Test Email
          </title>

        </head>

        <body
          style="
            margin:0;
            padding:40px 20px;
            background:#f4f7f8;
            font-family:Arial,Helvetica,sans-serif;
          "
        >

          <div
            style="
              max-width:600px;
              margin:auto;
              background:#ffffff;
              padding:35px;
              border-radius:18px;
              box-shadow:
                0 10px 35px
                rgba(0,0,0,0.08);
            "
          >

            <div
              style="
                text-align:center;
                margin-bottom:25px;
              "
            >

              <div
                style="
                  font-size:13px;
                  letter-spacing:2px;
                  color:#00adb5;
                  margin-bottom:10px;
                "
              >
                AMAZON SES TEST
              </div>

              <h1
                style="
                  margin:0;
                  color:#071b1d;
                "
              >
                The Abundance Crossroad™
              </h1>

            </div>


            <h2
              style="
                color:#172022;
              "
            >
              Email Integration Successful 🎉
            </h2>


            <p
              style="
                color:#555;
                line-height:1.7;
              "
            >
              This is a test email from the
              webinar registration system.
            </p>


            <div
              style="
                margin:25px 0;
                padding:20px;
                background:#f5fafb;
                border-radius:12px;
                border:1px solid #dceff1;
              "
            >

              <p>
                <strong>Node.js:</strong>
                Connected
              </p>

              <p>
                <strong>Nodemailer:</strong>
                Connected
              </p>

              <p>
                <strong>Amazon SES:</strong>
                Connected
              </p>

              <p>
                <strong>SMTP:</strong>
                Working
              </p>

            </div>


            <p
              style="
                color:#555;
                line-height:1.7;
              "
            >
              This confirms that our email delivery
              infrastructure is working correctly.
            </p>


            <div
              style="
                margin-top:25px;
                padding:18px;
                background:#071b1d;
                color:#ffffff;
                border-radius:12px;
                text-align:center;
              "
            >

              Amazon SES integration test successful.
              <br />
              The Abundance Crossroad™
              
            </div>

          </div>

        </body>

        </html>
      `
    };


    // ==================================================
    // SEND EMAIL
    // ==================================================

    const info =
      await transporter.sendMail(
        mailOptions
      );


    // ==================================================
    // SUCCESS
    // ==================================================

    console.log('');
    console.log(
      '======================================'
    );

    console.log(
      'EMAIL SENT SUCCESSFULLY ✅'
    );

    console.log(
      '======================================'
    );

    console.log(
      'Message ID:',
      info.messageId
    );

    console.log(
      'Recipient:',
      process.env.TEST_EMAIL
    );

    console.log(
      'Response:',
      info.response
    );

    console.log(
      '======================================'
    );


  } catch (error) {

    console.error('');
    console.error(
      '======================================'
    );

    console.error(
      'EMAIL SENDING FAILED ❌'
    );

    console.error(
      '======================================'
    );

    console.error(
      error
    );

    console.error(
      '======================================'
    );

    process.exitCode = 1;
  }
};


sendTestEmail();