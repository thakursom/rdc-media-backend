require("dotenv").config();
const mongoose = require("mongoose");
const Language = require("../models/languageModel");
const connectDB = require("../config/db");

// --- Helper: Get Next ID ---
async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 }).limit(1);
    return lastDoc && lastDoc.id ? lastDoc.id + 1 : 1;
}

// --- Data to Seed ---
const languageData = [
    { name: "English", code: "en" },
    { name: "Spanish", code: "es" },
    { name: "French", code: "fr" },
    { name: "German", code: "de" },
    { name: "Italian", code: "it" },
    { name: "Portuguese", code: "pt" },
    { name: "Russian", code: "ru" },
    { name: "Chinese (Simplified)", code: "zh-CN" },
    { name: "Japanese", code: "ja" },
    { name: "Korean", code: "ko" },
    { name: "Hindi", code: "hi" },
    { name: "Arabic", code: "ar" },
    { name: "Turkish", code: "tr" },
    { name: "Dutch", code: "nl" },
    { name: "Polish", code: "pl" },
    { name: "Swedish", code: "sv" },
    { name: "Indonesian", code: "id" },
    { name: "Thai", code: "th" },
    { name: "Vietnamese", code: "vi" },
    { name: "Gujarati", code: "gu" },
    { name: "Punjabi", code: "pa" },
    { name: "Bengali", code: "bn" },
    { name: "Tamil", code: "ta" },
    { name: "Telugu", code: "te" },
    { name: "Marathi", code: "mr" },
    { name: "Urdu", code: "ur" }
];

// --- Main Seed Function ---
const seedLanguages = async () => {
    try {
        // 1. Connect to DB
        await connectDB();

        console.log("Starting Language Seeding...");

        for (const lData of languageData) {
            // Check or Create Language
            let language = await Language.findOne({ name: lData.name });

            if (!language) {
                const newId = await getNextId(Language);
                language = await Language.create({
                    id: newId,
                    name: lData.name,
                    code: lData.code,
                    status: 1
                });
                console.log(`[CREATED] Language: ${language.name} (Code: ${language.code || 'N/A'}, ID: ${language.id})`);
            } else {
                console.log(`[EXISTS] Language: ${language.name} (ID: ${language.id})`);
            }
        }

        console.log("-----------------------------------");
        console.log("Seeding Completed Successfully!");
        process.exit(0);

    } catch (error) {
        console.error("Error Seeding Languages:", error);
        process.exit(1);
    }
};

// Run the function
seedLanguages();
