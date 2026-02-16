const Release = require("../models/releaseModel");
const Track = require("../models/trackModel");
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
                // releaseType: Joi.string().required(),
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
                releaseArtists: Joi.array().items(Joi.string()).min(1).required(),
                tracks: Joi.array().items(
                    Joi.object({
                        title: Joi.string().required(),
                        artists: Joi.array().items(Joi.string()).min(1).required(),
                        duration: Joi.number().required(),
                        explicit: Joi.alternatives().try(Joi.number(), Joi.string(), Joi.boolean()).optional().allow(null, 0, '0', false),
                        producer: Joi.string().optional().allow(null, ''),
                        lyricist: Joi.string().optional().allow(null, ''),
                        composer: Joi.string().optional().allow(null, ''),
                        lyrics: Joi.string().optional().allow(null, ''),
                        version: Joi.string().optional().allow(null, ''),
                        isrc: Joi.string().optional().allow(null, ''),
                        hasNewAudioFile: Joi.boolean().optional(),
                        hasNewLyricsFile: Joi.boolean().optional(),
                        name: Joi.string().optional().allow(null, '')
                    }).unknown(true)
                ).min(1).required()
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

            // Construct Base URL
            const baseUrl = process.env.BASE_URL;
            const getFileUrl = (filename) => filename ? `${baseUrl}/public/uploads/${filename}` : null;

            console.log("data", data);
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
                isrc: isrcNumber || null,
                upc_number: upcNumber || null,
                cat_number: data.catalogueNo || null,
                parental_warning_type: data.parentalWarning || '0',
                description: data.description || null,
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

                const trackPromises = data.tracks.map(async (track, index) => {
                    try {
                        const trackId = await getNextId(Track);

                        console.log("Creating track:", track.name);

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

                        return await Track.create({
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
                            isrc_number: track.isrc || null,
                            have_isrc: track.isrc ? 1 : 0,
                            original_audio_name: track.name,
                            publisher: data.label || null,
                            producer: track.producer || null,
                            lyricist: track.lyricist || null,
                            composer: track.composer || null,
                            lyrics_text: track.lyrics || null,
                            mix_version: track.version || null,
                        });

                    } catch (err) {
                        console.error("Track creation failed:", err);
                        throw err;
                    }
                });

                savedTracks = await Promise.all(trackPromises);
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


}

module.exports = new ReleaseController();