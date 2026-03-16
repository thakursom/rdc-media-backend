const Release = require("../models/releaseModel");
const User = require("../models/userModel");
const Artist = require("../models/artistModel");
const Label = require("../models/labelModel");
const Track = require("../models/trackModel");
const mongoose = require("mongoose");

exports.getDashboardStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateQuery = {};

        if (startDate && endDate) {
            dateQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // 1. Basic Stats
        const totalAlbums = await Release.countDocuments(dateQuery);

        // Today's Albums
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todayAlbums = await Release.countDocuments({
            createdAt: { $gte: startOfToday }
        });

        const totalTracks = await Track.countDocuments(dateQuery);
        const totalLabels = await Label.countDocuments(dateQuery);

        // 2. Real Trend Data (Last 12 months)
        const last12Months = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            last12Months.push({
                month: d.getMonth() + 1,
                year: d.getFullYear(),
                label: d.toLocaleString('default', { month: 'short' }) + " " + d.getFullYear()
            });
        }

        const trendAgg = async (model, dateField = "createdAt") => {
            return await model.aggregate([
                {
                    $match: {
                        [dateField]: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) }
                    }
                },
                {
                    $group: {
                        _id: {
                            month: { $month: `$${dateField}` },
                            year: { $year: `$${dateField}` }
                        },
                        count: { $sum: 1 }
                    }
                }
            ]);
        };

        const [albumsTrend, tracksTrend, labelsTrendAgg] = await Promise.all([
            trendAgg(Release),
            trendAgg(Track),
            trendAgg(Label)
        ]);

        const formatTrend = (aggData) => {
            return last12Months.map(m => {
                const found = aggData.find(d => d._id.month === m.month && d._id.year === m.year);
                return found ? found.count : 0;
            });
        };

        const trendData = {
            labels: last12Months.map(m => m.label),
            albums: formatTrend(albumsTrend),
            tracks: formatTrend(tracksTrend),
            labelsTrend: formatTrend(labelsTrendAgg)
        };

        // 3. Top Artists (with counts)
        const topArtists = await Release.aggregate([
            { $match: dateQuery },
            { $unwind: { path: "$display_artist", preserveNullAndEmptyArrays: false } },
            { $addFields: { artistName: { $cond: { if: { $eq: [{ $type: "$display_artist" }, "string"] }, then: "$display_artist", else: "$display_artist.name" } } } },
            { $group: { _id: "$artistName", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
                $project: {
                    name: "$_id",
                    count: 1
                }
            }
        ]);

        // 4. Top Genres
        const topGenres = await Release.aggregate([
            { $match: dateQuery },
            { $group: { _id: "$genre_id", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "genres",
                    let: { genreStringId: { $toString: "$_id" } },
                    pipeline: [
                        { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$genreStringId"] } } }
                    ],
                    as: "genreInfo"
                }
            },
            { $unwind: { path: "$genreInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    name: { $ifNull: ["$genreInfo.title", "Other"] },
                    count: 1
                }
            }
        ]);

        // 5. Top Labels (Querying labels collection correctly)
        const topLabelsList = await Release.aggregate([
            { $match: dateQuery },
            { $group: { _id: "$label_id", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "labels",
                    let: { labelStringId: { $toString: "$_id" } },
                    pipeline: [
                        { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$labelStringId"] } } }
                    ],
                    as: "labelInfo"
                }
            },
            { $unwind: { path: "$labelInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    name: { $ifNull: ["$labelInfo.name", "Unknown Label"] },
                    count: 1
                }
            }
        ]);

        // 6. Top Languages
        const topLanguages = await Release.aggregate([
            { $match: dateQuery },
            { $group: { _id: "$language_id", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "languages",
                    let: { langStringId: { $toString: "$_id" } },
                    pipeline: [
                        { $match: { $expr: { $eq: [{ $toString: "$_id" }, "$$langStringId"] } } }
                    ],
                    as: "langInfo"
                }
            },
            { $unwind: { path: "$langInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    name: { $ifNull: ["$langInfo.name", "Other"] },
                    count: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalAlbums,
                    todayAlbums,
                    totalTracks,
                    totalLabels
                },
                trendData,
                topArtists: topArtists.map(a => ({ name: a.name, count: a.count })),
                topGenres: topGenres.map(g => ({ name: g.name || "Other", count: g.count })),
                topLabels: topLabelsList.map(l => ({ name: l.name, count: l.count })),
                topLanguages: topLanguages.map(l => ({ name: l.name || "Other", count: l.count }))
            }
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
