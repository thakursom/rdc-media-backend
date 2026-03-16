const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({

    third_party_id: {
        type: Number,
        default: null,
    },
    third_party_sub_id: {
        type: Number,
        default: null,
    },
    third_party_username: {
        type: String,
        default: null
    },
    access_token: {
        type: String,
        default: null
    },
    parent_id: {
        type: String,
        default: null
    },
    name: {
        type: String,
    },
    email: {
        type: String,
        unique: true
    },
    phone: {
        type: String,
        default: null
    },
    country_id: {
        type: Number,
        default: null
    },
    email_verified_at: {
        type: Date,
        default: null
    },
    password: {
        type: String,
    },
    remember_token: {
        type: String,
        default: null
    },
    role: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        default: 1010
    },
    total_stream: {
        type: Number,
        default: null
    },
    total_revenue: {
        type: Number,
        default: null
    },
    youtube_total_stream: {
        type: Number,
        default: null
    },
    youtube_total_revenue: {
        type: Number,
        default: null
    },
    resetToken: {
        type: String,
        default: null
    },
    resetTokenExpire: {
        type: Date,
        default: null
    },
    isTwoFactorEnabled: {
        type: Boolean,
        default: false
    },
    twoFactorSecret: {
        type: String,
        default: null
    },
    isApproved: {
        type: Number,
        default: 0 // 0: Pending, 1: Approved
    },
    isLocked: {
        type: Number,
        default: 0 // 1: Active, 0: Locked (Default 0 per requested logic)
    },
    loginAttempts: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("User", UserSchema);
