/**
 * Default LPA Check Sheet Templates for Assembly and C&C
 */
import fs from "fs";
import path from "path";

// Function to safely load template JSON from admin folder if available, or fall back to embedded specs
export function getDefaultTemplate(section = "assembly") {
  const isAssembly = String(section).toLowerCase() === "assembly";
  const filename = isAssembly ? "assemblyTemplate.json" : "ccTemplate.json";
  
  // Try loading from admin folder
  const adminPath = path.join(process.cwd(), "..", "admin", "src", "pages", "lpa", filename);
  if (fs.existsSync(adminPath)) {
    try {
      const content = fs.readFileSync(adminPath, "utf-8");
      return JSON.parse(content);
    } catch {}
  }

  // Fallback structural definition
  if (isAssembly) {
    return {
      section: "assembly",
      name: "Assembly LPA Check Sheet.xls",
      docNo: "FRM-WH-QA-246",
      revNo: "06",
      issueDate: "31.01.22",
      sheets: [
        {
          name: "Assy QC & Pro REV 06",
          columnCount: 7,
          columns: [
            { wpx: 38 },
            { wpx: 50 },
            { wpx: 490 },
            { wpx: 40 },
            { wpx: 45 },
            { wpx: 75 },
            { wpx: 50 }
          ],
          rows: []
        }
      ]
    };
  }

  return {
    section: "cc",
    name: "C&C LPA Check Sheet",
    docNo: "FRM-CC-QA-102",
    revNo: "03",
    issueDate: "15.04.22",
    sheets: [
      {
        name: "C&C Inspection",
        columnCount: 9,
        columns: [
          { wpx: 38 },
          { wpx: 60 },
          { wpx: 120 },
          { wpx: 120 },
          { wpx: 400 },
          { wpx: 45 },
          { wpx: 120 },
          { wpx: 75 },
          { wpx: 50 }
        ],
        rows: []
      }
    ]
  };
}
