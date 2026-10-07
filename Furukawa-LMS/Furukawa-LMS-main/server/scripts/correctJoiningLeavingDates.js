import { fixJoiningAfterLeavingDates } from "../utils/joiningLeavingDateFix.js";

// Corrects users whose leavingDate falls before their joiningDate (in the users columns or
// inside a statusHistory entry) by raising the leaving date to the joining date. The server
// already runs the same correction on every start (User.init); this script is for checking a
// database by hand, or fixing one without starting the app. Point the server's DB env config at
// the target database before running it.
//
// Original values of every corrected row are saved to the user_date_corrections table.
//
// Usage:
//   node scripts/correctJoiningLeavingDates.js          (dry run, logs only)
//   node scripts/correctJoiningLeavingDates.js --apply  (writes changes to database)

async function run() {
    const apply = process.argv.includes("--apply");
    console.log(apply ? "Running in APPLY mode — changes will be written to the DB." : "Running in DRY RUN mode — no changes will be written. Pass --apply to write.");

    try {
        const { scanned, corrected } = await fixJoiningAfterLeavingDates({ apply, log: console.log });
        console.log(`\nScanned ${scanned} user(s). ${apply ? "Corrected" : "Would correct"} ${corrected.length} user(s).`);
        console.log("Done.");
        process.exit(0);
    } catch (error) {
        console.error("Correction failed:", error);
        process.exit(1);
    }
}

run();
