const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// POST /api/auth/login — Owner login (supports multiple owners via OWNERS_JSON)
router.post('/login', (req, res) => {
  try {
    const { username, phoneNumber } = req.body;

    if (!username || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Username and phone number are required.'
      });
    }

    // Build owners list: prefer OWNERS_JSON, fallback to legacy single-owner vars
    let owners = [];
    if (process.env.OWNERS_JSON) {
      try {
        owners = JSON.parse(process.env.OWNERS_JSON);
      } catch (_) {}
    }
    // Always include the legacy single owner if defined
    if (process.env.OWNER_USERNAME && process.env.OWNER_PHONE) {
      const alreadyIncluded = owners.some(
        (o) => o.username === process.env.OWNER_USERNAME
      );
      if (!alreadyIncluded) {
        owners.push({
          username: process.env.OWNER_USERNAME,
          phone: process.env.OWNER_PHONE,
        });
      }
    }

    const match = owners.find(
      (o) => o.username === username && o.phone === phoneNumber
    );

    if (!match) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      { username, role: 'owner' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error during login.'
    });
  }
});

module.exports = router;
