const {
  createWebinarCalendarEvent
} = require('./services/calendarService');

const testCalendarService = async () => {
  console.log('\n========================================');
  console.log('CALENDAR SERVICE TEST');
  console.log('========================================');

  try {
    const result = await createWebinarCalendarEvent({
      title: 'The Abundance Crossroad™',

      description:
        'The 2-Day Experience That Will Transform the Way You Make Decisions About Money, Success, Leadership and Life.',

      date: '2026-10-15',

      time: '10:00',

      durationMinutes: 120,

      location: 'Zoom'
    });

    console.log('\nCALENDAR EVENT CREATED ✅');

    console.log('Success:', result.success);

    console.log('Filename:', result.filename);

    console.log('\nICS CONTENT PREVIEW:');
    console.log('----------------------------------------');

    console.log(
      result.calendarContent.substring(0, 1000)
    );

    console.log('----------------------------------------');

    if (
      result.success &&
      result.calendarContent &&
      result.calendarContent.includes('BEGIN:VCALENDAR') &&
      result.calendarContent.includes('END:VCALENDAR')
    ) {
      console.log('\nCALENDAR ICS VALIDATION PASSED ✅');
    } else {
      throw new Error(
        'Generated calendar content is invalid.'
      );
    }

    console.log('\n========================================');
    console.log('CALENDAR SERVICE TEST PASSED ✅');
    console.log('========================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ CALENDAR SERVICE TEST FAILED');

    console.error('Error:', error.message);

    console.log('\n========================================\n');

    process.exit(1);
  }
};

testCalendarService();