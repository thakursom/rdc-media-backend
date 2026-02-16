const mongoose = require("mongoose");

const LanguageSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        name: {
            type: String, // e.g., "English", "Hindi"
            required: true,
            unique: true
        },
        code: {
            type: String, // e.g., "en", "hi" - optional but good to have
            default: null
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

module.exports = mongoose.model("Language", LanguageSchema);
