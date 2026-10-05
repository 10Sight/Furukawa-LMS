import { useEffect, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");

const computeRemaining = (targetMs) => {
    const diff = targetMs - Date.now();
    if (diff <= 0) {
        return { isExpired: true, hours: 0, minutes: 0, seconds: 0, formatted: "0h 0m 0s" };
    }
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
        isExpired: false,
        hours,
        minutes,
        seconds,
        formatted: `${hours}h ${pad(minutes)}m ${pad(seconds)}s`,
    };
};

// Ticks every second until targetDate is reached. Pass null/undefined for an already-expired state.
export default function useCountdown(targetDate) {
    const targetMs = targetDate ? new Date(targetDate).getTime() : null;
    const [remaining, setRemaining] = useState(() =>
        targetMs ? computeRemaining(targetMs) : { isExpired: true, hours: 0, minutes: 0, seconds: 0, formatted: "0h 0m 0s" }
    );

    useEffect(() => {
        if (!targetMs) {
            setRemaining({ isExpired: true, hours: 0, minutes: 0, seconds: 0, formatted: "0h 0m 0s" });
            return;
        }

        setRemaining(computeRemaining(targetMs));
        const interval = setInterval(() => {
            setRemaining(computeRemaining(targetMs));
        }, 1000);

        return () => clearInterval(interval);
    }, [targetMs]);

    return remaining;
}
