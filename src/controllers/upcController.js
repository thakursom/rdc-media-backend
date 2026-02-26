const UPC = require("../models/upcModel");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");

async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 }).limit(1);
    return lastDoc && lastDoc.id ? lastDoc.id + 1 : 1;
}

class UPCController {

    // Get all UPCs with Search and Pagination
    async getUPCs(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            // Search query
            const searchQuery = req.query.search || "";
            // Status filter: "All", "Active" (Unused, 0), "Inactive" (Used, 1) // According to req query
            let status = req.query.status;

            const query = {};

            if (searchQuery) {
                query.$or = [
                    { upc: { $regex: searchQuery, $options: "i" } },
                    { ean: { $regex: searchQuery, $options: "i" } }
                ];
            }

            if (status !== undefined && status !== "" && status !== "All") {
                query.status = Number(status);
            }

            const totalDocs = await UPC.countDocuments(query);
            const upcs = await UPC.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

            return res.status(200).json({
                success: true,
                data: upcs,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            });
        } catch (error) {
            console.error("Error fetching UPCs:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Upload UPCs via Excel
    async uploadUPC(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: "Please upload an excel file" });
            }

            // Read the uploaded excel file
            const workbook = xlsx.readFile(req.file.path);
            const sheetName = workbook.SheetNames[0];
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

            let addedCount = 0;
            let duplicateCount = 0;

            const existingUPCs = await UPC.find({}, "upc ean");
            const existingUPCSet = new Set(existingUPCs.map(u => u.upc));
            const existingEANSet = new Set(existingUPCs.map(u => u.ean));

            let currentId = await getNextId(UPC);
            const docsToInsert = [];

            for (const row of data) {
                // Determine property names dynamically (case-insensitive)
                const upcKey = Object.keys(row).find(key => key.toLowerCase() === 'upc');
                const eanKey = Object.keys(row).find(key => key.toLowerCase() === 'ean');

                if (upcKey && eanKey) {
                    const upcVal = String(row[upcKey]).trim();
                    const eanVal = String(row[eanKey]).trim();

                    if (upcVal && eanVal) {
                        // Check if already exist in DB or in our insert queue
                        if (!existingUPCSet.has(upcVal) && !existingEANSet.has(eanVal)) {
                            docsToInsert.push({
                                id: currentId++,
                                upc: upcVal,
                                ean: eanVal,
                                status: 1 // Default enabled
                            });
                            existingUPCSet.add(upcVal);
                            existingEANSet.add(eanVal);
                            addedCount++;
                        } else {
                            duplicateCount++;
                        }
                    }
                }
            }

            if (docsToInsert.length > 0) {
                await UPC.insertMany(docsToInsert);
            }

            // Cleanup the uploaded file
            fs.unlinkSync(req.file.path);

            return res.status(200).json({
                success: true,
                message: `Successfully added ${addedCount} UPCs. Found ${duplicateCount} duplicates.`
            });

        } catch (error) {
            console.error("Error uploading UPCs:", error);
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(500).json({ success: false, message: "Server Error during upload" });
        }
    }

    // Update UPC Status
    async updateUPCStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            const updatedUPC = await UPC.findOneAndUpdate(
                { id: id },
                { status: Number(status) },
                { new: true }
            );

            if (!updatedUPC) return res.status(404).json({ success: false, message: "UPC not found" });

            return res.status(200).json({ success: true, message: "UPC status updated", data: updatedUPC });
        } catch (error) {
            console.error("Error updating UPC status:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Update UPC (Single Entry)
    async updateUPC(req, res) {
        try {
            const { id } = req.params;
            const { upc, ean, status } = req.body;

            // Optional: You could add a check here to ensure the new UPC/EAN isn't already taken by another document
            // For now we just update and let Mongoose unique index throw an error if it's a conflict.

            const updatedUPC = await UPC.findOneAndUpdate(
                { id: id },
                { upc, ean, status: status !== undefined ? Number(status) : undefined },
                { new: true }
            );

            if (!updatedUPC) return res.status(404).json({ success: false, message: "UPC not found" });

            return res.status(200).json({ success: true, message: "UPC updated", data: updatedUPC });
        } catch (error) {
            console.error("Error updating UPC:", error);
            if (error.code === 11000) {
                return res.status(400).json({ success: false, message: "UPC or EAN already exists" });
            }
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Delete UPC
    async deleteUPC(req, res) {
        try {
            const { id } = req.params;
            const deletedUPC = await UPC.findOneAndDelete({ id: id });

            if (!deletedUPC) return res.status(404).json({ success: false, message: "UPC not found" });

            return res.status(200).json({ success: true, message: "UPC deleted" });
        } catch (error) {
            console.error("Error deleting UPC:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Export UPCs to Excel
    async exportUPC(req, res) {
        try {
            const searchQuery = req.query.search || "";
            let status = req.query.status;

            const query = {};

            if (searchQuery) {
                query.$or = [
                    { upc: { $regex: searchQuery, $options: "i" } },
                    { ean: { $regex: searchQuery, $options: "i" } }
                ];
            }

            if (status !== undefined && status !== "" && status !== "All") {
                query.status = Number(status);
            }

            const upcs = await UPC.find(query).sort({ createdAt: -1 });

            if (!upcs || upcs.length === 0) {
                return res.status(404).json({ success: false, message: "No UPCs found to export" });
            }

            // Format data for excel
            const exportData = upcs.map((item, index) => ({
                "No": index + 1,
                "UPC": item.upc,
                "EAN": item.ean,
                "Status": item.status === 1 ? "Enabled" : "Disabled"
            }));

            const worksheet = xlsx.utils.json_to_sheet(exportData);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "UPCs");

            // Write to buffer
            const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=upc-export.xlsx');

            return res.send(buffer);

        } catch (error) {
            console.error("Error exporting UPCs:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }
}

module.exports = new UPCController();
