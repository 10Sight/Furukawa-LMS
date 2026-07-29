import React from 'react';
import RevisionHistoryTable from './RevisionHistoryTable';

const RevisionHistoryList = ({ logs, loading }) => {
    if (loading) {
        return <div className="py-10 text-center text-muted-foreground">Loading history...</div>;
    }

    if (!logs || logs.length === 0) {
        return <div className="py-10 text-center text-muted-foreground">No revision history yet.</div>;
    }

    return <RevisionHistoryTable logs={logs} />;
};

export default RevisionHistoryList;
