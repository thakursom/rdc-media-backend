const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const mongoose = require("mongoose");
const DSP = require("../models/dspModel");
const connectDB = require("../config/db");

const dsps = [
    { id: 1, name: 'Spotify' },
    { id: 2, name: 'Youtube' },
    { id: 3, name: 'Gaana' },
    { id: 4, name: 'Fuga' },
    { id: 5, name: 'PDL' },
    { id: 6, name: 'Facebook_AAP' },
    { id: 7, name: 'TikTok \/ Bytedance' },
    { id: 8, name: 'Snap' },
    { id: 9, name: 'Amazon Music' },
    { id: 10, name: 'JioSaavn' },
    { id: 11, name: 'Youtube_ContentID' },
    { id: 12, name: 'Facebook_SRP' },

];

const seedDSPs = async () => {
    try {
        await connectDB();
        console.log("Connected to MongoDB");

        // Check if DSPs already exist to avoid duplicates
        const count = await DSP.countDocuments();
        if (count > 0) {
            console.log("DSPs already seeded. Skipping...");
            process.exit();
        }

        await DSP.insertMany(dsps);
        console.log("DSPs seeded successfully!");
        process.exit();
    } catch (error) {
        console.error("Error seeding DSPs:", error);
        process.exit(1);
    }
};

seedDSPs();
