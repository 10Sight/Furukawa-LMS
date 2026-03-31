import nodemailer from "nodemailer";
import ENV from "../configs/env.config.js";

const sendMail = async function (email, subject, message, attachments = [], cc = "") {
    const transporter = nodemailer.createTransport({
        host: ENV.SMTP_HOST || 'smtp.office365.com',
        port: ENV.SMTP_PORT || 587,
        secure: false, // Must be false for 587
        requireTLS: true, // Forces STARTTLS for Office365
        auth: {
            user: ENV.SMTP_USERNAME,
            pass: ENV.SMTP_PASSWORD,
        },
        tls: {
            ciphers: "TLSv1.2", // O365 rejects SSLv3. Require at least TLS 1.2
            rejectUnauthorized: false,
        },
    });

    // Handle transporter auth user from ENV if available, else hardcoded for safety? 
    // Actually the previous code used ENV.SMTP_USERNAME. Let's stick to ENV but allow override if needed. 
    // Wait, the previous code strictly used ENV. I should check if I should change that.
    // The previous code: user: ENV.SMTP_USERNAME
    // I will keep it ENV.SMTP_USERNAME

    // Create mail options
    const mailOptions = {
        from: `10Sight Technologies <${ENV.SMTP_USERNAME}>`,
        to: email,
        cc: cc,
        subject: subject,
        html: message,
    };

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        mailOptions.attachments = attachments;
    }

    await transporter.sendMail(mailOptions);
};

export default sendMail;