const path = require("path");

class FileController {
    async uploadImage(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: "No file uploaded"
                });
            }

            const filename = req.file.filename;
            const fileUrl = `${process.env.BASE_URL}/public/uploads/${filename}`;

            return res.status(200).json({
                success: true,
                message: "Image uploaded successfully",
                data: {
                    filename: filename,
                    url: fileUrl
                }
            });
        } catch (error) {
            console.error("Upload error:", error);
            return res.status(500).json({
                success: false,
                message: "Server error during upload",
                error: error.message
            });
        }
    }
}

module.exports = new FileController();
