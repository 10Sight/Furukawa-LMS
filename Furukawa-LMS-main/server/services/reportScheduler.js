import cron from "node-cron";
import Mail from "../models/mail.model.js";
// import reportService from "./report.service.js";

const init = () => {
    console.log("Initializing Report Scheduler...");

    // ================= DAILY REPORT (8:00 PM) =================
    // Cron: 0 20 * * * (At 20:00)
    cron.schedule('0 20 * * *', async () => {
        console.log("Running Daily Report Job...");
        try {
            // Find users who want daily reports
            const mails = await Mail.findAll({ isDailyReport: 1 });
            const emails = mails.map(m => m.email);

            if (emails.length === 0) {
                console.log("Daily Report: No recipients found.");
                return;
            }

            console.log(`Sending Daily Report to ${emails.length} recipients...`);
            await reportService.generateAndSend(emails, "Daily");
            console.log("Daily Report Sent Successfully.");

        } catch (error) {
            console.error("Failed to run Daily Report Job:", error);
        }
    });

    // ================= MONTHLY REPORT (Last Day of Month at 8:00 PM) =================
    // Cron: 0 20 * * * (Check every day at 8 PM if it is the last day)
    cron.schedule('0 20 * * *', async () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        // If tomorrow is the 1st, then today is the last day of the month
        if (tomorrow.getDate() === 1) {
            console.log("It is the last day of the month. Running Monthly Report Job...");
            try {
                // Find users who want monthly reports
                const mails = await Mail.findAll({ isMonthlyReport: 1 });
                const emails = mails.map(m => m.email);

                if (emails.length === 0) {
                    console.log("Monthly Report: No recipients found.");
                    return;
                }

                console.log(`Sending Monthly Report to ${emails.length} recipients...`);
                await reportService.generateAndSend(emails, "Monthly");
                console.log("Monthly Report Sent Successfully.");

            } catch (error) {
                console.error("Failed to run Monthly Report Job:", error);
            }
        }
    });
};

export default {
    init
};
