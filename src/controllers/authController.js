const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const otplib = require("otplib");
const authenticator = otplib.authenticator || otplib;
const qrcode = require("qrcode");

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

            // Check if account is approved first
            if (user.isApproved === 0) {
                return ResponseService.error(res, "Your account is currently under approval. Please wait for Super Admin to approve.", 403);
            }

            // Then check if account is locked
            if (user.isLocked === 0) {
                return ResponseService.error(res, "Your account is locked. Please contact Super Admin to unlock.", 403);
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                // Increment failed attempts
                user.loginAttempts = (user.loginAttempts || 0) + 1;

                // Lock account if attempts >= 3
                if (user.loginAttempts >= 3) {
                    user.isLocked = 0;
                    await user.save();
                    return ResponseService.error(res, "Invalid password. Your account has been locked due to too many failed attempts.", 403);
                }

                await user.save();
                const remaining = 3 - user.loginAttempts;
                return ResponseService.error(res, `Invalid password. ${remaining} attempts remaining before account lock.`, 401);
            }

            // Reset attempts on successful login
            user.loginAttempts = 0;
            await user.save();

            if (user.isTwoFactorEnabled) {
                // Return a temporary token for 2FA verification
                const tempToken = jwt.sign(
                    {
                        _id: user._id,
                        userId: user.id,
                        challenge: true
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: "5m" } // 5 minutes to enter code
                );

                return ResponseService.success(res, "2FA required", {
                    twoFactorRequired: true,
                    tempToken
                });
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
            console.error("Login error:", error);
            return ResponseService.error(res, "Login failed", 500, error);
        }
    }

    // verify2FALogin method
    async verify2FALogin(req, res) {
        try {
            const { tempToken, code } = req.body;

            const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
            if (!decoded.challenge) {
                return ResponseService.error(res, "Invalid token", 401);
            }

            const user = await User.findById(decoded._id);
            if (!user || !user.isTwoFactorEnabled) {
                return ResponseService.error(res, "User not found or 2FA not enabled", 404);
            }

            const isValid = authenticator.verify({
                token: code,
                secret: user.twoFactorSecret
            });

            if (!isValid) {
                return ResponseService.error(res, "Invalid 2FA code", 400);
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
            console.error("2FA Verification error:", error);
            return ResponseService.error(res, "Verification failed", 500, error);
        }
    }

    // Get current user profile
    async getProfile(req, res) {
        try {
            const { _id } = req.user;
            const user = await User.findById(_id).select("-password -twoFactorSecret");
            if (!user) {
                return ResponseService.error(res, "User not found", 404);
            }
            return ResponseService.success(res, "Profile fetched successfully", { user });
        } catch (error) {
            console.error("Profile fetch error:", error);
            return ResponseService.error(res, "Failed to fetch profile", 500);
        }
    }

    // generate2FA method
    async generate2FA(req, res) {
        try {
            const { _id } = req.user;
            const user = await User.findById(_id);
            if (!user) return ResponseService.error(res, "User not found", 404);

            console.log("Debug: authenticator keys", Object.keys(authenticator));
            if (!authenticator || typeof authenticator.generateSecret !== 'function') {
                throw new Error("TOTP Authenticator is not properly initialized");
            }

            const secret = authenticator.generateSecret();

            console.log("Debug: 2FA Generation Details", {
                email: user.email,
                issuer: "RDC-Media",
                secretLength: secret ? secret.length : 'N/A',
                uriMethodName: authenticator.generateURI ? 'generateURI' : (authenticator.keyURI ? 'keyURI' : 'keyuri')
            });

            const uriMethod = authenticator.generateURI || authenticator.keyURI || authenticator.keyuri;
            if (typeof uriMethod !== 'function') {
                throw new Error("TOTP Authenticator is missing URI generation method. Available: " + Object.keys(authenticator).join(', '));
            }

            let otpauth;
            try {
                // In otplib v13, generateURI often expects an object
                if (authenticator.generateURI) {
                    otpauth = authenticator.generateURI({
                        secret: secret,
                        label: user.email,
                        issuer: "RDC-Media"
                    });
                } else {
                    otpauth = uriMethod.call(authenticator, user.email, "RDC-Media", secret);
                }
            } catch (err) {
                console.warn("Library URI generation failed, using manual fallback:", err.message);
                // Last resort manual fallback
                otpauth = `otpauth://totp/${encodeURIComponent("RDC-Media")}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent("RDC-Media")}`;
            }

            const qrCodeUrl = await qrcode.toDataURL(otpauth);

            // Store secret temporarily but don't enable yet
            user.twoFactorSecret = secret;
            await user.save();

            return ResponseService.success(res, "2FA Secret generated", {
                secret,
                qrCodeUrl
            });
        } catch (error) {
            console.error("2FA generation error:", error);
            return ResponseService.error(res, "Failed to generate 2FA", 500, error);
        }
    }

    // enable2FA method
    async enable2FA(req, res) {
        try {
            const { _id } = req.user;
            const { code } = req.body;

            const user = await User.findById(_id);
            if (!user || !user.twoFactorSecret) {
                return ResponseService.error(res, "2FA setup not initialized", 400);
            }

            const isValid = authenticator.verify({
                token: code,
                secret: user.twoFactorSecret
            });

            if (!isValid) {
                return ResponseService.error(res, "Invalid verification code", 400);
            }

            user.isTwoFactorEnabled = true;
            await user.save();

            return ResponseService.success(res, "2FA enabled successfully");
        } catch (error) {
            console.error("2FA enablement error:", error);
            return ResponseService.error(res, "Failed to enable 2FA", 500, error);
        }
    }

    // disable2FA method
    async disable2FA(req, res) {
        try {
            const { _id } = req.user;
            const { code } = req.body;

            const user = await User.findById(_id);
            if (!user) return ResponseService.error(res, "User not found", 404);

            const isValid = authenticator.verify({
                token: code,
                secret: user.twoFactorSecret
            });

            if (!isValid) {
                return ResponseService.error(res, "Invalid verification code", 400);
            }

            user.isTwoFactorEnabled = false;
            user.twoFactorSecret = null;
            await user.save();

            return ResponseService.success(res, "2FA disabled successfully");
        } catch (error) {
            return ResponseService.error(res, "Failed to disable 2FA", 500, error);
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
