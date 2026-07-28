import { useState, useEffect } from 'react';
import axiosInstance from '@/Helper/axiosInstance';

// Fetches the live docNo/revNo/revDate for a form from the Revision Table
// (revision_records, keyed by sheetKey), optionally scoped to a department
// and/or section — resolves to the most specific match (department+section ->
// department-only -> global default). Falls back to whatever the caller
// passes in — the form's own previously-hardcoded values — while loading or
// if nothing is unreachable, so nothing ever renders blank or broken.
export default function useRevisionInfo(sheetKey, fallback, { departmentId, sectionId } = {}) {
    const [info, setInfo] = useState(fallback);

    useEffect(() => {
        let active = true;
        const params = {};
        if (departmentId) params.departmentId = departmentId;
        if (sectionId) params.sectionId = sectionId;

        axiosInstance.get(`/api/revision-records/sheet/${sheetKey}`, { params })
            .then((res) => {
                if (!active || !res.data?.success) return;
                const record = res.data.data || {};
                // Only override fields the Revision Table actually has a value for —
                // an unset (null) field there must never blank out a good fallback.
                setInfo((prev) => ({
                    ...prev,
                    ...(record.docNo ? { docNo: record.docNo } : {}),
                    ...(record.revNo ? { revNo: record.revNo } : {}),
                    ...(record.revDate ? { revDate: record.revDate } : {}),
                }));
            })
            .catch(() => { /* keep fallback */ });
        return () => { active = false; };
    }, [sheetKey, departmentId, sectionId]);

    return info;
}
