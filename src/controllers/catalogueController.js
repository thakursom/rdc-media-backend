const Release = require("../models/releaseModel");
const Track = require("../models/trackModel");
const Genre = require("../models/genreModel");
const Language = require("../models/languageModel");
const Label = require("../models/labelModel");

exports.getCatalogueStats = async (req, res) => {
    try {
        // 1. Inventory Counts
        const totalTracks = await Track.countDocuments();
        const totalReleases = await Release.countDocuments();
        const albumsCount = await Release.countDocuments({ release_type: 2 });
        const singlesCount = await Release.countDocuments({ release_type: 1 });
        const epsCount = await Release.countDocuments({ release_type: 3 });

        const totalLabels = await Label.countDocuments();

        // New Albums (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newAlbumsCount = await Release.countDocuments({
            release_type: 2,
            createdAt: { $gte: thirtyDaysAgo }
        });

        // 2. Genre Distribution
        const genreDistribution = await Release.aggregate([
            { $group: { _id: "$genre_id", count: { $sum: 1 } } },
            {
                $lookup: {
                    from: "genres",
                    localField: "_id",
                    foreignField: "_id",
                    as: "genreInfo"
                }
            },
            { $unwind: "$genreInfo" },
            {
                $project: {
                    name: "$genreInfo.title",
                    count: 1
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // 3. Language Breakdown
        const languageDistribution = await Release.aggregate([
            { $group: { _id: "$language_id", count: { $sum: 1 } } },
            {
                $lookup: {
                    from: "languages",
                    localField: "_id",
                    foreignField: "_id",
                    as: "langInfo"
                }
            },
            { $unwind: "$langInfo" },
            {
                $project: {
                    name: "$langInfo.name",
                    count: 1
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        // 4. Content Type Breakdown (Simulated based on counts)
        const contentTypes = [
            { label: 'Albums', count: albumsCount },
            { label: 'Singles', count: singlesCount },
            { label: 'EPs', count: epsCount }
        ];

        // 5. Top Albums (Mock for UI)
        const topAlbums = await Release.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title upc');

        res.status(200).json({
            success: true,
            data: {
                inventory: {
                    totalTracks,
                    totalReleases,
                    albums: albumsCount,
                    newAlbums: newAlbumsCount,
                    singles: singlesCount,
                    eps: epsCount,
                    totalLabels
                },
                genreDistribution,
                languageDistribution,
                contentTypes,
                topAlbums: topAlbums.map(a => ({
                    title: a.title,
                    upc: a.upc,
                    score: Math.floor(Math.random() * 40) + 60 // Simulated popularity score
                }))
            }
        });

    } catch (error) {
        console.error("Catalogue Stats Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

