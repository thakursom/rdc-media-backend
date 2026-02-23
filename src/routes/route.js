const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require("../middlewares/authMiddleware");
const releaseController = require("../controllers/releaseController");
const artistController = require("../controllers/artistController");
const userController = require("../controllers/userController");


const genreController = require("../controllers/genreController");
const languageController = require("../controllers/languageController");
const dspController = require("../controllers/dspController");


//Auth Apis
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);
router.post("/change-password", authMiddleware, authController.changePassword);

const upload = require("../middlewares/uploadMiddleware");

//Release Apis
router.post("/create-release", authMiddleware, upload.fields([
    { name: 'artwork', maxCount: 1 },
    { name: 'trackFiles', maxCount: 20 },
    { name: 'lyricsFiles', maxCount: 20 } // In case we support multiple lyrics files
]), releaseController.createRelease);

//Artist Apis
router.post("/create-artist", authMiddleware, artistController.createArtist);
router.get("/artists", authMiddleware, artistController.getArtists);
router.get("/artist/:id", authMiddleware, artistController.getArtistById);

//User Apis
router.get("/labels", authMiddleware, userController.fetchAllLabels);
router.get("/sublabels", authMiddleware, userController.fetchAllSubLabel);

// Genre Apis
router.get("/genres", authMiddleware, genreController.getGenres);
router.get("/subgenres", authMiddleware, genreController.getSubGenres);
router.post("/create-genre", authMiddleware, genreController.createGenre);
router.post("/create-subgenre", authMiddleware, genreController.createSubGenre);

// Language Apis
router.get("/languages", authMiddleware, languageController.getLanguages);
router.post("/create-language", authMiddleware, languageController.createLanguage);

// DSP Apis
router.get("/dsps", authMiddleware, dspController.getDSPs);
router.post("/create-dsp", authMiddleware, dspController.createDSP);


module.exports = router;
