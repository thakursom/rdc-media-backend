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
        // PNG:  89 50 4E 47 0D 0A 1A 0A
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
            && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A;
        return isJpeg || isPng;
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

// ─── Middleware: validate artwork ────────────────────────────────────────────
const validateArtworkMagicBytes = (req, res, next) => {
    const artworkFile = req.files?.artwork?.[0] || (req.file?.fieldname === 'artwork' ? req.file : null);
    if (!artworkFile) return next();

    if (!isRealImage(artworkFile.path)) {
        try { fs.unlinkSync(artworkFile.path); } catch { }
        return res.status(400).json({
            success: false,
            message: "Invalid artwork file. Only real JPEG or PNG images are accepted. Renaming a file's extension is not allowed."
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
        if (file.fieldname === "artwork") {
            if (!file.mimetype.startsWith("image/")) {
                return cb(new Error("Only image files are allowed for artwork!"), false);
            }
        }
        if (file.fieldname === "trackFiles") {
            if (!file.mimetype.startsWith("audio/")) {
                return cb(new Error("Only audio files are allowed for tracks!"), false);
            }
        }
        cb(null, true);
    }
});

module.exports = { upload, validateArtworkMagicBytes, validateTrackMagicBytes };

