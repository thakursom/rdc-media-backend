const DSP = require("../models/dspModel");

// Get all DSPs
exports.getDSPs = async (req, res) => {
    try {
        const dsps = await DSP.find({ status: 1 }).select("-_id id name");
        res.status(200).json({ success: true, data: dsps });
    } catch (error) {
        console.error("Error fetching DSPs:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Create DSP (For internal use/seeding)
exports.createDSP = async (req, res) => {
    try {
        const { id, name } = req.body;

        if (!id || !name) {
            return res.status(400).json({ success: false, message: "ID and Name are required" });
        }

        const existingDSP = await DSP.findOne({ $or: [{ id }, { name }] });
        if (existingDSP) {
            return res.status(400).json({ success: false, message: "DSP with this ID or Name already exists" });
        }

        const newDSP = new DSP({ id, name });
        await newDSP.save();

        res.status(201).json({ success: true, message: "DSP created successfully", data: newDSP });
    } catch (error) {
        console.error("Error creating DSP:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
