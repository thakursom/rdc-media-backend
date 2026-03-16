const mongoose = require('mongoose');

const trackEventAssignmentSchema = new mongoose.Schema({

    trackId: {
        type: String,
        required: true,
        index: true
    },
    releaseId: {
        type: String,
        required: true,
        index: true
    },
    eventId: {
        type: String,
        required: true,
        index: true
    },
    assignedDate: {
        type: Date,
        default: Date.now
    }
},
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model('TrackEventAssignment', trackEventAssignmentSchema);
