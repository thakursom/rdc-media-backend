const Genre = require("../models/genreModel");
const SubGenre = require("../models/subGenreModel");

async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 }).limit(1);
    return lastDoc && lastDoc.id ? lastDoc.id + 1 : 1;
}

class GenreController {
    // Get all genres
    async getGenres(req, res) {
        try {
            const genres = await Genre.find({ status: 1 }).sort({ name: 1 });
            return res.status(200).json({ success: true, data: genres });
        } catch (error) {
            console.error("Error fetching genres:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Get subgenres (optionally by genre_id)
    async getSubGenres(req, res) {
        try {
            const { genre_id } = req.query;
            const query = { status: 1 };
            if (genre_id) {
                query.genre_id = genre_id;
            }

            const subGenres = await SubGenre.find(query).sort({ name: 1 });
            return res.status(200).json({ success: true, data: subGenres });
        } catch (error) {
            console.error("Error fetching subgenres:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Create Genre
    async createGenre(req, res) {
        try {
            const { name } = req.body;
            if (!name) return res.status(400).json({ success: false, message: "Name is required" });

            const id = await getNextId(Genre);
            const newGenre = await Genre.create({ id, name });

            return res.status(201).json({ success: true, message: "Genre created", data: newGenre });
        } catch (error) {
            console.error("Error creating genre:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Create SubGenre
    async createSubGenre(req, res) {
        try {
            const { name, genre_id } = req.body;
            if (!name || !genre_id) return res.status(400).json({ success: false, message: "Name and genre_id are required" });

            const id = await getNextId(SubGenre);
            const newSubGenre = await SubGenre.create({ id, name, genre_id });

            return res.status(201).json({ success: true, message: "SubGenre created", data: newSubGenre });
        } catch (error) {
            console.error("Error creating subgenre:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }
}

module.exports = new GenreController();
