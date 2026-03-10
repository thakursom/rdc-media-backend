const mongoose = require("mongoose");

const ReleaseRemarkSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        release_id: {
            type: Number,
            required: true,
            index: true
        },
        action: {
            type: String, // 'Rejected', 'Approved', 'Saved', 'Submitted'
            required: true
        },
        rejection_type: {
            type: String, // from frontend dropdown
            default: null
        },
        remark: {
            type: String, // text reason/comment
            default: null
        },
        attachment_path: {
            type: String,
            default: null
        },
        created_by: {
            type: Number,
            default: null
        }
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        versionKey: false
    }
);

module.exports = mongoose.model("ReleaseRemark", ReleaseRemarkSchema);
