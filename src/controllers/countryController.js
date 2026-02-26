const Country = require("../models/countryModel");

async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 }).limit(1);
    return lastDoc && lastDoc.id ? lastDoc.id + 1 : 1;
}

class CountryController {

    // Get all countries
    async getCountries(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const totalDocs = await Country.countDocuments();
            const countries = await Country.find().sort({ createdAt: -1 }).skip(skip).limit(limit);

            return res.status(200).json({
                success: true,
                data: countries,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            });
        } catch (error) {
            console.error("Error fetching countries:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Create Country
    async createCountry(req, res) {
        try {
            const { countryName, countryCode } = req.body;
            if (!countryName || !countryCode) return res.status(400).json({ success: false, message: "Country Name and Code are required" });

            const id = await getNextId(Country);
            const newCountry = await Country.create({ id, countryName, countryCode });

            return res.status(201).json({ success: true, message: "Country created", data: newCountry });
        } catch (error) {
            console.error("Error creating country:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }


    // Update Country
    async updateCountry(req, res) {
        try {
            const { id } = req.params;
            const { countryName, countryCode, status } = req.body;

            const updatedCountry = await Country.findOneAndUpdate(
                { id: id },
                { countryName, countryCode, status },
                { new: true }
            );

            if (!updatedCountry) return res.status(404).json({ success: false, message: "Country not found" });

            return res.status(200).json({ success: true, message: "Country updated", data: updatedCountry });
        } catch (error) {
            console.error("Error updating country:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }


    // Delete Country
    async deleteCountry(req, res) {
        try {
            const { id } = req.params;
            const deletedCountry = await Country.findOneAndDelete({ id: id });

            if (!deletedCountry) return res.status(404).json({ success: false, message: "Country not found" });

            return res.status(200).json({ success: true, message: "Country deleted" });
        } catch (error) {
            console.error("Error deleting country:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }
}

module.exports = new CountryController();
