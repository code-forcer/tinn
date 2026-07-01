const express = require("express");
const Contact = require("../models/Contact");
const { verifyToken, isAdmin } = require("../middleware/checker"); // Make sure you have these

const router = express.Router();

// Middleware: All admin contact routes require authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// GET /api/admin/contacts - Get all contacts with pagination, filtering, and sorting
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = "createdAt",
      order = "desc"
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const query = {};

    // Filter by status
    if (status && status !== "all") {
      query.status = status;
    }

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { message: { $regex: search, $options: "i" } }
      ];
    }

    // Build sort object
    const sortOrder = order === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    const [contacts, total] = await Promise.all([
      Contact.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Contact.countDocuments(query)
    ]);

    // Get status counts
    const statusCounts = await Contact.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = {
      total,
      new: statusCounts.find(s => s._id === "new")?.count || 0,
      read: statusCounts.find(s => s._id === "read")?.count || 0,
      replied: statusCounts.find(s => s._id === "replied")?.count || 0,
      archived: statusCounts.find(s => s._id === "archived")?.count || 0
    };

    res.json({
      ok: true,
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch contacts."
    });
  }
});

// GET /api/admin/contacts/:id - Get single contact
router.get("/:id", async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (!contact) {
      return res.status(404).json({
        ok: false,
        error: "Contact not found."
      });
    }

    // Mark as read if it's new
    if (contact.status === "new") {
      contact.status = "read";
      await contact.save();
    }

    res.json({
      ok: true,
      contact
    });
  } catch (error) {
    console.error("Get contact error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch contact."
    });
  }
});

// PATCH /api/admin/contacts/:id - Update contact status
router.patch("/:id", async (req, res) => {
  try {
    const { status, replied } = req.body;

    const validStatuses = ["new", "read", "replied", "archived"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid status value."
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (typeof replied === "boolean") updateData.replied = replied;

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        ok: false,
        error: "Contact not found."
      });
    }

    res.json({
      ok: true,
      message: "Contact updated successfully.",
      contact
    });
  } catch (error) {
    console.error("Update contact error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to update contact."
    });
  }
});

// DELETE /api/admin/contacts/:id - Delete single contact
router.delete("/:id", async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);

    if (!contact) {
      return res.status(404).json({
        ok: false,
        error: "Contact not found."
      });
    }

    res.json({
      ok: true,
      message: "Contact deleted successfully."
    });
  } catch (error) {
    console.error("Delete contact error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to delete contact."
    });
  }
});

// DELETE /api/admin/contacts - Bulk delete contacts
router.delete("/", async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid contact IDs."
      });
    }

    const result = await Contact.deleteMany({
      _id: { $in: ids }
    });

    res.json({
      ok: true,
      message: `${result.deletedCount} contact(s) deleted successfully.`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to delete contacts."
    });
  }
});

// PATCH /api/admin/contacts/bulk/update - Bulk update status
router.patch("/bulk/update", async (req, res) => {
  try {
    const { ids, status } = req.body;

    const validStatuses = ["new", "read", "replied", "archived"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid status value."
      });
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Invalid contact IDs."
      });
    }

    const result = await Contact.updateMany(
      { _id: { $in: ids } },
      { $set: { status } }
    );

    res.json({
      ok: true,
      message: `${result.modifiedCount} contact(s) updated successfully.`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to update contacts."
    });
  }
});

module.exports = router;