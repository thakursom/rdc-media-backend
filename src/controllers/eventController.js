const Event = require("../models/eventModel");
const TrackEventAssignment = require("../models/trackEventAssignmentModel");
const Track = require("../models/trackModel");
const Release = require("../models/releaseModel");
const xlsx = require("xlsx");
const Joi = require("joi");



class EventController {
    // CRUD for Events (Master Data)
    async createEvent(req, res) {
        try {
            const schema = Joi.object({
                title: Joi.string().required(),
                eventDate: Joi.date().required(),
                description: Joi.string().allow(null, ''),
                status: Joi.string().valid('Active', 'Inactive').default('Active')
            });

            const { error } = schema.validate(req.body);
            if (error) return res.status(400).json({ success: false, message: error.details[0].message });

            const newEvent = await Event.create({ ...req.body });

            res.status(201).json({ success: true, data: newEvent });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    async getEvents(req, res) {
        try {
            const { page = 1, limit = 10, search = '', status = 'All' } = req.query;
            const query = {};
            if (search) query.title = { $regex: search, $options: 'i' };
            if (status !== 'All') query.status = status;

            const events = await Event.find(query)
                .sort({ eventDate: -1 })
                .skip((page - 1) * limit)
                .limit(parseInt(limit));

            const totalDocs = await Event.countDocuments(query);

            res.status(200).json({
                success: true,
                data: events,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    async getEventById(req, res) {
        try {
            const event = await Event.findById(req.params.id);
            if (!event) return res.status(404).json({ message: 'Event not found' });
            res.status(200).json({ success: true, data: event });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    async updateEvent(req, res) {
        try {
            const event = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!event) return res.status(404).json({ message: 'Event not found' });
            res.status(200).json({ success: true, data: event });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    async deleteEvent(req, res) {
        try {
            const event = await Event.findByIdAndDelete(req.params.id);
            if (!event) return res.status(404).json({ message: 'Event not found' });
            res.status(200).json({ success: true, message: "Event deleted successfully" });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // Track Event Assignments
    async getTrackEventAssignments(req, res) {
        try {
            const { page = 1, limit = 10, search = '' } = req.query;
            const skip = (page - 1) * limit;

            // This is complex as we need to join Track, Release, and Event
            // For now, let's just return a placeholder or implement basic aggregation
            // In a real scenario, we might want to search by track title or release title

            const aggregation = [
                {
                    $lookup: {
                        from: "tracks",
                        let: { tid: "$trackId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$tid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$tid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "track"
                    }
                },
                { $unwind: "$track" },
                {
                    $lookup: {
                        from: "releases",
                        let: { rid: "$releaseId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$rid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$rid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "release"
                    }
                },
                { $unwind: "$release" },
                {
                    $lookup: {
                        from: "events",
                        let: { eid: "$eventId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$eid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$eid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "event"
                    }
                },
                { $unwind: "$event" }
            ];

            if (search) {
                aggregation.push({
                    $match: {
                        $or: [
                            { "track.title": { $regex: search, $options: 'i' } },
                            { "release.title": { $regex: search, $options: 'i' } },
                            { "event.title": { $regex: search, $options: 'i' } }
                        ]
                    }
                });
            }

            aggregation.push(
                { $sort: { assignedDate: -1 } },
                { $skip: skip },
                { $limit: parseInt(limit) },
                {
                    $project: {
                        id: 1,
                        trackTitle: "$track.title",
                        releaseTitle: "$release.title",
                        eventTitle: "$event.title",
                        assignedDate: 1,
                        eventDate: "$event.eventDate"
                    }
                }
            );

            const data = await TrackEventAssignment.aggregate(aggregation);
            const totalDocs = await TrackEventAssignment.countDocuments(); // Simple count for pagination

            res.status(200).json({
                success: true,
                data: data,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: parseInt(page),
                    limit: parseInt(limit)
                }
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    async assignEventsToTrack(req, res) {
        try {
            const schema = Joi.object({
                trackId: Joi.any().required(),
                releaseId: Joi.any().required(),
                eventIds: Joi.array().items(Joi.any()).required()
            });

            const { error } = schema.validate(req.body);
            if (error) return res.status(400).json({ success: false, message: error.details[0].message });

            const { trackId, releaseId, eventIds } = req.body;

            // Remove existing assignments for this track to avoid duplicates or handles updates
            await TrackEventAssignment.deleteMany({ trackId });

            const assignments = [];
            for (const eventId of eventIds) {
                assignments.push({
                    trackId,
                    releaseId,
                    eventId,
                    assignedDate: new Date()
                });
            }

            if (assignments.length > 0) {
                await TrackEventAssignment.insertMany(assignments);
            }

            res.status(200).json({ success: true, message: "Events assigned successfully" });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    async exportTrackEventAssignments(req, res) {
        try {
            const { search = '' } = req.query;

            const aggregation = [
                {
                    $lookup: {
                        from: "tracks",
                        let: { tid: "$trackId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$tid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$tid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "track"
                    }
                },
                { $unwind: "$track" },
                {
                    $lookup: {
                        from: "releases",
                        let: { rid: "$releaseId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$rid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$rid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "release"
                    }
                },
                { $unwind: "$release" },
                {
                    $lookup: {
                        from: "events",
                        let: { eid: "$eventId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$_id", "$$eid"] },
                                            { $eq: ["$_id", { $convert: { input: "$$eid", to: "objectId", onError: null, onNull: null } }] }
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "event"
                    }
                },
                { $unwind: "$event" }
            ];

            if (search) {
                aggregation.push({
                    $match: {
                        $or: [
                            { "track.title": { $regex: search, $options: 'i' } },
                            { "release.title": { $regex: search, $options: 'i' } },
                            { "event.title": { $regex: search, $options: 'i' } }
                        ]
                    }
                });
            }

            aggregation.push(
                { $sort: { assignedDate: -1 } },
                {
                    $project: {
                        "Track Title": "$track.title",
                        "Release Title": "$release.title",
                        "Event Title": "$event.title",
                        "Assigned Date": "$assignedDate",
                        "Event Date": "$event.eventDate"
                    }
                }
            );

            const data = await TrackEventAssignment.aggregate(aggregation);

            if (!data || data.length === 0) {
                return res.status(404).json({ success: false, message: "No assignments found to export" });
            }

            // Clean up data for Excel
            const exportData = data.map((item, index) => ({
                "SN": index + 1,
                "Track Title": item["Track Title"],
                "Release Title": item["Release Title"],
                "Assigned Events": item["Event Title"],
                "Assigned Date": new Date(item["Assigned Date"]).toLocaleDateString(),
                "Event Date": new Date(item["Event Date"]).toLocaleDateString()
            }));

            const worksheet = xlsx.utils.json_to_sheet(exportData);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Assignments");

            const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=track-event-assignments.xlsx');

            return res.send(buffer);
        } catch (err) {
            console.error("Export error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
}

module.exports = new EventController();
