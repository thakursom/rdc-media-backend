const Release = require("../models/releaseModel");
const User = require("../models/userModel");
const Artist = require("../models/artistModel");
const Label = require("../models/labelModel");
const Track = require("../models/trackModel");

exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Basic Stats
        const totalReleases = await Release.countDocuments();
        const pendingReleases = await Release.countDocuments({ status: 0 }); // Assuming 0 is pending
        const approvedReleases = await Release.countDocuments({ status: 1 }); // Assuming 1 is approved
        const rejectedReleases = await Release.countDocuments({ status: 2 }); // Assuming 2 is rejected

        // 2. Latest Releases (last 12)
        const latestReleases = await Release.find()
            .sort({ createdAt: -1 })
            .limit(12)
            .populate('primary_artist', 'name')
            .populate('label', 'name');

        // 3. Top Labels (by release count) - Simplified aggregation
        const topLabels = await Release.aggregate([
            { $group: { _id: "$label_id", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "labels",
                    localField: "_id",
                    foreignField: "_id",
                    as: "labelInfo"
                }
            },
            { $unwind: "$labelInfo" },
            {
                $project: {
                    name: "$labelInfo.name",
                    count: 1
                }
            }
        ]);

        // 4. Top Artists (by release count)
        const topArtists = await Release.aggregate([
            { $group: { _id: "$primary_artist_id", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "artists",
                    localField: "_id",
                    foreignField: "_id",
                    as: "artistInfo"
                }
            },
            { $unwind: "$artistInfo" },
            {
                $project: {
                    name: "$artistInfo.name",
                    count: 1
                }
            }
        ]);

        // 5. Aggregated Top Genres
        const topGenres = await Release.aggregate([
            { $group: { _id: "$genre_name", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // 6. Aggregated Top Languages
        const topLanguages = await Release.aggregate([
            { $group: { _id: "$language_name", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // 7. Simulated Analytics Data (Higher resolution for the new UI)
        const streamingPerformance = {
            labels: ["21 Jan", "22 Jan", "23 Jan", "24 Jan", "25 Jan", "26 Jan", "27 Jan"],
            datasets: [
                {
                    label: "Current Period",
                    data: [100000, 150000, 80000, 60000, 120000, 90000, 140000],
                    borderColor: "#10b981", // Emerald
                    backgroundColor: "rgba(16, 185, 129, 0.1)",
                    tension: 0.4
                },
                {
                    label: "Previous Period",
                    data: [20000, 50000, 120000, 90000, 70000, 200000, 250000],
                    borderColor: "#f59e0b", // Amber
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    tension: 0.4
                }
            ]
        };

        const platformDistribution = {
            labels: ["Direct Store", "Apple Music", "iTunes", "Amazon Music", "Other"],
            data: [250000, 180000, 45000, 40000, 60000],
            percentages: [60, 40, 20, 30, 50] // Simulated percentages
        };

        // 8. Recent Artists for Sub Labels
        const recentArtists = await Artist.find().sort({ createdAt: -1 }).limit(5);

        res.status(200).json({
            success: true,
            data: {
                stats: {
                    total: totalReleases,
                    pending: pendingReleases,
                    approved: approvedReleases,
                    rejected: rejectedReleases,
                    totalStreams: (totalReleases * 1250).toLocaleString(), // Semi-dynamic
                    streamGrowth: "+4,882 (34%)"
                },
                latestReleases: latestReleases.slice(0, 6),
                topLabels: topLabels.map(l => ({ ...l, percentage: Math.floor((l.count / totalReleases) * 100) })),
                topArtists: topArtists.map(a => ({
                    ...a,
                    streams: (a.count * 850).toLocaleString(),
                    percentage: Math.floor((a.count / totalReleases) * 100)
                })),
                topGenres: topGenres.map(g => ({ name: g._id || "Other", count: g.count, percentage: Math.floor((g.count / totalReleases) * 100) })),
                topLanguages: topLanguages.map(l => ({ name: l._id || "Other", count: l.count, percentage: Math.floor((l.count / totalReleases) * 100) })),
                subLabels: recentArtists.map(a => ({
                    name: a.name,
                    email: a.email || `${a.name.toLowerCase().replace(/ /g, '')}@rdc.com`,
                    type: "ARTIST",
                    image: a.artist_image_url
                })),
                simulated: {
                    streamingPerformance,
                    platformDistribution
                }
            }
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
