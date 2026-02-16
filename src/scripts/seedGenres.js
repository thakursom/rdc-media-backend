require("dotenv").config();
const mongoose = require("mongoose");
const Genre = require("../models/genreModel");
const SubGenre = require("../models/subGenreModel");
const connectDB = require("../config/db");

// --- Helper: Get Next ID ---
async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 }).limit(1);
    return lastDoc && lastDoc.id ? lastDoc.id + 1 : 1;
}

// --- Data to Seed ---
const genreData = [
    {
        name: "Pop",
        subgenres: ["Pop Rock", "Synth-pop", "Electropop", "Dance-pop", "Indie Pop"]
    },
    {
        name: "Rock",
        subgenres: ["Alternative Rock", "Indie Rock", "Hard Rock", "Punk Rock", "Progressive Rock"]
    },
    {
        name: "Hip Hop",
        subgenres: ["Trap", "Boom Bap", "Gangsta Rap", "Alternative Hip Hop", "Lo-fi Hip Hop"]
    },
    {
        name: "Electronic",
        subgenres: ["House", "Techno", "Trance", "Dubstep", "Drum and Bass", "Ambient"]
    },
    {
        name: "R&B",
        subgenres: ["Contemporary R&B", "Soul", "Neo Soul", "Funk", "Disco"]
    },
    {
        name: "Jazz",
        subgenres: ["Smooth Jazz", "Bebop", "Fusion", "Swing", "Latin Jazz"]
    },
    {
        name: "Classical",
        subgenres: ["Baroque", "Romantic", "Modern Creative", "Opera", "Chamber Music"]
    },
    {
        name: "Country",
        subgenres: ["Contemporary Country", "Bluegrass", "Americana", "Country Pop"]
    },
    {
        name: "Reggae",
        subgenres: ["Roots Reggae", "Dancehall", "Dub", "Ska"]
    },
    {
        name: "Folk",
        subgenres: ["Contemporary Folk", "Folk Rock", "Indie Folk"]
    },
    {
        name: "Metal",
        subgenres: ["Heavy Metal", "Thrash Metal", "Death Metal", "Black Metal", "Metalcore"]
    },
    {
        name: "Latin",
        subgenres: ["Reggaeton", "Salsa", "Bachata", "Cumbia", "Merengue"]
    },
    {
        name: "Blues",
        subgenres: ["Delta Blues", "Chicago Blues", "Blues Rock"]
    },
    {
        name: "World",
        subgenres: ["Afrobeat", "K-Pop", "J-Pop", "Bollywood"]
    }
];

// --- Main Seed Function ---
const seedGenres = async () => {
    try {
        // 1. Connect to DB
        await connectDB();

        console.log("Starting Genre Seeding...");

        for (const gData of genreData) {
            // A. Check or Create Genre
            let genre = await Genre.findOne({ name: gData.name });

            if (!genre) {
                const newId = await getNextId(Genre);
                genre = await Genre.create({
                    id: newId,
                    name: gData.name,
                    status: 1
                });
                console.log(`[CREATED] Genre: ${genre.name} (ID: ${genre.id})`);
            } else {
                console.log(`[EXISTS] Genre: ${genre.name} (ID: ${genre.id})`);
            }

            // B. Check or Create SubGenres
            if (gData.subgenres && gData.subgenres.length > 0) {
                for (const subName of gData.subgenres) {
                    let subGenre = await SubGenre.findOne({ name: subName, genre_id: genre.id });

                    if (!subGenre) {
                        const newSubId = await getNextId(SubGenre);
                        subGenre = await SubGenre.create({
                            id: newSubId,
                            genre_id: genre.id,
                            name: subName,
                            status: 1
                        });
                        console.log(`  -> [CREATED] SubGenre: ${subGenre.name} (ID: ${subGenre.id})`);
                    } else {
                        console.log(`  -> [EXISTS] SubGenre: ${subGenre.name} (ID: ${subGenre.id})`);
                    }
                }
            }
        }

        console.log("-----------------------------------");
        console.log("Seeding Completed Successfully!");
        process.exit(0);

    } catch (error) {
        console.error("Error Seeding Genres:", error);
        process.exit(1);
    }
};

// Run the function
seedGenres();
