const User = require("../models/userModel");
const ResponseService = require("../services/responseService");
const bcrypt = require("bcryptjs");



class UserController {

    // Get all users with pagination and search
    async getUsers(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;
            const { search, role, id } = req.query;

            let query = {};
            if (id) {
                query._id = id;
            }
            if (role) {
                query.role = role;
            }
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { third_party_username: { $regex: search, $options: "i" } }
                ];
            }

            const totalDocs = await User.countDocuments(query);
            const users = await User.find(query)
                .select("-password")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            return res.status(200).json({
                success: true,
                message: "Users fetched successfully",
                data: users,
                pagination: {
                    totalDocs,
                    totalPages: Math.ceil(totalDocs / limit),
                    currentPage: page,
                    limit
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Create User
    async createUser(req, res, next) {
        try {
            const { name, email, phone, password, role, third_party_username, parent_id } = req.body;

            if (!name || !email || !password || !role) {
                return ResponseService.error(res, "Required fields are missing", 400);
            }

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return ResponseService.error(res, "User with this email already exists", 400);
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            let assigned_parent_id = null;
            if (role === "Sub User") {
                assigned_parent_id = parent_id || req.user?.userId;
            }

            const newUser = new User({
                name,
                email,
                phone,
                password: hashedPassword,
                role,
                third_party_username,
                parent_id: assigned_parent_id
            });

            await newUser.save();

            const userResponse = newUser.toObject();
            delete userResponse.password;

            return ResponseService.success(res, "User created successfully", { user: userResponse });
        } catch (error) {
            next(error);
        }
    }

    // Update User
    async updateUser(req, res, next) {
        try {
            const { id } = req.params;
            const { name, email, phone, password, role, third_party_username, parent_id } = req.body;

            let user = await User.findById(id);

            if (!user) {
                return ResponseService.error(res, "User not found", 404);
            }

            if (email && email !== user.email) {
                const emailExists = await User.findOne({ email });
                if (emailExists) return ResponseService.error(res, "Email already in use", 400);
            }

            const updateData = { name, email, phone, role, third_party_username };
            if (role === "Sub User") {
                if (parent_id) updateData.parent_id = parent_id;
            } else {
                updateData.parent_id = null;
            }
            if (password) {
                updateData.password = await bcrypt.hash(password, 10);
            }

            const updatedUser = await User.findByIdAndUpdate(
                user._id,
                { $set: updateData },
                { new: true }
            ).select("-password");

            return ResponseService.success(res, "User updated successfully", { user: updatedUser });
        } catch (error) {
            next(error);
        }
    }

    // Delete User
    async deleteUser(req, res, next) {
        try {
            const { id } = req.params;

            let user = await User.findById(id);

            if (!user) {
                return ResponseService.error(res, "User not found", 404);
            }

            await User.findByIdAndDelete(user._id);
            return ResponseService.success(res, "User deleted successfully");
        } catch (error) {
            next(error);
        }
    }

    //fetchAllLabels method
    async fetchAllLabels(req, res, next) {
        try {
            const { search } = req.query;

            let query = { role: "Label" };
            if (search) {
                query.name = { $regex: search, $options: "i" };
            }

            const labels = await User.find(query)
                .select("_id name parent_id amount");

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
                .select("_id name parent_id");

            return ResponseService.success(res, "Labels fetched successfully", { labels });

        } catch (error) {
            next(error);
        }
    }

    // Toggle user approval status
    async toggleApprove(req, res, next) {
        try {
            const { id } = req.params;

            let user = await User.findById(id);

            if (!user) return ResponseService.error(res, "User not found", 404);

            user.isApproved = user.isApproved === 1 ? 0 : 1;
            await user.save();

            const status = user.isApproved === 1 ? "approved" : "rejected";
            return ResponseService.success(res, `User ${status} successfully`, { user });
        } catch (error) {
            next(error);
        }
    }

    // Toggle user lock status
    async toggleLock(req, res, next) {
        try {
            const { id } = req.params;

            let user = await User.findById(id);

            if (!user) return ResponseService.error(res, "User not found", 404);

            user.isLocked = user.isLocked === 1 ? 0 : 1;
            // If unlocking (setting to 1), reset login attempts
            if (user.isLocked === 1) {
                user.loginAttempts = 0;
            }
            await user.save();

            const status = user.isLocked === 1 ? "unlocked" : "locked";
            return ResponseService.success(res, `User ${status} successfully`, { user });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();
