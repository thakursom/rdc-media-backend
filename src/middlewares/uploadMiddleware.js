const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../../public/uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// Read first N bytes of a file synchronously to check magic bytes
function readMagicBytes(filePath, numBytes) {
    const buf = Buffer.alloc(numBytes);
    let fd;
    try {
        fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, numBytes, 0);
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
    }
    return buf;
}

// ─── IMAGE magic bytes ───────────────────────────────────────────────────────
function isRealImage(filePath) {
    try {
        const bytes = readMagicBytes(filePath, 8);
        // JPEG: FF D8 FF
        const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
        return isJpeg;
    } catch {
        return false;
    }
}

// ─── AUDIO magic bytes ───────────────────────────────────────────────────────
function isRealAudio(filePath) {
    try {
        const bytes = readMagicBytes(filePath, 12);
        // MP3 with ID3 tag: 49 44 33 ("ID3")
        const isMP3_ID3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
        // MP3 raw frame sync: FF FB | FF F3 | FF F2
        const isMP3_Raw = bytes[0] === 0xFF && (bytes[1] === 0xFB || bytes[1] === 0xF3 || bytes[1] === 0xF2);
        // WAV: "RIFF" at 0-3, "WAVE" at 8-11
        const isWAV = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
            && bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
        return isMP3_ID3 || isMP3_Raw || isWAV;
    } catch {
        return false;
    }
}

// ─── Middleware: validate any image ────────────────────────────────────────────
const validateImageMagicBytes = (req, res, next) => {
    let filesToCheck = [];
    if (req.file && (req.file.mimetype.startsWith('image/') || req.file.fieldname === 'artwork' || req.file.fieldname === 'artist_image' || req.file.fieldname === 'newsletter_image' || req.file.fieldname === 'rejection_file' || req.file.fieldname === 'file')) {
        filesToCheck.push(req.file);
    }
    if (req.files) {
        Object.values(req.files).flat().forEach(file => {
             if (file.mimetype && (file.mimetype.startsWith('image/') || file.fieldname === 'artwork' || file.fieldname === 'artist_image' || file.fieldname === 'newsletter_image' || file.fieldname === 'rejection_file' || file.fieldname === 'file')) {
                 filesToCheck.push(file);
             }
        });
    }

    const fakeFiles = [];
    for (const file of filesToCheck) {
        if (!isRealImage(file.path)) {
            fakeFiles.push(file.originalname);
            try { fs.unlinkSync(file.path); } catch { }
        }
    }

    if (fakeFiles.length > 0) {
        // Clean up everything else to be safe
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
        if (req.files) {
            Object.values(req.files).flat().forEach(f => {
                try { fs.unlinkSync(f.path); } catch {}
            });
        }
        return res.status(400).json({
            success: false,
            message: "Only valid JPG and JPEG images are allowed. Renaming a file's extension to bypass is not allowed."
        });
    }

    next();
};

// ─── Middleware: validate track audio files ──────────────────────────────────
const validateTrackMagicBytes = (req, res, next) => {
    const trackFiles = req.files?.trackFiles || [];
    if (trackFiles.length === 0) return next();

    const fakeFiles = [];
    for (const track of trackFiles) {
        if (!isRealAudio(track.path)) {
            fakeFiles.push(track.originalname);
            try { fs.unlinkSync(track.path); } catch { }
        }
    }

    if (fakeFiles.length > 0) {
        // Also clean up any artwork that was uploaded in the same request
        const artwork = req.files?.artwork?.[0];
        if (artwork) try { fs.unlinkSync(artwork.path); } catch { }

        return res.status(400).json({
            success: false,
            message: `Invalid track file(s): ${fakeFiles.join(', ')}. Only real MP3 or WAV audio files are accepted. Renaming a file's extension is not allowed.`
        });
    }

    next();
};

// ─── Multer instance ─────────────────────────────────────────────────────────
const upload = multer({
    storage: storage,
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
    fileFilter: (req, file, cb) => {
        // Global restriction for images
        if (file.mimetype.startsWith("image/") || file.fieldname === "artwork" || file.fieldname === "artist_image" || file.fieldname === "newsletter_image" || file.fieldname === "rejection_file" || file.fieldname === "file") {
            const allowedMimeTypes = ["image/jpeg", "image/jpg"];
            // Also check file extension roughly to prevent purely extension mismatched uploads
            const extName = path.extname(file.originalname).toLowerCase();
            const allowedExtensions = [".jpg", ".jpeg"];
            
            if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(extName)) {
                return cb(new Error("Only valid JPG and JPEG images are allowed."), false);
            }
        }
        if (file.fieldname === "trackFiles") {
            if (!file.mimetype.startsWith("audio/")) {
                return cb(new Error("Only audio files are allowed for tracks!"), false);
            }
        }
        if (file.fieldname === "lyricsFiles") {
            const extName = path.extname(file.originalname).toLowerCase();
            const allowedLyricsExtensions = [".txt"];
            if (!allowedLyricsExtensions.includes(extName)) {
                return cb(new Error("Only .txt files are allowed for lyrics."), false);
            }
        }
        cb(null, true);
    }
});

// ─── Middleware: validate document files ─────────────────────────────────────
const validateDocumentContent = (req, res, next) => {
    let filesToCheck = [];
    if (req.file && path.extname(req.file.originalname).toLowerCase() === '.txt') {
        filesToCheck.push(req.file);
    }
    if (req.files) {
        Object.values(req.files).flat().forEach(file => {
            if (path.extname(file.originalname).toLowerCase() === '.txt') {
                filesToCheck.push(file);
            }
        });
    }

    const fakeFiles = [];
    for (const file of filesToCheck) {
        try {
            const content = fs.readFileSync(file.path, 'utf8');
            
            // Check for binary null bytes
            if (content.indexOf('\x00') !== -1) {
                fakeFiles.push(file.originalname);
                fs.unlinkSync(file.path);
                continue;
            }

            // Check if it's specifically disguised structured JSON
            try {
                const parsed = JSON.parse(content);
                if (typeof parsed === 'object' && parsed !== null) {
                    fakeFiles.push(file.originalname);
                    fs.unlinkSync(file.path);
                    continue;
                }
            } catch (e) {
                // Not JSON, which is expected for genuine plain text
            }
        } catch {
            fakeFiles.push(file.originalname);
            try { fs.unlinkSync(file.path); } catch { }
        }
    }

    if (fakeFiles.length > 0) {
        // Clean up everything else to be safe
        if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
        if (req.files) {
            Object.values(req.files).flat().forEach(f => {
                try { fs.unlinkSync(f.path); } catch {}
            });
        }
        return res.status(400).json({
            success: false,
            message: "Invalid file(s) detected. Only genuine plain text (.txt) files are allowed. Disguised JSON or binary files are strictly rejected."
        });
    }

    next();
};

module.exports = { upload, validateImageMagicBytes, validateTrackMagicBytes, validateDocumentContent };

