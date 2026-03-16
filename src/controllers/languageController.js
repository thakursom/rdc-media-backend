const Language = require("../models/languageModel");



class LanguageController {
    // Get all languages
    async getLanguages(req, res) {
        try {
            const languages = await Language.find({ status: 1 }).sort({ name: 1 });
            return res.status(200).json({ success: true, data: languages });
        } catch (error) {
            console.error("Error fetching languages:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Create Language
    async createLanguage(req, res) {
        try {
            const { name, code } = req.body;
            if (!name) return res.status(400).json({ success: false, message: "Name is required" });

            const newLanguage = await Language.create({ name, code });

            return res.status(201).json({ success: true, message: "Language created", data: newLanguage });
        } catch (error) {
            console.error("Error creating language:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }
}

module.exports = new LanguageController();
