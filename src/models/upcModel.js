const mongoose = require("mongoose");

const UPCSchema = new mongoose.Schema(
    {

        upc: {
            type: String,
            required: true,
            unique: true
        },
        ean: {
            type: String,
            required: true,
            unique: true
        },
        status: {
            type: Number,
            default: 1 // 1 = Enabled, 0 = Disabled
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("UPC", UPCSchema);
