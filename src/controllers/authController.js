const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const ResponseService = require("../services/responseService");
const sendEmail = require("../utils/sendEmail");
const User = require("../models/userModel");

class AuthController {

    constructor() { }

    //login method
    async login(req, res) {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ email });
            if (!user) {
                return ResponseService.error(res, "User not found", 404);
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return ResponseService.error(res, "Invalid password", 400);
            }

            const token = jwt.sign(
                {
                    _id: user._id,
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return ResponseService.success(res, "Login successful", {
                token,
                user: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    userId: user.id
                }
            });

        } catch (error) {

            return ResponseService.error(res, "Login failed", 500, error);
        }
    }

    //forgotPassword method
    async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            const user = await User.findOne({ email });
            if (!user) return ResponseService.error(res, "User not found", 404);

            // create secure token
            const resetToken = crypto.randomBytes(32).toString("hex");
            const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

            user.resetToken = hashedToken;
            user.resetTokenExpire = Date.now() + 15 * 60 * 1000; // 15 min

            await user.save();

            // You will email this link in real apps
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
            console.log(resetUrl);


            // Send Email
            await sendEmail(
                'tripathipawan1187@gmail.com',
                "Password Reset Request",
                `
                <h3>Password Reset Requested</h3>
                <p>Click below to reset your password:</p>
                <a href="${resetUrl}" style="color:blue">${resetUrl}</a>
                <br><br>
                <b>Note:</b> Link is valid for 15 minutes.
                `
            );


            return ResponseService.success(res, "Reset link sent to email", {});
        } catch (error) {
            return ResponseService.error(res, "Failed to generate reset link", 500, error);
        }
    }


    //resetPassword method
    async resetPassword(req, res) {
        try {
            const { token } = req.params;
            const { newPassword } = req.body;

            const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

            const user = await User.findOne({
                resetToken: hashedToken,
                resetTokenExpire: { $gt: Date.now() }
            });

            if (!user) return ResponseService.error(res, "Token invalid or expired", 400);

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            user.password = hashedPassword;
            user.resetToken = undefined;
            user.resetTokenExpire = undefined;

            await user.save();


            return ResponseService.success(res, "Password updated successfully");
        } catch (error) {
            return ResponseService.error(res, "Password reset failed", 500, error);
        }
    }


    //changePassword method
    async changePassword(req, res) {
        try {
            const { _id } = req.user;
            const { oldPassword, newPassword } = req.body;

            const user = await User.findById(_id);
            if (!user) return ResponseService.error(res, "User not found", 404);

            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                return ResponseService.error(res, "Old password is incorrect", 400);
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);

            user.password = hashedPassword;
            await user.save();


            return ResponseService.success(res, "Password changed successfully");
        } catch (error) {
            return ResponseService.error(res, "Something went wrong", 500, error);
        }
    }


}

module.exports = new AuthController();
