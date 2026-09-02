const LeadModel = require('../models/leadModel');

class LeadController {

  // GET /api/leads
  static async getLeads(req, res) {

    try {

      const {
        search = '',
        status = 'all'
      } = req.query;

      const leads = await LeadModel.getAllLeads({
        search,
        status
      });

      res.json({
        success: true,
        count: leads.length,
        leads
      });

    } catch (error) {

      console.error('Get leads error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to fetch leads'
      });

    }
  }


  // GET /api/leads/stats
  static async getStats(req, res) {

    try {

      const stats = await LeadModel.getStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {

      console.error('Get lead stats error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to fetch lead statistics'
      });

    }
  }


  // GET /api/leads/:id
  static async getLead(req, res) {

    try {

      const { id } = req.params;

      const lead = await LeadModel.getLeadById(id);

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      res.json({
        success: true,
        lead
      });

    } catch (error) {

      console.error('Get lead error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to fetch lead'
      });

    }
  }


  // PUT /api/leads/:id/status
  static async updateStatus(req, res) {

    try {

      const { id } = req.params;
      const { lead_status } = req.body;

      if (!lead_status) {
        return res.status(400).json({
          success: false,
          message: 'Lead status is required'
        });
      }

      const lead = await LeadModel.getLeadById(id);

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      await LeadModel.updateLeadStatus(
        id,
        lead_status
      );

      const updatedLead =
        await LeadModel.getLeadById(id);

      res.json({
        success: true,
        message: 'Lead status updated successfully',
        lead: updatedLead
      });

    } catch (error) {

      console.error('Update lead status error:', error);

      if (error.message === 'Invalid lead status') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update lead status'
      });

    }
  }
}

module.exports = LeadController;