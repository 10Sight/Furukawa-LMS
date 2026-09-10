import React from "react";
import { IconLoader2, IconExternalLink, IconRefresh, IconAlertTriangle, IconFileSpreadsheet } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

// Not an iframe: Microsoft's login page sets X-Frame-Options: DENY, so any
// viewer without an already-active browser session for our Azure tenant gets
// a hard "refused to connect" the moment Excel Online redirects to sign-in
// inside a frame. A full-page new-tab open isn't subject to that block, so
// it's the only reliable way to open the workbook until LMS users are real
// Azure AD identities in this tenant (delegated auth, not yet built).
const MicrosoftExcelEmbed = ({ webUrl, title = "Microsoft Excel Online", onRefresh, isRefreshing = false }) => {
    if (!webUrl) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-slate-50 text-slate-600">
                <IconAlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                <p className="font-medium text-sm">No Microsoft Excel workbook linked to this meeting.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center gap-4 p-12 border border-slate-200 rounded-lg bg-white shadow-sm text-center">
            <div className="p-4 bg-emerald-50 rounded-full">
                <IconFileSpreadsheet className="h-10 w-10 text-emerald-600" />
            </div>
            <div>
                <p className="text-sm font-semibold text-slate-800">{title}</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    This meeting's spreadsheet lives in Microsoft 365. Open it in a new tab to view or edit — sign in with your organization account if prompted.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    className="cursor-pointer flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => window.open(webUrl, "_blank", "noopener,noreferrer")}
                >
                    <IconExternalLink className="h-4 w-4" /> Open in Excel
                </Button>
                {onRefresh && (
                    <Button variant="outline" size="sm" className="cursor-pointer flex items-center gap-1.5" onClick={onRefresh} disabled={isRefreshing}>
                        {isRefreshing ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconRefresh className="h-3.5 w-3.5" />} Refresh Link
                    </Button>
                )}
            </div>
        </div>
    );
};

export default MicrosoftExcelEmbed;
