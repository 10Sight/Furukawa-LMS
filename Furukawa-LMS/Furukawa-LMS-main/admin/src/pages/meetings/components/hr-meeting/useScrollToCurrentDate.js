import { useLayoutEffect } from "react";

// Scrolls a Daily HR Meeting sheet horizontally so today's date column (IST) is in view, at the
// right edge with the days before it to its left. When today is not shown (a past month), the last
// shown date is used instead. Date header cells carry data-date="YYYY-MM-DD".
// Runs again when the shown dates change (month / days-shown switch / refetch) or the layout does.

const todayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export default function useScrollToCurrentDate(containerRef, visibleDates, layoutKey) {
    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container || !visibleDates?.length) return;

        const today = todayIST();
        const target = visibleDates.some((d) => d.date === today)
            ? today
            : visibleDates[visibleDates.length - 1].date;
        const cell = container.querySelector(`th[data-date="${target}"]`);
        if (!cell) return;

        const box = container.getBoundingClientRect();
        const cellRight = cell.getBoundingClientRect().right - box.left + container.scrollLeft;
        container.scrollLeft = Math.max(0, cellRight - container.clientWidth);
    }, [containerRef, visibleDates, layoutKey]);
}
