import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

// Shows how many already-saved sheets a revision save will rewrite — pair with
// usePropagationPreview (hooks/usePropagationPreview.js) for `count`/`loading`.
const PropagationNotice = ({ count, loading }) => {
    if (loading) {
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Checking saved sheets…
            </div>
        );
    }
    if (count === null) return null;
    if (count === 0) {
        return <p className="text-xs text-muted-foreground">No already-saved sheets use this revision yet.</p>;
    }
    return (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
                Saving will also update the Doc. No., Rev. No., Issue Date and Rev. Date on{" "}
                <strong>{count} already-saved sheet{count === 1 ? "" : "s"}</strong>, including submitted and approved ones.
            </span>
        </div>
    );
};

export default PropagationNotice;
