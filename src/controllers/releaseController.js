const Release = require("../models/releaseModel");
const Track = require("../models/trackModel");
const User = require("../models/userModel");
const Language = require("../models/languageModel");
const Joi = require("joi");

async function getNextId(model) {
    const lastDoc = await model.findOne().sort({ id: -1 }).limit(1);
    return lastDoc && lastDoc.id ? lastDoc.id + 1 : 1;
}

const formatDuration = (sec) => {
    if (!sec) return null;

    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);

    return `${m}:${s.toString().padStart(2, "0")}`;
};

async function generateNextCode(model, field) {
    const prefix = process.env.ISRC_Code_Prefix;
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const lastDoc = await model
        .findOne({ [field]: { $regex: new RegExp(`^${escapedPrefix}\\d+$`) } })
        .sort({ createdAt: -1 });

    let nextNumber = 2600001; // default start

    if (lastDoc && lastDoc[field]) {
        const num = parseInt(lastDoc[field].replace(prefix, ""));
        nextNumber = num + 1;
    }

    return `${prefix}${nextNumber}`;
}

class ReleaseController {

    constructor() { }

    //createRelease method
    async createRelease(req, res) {
        try {
            let data = req.body;
            if (req.body.data) {
                try {
                    data = JSON.parse(req.body.data);
                } catch (e) {
                    return res.status(400).send({ status: false, message: "Invalid JSON data format" });
                }
            }

            // Define Joi Schema
            const schema = Joi.object({
                title: Joi.string().required().messages({ 'any.required': 'Title is required' }),
                primaryGenre: Joi.number().required(),
                secondaryGenre: Joi.number().optional().allow(null),
                language: Joi.number().required(),
                releaseDate: Joi.date().required(),
                label: Joi.number().optional().allow(null),
                productionHolder: Joi.string().optional().allow(null, ''),
                productionYear: Joi.string().optional().allow(null, ''),
                copyrightHolder: Joi.string().optional().allow(null, ''),
                copyrightYear: Joi.string().optional().allow(null, ''),
                upcMode: Joi.string().valid('Auto', 'Manual').required(),
                upc: Joi.string().when('upcMode', { is: 'Manual', then: Joi.required(), otherwise: Joi.optional().allow(null, '') }),
                isrcMode: Joi.string().valid('Auto', 'Manual').required(),
                isrc: Joi.string().when('isrcMode', { is: 'Manual', then: Joi.required(), otherwise: Joi.optional().allow(null, '') }),
                catalogueNo: Joi.string().optional().allow(null, ''),
                parentalWarning: Joi.string().optional().allow(null, '0'),
                description: Joi.string().optional().allow(null, ''),
                pricing: Joi.string().optional().allow(null, ''),
                selectedStores: Joi.array().items(Joi.number()).optional(),
                releaseArtists: Joi.array().items(Joi.string()).min(1).required(),
            }).unknown(true);

            // Validate Data
            const { error } = schema.validate(data, { abortEarly: false });
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: "Validation Error",
                    errors: error.details.map(detail => detail.message)
                });
            }

            // Extract Files
            const files = req.files || {};
            const artworkFile = files['artwork'] ? files['artwork'][0] : null;
            const trackFiles = files['trackFiles'] || [];
            const lyricsFiles = files['lyricsFiles'] || [];

            // Construct Relative Path Helper
            const getFileUrl = (filename) => filename ? `/public/uploads/${filename}` : null;


            let upcNumber = data.upc;
            let isrcNumber = data.isrc;

            if (data.upcMode === "Auto") {
                upcNumber = await generateNextCode(Release, "upc_number");
            }

            if (data.isrcMode === "Auto") {
                isrcNumber = await generateNextCode(Release, "isrc");
            }

            const safeNumber = (val) => {
                if (val == null || val === '' || val === undefined) return null;
                const num = Number(val);
                return isNaN(num) ? null : num;
            };


            let langCode = null;
            let langName = null;
            if (data.language) {
                const langDoc = await Language.findOne({ id: data.language });
                if (langDoc) {
                    langCode = langDoc.code;
                    langName = langDoc.name;
                }
            }

            const releaseId = await getNextId(Release);

            const releaseData = {
                id: releaseId,
                title: data.title || '',
                lang: langCode,
                content_lang: langName,
                display_artist: data.releaseArtists || [],
                artists: '',
                feature_artist: null,
                release_type: data.releaseType || 'single',
                label_id: data.label || null,
                sublabel_id: null,
                genre_id: safeNumber(data.primaryGenre),
                subgenre_id: safeNumber(data.secondaryGenre),
                release_date: data.releaseDate ? new Date(data.releaseDate) : null,
                p_line: data.productionHolder || null,
                p_line_year: data.productionYear || null,
                c_line: data.copyrightHolder || null,
                c_line_year: data.copyrightYear || null,
                isrc: null,
                upc_number: upcNumber || null,
                cat_number: data.catalogueNo || null,
                parental_warning_type: data.parentalWarning || '0',
                description: data.description || null,
                pricing: data.pricing || null,
                store_ids: data.selectedStores || [],
                artwork: data.artworkFile || null,
                artwork_path: artworkFile ? getFileUrl(artworkFile.filename) : null,
                created_by: req.user?.id || null,
                status: 'processing',
                created_at: new Date(),
                updated_at: new Date()
            };

            const newRelease = await Release.create(releaseData);

            let savedTracks = [];
            if (data.tracks && data.tracks.length > 0) {
                let audioFileIndex = 0;
                let lyricsFileIndex = 0;

                for (let index = 0; index < data.tracks.length; index++) {
                    const track = data.tracks[index];
                    try {
                        const trackId = await getNextId(Track);

                        let audioPath = null;
                        if (track.hasNewAudioFile && trackFiles[audioFileIndex]) {
                            audioPath = getFileUrl(trackFiles[audioFileIndex].filename);
                            audioFileIndex++;
                        }

                        let lyricsPath = null;
                        if (track.hasNewLyricsFile && lyricsFiles[lyricsFileIndex]) {
                            lyricsPath = getFileUrl(lyricsFiles[lyricsFileIndex].filename);
                            lyricsFileIndex++;
                        }

                        const artistsArray = (Array.isArray(track.artists) && track.artists.length > 0)
                            ? track.artists
                            : data.releaseArtists || [];

                        let trackIsrc = track.isrc;
                        if (!trackIsrc) {
                            trackIsrc = await generateNextCode(Track, "isrc_number");
                        }

                        const newTrack = await Track.create({
                            id: trackId,
                            release_id: releaseId,
                            title: track.title,
                            position: index + 1,
                            audio_files: [track.name],
                            audio_path: audioPath,
                            lyrics_file_path: lyricsPath,
                            duration: formatDuration(track.duration),
                            genre_id: safeNumber(data.primaryGenre),
                            subgenre_id: safeNumber(data.secondaryGenre),
                            display_artist: artistsArray,
                            feature_artist: artistsArray,
                            explicit: track.explicit,
                            isrc_number: trackIsrc || null,
                            have_isrc: trackIsrc ? 1 : 0,
                            original_audio_name: track.name,
                            publisher: data.label || null,
                            producer: track.producer || null,
                            lyricist: track.lyricist || null,
                            composer: track.composer || null,
                            lyrics_text: track.lyrics || null,
                            mix_version: track.version || null,
                        });

                        savedTracks.push(newTrack);

                    } catch (err) {
                        console.error("Track creation failed:", err);
                        throw err;
                    }
                }
            }

            return res.status(201).json({
                success: true,
                message: 'Release and tracks created successfully',
                release: newRelease,
                tracks: savedTracks,
            });
        } catch (err) {
            console.error('Error creating release:', err);
            return res.status(500).json({
                success: false,
                message: 'Server error while creating release',
                error: err.message,
            });
        }
    }

    // getReleases method
    async getReleases(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || "";
            const skip = (page - 1) * limit;

            // Determine Base URL dynamically from request
            const host = req.get('host');
            const protocol = req.protocol;
            const dynamicBaseUrl = `${protocol}://${host}`;

            let query = { deleted: 0 };

            // Handle Search
            if (search) {
                const matchingLabels = await User.find({
                    name: { $regex: search, $options: "i" },
                    role: "Label"
                }).select("id");

                const labelIds = matchingLabels.map(l => l.id);

                query.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { display_artist: { $elemMatch: { $regex: search, $options: "i" } } },
                    { label_id: { $in: labelIds } }
                ];
            }

            // Handle Advanced Filters
            const { releaseTypes, statuses, label, artist, user, periodFrom, periodTo, sources, sortBy, sortOrder } = req.query;

            if (releaseTypes) {
                const types = Array.isArray(releaseTypes) ? releaseTypes : releaseTypes.split(',');
                query.release_type = { $in: types };
            }

            if (statuses) {
                const statusList = Array.isArray(statuses) ? statuses : statuses.split(',');
                query.status = { $in: statusList };
            }

            if (label) {
                const matchingLabels = await User.find({
                    name: { $regex: label, $options: "i" },
                    role: "Label"
                }).select("id");
                const labelIds = matchingLabels.map(l => l.id);
                query.label_id = { $in: labelIds };
            }

            if (artist) {
                query.display_artist = { $elemMatch: { $regex: artist, $options: "i" } };
            }

            if (user) {
                const matchingUsers = await User.find({
                    name: { $regex: user, $options: "i" }
                }).select("id");
                const userIds = matchingUsers.map(u => u.id);
                query.created_by = { $in: userIds };
            }

            if (periodFrom || periodTo) {
                query.release_date = {};
                if (periodFrom) query.release_date.$gte = new Date(periodFrom);
                if (periodTo) query.release_date.$lte = new Date(periodTo);
            }

            if (sources) {
                const sourceList = Array.isArray(sources) ? sources : sources.split(',');
                query.provided_by = { $in: sourceList };
            }

            // Determine Sort
            let sortStage = { createdAt: -1 };
            if (sortBy) {
                const order = sortOrder === 'asc' ? 1 : -1;
                if (sortBy === 'release_title') sortStage = { title: order };
                else if (sortBy === 'artist') sortStage = { display_artist: order };
                else if (sortBy === 'label') sortStage = { label_id: order };
                else if (sortBy === 'creation_date') sortStage = { createdAt: order };
                else if (sortBy === 'release_date') sortStage = { release_date: order };
            }

            const aggregation = [
                { $match: query },
                { $sort: sortStage },
                { $skip: skip },
                { $limit: limit },
                // Join with Users (Labels)
                {
                    $lookup: {
                        from: "users",
                        localField: "label_id",
                        foreignField: "id",
                        as: "label_data"
                    }
                },
                { $unwind: { path: "$label_data", preserveNullAndEmptyArrays: true } },
                // Join with Tracks to get counts
                {
                    $lookup: {
                        from: "tracks",
                        localField: "id",
                        foreignField: "release_id",
                        as: "tracks"
                    }
                },
                // Project fields to match frontend expectations
                {
                    $project: {
                        _id: 1,
                        id: 1,
                        release_title: "$title",
                        release_type: {
                            $cond: { if: { $eq: ["$release_type", "album"] }, then: 2, else: 1 }
                        },
                        status: {
                            $cond: {
                                if: { $or: [{ $eq: ["$status", "approved"] }, { $eq: ["$status", "1"] }] },
                                then: 1,
                                else: 0
                            }
                        },
                        primary_artist: {
                            name: { $arrayElemAt: ["$display_artist", 0] }
                        },
                        label: {
                            name: "$label_data.name"
                        },
                        artwork_path: {
                            $cond: {
                                if: { $and: ["$artwork_path", { $ne: ["$artwork_path", null] }] },
                                then: {
                                    $concat: [
                                        dynamicBaseUrl || "",
                                        {
                                            $cond: {
                                                if: { $regexMatch: { input: "$artwork_path", regex: /^http/ } },
                                                then: { $substrCP: ["$artwork_path", { $indexOfCP: ["$artwork_path", "/public/"] }, 1000] },
                                                else: "$artwork_path"
                                            }
                                        }
                                    ]
                                },
                                else: null
                            }
                        },
                        release_date: 1,
                        tracks: {
                            $map: {
                                input: "$tracks",
                                as: "t",
                                in: {
                                    id: "$$t.id",
                                    title: "$$t.title",
                                    audio_path: {
                                        $cond: {
                                            if: { $and: ["$$t.audio_path", { $ne: ["$$t.audio_path", null] }] },
                                            then: {
                                                $concat: [
                                                    dynamicBaseUrl || "",
                                                    {
                                                        $cond: {
                                                            if: { $regexMatch: { input: "$$t.audio_path", regex: /^http/ } },
                                                            then: { $substrCP: ["$$t.audio_path", { $indexOfCP: ["$$t.audio_path", "/public/"] }, 1000] },
                                                            else: "$$t.audio_path"
                                                        }
                                                    }
                                                ]
                                            },
                                            else: null
                                        }
                                    },
                                    isrc: "$$t.isrc_number",
                                    duration: "$$t.duration"
                                }
                            }
                        },
                        upc: "$upc_number",
                        catalogue_number: "$cat_number",
                        territories: "$store_ids", // Using store_ids as placeholder if territories field is missing
                        stores: "$store_ids"
                    }
                }
            ];

            const releases = await Release.aggregate(aggregation);
            const totalDocs = await Release.countDocuments(query);

            return res.status(200).json({
                success: true,
                data: {
                    releases,
                    pagination: {
                        totalDocs,
                        totalPages: Math.ceil(totalDocs / limit),
                        currentPage: page,
                        limit
                    }
                }
            });
        } catch (err) {
            console.error('Error fetching releases:', err);
            return res.status(500).json({
                success: false,
                message: 'Server error while fetching releases',
                error: err.message,
            });
        }
    }
}

module.exports = new ReleaseController();