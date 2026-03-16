const mongoose = require("mongoose");

const GenreSchema = new mongoose.Schema(
    {

        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            default: ""
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
