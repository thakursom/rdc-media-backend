const mongoose = require("mongoose");

const LabelSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            default: null
        },
        country: {
            type: String,
            default: null
        },
        status: {
            type: Number,
            default: 1 // 1 = Active, 0 = Inactive
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("Label", LabelSchema);
