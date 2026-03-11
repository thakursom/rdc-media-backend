const Label = require("../models/labelModel");
const ResponseService = require("../services/responseService");

async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 }).limit(1);
    return lastDoc && lastDoc.id ? lastDoc.id + 1 : 1;
}

class LabelController {
    // Get all labels
    async getLabels(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const totalDocs = await Label.countDocuments();
            const labels = await Label.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

            // Using the current structure in codebase or ResponseService
            return res.status(200).json({
                success: true,
                message: "Labels fetched successfully",
                data: labels,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            });
        } catch (error) {
            console.error("Error fetching labels:", error);
            if (next) return next(error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Create Label
    async createLabel(req, res, next) {
        try {
            const { name, email, country, user_id, status } = req.body;
            if (!name) return res.status(400).json({ success: false, message: "Name is required" });

            const id = await getNextId(Label);
            const newLabel = await Label.create({ id, name, email, country, user_id, status });

            return res.status(201).json({ success: true, message: "Label created successfully", data: newLabel });
        } catch (error) {
            console.error("Error creating label:", error);
            if (next) return next(error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Update Label
    async updateLabel(req, res, next) {
        try {
            const { id } = req.params;
            const { name, email, country, user_id, status } = req.body;

            const updatedLabel = await Label.findOneAndUpdate(
                { id: id },
                { name, email, country, user_id, status },
                { new: true }
            );

            if (!updatedLabel) return res.status(404).json({ success: false, message: "Label not found" });

            return res.status(200).json({ success: true, message: "Label updated successfully", data: updatedLabel });
        } catch (error) {
            console.error("Error updating label:", error);
            if (next) return next(error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Delete Label
    async deleteLabel(req, res, next) {
        try {
            const { id } = req.params;
            const deletedLabel = await Label.findOneAndDelete({ id: id });

            if (!deletedLabel) return res.status(404).json({ success: false, message: "Label not found" });

            return res.status(200).json({ success: true, message: "Label deleted successfully" });
        } catch (error) {
            console.error("Error deleting label:", error);
            if (next) return next(error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }
}

module.exports = new LabelController();
