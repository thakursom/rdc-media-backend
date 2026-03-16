const Release = require("../models/releaseModel");
const Track = require("../models/trackModel");
const Language = require("../models/languageModel");
const Label = require("../models/labelModel");
const Genre = require("../models/genreModel");
const SubGenre = require("../models/subGenreModel");
const User = require("../models/userModel");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");

const resolveDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;

    // Handle DD-MM-YYYY format specifically
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            // Assume DD-MM-YYYY
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed
            const year = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date;
        }
    }

    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
};

const bulkUploadRelease = async (req, res) => {
    console.log("--- Starting Bulk Release Upload Process ---");

    try {
        if (!req.file) {
            console.log("No file uploaded");
            return res.status(400).json({ success: false, message: "No ZIP file uploaded" });
        }

        console.log(`Received ZIP file: ${req.file.originalname}`);

        // Note: We need adm-zip but it might be missing
        let AdmZip;
        try {
            AdmZip = require("adm-zip");
        } catch (e) {
            console.error("CRITICAL ERROR: 'adm-zip' library is missing. Please run 'npm install adm-zip' in backend.");
            return res.status(500).json({
                success: false,
                message: "Backend missing dependency: adm-zip. Please contact admin."
            });
        }

        const filePath = req.file.path;
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();
        console.log(`Extracted ${zipEntries.length} entries from ZIP`);

        // Look for Excel file
        const excelEntry = zipEntries.find(entry => entry.entryName.endsWith(".xlsx") || entry.entryName.endsWith(".xls"));
        if (!excelEntry) {
            console.log("No metadata Excel file found in ZIP");
            return res.status(400).json({ success: false, message: "Metadata Excel file not found in ZIP" });
        }

        console.log(`Found Metadata Excel: ${excelEntry.entryName}`);

        // Parse Excel
        const workbook = XLSX.read(excelEntry.getData(), { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        console.log(`Parsed ${rows.length} rows from Excel`);

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: "Excel file is empty" });
        }

        // DEBUG: Log the headers found in the first row
        console.log("Excel Headers Found:", Object.keys(rows[0]));

        const findValue = (row, possibleKeys) => {
            const keys = Object.keys(row);
            for (const pKey of possibleKeys) {
                // Try exact match first
                let foundKey = keys.find(k => k.toLowerCase().trim() === pKey.toLowerCase().trim());
                if (foundKey) return row[foundKey];

                // Try "contains" match to handle (Required) or (Optional) suffixes
                foundKey = keys.find(k => {
                    const cleanK = k.toLowerCase().replace(/\(.*\)/, "").trim();
                    const cleanP = pKey.toLowerCase().replace(/\(.*\)/, "").trim();
                    return cleanK === cleanP || cleanK.includes(cleanP) || cleanP.includes(cleanK);
                });
                if (foundKey) return row[foundKey];
            }
            return null;
        };

        // Cache for resolving names to IDs
        const labelCache = {};
        const genreCache = {};
        const subGenreCache = {};
        const languageCache = {};

        const resolveLabel = async (name) => {
            if (!name) return null;
            const cleanName = String(name).trim();
            if (labelCache[cleanName]) return labelCache[cleanName];

            // 1. Check Label collection
            let label = await Label.findOne({ name: new RegExp(`^${cleanName}$`, "i") });
            if (label) {
                labelCache[cleanName] = label._id;
                return label._id;
            }

            // 2. Check User collection (role: Label)
            const userLabel = await User.findOne({ 
                role: "Label", 
                name: new RegExp(`^${cleanName}$`, "i") 
            });
            if (userLabel) {
                labelCache[cleanName] = userLabel._id;
                return userLabel._id;
            }

            return null;
        };

        const resolveGenre = async (title) => {
            if (!title) return null;
            const cleanTitle = String(title).trim();
            if (genreCache[cleanTitle]) return genreCache[cleanTitle];
            const genre = await Genre.findOne({ title: new RegExp(`^${cleanTitle}$`, "i") });
            if (genre) {
                genreCache[cleanTitle] = genre._id;
                return genre._id;
            }
            return null;
        };

        const resolveSubGenre = async (title) => {
            if (!title) return null;
            const cleanTitle = String(title).trim();
            if (subGenreCache[cleanTitle]) return subGenreCache[cleanTitle];
            const subGenre = await SubGenre.findOne({ title: new RegExp(`^${cleanTitle}$`, "i") });
            if (subGenre) {
                subGenreCache[cleanTitle] = subGenre._id;
                return subGenre._id;
            }
            return null;
        };

        const resolveLanguage = async (name) => {
            if (!name) return null;
            const cleanName = String(name).trim();
            if (languageCache[cleanName]) return languageCache[cleanName];
            const lang = await Language.findOne({ name: new RegExp(`^${cleanName}$`, "i") });
            if (lang) {
                languageCache[cleanName] = lang._id;
                return lang._id;
            }
            return null;
        };

        const uploadDir = path.join(__dirname, "../../public/uploads");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Log all files in ZIP for debugging if needed
        console.log("Files found in ZIP:");
        zipEntries.forEach(e => console.log(`  - ${e.entryName}`));

        const extractAsset = (name) => {
            if (!name) return null;
            const cleanName = String(name).trim();
            const cleanNameLower = cleanName.toLowerCase();

            // Search case-insensitively and ignore paths
            const entry = zipEntries.find(e => {
                const entryBasename = path.basename(e.entryName.replace(/\\/g, '/')).toLowerCase();
                return entryBasename === cleanNameLower || entryBasename === cleanNameLower.split('.')[0];
            });

            if (!entry) {
                console.log(`- Asset NOT found in ZIP: "${cleanName}"`);
                return null;
            }

            console.log(`- Found asset in ZIP: "${entry.entryName}" for "${cleanName}"`);
            const fileExt = path.extname(entry.entryName);
            const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
            const destPath = path.join(uploadDir, uniqueName);

            try {
                fs.writeFileSync(destPath, entry.getData());
                return { uniqueName, originalName: cleanName };
            } catch (err) {
                console.error(`- Failed to write asset to disk: ${destPath}`, err.message);
                return null;
            }
        };

        let createdCount = 0;
        let skipCount = 0;
        let errors = [];

        for (const row of rows) {
            try {
                const title = findValue(row, ["Release Title", "Title", "Name"]);
                if (!title) {
                    console.log("Skipping row: Missing Title. Row keys:", Object.keys(row));
                    skipCount++;
                    continue;
                }

                console.log(`Processing Release: ${title}`);

                const labelName = findValue(row, ["Label", "Label Name", "Label (Required)", "Label(Required)", "Label (Rquired)"]);
                const genreName = findValue(row, ["Main Genre", "Primary Genre", "Genre", "Track Main Genre"]);
                const subGenreName = findValue(row, ["Sub Genre", "Secondary Genre", "SubGenre", "Track Sub Genre"]);
                const langName = findValue(row, ["Meta Language", "Content Language", "Language", "Metalanguage"]);
                const dateVal = findValue(row, ["Release Date", "ReleaseDate", "Date"]);
                const artistVal = findValue(row, ["Display Artist", "Artist", "Main Artist"]);
                const artworkName = findValue(row, ["Art Work Name", "Artwork", "Image", "Cover Art"]);

                const labelId = await resolveLabel(labelName);
                const genreId = await resolveGenre(genreName);
                const subGenreId = await resolveSubGenre(subGenreName);
                const languageId = await resolveLanguage(langName);
                const releaseDate = resolveDate(dateVal);

                const artistArray = artistVal ? String(artistVal).split(',').map(a => a.trim()).filter(a => a) : [];

                const artworkAsset = extractAsset(artworkName);

                const releaseData = {
                    title: title,
                    display_artist: artistArray,
                    upc_number: findValue(row, ["UPC", "UPC (Optional)", "UPCNumber", "Barcode"]),
                    cat_number: findValue(row, ["Cat Number", "CatalogueNo", "CatNo", "Catalogue_No"]),
                    status: 'processing',
                    create_type: "Pending",
                    release_type: findValue(row, ["ReleaseType", "Release Type"]),
                    label_id: labelId,
                    genre_id: genreId,
                    subgenre_id: subGenreId,
                    language_id: languageId,
                    release_date: releaseDate,
                    artwork: artworkAsset ? artworkAsset.uniqueName : null,
                    artwork_path: artworkAsset ? `/public/uploads/${artworkAsset.uniqueName}` : null,
                    p_line: findValue(row, ["P Line"]),
                    p_line_year: findValue(row, ["P Line Year"]),
                    c_line: findValue(row, ["C Line"]),
                    c_line_year: findValue(row, ["C Line Year"]),
                    description: findValue(row, ["Release Description", "Description"]),
                    created_at: new Date(),
                    updated_at: new Date(),
                    created_by: req.user?.userId || req.user?._id || null
                };

                const newRelease = await Release.create(releaseData);
                console.log(`- Created Release entry (ID: ${newRelease._id}) ${artworkAsset ? '[with artwork]' : ''}`);

                const trackTitle = findValue(row, ["Track Title", "TrackTitle", "Song Title", "TrackName"]);
                if (trackTitle) {
                    const trackArtistVal = findValue(row, ["Track Display Artist", "Artist"]);
                    const trackArtistArray = trackArtistVal ? String(trackArtistVal).split(',').map(a => a.trim()).filter(a => a) : [];
                    const audioFileName = findValue(row, ["Audio File", "Audio", "Track File"]);

                    const audioAsset = extractAsset(audioFileName);
                    if (audioFileName && !audioAsset) console.log(`Warning: Audio file "${audioFileName}" not found in ZIP`);

                    await Track.create({
                        release_id: newRelease._id,
                        title: trackTitle,
                        display_artist: trackArtistArray,
                        position: findValue(row, ["Track#"]) || 1,
                        isrc_number: findValue(row, ["ISRC", "ISRC (Optional)", "ISRCNumber"]),
                        duration: findValue(row, ["Duration", "Length", "Time"]) || '0:00',
                        composer: findValue(row, ["Composer"]),
                        lyricist: findValue(row, ["Lyricist"]),
                        producer: findValue(row, ["Producer"]),
                        audio_files: audioAsset ? [audioAsset.uniqueName] : [],
                        audio_path: audioAsset ? `/public/uploads/${audioAsset.uniqueName}` : null,
                        original_audio_name: audioAsset ? audioAsset.originalName : null
                    });
                    console.log(`- Created Track entry for release ${newRelease._id} ${audioAsset ? '[with audio]' : ''}`);
                }

                createdCount++;
            } catch (err) {
                console.error(`Error processing row for ${row.Title}:`, err.message);
                errors.push({ row: row.Title, error: err.message });
            }
        }

        console.log(`--- Bulk Upload Finished ---`);
        console.log(`Total Created: ${createdCount}, Skipped: ${skipCount}, Errors: ${errors.length}`);

        return res.status(200).json({
            success: true,
            message: `Bulk release processed. Created: ${createdCount}, Errors: ${errors.length}`,
            data: { createdCount, errors }
        });

    } catch (err) {
        console.error("Bulk upload failed:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error during bulk upload",
            error: err.message
        });
    }
};

module.exports = { bulkUploadRelease };
