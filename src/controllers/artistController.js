const Artist = require("../models/artistModel");


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
            const {
                name, email, sound_cloud, twitter, facebook,
                instagram, youtube, website, brandcamp,
                is_on_spotify, spotify_link, is_on_apple, apple_link,
                artist_image, artist_image_url, apple_image, youtube_image_url,
                youtube_link, facebook_profile_id, instagram_profile_id, isrc
            } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Artist name is required"
                });
            }

            const artistData = {
                created_by: req.user?.userId || null,
                name,
                email,
                sound_cloud,
                twitter,
                facebook,
                instagram,
                youtube,
                website,
                brandcamp,
                is_on_spotify: Number(is_on_spotify) || 0,
                spotify_link,
                is_on_apple: Number(is_on_apple) || 0,
                apple_link,
                artist_image,
                artist_image_url,
                apple_image,
                youtube_image_url,
                youtube_link,
                facebook_profile_id,
                instagram_profile_id,
                isrc
            };

            const artist = await Artist.create(artistData);

            return res.status(201).json({
                success: true,
                message: "Artist created successfully",
                data: artist
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
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            const search = req.query.search || "";

            const query = {};
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } }
                ];
            }

            const totalDocs = await Artist.countDocuments(query);
            const artists = await Artist.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            return res.status(200).json({
                success: true,
                data: {
                    artists,
                    pagination: {
                        totalDocs,
                        totalPages: Math.ceil(totalDocs / limit),
                        currentPage: page,
                        limit
                    }
                }
            });

        } catch (err) {
            console.error("Get artists error:", err);
            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }

    async getArtistById(req, res) {
        try {
            const { id } = req.params;
            const artist = await Artist.findById(id);

            if (!artist) {
                return res.status(404).json({
                    success: false,
                    message: "Artist not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: artist
            });
        } catch (err) {
            console.error("Get artist error:", err);
            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }

    async updateArtist(req, res) {
        try {
            const { id } = req.params;
            const updatedArtist = await Artist.findByIdAndUpdate(
                id,
                req.body,
                { new: true }
            );

            if (!updatedArtist) {
                return res.status(404).json({
                    success: false,
                    message: "Artist not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Artist updated successfully",
                data: updatedArtist
            });
        } catch (err) {
            console.error("Update artist error:", err);
            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }

    async deleteArtist(req, res) {
        try {
            const { id } = req.params;
            const deletedArtist = await Artist.findByIdAndDelete(id);

            if (!deletedArtist) {
                return res.status(404).json({
                    success: false,
                    message: "Artist not found"
                });
            }

            return res.status(200).json({
                success: true,
                message: "Artist deleted successfully"
            });
        } catch (err) {
            console.error("Delete artist error:", err);
            return res.status(500).json({
                success: false,
                message: "Server error"
            });
        }
    }

    async createReleaseArtist(req, res) {
        try {

            const { name } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Artist name is required"
                });
            }

            const artistData = {
                created_by: req.user?.userId || null,
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

    async getReleaseArtists(req, res) {
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

    async getReleaseArtistById(req, res) {
        try {
            const { id } = req.params;

            const artist = await Artist.findById(id);

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
