const User = require("../models/userModel");
const ResponseService = require("../services/responseService");

class UserController {

    constructor() { }


    //fetchAllLabels method
    async fetchAllLabels(req, res, next) {
        try {
            const { search } = req.query;

            let query = { role: "Label" };
            if (search) {
                query.name = { $regex: search, $options: "i" };
            }

            const labels = await User.find(query)
                .select("_id id name parent_id amount");

            return ResponseService.success(res, "Label fetched successfully", { labels });

        } catch (error) {
            next(error);
        }
    }

    //fetchAllSubLabel method
    async fetchAllSubLabel(req, res, next) {
        try {

            const { userId } = req.user;

            const { search } = req.query;

            let query = { parent_id: userId };

            if (search) {
                query.name = { $regex: search, $options: "i" };
            }

            const labels = await User.find(query)
                .select("_id id name parent_id");

            return ResponseService.success(res, "Labels fetched successfully", { labels });

        } catch (error) {
            next(error);
        }
    }



}

module.exports = new UserController();
