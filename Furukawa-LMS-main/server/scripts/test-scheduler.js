import reportScheduler from "../services/reportScheduler.js";
import reportService from "../services/report.service.js";
import Mail from "../models/mail.model.js";

const test = async () => {
    console.log("Starting Scheduler Test...");

    // Mock Mail.findAll to return a test email if needed, or rely on DB
    // For safety, let's just run the generation logic directly to see if it works without error
    try {
        console.log("Testing Report Generation Logic...");
        // Using a dummy email array to avoid spamming real users if they exist
        // But we want to ensure the query works.
        const data = await reportService.getReportData();
        console.log(`Fetched ${data.length} rows for report.`);

        if (data.length > 0) {
            console.log("Sample Data Row:", data[0]);
        } else {
            console.log("No data returned from query - check if database has data for 'lines' and 'departments'");
        }

        console.log("Scheduler initialization check (dry run)...");
        reportScheduler.init();
        console.log("Scheduler initialized successfully.");

    } catch (err) {
        console.error("Test Failed:", err);
    }

    process.exit(0);
};

test();
