const mongoose = require("mongoose");

const CountrySchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        countryName: {
            type: String,
            required: true
        },
        countryCode: {
            type: String,
            required: true
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

module.exports = mongoose.model("Country", CountrySchema);
