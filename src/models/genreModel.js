const mongoose = require("mongoose");

const GenreSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        title: {
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

module.exports = mongoose.model("Genre", GenreSchema);
