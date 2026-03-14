const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { executeSql } = require('../config/db');

const router = express.Router();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
    }
});

// Login
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const result = await executeSql(`SELECT id, name, email, password_hash, role FROM users WHERE email = :1 AND role = :2`, [email, role]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials or incorrect role selected' });
        
        const user = result.rows[0];
        // For hackathon/demo, handling raw text as well incase DB seeded without bcrypt
        const validPass = await bcrypt.compare(password, user.PASSWORD_HASH).catch(() => false) || password === user.PASSWORD_HASH;
        
        if (!validPass) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.ID, role: user.ROLE }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        res.json({ token, user: { id: user.ID, name: user.NAME, email: user.EMAIL, role: user.ROLE } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Register
router.post('/register', async (req, res) => {
    const { name, email, password, role } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        await executeSql(
            `INSERT INTO users (name, email, password_hash, role) VALUES (:1, :2, :3, :4)`,
            [name, email, hash, role || 'Staff']
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send OTP
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    try {
        const userCheck = await executeSql(`SELECT id FROM users WHERE email = :1`, [email]);
        if (userCheck.rows.length === 0) return res.status(404).json({ error: 'Email not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Insert OTP with 10 min expiration
        await executeSql(
            `INSERT INTO otps (email, otp_code, expires_at) VALUES (:1, :2, CURRENT_TIMESTAMP + INTERVAL '10' MINUTE)`,
            [email, otp]
        );

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Inventory Pro - Password Reset OTP',
            text: `Your password reset OTP is ${otp}. It is valid for 10 minutes.`
        };

        if (process.env.EMAIL_APP_PASSWORD && process.env.EMAIL_APP_PASSWORD !== 'your_16_char_app_password') {
            await transporter.sendMail(mailOptions);
            res.json({ success: true, message: 'OTP sent to your email' });
        } else {
            console.log('DEMO MODE: OTP is', otp);
            res.json({ success: true, message: 'OTP logged to console (demo mode)' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const result = await executeSql(
            `SELECT id FROM otps WHERE email = :1 AND otp_code = :2 AND expires_at > CURRENT_TIMESTAMP ORDER BY id DESC`,
            [email, otp]
        );
        if (result.rows.length > 0) {
            res.json({ valid: true });
        } else {
            res.status(400).json({ error: 'Invalid or expired OTP' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;
    try {
        // Verify again
        const check = await executeSql(`SELECT id FROM otps WHERE email = :1 AND otp_code = :2 AND expires_at > CURRENT_TIMESTAMP`, [email, otp]);
        if (check.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });

        const hash = await bcrypt.hash(newPassword, 10);
        await executeSql(`UPDATE users SET password_hash = :1 WHERE email = :2`, [hash, email]);
        // Clean up OTPs
        await executeSql(`DELETE FROM otps WHERE email = :1`, [email]);
        
        res.json({ success: true, message: 'Password updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
