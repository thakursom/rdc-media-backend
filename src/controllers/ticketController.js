const Ticket = require('../models/ticketModel');

exports.createTicket = async (req, res) => {
    try {
        const { name, email, department, priority, subject, message } = req.body;

        const newTicket = new Ticket({
            name,
            email,
            department,
            priority,
            subject,
            message
        });

        await newTicket.save();

        res.status(201).json({
            success: true,
            data: {
                message: "Ticket created successfully",
                ticket: newTicket
            }
        });
    } catch (error) {
        console.error("Create Ticket Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to create ticket.", error: error.message } });
    }
};

exports.getTickets = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || "";

        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { subject: { $regex: search, $options: "i" } }
            ];
        }

        const totalDocs = await Ticket.countDocuments(query);
        const tickets = await Ticket.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            data: {
                tickets,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            }
        });
    } catch (error) {
        console.error("Get Tickets Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to fetch tickets.", error: error.message } });
    }
};

exports.getTicketById = async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await Ticket.findById(id);
        if (!ticket) return res.status(404).json({ success: false, data: { message: "Ticket not found" } });
        res.status(200).json({ success: true, data: ticket });
    } catch (error) {
        console.error("Get Ticket Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to fetch ticket", error: error.message } });
    }
};

exports.updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Ticket.findByIdAndUpdate(id, req.body, { new: true });

        if (!updated) return res.status(404).json({ success: false, data: { message: "Ticket not found" } });
        res.status(200).json({ success: true, data: { message: "Ticket updated successfully", data: updated } });
    } catch (error) {
        console.error("Update Ticket Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to update ticket", error: error.message } });
    }
};

exports.deleteTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Ticket.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ success: false, data: { message: "Ticket not found" } });
        res.status(200).json({ success: true, data: { message: "Ticket deleted successfully" } });
    } catch (error) {
        console.error("Delete Ticket Error:", error);
        res.status(500).json({ success: false, data: { message: "Failed to delete ticket", error: error.message } });
    }
};
