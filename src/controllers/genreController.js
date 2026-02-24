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
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const totalDocs = await Genre.countDocuments();
            const genres = await Genre.find().sort({ title: 1 }).skip(skip).limit(limit);

            return res.status(200).json({
                success: true,
                data: genres,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            });
        } catch (error) {
            console.error("Error fetching genres:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Get subgenres (optionally by genre_id)
    async getSubGenres(req, res) {
        try {
            const { genre_id } = req.query;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const query = {};
            if (genre_id) {
                query.genre_id = Number(genre_id);
            }

            const totalDocs = await SubGenre.countDocuments(query);
            const subGenres = await SubGenre.find(query).sort({ title: 1 }).skip(skip).limit(limit);

            return res.status(200).json({
                success: true,
                data: subGenres,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            });
        } catch (error) {
            console.error("Error fetching subgenres:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Create Genre
    async createGenre(req, res) {
        try {
            const { title, description } = req.body;
            if (!title) return res.status(400).json({ success: false, message: "Title is required" });

            const id = await getNextId(Genre);
            const newGenre = await Genre.create({ id, title, description });

            return res.status(201).json({ success: true, message: "Genre created", data: newGenre });
        } catch (error) {
            console.error("Error creating genre:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Create SubGenre
    async createSubGenre(req, res) {
        try {
            const { title, genre_id, description } = req.body;
            if (!title || !genre_id) return res.status(400).json({ success: false, message: "Title and genre_id are required" });

            const id = await getNextId(SubGenre);
            const newSubGenre = await SubGenre.create({
                id,
                title,
                genre_id: Number(genre_id),
                description
            });

            return res.status(201).json({ success: true, message: "SubGenre created", data: newSubGenre });
        } catch (error) {
            console.error("Error creating subgenre:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Update SubGenre
    async updateSubGenre(req, res) {
        try {
            const { id } = req.params;
            const { title, description, status, genre_id } = req.body;

            const updateData = { title, description, status };
            if (genre_id) updateData.genre_id = Number(genre_id);

            const updatedSubGenre = await SubGenre.findOneAndUpdate(
                { id: id },
                updateData,
                { new: true }
            );

            if (!updatedSubGenre) return res.status(404).json({ success: false, message: "SubGenre not found" });

            return res.status(200).json({ success: true, message: "SubGenre updated", data: updatedSubGenre });
        } catch (error) {
            console.error("Error updating subgenre:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Delete SubGenre
    async deleteSubGenre(req, res) {
        try {
            const { id } = req.params;
            const deletedSubGenre = await SubGenre.findOneAndDelete({ id: id });

            if (!deletedSubGenre) return res.status(404).json({ success: false, message: "SubGenre not found" });

            return res.status(200).json({ success: true, message: "SubGenre deleted" });
        } catch (error) {
            console.error("Error deleting subgenre:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Update Genre
    async updateGenre(req, res) {
        try {
            const { id } = req.params;
            const { title, description, status } = req.body;

            const updatedGenre = await Genre.findOneAndUpdate(
                { id: id },
                { title, description, status },
                { new: true }
            );

            if (!updatedGenre) return res.status(404).json({ success: false, message: "Genre not found" });

            return res.status(200).json({ success: true, message: "Genre updated", data: updatedGenre });
        } catch (error) {
            console.error("Error updating genre:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }

    // Delete Genre
    async deleteGenre(req, res) {
        try {
            const { id } = req.params;
            const deletedGenre = await Genre.findOneAndDelete({ id: id });

            if (!deletedGenre) return res.status(404).json({ success: false, message: "Genre not found" });

            // Also delete associated subgenres
            await SubGenre.deleteMany({ genre_id: id });

            return res.status(200).json({ success: true, message: "Genre and its subgenres deleted" });
        } catch (error) {
            console.error("Error deleting genre:", error);
            return res.status(500).json({ success: false, message: "Server Error" });
        }
    }
}

module.exports = new GenreController();
