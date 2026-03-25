const Newsletter = require('../models/newsletterModel');

exports.createNewsletter = async (req, res) => {
    try {
        let { titleArtist, shortDescription, image, image_url, externalLink, status, email } = req.body;

        if (req.file) {
            image = req.file.filename;
            image_url = `${process.env.BASE_URL}/public/uploads/${image}`;
        }

        const newNewsletter = new Newsletter({
            titleArtist,
            shortDescription,
            image,
            image_url,
            externalLink,
            status,
            email
        });

        await newNewsletter.save();

        res.status(201).json({
            success: true,
            data: {
                message: "Newsletter created successfully",
                newsletter: newNewsletter
            }
        });
    } catch (error) {
        console.error("Create Newsletter Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to create newsletter.", error: error.message } });
    }
};

exports.getNewsletters = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || "";
        const skip = (page - 1) * limit;

        let query = {};
        if (search) {
            query = {
                $or: [
                    { titleArtist: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const totalDocs = await Newsletter.countDocuments(query);
        const newsletters = await Newsletter.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            data: {
                newsletters,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            }
        });
    } catch (error) {
        console.error("Get Newsletters Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to fetch newsletters.", error: error.message } });
    }
};

exports.deleteNewsletter = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Newsletter.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, data: { message: "Newsletter not found." } });
        }
        res.status(200).json({ success: true, data: { message: "Newsletter deleted successfully." } });
    } catch (error) {
        console.error("Delete Newsletter Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to delete newsletter.", error: error.message } });
    }
};

exports.getNewsletterById = async (req, res) => {
    try {
        const { id } = req.params;
        const newsletter = await Newsletter.findById(id);
        if (!newsletter) return res.status(404).json({ success: false, data: { message: "Newsletter not found" } });
        res.status(200).json({ success: true, data: newsletter });
    } catch (error) {
        console.error("Get Newsletter Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to fetch newsletter", error: error.message } });
    }
};

exports.updateNewsletter = async (req, res) => {
    try {
        const { id } = req.params;
        let { titleArtist, shortDescription, image, image_url, externalLink, status, email } = req.body;

        if (req.file) {
            image = req.file.filename;
            image_url = `${process.env.BASE_URL}/public/uploads/${image}`;
        }
        const updated = await Newsletter.findByIdAndUpdate(id, {
            titleArtist, shortDescription, image, image_url, externalLink, status, email
        }, { new: true });

        if (!updated) return res.status(404).json({ success: false, data: { message: "Newsletter not found" } });
        res.status(200).json({ success: true, data: { message: "Newsletter updated successfully", data: updated } });
    } catch (error) {
        console.error("Update Newsletter Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to update newsletter", error: error.message } });
    }
};
