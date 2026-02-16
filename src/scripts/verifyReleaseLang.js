require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Release = require("../models/releaseModel");
const Language = require("../models/languageModel");
const releaseController = require("../controllers/releaseController");

async function verifyRelease() {
    try {
        await connectDB();

        // 1. Get a Language
        const language = await Language.findOne();
        if (!language) {
            console.error("No languages found. Seed languages first.");
            process.exit(1);
        }
        console.log(`Using Language: ${language.name} (Code: ${language.code}, ID: ${language.id})`);

        // 2. Mock Request and Response
        const req = {
            body: {
                title: "Test Release Language",
                language: language.id, // Sending ID, expecting conversion
                releaseType: "single",
                primaryGenre: 1, // Assuming usage of ID 1
                secondaryGenre: 1,
                upcMode: "Manual",
                upc: "123456789012",
                isrcMode: "Manual",
                isrc: "US1234567890"
            },
            user: { id: 1 }
        };

        const res = {
            status: function (code) {
                this.statusCode = code;
                return this;
            },
            json: function (data) {
                console.log("Controller Response:", JSON.stringify(data, null, 2));
                this.data = data;
                return this;
            }
        };

        // 3. Call Controller
        console.log("Calling createRelease...");
        await releaseController.createRelease(req, res);

        // 4. Verify in DB
        if (res.data && res.data.success && res.data.release) {
            const release = await Release.findById(res.data.release._id);
            console.log("---------------------------------------------------");
            console.log("Verifying DB Entry:");
            console.log(`Lang (Expected: ${language.code}):`, release.lang);
            console.log(`Content Lang (Expected: ${language.name}):`, release.content_lang);

            if (release.lang === language.code && release.content_lang === language.name) {
                console.log("SUCCESS: Language stored correctly as Code and Name!");
            } else {
                console.error("FAILURE: Language mismatch.");
            }

            // Cleanup
            await Release.deleteOne({ _id: release._id });
            console.log("Cleanup: Test release deleted.");
        } else {
            console.error("Controller call failed.");
        }

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

verifyRelease();
