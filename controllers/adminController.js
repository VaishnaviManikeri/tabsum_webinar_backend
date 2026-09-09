const AdminModel = require('../models/adminModel');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

class AdminController {
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required'
        });
      }

      const admin = await AdminModel.findByEmail(email);

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      const isValidPassword = await AdminModel.validatePassword(
        password,
        admin.password
      );

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is not configured');

        return res.status(500).json({
          success: false,
          message: 'Server authentication configuration error'
        });
      }

      const token = jwt.sign(
        {
          id: admin.id,
          email: admin.email
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '7d'
        }
      );

      return res.status(200).json({
        success: true,
        token,
        admin: {
          id: admin.id,
          email: admin.email
        }
      });

    } catch (error) {
      console.error('Login error:', error);

      return res.status(500).json({
        success: false,
        message:
          error.code === 'ER_ACCESS_DENIED_ERROR'
            ? 'Database authentication failed. Check the backend database credentials.'
            : 'Internal server error'
      });
    }
  }
}

module.exports = AdminController;