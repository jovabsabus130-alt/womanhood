const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const { sendReadyToCollectMessage } = require('../utils/whatsapp');

// All order routes are protected
router.use(authMiddleware);

// Helper: upload buffer to Cloudinary
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'womanhood', resource_type: 'image' },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// Helper: delete image from Cloudinary
const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl) return;
  try {
    // Extract public_id from URL
    const parts = imageUrl.split('/');
    const folderIndex = parts.indexOf('womanhood');
    if (folderIndex !== -1) {
      const publicIdWithExtension = parts.slice(folderIndex).join('/');
      const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
      const publicId = lastDotIndex !== -1 ? publicIdWithExtension.substring(0, lastDotIndex) : publicIdWithExtension;
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
};

// POST /api/orders — Create order
router.post('/', upload.single('clothPhoto'), async (req, res) => {
  try {
    const { serialNumber, customerName, phoneNumber, deliveryDueDate, notes } = req.body;

    // Check duplicate serial number
    const existing = await Order.findOne({ serialNumber });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An order with this serial number already exists.'
      });
    }

    let clothPhotoUrl = '';

    // Upload image to Cloudinary if provided
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer);
      clothPhotoUrl = result.secure_url;
    }

    const order = await Order.create({
      serialNumber,
      customerName,
      phoneNumber,
      clothPhoto: clothPhotoUrl,
      deliveryDueDate,
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create order'
    });
  }
});

// GET /api/orders/search?q= — Search orders
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      const orders = await Order.find().sort({ createdAt: -1 }).limit(50);
      return res.json({ success: true, orders });
    }

    const searchRegex = new RegExp(q.trim(), 'i');
    const orders = await Order.find({
      $or: [
        { customerName: searchRegex },
        { phoneNumber: searchRegex },
        { serialNumber: searchRegex }
      ]
    }).sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
});

// GET /api/orders/by-date?date=YYYY-MM-DD — Orders due on a specific date (pending only)
// Queries a broad ±1 day UTC range then filters by local date string to handle any timezone
router.get('/by-date', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, message: 'date query param required' });
    }
    // Broad UTC range: cover the full calendar day in any timezone (max ±14h offset)
    const [y, mo, d] = date.split('-').map(Number);
    const start = new Date(Date.UTC(y, mo - 1, d - 1, 10, 0, 0, 0)); // prev day 10:00 UTC
    const end   = new Date(Date.UTC(y, mo - 1, d + 1, 14, 0, 0, 0)); // next day 14:00 UTC

    const allOrders = await Order.find({
      deliveryDueDate: { $gte: start, $lte: end },
      status: { $ne: 'collected' },
    }).sort({ createdAt: -1 });

    // Filter to only orders whose LOCAL date string matches requested date
    const orders = allOrders.filter(order => {
      const local = new Date(order.deliveryDueDate);
      const localKey = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
      return localKey === date;
    });

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders by date' });
  }
});

// GET /api/orders/month-orders?year=YYYY&month=MM — Full pending orders grouped by local date
router.get('/month-orders', async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ success: false, message: 'year and month required' });
    }
    const y = parseInt(year, 10);
    const m = parseInt(month, 10) - 1;
    // Broad range to cover all timezones
    const start = new Date(Date.UTC(y, m, 0, 10, 0, 0, 0));       // last day of prev month 10:00 UTC
    const end   = new Date(Date.UTC(y, m + 1, 2, 14, 0, 0, 0));   // 2nd day of next month 14:00 UTC

    const allOrders = await Order.find({
      deliveryDueDate: { $gte: start, $lte: end },
      status: { $ne: 'collected' },
    }).select('customerName serialNumber deliveryDueDate status').sort({ deliveryDueDate: 1 });

    // Group by LOCAL date key
    const grouped = {};
    for (const order of allOrders) {
      const local = new Date(order.deliveryDueDate);
      const localMonth = local.getMonth() + 1;
      // Only include orders that actually fall in the requested month locally
      if (local.getFullYear() !== y || localMonth !== parseInt(month, 10)) continue;
      const key = `${local.getFullYear()}-${String(localMonth).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push({
        _id: order._id,
        customerName: order.customerName,
        serialNumber: order.serialNumber,
        status: order.status,
      });
    }

    res.json({ success: true, orders: grouped });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch month orders' });
  }
});

// GET /api/orders/:id — Single order detail
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order'
    });
  }
});

// PATCH /api/orders/:id — Edit order fields
router.patch('/:id', upload.single('clothPhoto'), async (req, res) => {
  try {
    const updates = { ...req.body };

    // Upload new image if provided
    if (req.file) {
      // Find old image to delete
      const existingOrder = await Order.findById(req.params.id);
      if (existingOrder && existingOrder.clothPhoto) {
        await deleteFromCloudinary(existingOrder.clothPhoto);
      }

      const result = await uploadToCloudinary(req.file.buffer);
      updates.clothPhoto = result.secure_url;
    }

    // Don't allow status update through this route
    delete updates.status;

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update order'
    });
  }
});

// PATCH /api/orders/:id/status — Update status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['material_collected', 'cutting', 'stitching_in_progress', 'ready_to_collect', 'collected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const updateData = { status };
    const existingOrder = await Order.findById(req.params.id);

    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Set collectedAt when status changes to 'collected'
    if (status === 'collected') {
      updateData.collectedAt = new Date();
    } else {
      updateData.collectedAt = null;
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    let whatsappNotification = null;

    if (existingOrder.status !== 'ready_to_collect' && status === 'ready_to_collect') {
      try {
        whatsappNotification = await sendReadyToCollectMessage(order);
      } catch (error) {
        console.error('Ready-to-collect WhatsApp message failed:', error.details || error.message);
        whatsappNotification = {
          sent: false,
          reason: 'whatsapp_send_failed'
        };
      }
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      order,
      whatsappNotification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
});

// DELETE /api/orders/:id — Delete order
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.clothPhoto) {
      await deleteFromCloudinary(order.clothPhoto);
    }

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete order'
    });
  }
});

module.exports = router;
