const mongoose = require("mongoose");

const SubGenreSchema = new mongoose.Schema(
    {

        genre_id: {
            type: String,
            required: true,
            ref: "Genre"
        },
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
            default: 1
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model("SubGenre", SubGenreSchema);
