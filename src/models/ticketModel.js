const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        department: {
            type: String,
            required: true,
            enum: ['Payment', 'Legal', 'Operational', 'Marketing', 'Youtube']
        },
        priority: {
            type: String,
            required: true,
            enum: ['Low', 'Normal', 'High'],
            default: 'Low'
        },
        subject: {
            type: String,
            required: true,
            trim: true
        },
        message: {
            type: String,
            required: true
        },
        closeDate: {
            type: Date,
            default: null
        },
        repliedBy: {
            type: String,
            default: "-"
        },
        activeTicket: {
            type: Boolean,
            default: true
        },
        status: {
            type: String,
            enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
            default: 'Open'
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

const Ticket = mongoose.model("Ticket", ticketSchema);
module.exports = Ticket;
