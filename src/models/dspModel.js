const mongoose = require("mongoose");

const DSPSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            unique: true
        },
        status: {
            type: Number,
            default: 1
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("DSP", DSPSchema);
