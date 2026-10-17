import { useState, useEffect } from 'react';
import axiosInstance from "@/services/requests/axiosInstance.js";

// Saving a revision record rewrites the doc/revision header on every already-saved
// form it governs (server: revisionPropagation.service.js). This fetches how many
// that is for a scope, so the admin sees the reach of an edit before confirming.
// `count` is null while loading, when disabled, or if the preview couldn't load.
export default function usePropagationPreview(sheetKey, departmentId, sectionId, enabled = true) {
    const [count, setCount] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled || !sheetKey) {
            setCount(null);
            return;
        }
        let active = true;
        setLoading(true);
        const params = { sheetKey };
        if (departmentId) params.departmentId = departmentId;
        if (departmentId && sectionId) params.sectionId = sectionId;

        axiosInstance.get('/api/revision-records/propagation-preview', { params })
            .then((res) => {
                if (active && res.data?.success) setCount(res.data.data?.affectedCount ?? 0);
            })
            .catch(() => { if (active) setCount(null); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [sheetKey, departmentId, sectionId, enabled]);

    return { count, loading };
}

// Suffix for a save toast, e.g. " · 37 saved sheets updated".
export const formatPropagatedToast = (count) =>
    count > 0 ? ` · ${count} saved sheet${count === 1 ? "" : "s"} updated` : "";
