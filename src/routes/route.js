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
const fileController = require("../controllers/fileController");
const countryController = require("../controllers/countryController");
const upcController = require("../controllers/upcController");
const labelController = require("../controllers/labelController");

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
router.put("/update-artist/:id", authMiddleware, artistController.updateArtist);
router.delete("/delete-artist/:id", authMiddleware, artistController.deleteArtist);
router.post("/upload-image", authMiddleware, upload.single("artist_image"), fileController.uploadImage);
router.post("/create-release-artist", authMiddleware, artistController.createReleaseArtist);
router.get("/release-artists", authMiddleware, artistController.getReleaseArtists);
router.get("/release-artist/:id", authMiddleware, artistController.getReleaseArtistById);

//User Apis
router.get("/users", authMiddleware, userController.getUsers);
router.post("/create-user", authMiddleware, userController.createUser);
router.put("/update-user/:id", authMiddleware, userController.updateUser);
router.delete("/delete-user/:id", authMiddleware, userController.deleteUser);
router.get("/labels", authMiddleware, userController.fetchAllLabels);
router.get("/sublabels", authMiddleware, userController.fetchAllSubLabel);

// Genre Apis
router.get("/genres", authMiddleware, genreController.getGenres);
router.get("/subgenres", authMiddleware, genreController.getSubGenres);
router.post("/create-genre", authMiddleware, genreController.createGenre);
router.put("/update-genre/:id", authMiddleware, genreController.updateGenre);
router.delete("/delete-genre/:id", authMiddleware, genreController.deleteGenre);
router.post("/create-subgenre", authMiddleware, genreController.createSubGenre);
router.put("/update-subgenre/:id", authMiddleware, genreController.updateSubGenre);
router.delete("/delete-subgenre/:id", authMiddleware, genreController.deleteSubGenre);
router.get("/release-genres", authMiddleware, genreController.getReleaseGenres);
router.get("/release-subgenres", authMiddleware, genreController.getReleaseSubGenres);

// Language Apis
router.get("/languages", authMiddleware, languageController.getLanguages);
router.post("/create-language", authMiddleware, languageController.createLanguage);

// DSP Apis
router.get("/dsps", authMiddleware, dspController.getDSPs);
router.post("/create-dsp", authMiddleware, dspController.createDSP);
router.put("/update-dsp/:id", authMiddleware, dspController.updateDSP);
router.delete("/delete-dsp/:id", authMiddleware, dspController.deleteDSP);
router.get("/release-dsps", authMiddleware, dspController.getReleaseDSPs);

// Country Apis
router.get("/countries", authMiddleware, countryController.getCountries);
router.post("/create-country", authMiddleware, countryController.createCountry);
router.put("/update-country/:id", authMiddleware, countryController.updateCountry);
router.delete("/delete-country/:id", authMiddleware, countryController.deleteCountry);

// Label Apis (New Dedicated Table)
router.get("/all-labels", authMiddleware, labelController.getLabels);
router.post("/create-label", authMiddleware, labelController.createLabel);
router.put("/update-label/:id", authMiddleware, labelController.updateLabel);
router.delete("/delete-label/:id", authMiddleware, labelController.deleteLabel);

// UPC Apis
router.get("/upcs", authMiddleware, upcController.getUPCs);
router.post("/upload-upc", authMiddleware, upload.single("file"), upcController.uploadUPC);
router.put("/update-upc-status/:id", authMiddleware, upcController.updateUPCStatus);
router.put("/update-upc/:id", authMiddleware, upcController.updateUPC);
router.delete("/delete-upc/:id", authMiddleware, upcController.deleteUPC);
router.get("/export-upc", authMiddleware, upcController.exportUPC);

module.exports = router;
