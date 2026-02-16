require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Release = require("../models/releaseModel");
const Language = require("../models/languageModel");
const releaseController = require("../controllers/releaseController");

async function verifyValidation() {
    try {
        await connectDB();

        // 1. Get a Language
        const language = await Language.findOne();
        if (!language) {
            console.error("No languages found. Seed languages first.");
            process.exit(1);
        }

        // --- Mock Response Object ---
        const createRes = () => {
            return {
                statusCode: 0,
                data: null,
                status: function (code) {
                    this.statusCode = code;
                    return this;
                },
                json: function (data) {
                    this.data = data;
                    return this;
                },
                send: function (data) {
                    this.data = data;
                    return this;
                }
            };
        };

        // --- TEST 1: Invalid Data (Missing Title) ---
        console.log("\n--- TEST 1: Invalid Data (Missing Title) ---");
        const invalidReq = {
            body: {
                releaseType: "single",
                // title is missing
                primaryGenre: 1,
                language: language.id,
                releaseDate: new Date().toISOString(),
                upcMode: "Auto",
                isrcMode: "Auto",
                releaseArtists: ["Artist 1"],
                tracks: [{ title: "Track 1", artists: ["Artist 1"], duration: 180 }]
            },
            user: { id: 1 }
        };
        const res1 = createRes();
        await releaseController.createRelease(invalidReq, res1);

        if (res1.statusCode === 400 && res1.data.message === "Validation Error") {
            console.log("SUCCESS: Validation caught missing title.");
            console.log("Errors:", res1.data.errors);
        } else {
            console.error("FAILURE: Validation failed to catch missing title.");
            console.log("Status:", res1.statusCode);
            console.log("Data:", res1.data);
        }

        // --- TEST 2: Valid Data ---
        console.log("\n--- TEST 2: Valid Data ---");
        const validReq = {
            body: {
                title: "Valid Release",
                releaseType: "single",
                primaryGenre: 1,
                language: language.id,
                releaseDate: new Date().toISOString(),
                upcMode: "Auto",
                isrcMode: "Auto",
                releaseArtists: ["Artist 1"],
                tracks: [{ title: "Track 1", artists: ["Artist 1"], duration: 180 }]
            },
            user: { id: 1 }
        };
        const res2 = createRes();
        await releaseController.createRelease(validReq, res2);

        if (res2.statusCode === 201 && res2.data.success) {
            console.log("SUCCESS: Valid data accepted.");
            // Cleanup
            await Release.deleteOne({ _id: res2.data.release._id });
            console.log("Cleanup: Test release deleted.");
        } else {
            console.error("FAILURE: Valid data rejected.");
            console.log("Status:", res2.statusCode);
            console.log("Data:", res2.data);
            if (res2.data.errors) console.log("Errors:", res2.data.errors);
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

verifyValidation();
