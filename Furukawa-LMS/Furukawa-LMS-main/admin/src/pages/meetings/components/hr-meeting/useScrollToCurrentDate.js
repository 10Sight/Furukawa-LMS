import { useLayoutEffect } from "react";

// Scrolls a Daily HR Meeting sheet horizontally so today's date column (IST) is in view, at the
// right edge with the days before it to its left. When today is not shown (a past month), the last
// shown date is used instead. Date header cells carry data-date="YYYY-MM-DD".
// Runs again only when the set of shown dates changes (month / days-shown switch) or the layout
// does. It is keyed on the dates themselves, not the array: a refetch (e.g. after an inline
// Training edit) builds a new array with the same dates, and must not yank the user's scroll
// position back to today while they are working on an earlier date.

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function useScrollToCurrentDate(containerRef, visibleDates, layoutKey) {
    const datesKey = (visibleDates || []).map((d) => d.date).join(",");
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || !datesKey) return;

        const dates = datesKey.split(",");
        const today = todayIST();
        const target = dates.includes(today) ? today : dates[dates.length - 1];
        const cell = container.querySelector(`th[data-date="${target}"]`);
        if (!cell) return;

        const box = container.getBoundingClientRect();
        const cellRight = cell.getBoundingClientRect().right - box.left + container.scrollLeft;
        container.scrollLeft = Math.max(0, cellRight - container.clientWidth);
    }, [containerRef, datesKey, layoutKey]);
}
