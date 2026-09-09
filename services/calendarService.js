const { createEvent } = require('ics');

/**
 * Create an .ics calendar event for the webinar.
 *
 * @param {Object} webinar
 * @returns {Promise<Object>}
 */
const createWebinarCalendarEvent = async ({
  title,
  description,
  date,
  time,
  durationMinutes = 120,
  location = 'Zoom'
}) => {
  try {
    if (!title) {
      throw new Error('Webinar title is required.');
    }

    if (!date) {
      throw new Error('Webinar date is required.');
    }

    if (!time) {
      throw new Error('Webinar time is required.');
    }

    /**
     * Expected date format:
     * YYYY-MM-DD
     *
     * Example:
     * 2026-10-15
     */

    const dateParts = date.split('-').map(Number);

    if (dateParts.length !== 3 || dateParts.some(Number.isNaN)) {
      throw new Error(
        'Invalid date format. Expected YYYY-MM-DD.'
      );
    }

    const [year, month, day] = dateParts;

    /**
     * Expected time formats:
     * HH:mm
     * HH:mm:ss
     *
     * Example:
     * 10:30
     */

    const timeParts = time.split(':').map(Number);

    if (
      timeParts.length < 2 ||
      timeParts.length > 3 ||
      timeParts.some(Number.isNaN)
    ) {
      throw new Error(
        'Invalid time format. Expected HH:mm or HH:mm:ss.'
      );
    }

    const hour = timeParts[0];
    const minute = timeParts[1];

    if (
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      throw new Error('Invalid webinar time.');
    }

    /**
     * ICS library uses:
     * [year, month, day, hour, minute]
     */

    const event = {
      start: [
        year,
        month,
        day,
        hour,
        minute
      ],

      duration: {
        hours: Math.floor(durationMinutes / 60),
        minutes: durationMinutes % 60
      },

      title,

      description:
        description ||
        'The Abundance Crossroad™ webinar.',

      location,

      status: 'CONFIRMED',

      busyStatus: 'BUSY',

      alarms: [
        {
          action: 'display',
          description: 'Webinar starts in 24 hours.',
          trigger: {
            hours: 24,
            before: true
          }
        },
        {
          action: 'display',
          description: 'Webinar starts in 30 minutes.',
          trigger: {
            minutes: 30,
            before: true
          }
        }
      ]
    };

    const { error, value } = await new Promise(
      (resolve) => {
        createEvent(event, (error, value) => {
          resolve({
            error,
            value
          });
        });
      }
    );

    if (error) {
      throw error;
    }

    return {
      success: true,
      calendarContent: value,
      filename: 'the-abundance-crossroad.ics'
    };

  } catch (error) {
    console.error(
      'Calendar event creation failed:',
      error.message
    );

    throw error;
  }
};

module.exports = {
  createWebinarCalendarEvent
};