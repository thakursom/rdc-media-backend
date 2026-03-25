const Release = require("../models/releaseModel");
const Track = require("../models/trackModel");
const User = require("../models/userModel");
const Label = require("../models/labelModel");
const Language = require("../models/languageModel");
const ReleaseRemark = require("../models/releaseRemarkModel");
const Joi = require("joi");
const mongoose = require("mongoose");



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
                primaryGenre: Joi.any().required(),
                secondaryGenre: Joi.any().optional().allow(null, ''),
                language: Joi.any().required(),
                releaseDate: Joi.date().required(),
                label: Joi.any().optional().allow(null, ''),
                productionHolder: Joi.string().optional().allow(null, ''),
                productionYear: Joi.any().optional().allow(null, ''),
                copyrightHolder: Joi.string().optional().allow(null, ''),
                copyrightYear: Joi.any().optional().allow(null, ''),
                upcMode: Joi.string().valid('Auto', 'Manual').required(),
                upc: Joi.string().when('upcMode', { is: 'Manual', then: Joi.required(), otherwise: Joi.optional().allow(null, '') }),
                isrcMode: Joi.string().valid('Auto', 'Manual').required(),
                isrc: Joi.string().when('isrcMode', { is: 'Manual', then: Joi.required(), otherwise: Joi.optional().allow(null, '') }),
                catalogueNo: Joi.string().optional().allow(null, ''),
                parentalWarning: Joi.string().optional().allow(null, '0'),
                description: Joi.string().optional().allow(null, ''),
                pricing: Joi.string().optional().allow(null, ''),
                selectedStores: Joi.array().items(Joi.any()).optional(),
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

            const safeId = (val) => {
                if (val == null || val === '' || val === undefined) return null;
                return String(val);
            };


            let langCode = null;
            let langName = null;
            if (data.language) {
                const langDoc = await Language.findById(data.language);
                if (langDoc) {
                    langCode = langDoc.code;
                    langName = langDoc.name;
                }
            }

            const releaseData = {
                title: data.title || '',
                lang: langCode,
                content_lang: langName,
                language_id: data.language || null,
                display_artist: data.releaseArtists || [],
                artists: (data.releaseArtists || []).join(', '),
                feature_artist: (data.releaseArtists || []).join(', '),
                release_type: data.releaseType || 'single',
                label_id: data.label || null,
                sublabel_id: null,
                genre_id: safeId(data.primaryGenre),
                subgenre_id: safeId(data.secondaryGenre),
                release_date: data.releaseDate ? new Date(data.releaseDate) : null,
                release_time: data.releaseTime || '00:00',
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
                store_ids: (data.selectedStores || []).filter(id => id != null),
                artwork: data.artworkFile || null,
                artwork_path: artworkFile ? getFileUrl(artworkFile.filename) : null,
                created_by: req.user?.userId || req.user?._id || null,
                is_various_artists: data.isVariousArtists ? 1 : 0,
                is_first_release: data.isFirstRelease ? 1 : 0,
                is_priority: data.priorityDistribution ? 1 : 0,
                is_instrumental: data.is_instrumental !== undefined ? data.is_instrumental : 0,
                country_restrictions: data.countryRestrictions || 'No',
                country_restrictions_list: data.countryRestrictionsList || [],
                previously_released: data.previouslyReleased || 'No',
                future_stores: data.futureStores || 'Yes',
                chart_registration: data.chartRegistration || [],
                status: 'processing',
                create_type: data.create_type || null,
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

                        const artistsArray = (Array.isArray(track.display_artist) && track.display_artist.length > 0)
                            ? track.display_artist
                            : data.releaseArtists || [];

                        let trackIsrc = track.isrc_number;
                        if (!trackIsrc) {
                            trackIsrc = await generateNextCode(Track, "isrc_number");
                        }

                        const newTrack = await Track.create({
                            release_id: newRelease._id,
                            title: track.title,
                            position: index + 1,
                            audio_files: [track.name],
                            audio_path: audioPath,
                            lyrics_file_path: lyricsPath,
                            duration: formatDuration(track.duration),
                            genre_id: safeId(data.primaryGenre),
                            subgenre_id: safeId(data.secondaryGenre),
                            display_artist: artistsArray,
                            feature_artist: artistsArray,
                            explicit: track.explicit ? 1 : 0,
                            explicitConfirmation: track.explicitConfirmation ? 1 : 0,
                            ownRightsConfirmation: track.ownRightsConfirmation ? 1 : 0,
                            noOtherArtistName: track.noOtherArtistName ? 1 : 0,
                            noOtherAlbumTitle: track.noOtherAlbumTitle ? 1 : 0,
                            isrc_number: trackIsrc || null,
                            have_isrc: trackIsrc ? 1 : 0,
                            original_audio_name: track.name,
                            publisher: data.label || null,
                            producer: track.producer || null,
                            lyricist: track.lyricist || null,
                            composer: track.composer || null,
                            lyrics_text: track.lyrics_text || null,
                            mix_version: track.mix_version || null,
                            preview_start: track.preview_start || 0,
                            c_line: track.c_line || null,
                            c_line_year: track.c_line_year || null,
                            p_line: track.p_line || null,
                            p_line_year: track.p_line_year || null,
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
            const dynamicBaseUrl = process.env.BASE_URL;

            let query = { deleted: 0 };

            // Handle Search
            if (search) {
                // Search in User model (for labels that might be users)
                const matchingUserLabels = await User.find({
                    name: { $regex: search, $options: "i" },
                    role: "Label"
                }).select("_id id");

                // Also search in dedicated Label model
                const matchingDedicatedLabels = await Label.find({
                    name: { $regex: search, $options: "i" }
                }).select("_id");

                const userLabelIds = matchingUserLabels.map(l => String(l._id || l.id));
                const dedicatedLabelIds = matchingDedicatedLabels.map(l => String(l._id));
                const allLabelIds = [...new Set([...userLabelIds, ...dedicatedLabelIds])];

                query.$or = [
                    { title: { $regex: search, $options: "i" } },
                    { display_artist: { $elemMatch: { $regex: search, $options: "i" } } },
                    { upc_number: { $regex: search, $options: "i" } },
                    { label_id: { $in: allLabelIds } },
                    { "tracks.isrc_number": { $regex: search, $options: "i" } },
                    { "tracks.title": { $regex: search, $options: "i" } }
                ];
            }

            // Handle Advanced Filters
            const { releaseTypes, statuses, create_type, label, artist, user, periodFrom, periodTo, sources, sortBy, sortOrder } = req.query;

            if (releaseTypes) {
                const types = Array.isArray(releaseTypes) ? releaseTypes : releaseTypes.split(',');
                query.release_type = { $in: types };
            }

            if (create_type) {
                const typeList = Array.isArray(create_type) ? create_type : create_type.split(',');
                query.create_type = { $in: typeList };
            }

            if (statuses) {
                const statusList = Array.isArray(statuses) ? statuses : statuses.split(',');
                query.status = { $in: statusList };
            }

            if (label) {
                // If label is passed, it could be a name or an ID from the dropdown
                const matchingLabels = await Label.find({
                    $or: [
                        { name: { $regex: label, $options: "i" } },
                        { _id: mongoose.isValidObjectId(label) ? label : null }
                    ]
                }).select("_id");

                const labelIds = matchingLabels.map(l => String(l._id));
                // Add the input itself if it's a valid ID but not found in the name search
                if (mongoose.isValidObjectId(label) && !labelIds.includes(String(label))) {
                    labelIds.push(String(label));
                }

                query.label_id = { $in: labelIds };
            }

            if (artist) {
                query.display_artist = { $elemMatch: { $regex: artist, $options: "i" } };
            }

            if (user) {
                const matchingUsers = await User.find({
                    name: { $regex: user, $options: "i" }
                }).select("_id");
                const userIds = matchingUsers.map(u => u._id);
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
                // Join with Labels
                {
                    $lookup: {
                        from: "labels",
                        let: { lid: "$label_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$lid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$lid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "label_data"
                    }
                },
                {
                    $addFields: {
                        label_data: { $arrayElemAt: ["$label_data", 0] }
                    }
                },
                // Join with Tracks
                {
                    $lookup: {
                        from: "tracks",
                        let: { rid: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$release_id", { $toString: "$$rid" }] },
                                            { $eq: ["$release_id", "$$rid"] }
                                        ]
                                    }
                                }
                            },
                            {
                                $lookup: {
                                    from: "trackeventassignments",
                                    let: { tid: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: {
                                                    $or: [
                                                        { $eq: ["$trackId", { $toString: "$$tid" }] },
                                                        { $eq: ["$trackId", "$$tid"] }
                                                    ]
                                                }
                                            }
                                        }
                                    ],
                                    as: "assignedEvents"
                                }
                            }
                        ],
                        as: "tracks"
                    }
                },
                // Join with ReleaseRemark to get the latest remarks
                {
                    $lookup: {
                        from: "releaseremarks",
                        let: { rid: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$release_id", { $toString: "$$rid" }] },
                                            { $eq: ["$release_id", "$$rid"] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "remarks_data"
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
                        create_type: 1,
                        admin_remarks: {
                            $let: {
                                vars: { latest_remark: { $arrayElemAt: [{ $sortArray: { input: "$remarks_data", sortBy: { created_at: -1 } } }, 0] } },
                                in: { $ifNull: ["$$latest_remark.remark", "$admin_remarks"] }
                            }
                        },
                        rejection_reason: {
                            $let: {
                                vars: { latest_remark: { $arrayElemAt: [{ $sortArray: { input: "$remarks_data", sortBy: { created_at: -1 } } }, 0] } },
                                in: { $ifNull: ["$$latest_remark.remark", "$rejection_reason"] }
                            }
                        },
                        rejection_file: {
                            $let: {
                                vars: {
                                    latest_remark: { $arrayElemAt: [{ $sortArray: { input: "$remarks_data", sortBy: { created_at: -1 } } }, 0] },
                                    legacy_file: "$rejection_file"
                                },
                                in: {
                                    $let: {
                                        vars: {
                                            selected_file: { $ifNull: ["$$latest_remark.attachment_path", "$$legacy_file"] }
                                        },
                                        in: {
                                            $cond: {
                                                if: { $and: ["$$selected_file", { $ne: ["$$selected_file", null] }] },
                                                then: {
                                                    $concat: [
                                                        dynamicBaseUrl || "",
                                                        {
                                                            $cond: {
                                                                if: { $regexMatch: { input: "$$selected_file", regex: /^http/ } },
                                                                then: { $substrCP: ["$$selected_file", { $indexOfCP: ["$$selected_file", "/public/"] }, 1000] },
                                                                else: "$$selected_file"
                                                            }
                                                        }
                                                    ]
                                                },
                                                else: null
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        rejection_type: {
                            $let: {
                                vars: { latest_remark: { $arrayElemAt: [{ $sortArray: { input: "$remarks_data", sortBy: { created_at: -1 } } }, 0] } },
                                in: { $ifNull: ["$$latest_remark.rejection_type", null] }
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
                                    _id: "$$t._id",
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
                                    duration: "$$t.duration",
                                    composer: "$$t.composer",
                                    producer: "$$t.producer",
                                    lyricist: "$$t.lyricist",
                                    remixer: "$$t.remixer",
                                    mix_version: "$$t.mix_version",
                                    preview_start: "$$t.preview_start",
                                    c_line: "$$t.c_line",
                                    c_line_year: "$$t.c_line_year",
                                    p_line: "$$t.p_line",
                                    p_line_year: "$$t.p_line_year",
                                    artist: { $arrayElemAt: ["$$t.display_artist", 0] },
                                    assignedEvents: "$$t.assignedEvents",
                                    explicitConfirmation: "$$t.explicitConfirmation",
                                    ownRightsConfirmation: "$$t.ownRightsConfirmation",
                                    noOtherArtistName: "$$t.noOtherArtistName",
                                    noOtherAlbumTitle: "$$t.noOtherAlbumTitle"
                                }
                            }
                        },
                        upc: "$upc_number",
                        catalogue_number: "$cat_number",
                        is_instrumental: 1,
                        chart_registration: 1,
                        territories: "$store_ids", // Using store_ids as placeholder if territories field is missing
                        stores: "$store_ids",
                        createdAt: 1,
                        updatedAt: 1
                    }
                },
                // Re-apply sort
                { $sort: sortStage }
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

    // getReleaseById method
    async getReleaseById(req, res) {
        try {
            const { id } = req.params;

            // Determine Base URL dynamically from request
            const dynamicBaseUrl = process.env.BASE_URL;

            const aggregation = [
                { $match: { _id: new mongoose.Types.ObjectId(id), deleted: 0 } },
                // Join with Users (Labels)
                {
                    $lookup: {
                        from: "labels",
                        let: { lid: "$label_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$lid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$lid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "label_data"
                    }
                },
                {
                    $addFields: {
                        label_data: { $arrayElemAt: ["$label_data", 0] }
                    }
                },
                // Join with Genres
                {
                    $lookup: {
                        from: "genres",
                        let: { gid: "$genre_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$gid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$gid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "genre_info"
                    }
                },
                {
                    $addFields: {
                        genre_info: { $arrayElemAt: ["$genre_info", 0] }
                    }
                },
                // Join with SubGenres
                {
                    $lookup: {
                        from: "subgenres",
                        let: { sgid: "$subgenre_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$sgid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$sgid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "subgenre_info"
                    }
                },
                {
                    $addFields: {
                        subgenre_info: { $arrayElemAt: ["$subgenre_info", 0] }
                    }
                },
                // Join with Tracks
                {
                    $lookup: {
                        from: "tracks",
                        let: { rid: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$release_id", { $toString: "$$rid" }] },
                                            { $eq: ["$release_id", "$$rid"] }
                                        ]
                                    }
                                }
                            },
                            {
                                $lookup: {
                                    from: "trackeventassignments",
                                    let: { tid: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: {
                                                    $or: [
                                                        { $eq: ["$trackId", { $toString: "$$tid" }] },
                                                        { $eq: ["$trackId", "$$tid"] }
                                                    ]
                                                }
                                            }
                                        }
                                    ],
                                    as: "assignedEvents"
                                }
                            }
                        ],
                        as: "tracks"
                    }
                },
                // Join with ReleaseRemark to get the latest remarks
                {
                    $lookup: {
                        from: "releaseremarks",
                        let: { rid: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$release_id", { $toString: "$$rid" }] },
                                            { $eq: ["$release_id", "$$rid"] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "remarks_data"
                    }
                },
                // Project fields to match frontend expectations
                {
                    $lookup: {
                        from: "languages",
                        let: { r_lang: "$lang", r_id: "$language_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ["$status", 1] },
                                            {
                                                $or: [
                                                    { $and: [{ $ne: ["$$r_lang", null] }, { $eq: ["$code", "$$r_lang"] }] },
                                                    { $and: [{ $ne: ["$$r_id", null] }, { $eq: ["$_id", "$$r_id"] }] }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "lang_info"
                    }
                },
                {
                    $addFields: {
                        language_id: {
                            $ifNull: ["$language_id", { $arrayElemAt: ["$lang_info.id", 0] }]
                        }
                    }
                },
                {
                    $project: {
                        _id: 1,
                        id: 1,
                        title: 1,
                        release_title: "$title",
                        release_type: 1,
                        status: 1,
                        create_type: 1,
                        admin_remarks: {
                            $let: {
                                vars: { latest_remark: { $arrayElemAt: [{ $sortArray: { input: "$remarks_data", sortBy: { created_at: -1 } } }, 0] } },
                                in: { $ifNull: ["$$latest_remark.remark", "$admin_remarks"] }
                            }
                        },
                        rejection_reason: {
                            $let: {
                                vars: { latest_remark: { $arrayElemAt: [{ $sortArray: { input: "$remarks_data", sortBy: { created_at: -1 } } }, 0] } },
                                in: { $ifNull: ["$$latest_remark.remark", "$rejection_reason"] }
                            }
                        },
                        rejection_file: {
                            $let: {
                                vars: {
                                    latest_remark: { $arrayElemAt: [{ $sortArray: { input: "$remarks_data", sortBy: { created_at: -1 } } }, 0] },
                                    legacy_file: "$rejection_file"
                                },
                                in: {
                                    $let: {
                                        vars: {
                                            selected_file: { $ifNull: ["$$latest_remark.attachment_path", "$$legacy_file"] }
                                        },
                                        in: {
                                            $cond: {
                                                if: { $and: ["$$selected_file", { $ne: ["$$selected_file", null] }] },
                                                then: {
                                                    $concat: [
                                                        dynamicBaseUrl || "",
                                                        {
                                                            $cond: {
                                                                if: { $regexMatch: { input: "$$selected_file", regex: /^http/ } },
                                                                then: { $substrCP: ["$$selected_file", { $indexOfCP: ["$$selected_file", "/public/"] }, 1000] },
                                                                else: "$$selected_file"
                                                            }
                                                        }
                                                    ]
                                                },
                                                else: null
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        rejection_type: {
                            $let: {
                                vars: { latest_remark: { $arrayElemAt: [{ $sortArray: { input: "$remarks_data", sortBy: { created_at: -1 } } }, 0] } },
                                in: { $ifNull: ["$$latest_remark.rejection_type", null] }
                            }
                        },
                        display_artist: 1,
                        primary_artist: {
                            name: { $arrayElemAt: ["$display_artist", 0] }
                        },
                        label_id: 1,
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
                        release_time: 1,
                        tracks: {
                            $map: {
                                input: "$tracks",
                                as: "t",
                                in: {
                                    _id: "$$t._id",
                                    title: "$$t.title",
                                    mix_version: "$$t.mix_version",
                                    position: "$$t.position",
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
                                    isrc_number: "$$t.isrc_number",
                                    isrc: "$$t.isrc_number",
                                    duration: "$$t.duration",
                                    remixer: "$$t.remixer",
                                    composer: "$$t.composer",
                                    producer: "$$t.producer",
                                    lyricist: "$$t.lyricist",
                                    lyrics_text: "$$t.lyrics_text",
                                    mix_version: "$$t.mix_version",
                                    preview_start: "$$t.preview_start",
                                    c_line: "$$t.c_line",
                                    c_line_year: "$$t.c_line_year",
                                    p_line: "$$t.p_line",
                                    p_line_year: "$$t.p_line_year",
                                    explicit: "$$t.explicit",
                                    display_artist: "$$t.display_artist",
                                    artist: { $arrayElemAt: ["$$t.display_artist", 0] },
                                    assignedEvents: "$$t.assignedEvents",
                                    explicitConfirmation: "$$t.explicitConfirmation",
                                    ownRightsConfirmation: "$$t.ownRightsConfirmation",
                                    noOtherArtistName: "$$t.noOtherArtistName",
                                    noOtherAlbumTitle: "$$t.noOtherAlbumTitle"
                                }
                            }
                        },
                        upc_number: 1,
                        upc: "$upc_number",
                        cat_number: 1,
                        catalogue_number: "$cat_number",
                        is_instrumental: 1,
                        chart_registration: 1,
                        p_line: 1,
                        p_line_year: 1,
                        c_line: 1,
                        c_line_year: 1,
                        lang: 1,
                        content_lang: 1,
                        language_id: 1,
                        genre_id: 1,
                        subgenre_id: 1,
                        store_ids: 1,
                        parental_warning_type: 1,
                        description: 1,
                        pricing: 1,
                        is_various_artists: 1,
                        is_various: "$is_various_artists",
                        is_first_release: 1,
                        is_first: "$is_first_release",
                        is_priority: 1,
                        country_restrictions: 1,
                        country_restrictions_list: 1,
                        previously_released: 1,
                        future_stores: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        release_date: 1,
                        release_time: 1,
                        genre_name: "$genre_info.title",
                        subgenre_name: "$subgenre_info.title",
                        language_name: { $arrayElemAt: ["$lang_info.name", 0] }
                    }
                }
            ];

            const releases = await Release.aggregate(aggregation);

            if (!releases || releases.length === 0) {
                return res.status(404).json({ success: false, message: "Release not found" });
            }

            return res.status(200).json({ success: true, data: releases[0] });
        } catch (error) {
            console.error('Error fetching single release:', error);
            return res.status(500).json({ success: false, message: "Server error", error: error.message });
        }
    }

    // updateReleaseStatus method
    async updateReleaseStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, create_type, admin_remarks, rejection_reason, rejection_type } = req.body;

            const updateData = {};
            if (status !== undefined) updateData.status = status;
            if (create_type !== undefined) updateData.create_type = create_type;
            if (admin_remarks !== undefined) updateData.admin_remarks = admin_remarks;
            if (rejection_reason !== undefined) updateData.rejection_reason = rejection_reason;

            let rejection_file = null;
            if (req.file) {
                rejection_file = `/public/uploads/${req.file.filename}`;
                updateData.rejection_file = rejection_file;
            }

            const release = await Release.findByIdAndUpdate(
                id,
                { $set: updateData },
                { returnDocument: 'after' }
            );

            if (!release) {
                return res.status(404).json({ success: false, message: "Release not found" });
            }

            // Create a dedicated remark entry
            if (create_type === 'Rejected' || create_type === 'Approved' || create_type === 'Saved' || admin_remarks || rejection_reason || rejection_file) {
                await ReleaseRemark.create({
                    release_id: id,
                    action: create_type || (status == "1" ? "Approved" : status == "2" ? "Rejected" : "Updated"),
                    rejection_type: rejection_type || null,
                    remark: rejection_reason || admin_remarks || null,
                    attachment_path: rejection_file,
                    created_by: req.user?.userId || req.user?._id || null
                });
            }

            return res.status(200).json({ success: true, message: "Status updated successfully", data: release });
        } catch (error) {
            return res.status(500).json({ success: false, message: "Server error", error: error.message });
        }
    }
    // updateRelease method
    async updateRelease(req, res) {
        try {
            const { id } = req.params;
            const releaseId = id;

            let data = req.body;
            if (req.body.data) {
                try {
                    data = JSON.parse(req.body.data);
                } catch (e) {
                    return res.status(400).send({ status: false, message: "Invalid JSON data format" });
                }
            }

            const existingRelease = await Release.findById(releaseId);
            if (!existingRelease) {
                return res.status(404).json({ success: false, message: "Release not found" });
            }

            // Extract Files
            const files = req.files || {};
            const artworkFile = files['artwork'] ? files['artwork'][0] : null;
            const trackFiles = files['trackFiles'] || [];
            const lyricsFiles = files['lyricsFiles'] || [];

            const getFileUrl = (filename) => filename ? `/public/uploads/${filename}` : null;

            let upcNumber = data.upcMode === "Auto" ? existingRelease.upc_number : data.upc;
            let isrcNumber = data.isrcMode === "Auto" ? existingRelease.isrc : data.isrc;

            const safeId = (val) => {
                if (val == null || val === '' || val === undefined) return null;
                return String(val);
            };

            let langCode = existingRelease.lang;
            let langName = existingRelease.content_lang;
            if (data.language && data.language != existingRelease.language_id) {
                const langDoc = await Language.findById(data.language);
                if (langDoc) {
                    langCode = langDoc.code;
                    langName = langDoc.name;
                }
            }

            const updateData = {
                title: data.title || existingRelease.title,
                lang: langCode,
                content_lang: langName,
                language_id: data.language || existingRelease.language_id,
                display_artist: data.releaseArtists || existingRelease.display_artist,
                release_type: data.releaseType || existingRelease.release_type,
                label_id: data.label || existingRelease.label_id,
                genre_id: safeId(data.primaryGenre) || existingRelease.genre_id,
                subgenre_id: safeId(data.secondaryGenre) || existingRelease.subgenre_id,
                release_date: data.releaseDate ? new Date(data.releaseDate) : existingRelease.release_date,
                release_time: data.releaseTime || existingRelease.release_time,
                p_line: data.productionHolder || existingRelease.p_line,
                p_line_year: data.productionYear || existingRelease.p_line_year,
                c_line: data.copyrightHolder || existingRelease.c_line,
                c_line_year: data.copyrightYear || existingRelease.c_line_year,
                upc_number: upcNumber || existingRelease.upc_number,
                cat_number: data.catalogueNo || existingRelease.cat_number,
                parental_warning_type: data.parentalWarning || existingRelease.parental_warning_type,
                description: data.description || existingRelease.description,
                pricing: data.pricing || existingRelease.pricing,
                store_ids: (data.selectedStores || existingRelease.store_ids || []).filter(id => id != null),
                artwork_path: artworkFile ? getFileUrl(artworkFile.filename) : existingRelease.artwork_path,
                is_various_artists: data.isVariousArtists !== undefined ? (data.isVariousArtists ? 1 : 0) : existingRelease.is_various_artists,
                is_first_release: data.isFirstRelease !== undefined ? (data.isFirstRelease ? 1 : 0) : existingRelease.is_first_release,
                is_priority: data.priorityDistribution !== undefined ? (data.priorityDistribution ? 1 : 0) : existingRelease.is_priority,
                is_instrumental: data.is_instrumental !== undefined ? data.is_instrumental : (data.isInstrumental !== undefined ? (data.isInstrumental ? 1 : 0) : existingRelease.is_instrumental),
                country_restrictions: data.countryRestrictions || existingRelease.country_restrictions,
                country_restrictions_list: data.countryRestrictionsList || existingRelease.country_restrictions_list,
                previously_released: data.previouslyReleased || existingRelease.previously_released,
                future_stores: data.futureStores || existingRelease.future_stores,
                chart_registration: data.chartRegistration || existingRelease.chart_registration,
                create_type: data.create_type || existingRelease.create_type,
                updated_at: new Date()
            };

            await Release.findByIdAndUpdate(releaseId, { $set: updateData });

            const oldTracks = await Track.find({ release_id: releaseId });
            let savedTracks = [];

            // Update tracks: Remove guard to allow deleting all tracks
            let audioFileIndex = 0;
            let lyricsFileIndex = 0;
            const newTrackIds = [];

            if (data.tracks && data.tracks.length > 0) {
                for (let index = 0; index < data.tracks.length; index++) {
                    const track = data.tracks[index];
                    const trackId = track._id || track.id;
                    const isExistingDbTrack = trackId && mongoose.Types.ObjectId.isValid(trackId);

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

                    const artistsArray = (Array.isArray(track.display_artist) && track.display_artist.length > 0)
                        ? track.display_artist
                        : data.releaseArtists || [];

                    if (isExistingDbTrack) {
                        const oldTrack = oldTracks.find(t => String(t._id) === String(trackId));
                        const finalAudioPath = audioPath || (oldTrack ? oldTrack.audio_path : null);
                        const finalLyricsPath = lyricsPath || (oldTrack ? oldTrack.lyrics_file_path : null);

                        let trackIsrc = track.isrc_number;
                        if (!trackIsrc && (!oldTrack || !oldTrack.isrc_number)) {
                            trackIsrc = await generateNextCode(Track, "isrc_number");
                        } else if (!trackIsrc && oldTrack) {
                            trackIsrc = oldTrack.isrc_number;
                        }

                        const updatedTrack = await Track.findByIdAndUpdate(
                            trackId,
                            {
                                $set: {
                                    title: track.title,
                                    position: index + 1,
                                    audio_path: finalAudioPath,
                                    lyrics_file_path: finalLyricsPath,
                                    genre_id: safeId(data.primaryGenre),
                                    subgenre_id: safeId(data.secondaryGenre),
                                    display_artist: artistsArray,
                                    feature_artist: artistsArray,
                                    explicit: track.explicit ? 1 : 0,
                                    explicitConfirmation: track.explicitConfirmation ? 1 : 0,
                                    ownRightsConfirmation: track.ownRightsConfirmation ? 1 : 0,
                                    noOtherArtistName: track.noOtherArtistName ? 1 : 0,
                                    noOtherAlbumTitle: track.noOtherAlbumTitle ? 1 : 0,
                                    isrc_number: trackIsrc || null,
                                    have_isrc: trackIsrc ? 1 : 0,
                                    publisher: data.label || null,
                                    producer: track.producer || null,
                                    lyricist: track.lyricist || null,
                                    composer: track.composer || null,
                                    lyrics_text: track.lyrics_text || null,
                                    mix_version: track.mix_version || null,
                                    preview_start: track.preview_start || 0,
                                    c_line: track.c_line || null,
                                    c_line_year: track.c_line_year || null,
                                    p_line: track.p_line || null,
                                    p_line_year: track.p_line_year || null,
                                }
                            },
                            { returnDocument: 'after' }
                        );
                        savedTracks.push(updatedTrack);
                        newTrackIds.push(new mongoose.Types.ObjectId(trackId));
                    } else {
                        let trackIsrc = track.isrc_number;
                        if (!trackIsrc) {
                            trackIsrc = await generateNextCode(Track, "isrc_number");
                        }
                        const newTrack = await Track.create({
                            release_id: releaseId,
                            title: track.title,
                            position: index + 1,
                            audio_files: [track.name],
                            audio_path: audioPath,
                            lyrics_file_path: lyricsPath,
                            duration: formatDuration(track.duration),
                            genre_id: safeId(data.primaryGenre),
                            subgenre_id: safeId(data.secondaryGenre),
                            display_artist: artistsArray,
                            feature_artist: artistsArray,
                            explicit: track.explicit ? 1 : 0,
                            explicitConfirmation: track.explicitConfirmation ? 1 : 0,
                            ownRightsConfirmation: track.ownRightsConfirmation ? 1 : 0,
                            noOtherArtistName: track.noOtherArtistName ? 1 : 0,
                            noOtherAlbumTitle: track.noOtherAlbumTitle ? 1 : 0,
                            isrc_number: trackIsrc || null,
                            have_isrc: trackIsrc ? 1 : 0,
                            original_audio_name: track.name,
                            publisher: data.label || null,
                            producer: track.producer || null,
                            lyricist: track.lyricist || null,
                            composer: track.composer || null,
                            lyrics_text: track.lyrics_text || null,
                            mix_version: track.mix_version || null,
                            preview_start: track.preview_start || 0,
                            c_line: track.c_line || null,
                            c_line_year: track.c_line_year || null,
                            p_line: track.p_line || null,
                            p_line_year: track.p_line_year || null,
                        });
                        savedTracks.push(newTrack);
                        newTrackIds.push(newTrack._id);
                    }
                }
            }

            // Delete tracks not in the current list (Robust version)
            await Track.deleteMany({
                $or: [
                    { release_id: releaseId },
                    { release_id: mongoose.Types.ObjectId.isValid(releaseId) ? new mongoose.Types.ObjectId(releaseId) : null }
                ],
                _id: { $nin: newTrackIds }
            });

            return res.status(200).json({
                success: true,
                message: 'Release updated successfully',
                release: updateData,
                tracks: savedTracks,
            });
        } catch (err) {
            console.error('Error updating release:', err);
            return res.status(500).json({
                success: false,
                message: 'Server error while updating release',
                error: err.message,
            });
        }
    }
}

module.exports = new ReleaseController();
