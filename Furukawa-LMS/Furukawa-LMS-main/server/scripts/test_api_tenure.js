import { getDashboardTenureStats } from "../controllers/dashboard.controller.js";

// Mock req and res
const req = {
    query: {
        department: "ALL",
        section: "ALL",
        line: "ALL",
        shift: "ALL",
    }
};

const res = {
    status: function(code) {
        this.statusCode = code;
        return this;
    },
    json: function(data) {
        this.body = data;
        console.log("RESPONSE STATUS:", this.statusCode);
        console.log("RESPONSE BODY:", JSON.stringify(data, null, 2));
    }
};

async function test() {
    try {
        console.log("Running getDashboardTenureStats with mock request...");
        await getDashboardTenureStats(req, res);
    } catch (err) {
        console.error("Test failed with error:", err);
    }
    process.exit(0);
}

test();
