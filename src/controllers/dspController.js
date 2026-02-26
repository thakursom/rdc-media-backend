const DSP = require("../models/dspModel");

async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 }).limit(1);
    return lastDoc && lastDoc.id ? lastDoc.id + 1 : 1;
}

class DSPController {
    // Get all release DSPs
    async getReleaseDSPs(req, res) {
        try {
            const dsps = await DSP.find({ status: 1 }).sort({ name: 1 });

            res.status(200).json({
                success: true,
                data: dsps,
            });
        } catch (error) {
            console.error("Error fetching DSPs:", error);
            res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Get all DSPs
    async getDSPs(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const totalDocs = await DSP.countDocuments();
            const dsps = await DSP.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

            res.status(200).json({
                success: true,
                data: dsps,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            });
        } catch (error) {
            console.error("Error fetching DSPs:", error);
            res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Create DSP
    async createDSP(req, res) {
        try {
            const { name, description, status } = req.body;

            if (!name) {
                return res.status(400).json({ success: false, message: "Name is required" });
            }

            const existingDSP = await DSP.findOne({ name });
            if (existingDSP) {
                return res.status(400).json({ success: false, message: "DSP with this name already exists" });
            }

            const id = await getNextId(DSP);
            const newDSP = new DSP({ id, name, description, status: status ?? 1 });
            await newDSP.save();

            res.status(201).json({ success: true, message: "DSP created successfully", data: newDSP });
        } catch (error) {
            console.error("Error creating DSP:", error);
            res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Update DSP
    async updateDSP(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const dsp = await DSP.findOneAndUpdate(
                { id: id },
                { $set: updateData },
                { new: true }
            );

            if (!dsp) {
                return res.status(404).json({ success: false, message: "DSP not found" });
            }

            res.status(200).json({ success: true, message: "DSP updated successfully", data: dsp });
        } catch (error) {
            console.error("Error updating DSP:", error);
            res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Delete DSP
    async deleteDSP(req, res) {
        try {
            const { id } = req.params;

            const dsp = await DSP.findOneAndDelete({ id: id });

            if (!dsp) {
                return res.status(404).json({ success: false, message: "DSP not found" });
            }

            res.status(200).json({ success: true, message: "DSP deleted successfully" });
        } catch (error) {
            console.error("Error deleting DSP:", error);
            res.status(500).json({ success: false, message: "Server Error" });
        }
    }
}

module.exports = new DSPController();
