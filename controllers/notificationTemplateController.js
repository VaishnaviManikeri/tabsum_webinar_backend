const NotificationTemplateModel = require('../models/notificationTemplateModel');

const validChannels = ['email', 'whatsapp'];
const validMessageTypes = ['confirmation', 'reminder_24h', 'reminder_3h', 'reminder_30m'];

const validateTemplate = (body, requireIdentity = true) => {
  if (requireIdentity && (!validChannels.includes(body.channel) || !validMessageTypes.includes(body.message_type))) {
    return 'A valid channel and message type are required.';
  }
  if (body.channel === 'whatsapp' && !body.template_name) return 'A WhatsApp approved template name is required.';
  if (body.channel === 'email' && !body.subject) return 'An email subject is required.';
  if (!body.body) return 'Message content is required.';
  return null;
};

class NotificationTemplateController {
  static async getAll(req, res) {
    try {
      res.json({ success: true, data: await NotificationTemplateModel.getAll() });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Could not load notification templates' });
    }
  }

  static async create(req, res) {
    const validationError = validateTemplate(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    try {
      const data = await NotificationTemplateModel.create(req.body);
      res.status(201).json({ success: true, message: 'Notification template created', data });
    } catch (error) {
      console.error(error);
      const duplicate = error.code === 'ER_DUP_ENTRY';
      res.status(duplicate ? 409 : 500).json({ success: false, message: duplicate ? 'A template already exists for this channel and message type' : 'Could not create notification template' });
    }
  }

  static async update(req, res) {
    const validationError = validateTemplate(req.body, false);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    try {
      const data = await NotificationTemplateModel.update(req.params.id, req.body);
      if (!data) return res.status(404).json({ success: false, message: 'Notification template not found' });
      res.json({ success: true, message: 'Notification template updated', data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Could not update notification template' });
    }
  }

  static async remove(req, res) {
    try {
      const removed = await NotificationTemplateModel.deactivate(req.params.id);
      if (!removed) return res.status(404).json({ success: false, message: 'Notification template not found' });
      res.json({ success: true, message: 'Notification template deactivated' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Could not deactivate notification template' });
    }
  }
}

module.exports = NotificationTemplateController;