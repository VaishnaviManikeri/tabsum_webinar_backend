const db = require('../config/db');
const {
  createZoomMeeting,
  getZoomMeeting,
  deleteZoomMeeting
} = require('../services/zoomService');

class WebinarModel {
  // =========================================================
  // GET LATEST WEBINAR
  // =========================================================
  static async getWebinar() {
    const [rows] = await db.query(
      `
      SELECT *
      FROM webinars
      ORDER BY id DESC
      LIMIT 1
      `
    );

    return rows[0];
  }

  // =========================================================
  // GET WEBINAR BY ID
  // =========================================================
  static async getWebinarById(webinarId) {
    const [rows] = await db.query(
      `
      SELECT *
      FROM webinars
      WHERE id = ?
      LIMIT 1
      `,
      [webinarId]
    );

    return rows[0];
  }

  // =========================================================
  // UPDATE / CREATE WEBINAR
  // Existing functionality preserved
  // =========================================================
  static async updateWebinar(data) {
    const {
      title,
      subtitle,
      date,
      time,
      duration,
      language,
      platform,
      price,
      backgroundImage
    } = data;

    // Check if webinar exists
    const existing = await this.getWebinar();

    // =======================================================
    // UPDATE EXISTING WEBINAR
    // =======================================================
    if (existing) {
      const query = `
        UPDATE webinars SET
          title = ?,
          subtitle = ?,
          date = ?,
          time = ?,
          duration = ?,
          language = ?,
          platform = ?,
          price = ?,
          background_image = COALESCE(?, background_image)
        WHERE id = ?
      `;

      const [result] = await db.query(query, [
        title,
        subtitle,
        date,
        time,
        duration,
        language,
        platform,
        price,
        backgroundImage,
        existing.id
      ]);

      return result;
    }

    // =======================================================
    // CREATE NEW WEBINAR
    // =======================================================
    const query = `
      INSERT INTO webinars (
        title,
        subtitle,
        date,
        time,
        duration,
        language,
        platform,
        price,
        background_image
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(query, [
      title,
      subtitle,
      date,
      time,
      duration,
      language,
      platform,
      price,
      backgroundImage
    ]);

    return result;
  }

  // =========================================================
  // CREATE ZOOM MEETING FOR WEBINAR
  // =========================================================
  static async createZoomMeetingForWebinar(webinarId) {
    try {
      // -----------------------------------------------------
      // 1. Get webinar from database
      // -----------------------------------------------------
      const webinar = await this.getWebinarById(webinarId);

      if (!webinar) {
        throw new Error(
          `Webinar with ID ${webinarId} not found.`
        );
      }

      // -----------------------------------------------------
      // 2. Validate webinar date
      // -----------------------------------------------------
      if (!webinar.date) {
        throw new Error(
          'Webinar date is required before creating Zoom meeting.'
        );
      }

      // -----------------------------------------------------
      // 3. Validate webinar time
      // -----------------------------------------------------
      if (!webinar.time) {
        throw new Error(
          'Webinar time is required before creating Zoom meeting.'
        );
      }

      // -----------------------------------------------------
      // 4. Prevent duplicate Zoom meeting
      // -----------------------------------------------------
      if (webinar.zoom_meeting_id) {
        console.log(
          `Zoom meeting already exists for webinar ${webinarId}.`
        );

        return {
          success: true,
          alreadyExists: true,
          webinarId: webinar.id,
          meetingId: webinar.zoom_meeting_id,
          joinUrl: webinar.zoom_join_url,
          startUrl: webinar.zoom_start_url,
          password: webinar.zoom_password,
          zoomCreatedAt: webinar.zoom_created_at
        };
      }

      // -----------------------------------------------------
      // 5. Convert date + time into Zoom start time
      // -----------------------------------------------------
      const webinarDate = String(webinar.date).trim();
      const webinarTime = String(webinar.time).trim();

      let startTime;

      // If time is HH:mm:ss
      if (/^\d{2}:\d{2}:\d{2}$/.test(webinarTime)) {
        startTime = `${webinarDate}T${webinarTime}+05:30`;
      }

      // If time is HH:mm
      else if (/^\d{2}:\d{2}$/.test(webinarTime)) {
        startTime = `${webinarDate}T${webinarTime}:00+05:30`;
      }

      else {
        throw new Error(
          `Invalid webinar time format: ${webinarTime}. Expected HH:mm or HH:mm:ss.`
        );
      }

      // -----------------------------------------------------
      // 6. Convert duration
      // -----------------------------------------------------
      let durationMinutes = 120;

      if (webinar.duration) {
        const durationString = String(webinar.duration);

        // Extract first number from values such as:
        // "120"
        // "120 Minutes"
        // "2 Hours"
        // "2 Hr"
        const durationMatch = durationString.match(
          /(\d+(?:\.\d+)?)/
        );

        if (durationMatch) {
          const durationValue = Number(durationMatch[1]);

          if (durationString.toLowerCase().includes('hour') ||
              durationString.toLowerCase().includes('hr')) {
            durationMinutes = Math.round(
              durationValue * 60
            );
          } else {
            durationMinutes = Math.round(
              durationValue
            );
          }
        }
      }

      // Safety fallback
      if (!durationMinutes || durationMinutes <= 0) {
        durationMinutes = 120;
      }

      // -----------------------------------------------------
      // 7. Create Zoom meeting
      // -----------------------------------------------------
      console.log('');
      console.log('========================================');
      console.log('CREATING ZOOM MEETING FOR WEBINAR');
      console.log('========================================');
      console.log('Webinar ID:', webinar.id);
      console.log('Topic:', webinar.title);
      console.log('Date:', webinarDate);
      console.log('Time:', webinarTime);
      console.log('Start Time:', startTime);
      console.log('Duration:', durationMinutes);
      console.log('========================================');

      const zoomResult = await createZoomMeeting({
        topic: webinar.title || 'The Abundance Crossroad™',
        startTime,
        duration: durationMinutes,
        timezone: 'Asia/Kolkata',
        agenda:
          webinar.subtitle ||
          'The Abundance Crossroad™ Webinar'
      });

      // -----------------------------------------------------
      // 8. Validate Zoom response
      // -----------------------------------------------------
      if (
        !zoomResult ||
        !zoomResult.success ||
        !zoomResult.meetingId ||
        !zoomResult.joinUrl
      ) {
        throw new Error(
          'Zoom meeting creation failed or returned incomplete data.'
        );
      }

      // -----------------------------------------------------
      // 9. Save Zoom details in database
      // -----------------------------------------------------
      const [updateResult] = await db.query(
        `
        UPDATE webinars
        SET
          zoom_meeting_id = ?,
          zoom_join_url = ?,
          zoom_start_url = ?,
          zoom_password = ?,
          zoom_created_at = NOW()
        WHERE id = ?
        `,
        [
          zoomResult.meetingId,
          zoomResult.joinUrl,
          zoomResult.startUrl || null,
          zoomResult.password || null,
          webinar.id
        ]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error(
          'Zoom meeting was created, but webinar database record could not be updated.'
        );
      }

      // -----------------------------------------------------
      // 10. Return complete result
      // -----------------------------------------------------
      const updatedWebinar =
        await this.getWebinarById(webinar.id);

      console.log('');
      console.log('========================================');
      console.log('ZOOM MEETING SAVED SUCCESSFULLY');
      console.log('========================================');
      console.log('Meeting ID:', zoomResult.meetingId);
      console.log('Join URL:', zoomResult.joinUrl);
      console.log('Start URL:', zoomResult.startUrl);
      console.log('Password:', zoomResult.password);
      console.log('========================================');
      console.log('');

      return {
        success: true,
        alreadyExists: false,
        mock: Boolean(zoomResult.mock),
        webinarId: updatedWebinar.id,
        meetingId: updatedWebinar.zoom_meeting_id,
        joinUrl: updatedWebinar.zoom_join_url,
        startUrl: updatedWebinar.zoom_start_url,
        password: updatedWebinar.zoom_password,
        zoomCreatedAt: updatedWebinar.zoom_created_at,
        webinar: updatedWebinar
      };

    } catch (error) {
      console.error(
        'Create Zoom Meeting For Webinar Error:',
        error
      );

      throw error;
    }
  }

  // =========================================================
  // GET ZOOM MEETING DETAILS
  // =========================================================
  static async getZoomMeetingForWebinar(webinarId) {
    try {
      const webinar =
        await this.getWebinarById(webinarId);

      if (!webinar) {
        throw new Error(
          `Webinar with ID ${webinarId} not found.`
        );
      }

      if (!webinar.zoom_meeting_id) {
        return {
          success: false,
          message:
            'No Zoom meeting is associated with this webinar.'
        };
      }

      const zoomResult =
        await getZoomMeeting(
          webinar.zoom_meeting_id
        );

      return {
        success: true,
        webinarId: webinar.id,
        meetingId: webinar.zoom_meeting_id,
        joinUrl: webinar.zoom_join_url,
        startUrl: webinar.zoom_start_url,
        password: webinar.zoom_password,
        zoomCreatedAt: webinar.zoom_created_at,
        zoom: zoomResult
      };

    } catch (error) {
      console.error(
        'Get Zoom Meeting For Webinar Error:',
        error
      );

      throw error;
    }
  }

  // =========================================================
  // DELETE ZOOM MEETING FOR WEBINAR
  // =========================================================
  static async deleteZoomMeetingForWebinar(webinarId) {
    try {
      const webinar =
        await this.getWebinarById(webinarId);

      if (!webinar) {
        throw new Error(
          `Webinar with ID ${webinarId} not found.`
        );
      }

      if (!webinar.zoom_meeting_id) {
        return {
          success: false,
          message:
            'No Zoom meeting exists for this webinar.'
        };
      }

      // -----------------------------------------------------
      // Delete meeting from Zoom
      // -----------------------------------------------------
      const deleteResult =
        await deleteZoomMeeting(
          webinar.zoom_meeting_id
        );

      // -----------------------------------------------------
      // Clear Zoom details from database
      // -----------------------------------------------------
      await db.query(
        `
        UPDATE webinars
        SET
          zoom_meeting_id = NULL,
          zoom_join_url = NULL,
          zoom_start_url = NULL,
          zoom_password = NULL,
          zoom_created_at = NULL
        WHERE id = ?
        `,
        [webinar.id]
      );

      console.log(
        `Zoom meeting deleted for webinar ${webinar.id}.`
      );

      return {
        success: true,
        webinarId: webinar.id,
        meetingId: webinar.zoom_meeting_id,
        zoom: deleteResult
      };

    } catch (error) {
      console.error(
        'Delete Zoom Meeting For Webinar Error:',
        error
      );

      throw error;
    }
  }
}

module.exports = WebinarModel;