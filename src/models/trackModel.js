const mongoose = require("mongoose");

const TrackSchema = new mongoose.Schema({

    release_id: {
        type: String,
        default: null
    },
    serial_number: {
        type: String,
        default: null
    },
    position: {
        type: Number,
        default: null
    },
    disc: {
        type: Number,
        default: null
    },

    crbt_time: {
        type: String,
        default: null
    },
    crbt_seconds_total: {
        type: Number,
        default: 0
    },

    artists: {
        type: [String],
        default: []
    }, // "_id" strings or names
    display_artist: {
        type: [String],
        default: []
    },
    feature_artist: {
        type: [String],
        default: []
    },

    title: {
        type: String,
        required: true
    },

    mix_version: {
        type: String,
        default: null
    },
    remixer: {
        type: String,
        default: null
    },
    is_remix: {
        type: Number,
        default: 0
    },

    orchestra: {
        type: String,
        default: null
    },
    arranger: {
        type: String,
        default: null
    },
    actor: {
        type: String,
        default: null
    },
    conductor: {
        type: String,
        default: null
    },
    composer: {
        type: String,
        default: null
    },
    producer: {
        type: String,
        default: null
    },
    lyricist: {
        type: String,
        default: null
    },

    genre_id: {
        type: String,
        default: null
    },
    subgenre_id: {
        type: String,
        default: null
    },

    publisher: {
        type: String,
        default: null
    },
    contributors: {
        type: String,
        default: null
    },

    have_isrc: {
        type: Number,
        default: 0
    },
    isrc_number: {
        type: String,
        default: null
    },

    is_dolby: {
        type: Number,
        default: 0
    },
    dolby_isrc: {
        type: String,
        default: null
    },
    dolby_audio: {
        type: String,
        default: null
    },

    track_lyrics: {
        type: String,
        default: null
    },
    lyrics_text: {
        type: String,
        default: null
    },

    sold_with_album: {
        type: Number,
        default: 0
    },
    explicit: {
        type: Number,
        default: 0
    },
    explicitConfirmation: {
        type: Number,
        default: 0
    },
    ownRightsConfirmation: {
        type: Number,
        default: 0
    },
    noOtherArtistName: {
        type: Number,
        default: 0
    },
    noOtherAlbumTitle: {
        type: Number,
        default: 0
    },

    preview_start: {
        type: Number,
        default: 0
    },
    c_line: {
        type: String,
        default: null
    },
    c_line_year: {
        type: String,
        default: null
    },
    p_line: {
        type: String,
        default: null
    },
    p_line_year: {
        type: String,
        default: null
    },

    start_time: {
        type: String,
        default: null
    },
    end_time: {
        type: String,
        default: null
    },

    price: {
        type: Number,
        default: null
    },

    audio_files: {
        type: [String],
        default: []
    },
    crbt_clip: {
        type: String,
        default: null
    },
    original_audio_name: {
        type: String,
        default: null
    },

    duration: {
        type: String,
        default: null
    },
    audio_path: {
        type: String,
        default: null
    },
    lyrics_file_path: {
        type: String,
        default: null
    },
},
    {
        timestamps: true,
        versionKey: false,
    }
);

module.exports = mongoose.model("Track", TrackSchema);
