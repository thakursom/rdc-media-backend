const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
    titleArtist: {
        type: String,
        required: true
    },
    shortDescription: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    image_url: {
        type: String
    },
    externalLink: {
        type: String
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    email: {
        type: String
    }
},
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model('Newsletter', newsletterSchema);
