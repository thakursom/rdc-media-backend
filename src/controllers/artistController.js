const Artist = require("../models/artistModel");

async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 });
    return lastDoc?.id ? lastDoc.id + 1 : 1;
}

const randomString = (len = 6) =>
    Math.random().toString(36).substring(2, 2 + len);

const randomUrl = (platform) =>
    `https://${platform}.com/${randomString(8)}`;

const generateEmail = (name) => {
    return (
        name
            .toLowerCase()
            .replace(/\s+/g, "") + "@gmail.com"
    );
};


class ArtistController {

    async createArtist(req, res) {
        try {

            const { name } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Artist name is required"
                });
            }

            const artistId = await getNextId(Artist);

            const artistData = {
                id: artistId,
                created_by: req.user?.id || null,
                name,
                email: generateEmail(name),

                artist_image: `artist_${randomString()}.jpg`,
                artist_image_url: randomUrl("images"),

                apple_image: `apple_${randomString()}.jpg`,
                youtube_image_url: randomUrl("youtube"),

                youtube_link: randomUrl("youtube"),
                sound_cloud: randomUrl("soundcloud"),
                twitter: randomUrl("twitter"),
                facebook: randomUrl("facebook"),
                instagram: randomUrl("instagram"),
                website: randomUrl("website"),

                spotify_link: randomUrl("spotify"),
                apple_link: randomUrl("apple"),

                facebook_profile_id: randomString(10),
                instagram_profile_id: randomString(10),

                isrc: randomString(12),

                is_on_spotify: Math.round(Math.random()),
                is_on_apple: Math.round(Math.random())
            };

            const artist = await Artist.create(artistData);

            return res.status(201).json({
                success: true,
                message: "Artist created successfully",
                artist
            });

        } catch (err) {
            console.error("Artist create error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }

    async getArtists(req, res) {
        try {


            const artists = await Artist.find()
                .sort({ createdAt: -1 });

            const total = await Artist.countDocuments();

            return res.status(200).json({
                success: true,
                total,
                artists
            });

        } catch (err) {
            console.error("Get artists error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }

    async getArtistById(req, res) {
        try {
            const { id } = req.params;

            const artist = await Artist.findOne({ id });

            if (!artist) {
                return res.status(404).json({
                    success: false,
                    message: "Artist not found"
                });
            }

            return res.status(200).json({
                success: true,
                artist
            });

        } catch (err) {
            console.error("Get artist error:", err);

            return res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }


}

module.exports = new ArtistController();
