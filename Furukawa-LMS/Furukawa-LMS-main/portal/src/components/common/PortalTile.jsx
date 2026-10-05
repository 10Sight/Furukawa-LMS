import React from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/common/ui/card.jsx";

// Same visual language as LandingPage.jsx's inline PortalCard/ACCENTS — kept as
// a separate shared component so new hub-style card grids (e.g. MisPortalHub)
// don't duplicate that styling. LandingPage.jsx itself is left untouched to
// minimize blast radius; it can be pointed at this later if desired.
export const PORTAL_TILE_ACCENTS = {
    blue: {
        border: "hover:border-blue-300", borderDark: "hover:border-blue-800",
        glow: "rgba(59,130,246,0.18)", wash: "from-blue-500/5",
        iconBg: "bg-blue-50", iconBgDark: "bg-blue-950/50",
        iconFg: "text-blue-600", iconFgDark: "text-blue-400",
        link: "text-blue-500", linkDark: "text-blue-400",
    },
    green: {
        border: "hover:border-green-300", borderDark: "hover:border-green-800",
        glow: "rgba(34,197,94,0.18)", wash: "from-green-500/5",
        iconBg: "bg-green-50", iconBgDark: "bg-green-950/50",
        iconFg: "text-green-600", iconFgDark: "text-green-400",
        link: "text-green-500", linkDark: "text-green-400",
    },
    purple: {
        border: "hover:border-purple-300", borderDark: "hover:border-purple-800",
        glow: "rgba(168,85,247,0.18)", wash: "from-purple-500/5",
        iconBg: "bg-purple-50", iconBgDark: "bg-purple-950/50",
        iconFg: "text-purple-600", iconFgDark: "text-purple-400",
        link: "text-purple-500", linkDark: "text-purple-400",
    },
    amber: {
        border: "hover:border-amber-300", borderDark: "hover:border-amber-800",
        glow: "rgba(244,63,94,0.18)", wash: "from-amber-500/5 to-rose-500/5",
        iconBg: "bg-amber-50", iconBgDark: "bg-amber-950/50",
        iconFg: "text-amber-600", iconFgDark: "text-amber-400",
        link: "text-rose-500", linkDark: "text-rose-400",
    },
};

export default function PortalTile({ accent = "blue", darkMode, icon, title, desc, onClick, ctaLabel = "Open" }) {
    const a = PORTAL_TILE_ACCENTS[accent] || PORTAL_TILE_ACCENTS.blue;
    const Icon = icon;
    return (
        <Card
            className={`group relative overflow-hidden active:scale-[0.98] sm:hover:-translate-y-1 transition-all duration-300 cursor-pointer backdrop-blur-xl ${darkMode ? `border-slate-800 bg-slate-900/60 ${a.borderDark}` : `border-slate-100 bg-white/70 ${a.border}`}`}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 10px 30px ${a.glow}`; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ""; }}
            onClick={onClick}
        >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-br ${a.wash} to-transparent transition-opacity duration-300 pointer-events-none`} />
            <CardContent className="relative p-5 sm:p-6 md:p-7 flex flex-col items-center text-center space-y-2 sm:space-y-3 pt-6 sm:pt-8">
                <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shrink-0 ${darkMode ? `${a.iconBgDark} ${a.iconFgDark}` : `${a.iconBg} ${a.iconFg}`}`}>
                    <Icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
                </div>
                <div className="space-y-1 w-full">
                    <h3 className={`text-sm sm:text-base md:text-lg font-bold ${darkMode ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>
                    <p className={`text-xs sm:text-sm leading-snug ${darkMode ? "text-slate-400" : "text-slate-500"}`}>
                        {desc}
                    </p>
                </div>
                <div className={`flex items-center gap-1 text-xs sm:text-sm font-medium opacity-100 sm:opacity-0 sm:group-hover:opacity-100 -translate-x-0 sm:-translate-x-1 sm:group-hover:translate-x-0 transition-all duration-200 pt-1 ${darkMode ? a.linkDark : a.link}`}>
                    {ctaLabel} <ArrowRight className="w-3.5 h-3.5" />
                </div>
            </CardContent>
        </Card>
    );
}
