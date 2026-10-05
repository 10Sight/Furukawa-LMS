import React from "react";
import { useSelector } from "react-redux";
import { Button } from "@/components/common/ui/button.jsx";
export const PHASE_2_URL = import.meta.env.VITE_PHASE_2_URL || "";
export const openPhase2 = () => window.open(PHASE_2_URL, "_blank", "noopener,noreferrer");
export default function Phase2() {
    const { darkMode } = useSelector((state) => state.theme);
    return (
        <div className={`text-center py-12 rounded-2xl border-2 border-dashed ${darkMode ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-500"}`}>
            {PHASE_2_URL ? (
                <Button onClick={openPhase2}>Open Phase 2</Button>
            ) : (
                "Phase 2 URL has not been configured yet."
            )}
        </div>
    );
}
