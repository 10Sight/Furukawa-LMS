import React from "react";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/common/ui/button.jsx";

// Contains a render-time crash in the spreadsheet or its charts (malformed cell
// data, a formula edge case, a recharts geometry error) to its own card, so the
// rest of the page stays usable. "Retry" remounts the children from scratch.
export default class ExcelErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null, attempt: 0 };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error(`[${this.props.title || "ExcelErrorBoundary"}]`, error, info?.componentStack);
    }

    handleRetry = () => {
        this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));
    };

    render() {
        if (this.state.error) {
            return (
                <div className="flex flex-col items-center justify-center gap-2 py-8 px-6 text-center bg-red-50/50 border border-red-100 rounded-lg">
                    <IconAlertTriangle className="w-7 h-7 text-red-400" />
                    <p className="text-sm font-semibold text-slate-800">{this.props.title || "Something went wrong"}</p>
                    <p className="text-xs text-slate-500 max-w-md">
                        {this.props.description || "This part of the page hit an unexpected error. Your saved data is not affected."}
                    </p>
                    <Button variant="outline" size="sm" className="mt-1 cursor-pointer flex items-center gap-1.5" onClick={this.handleRetry}>
                        <IconRefresh className="w-4 h-4" /> Retry
                    </Button>
                </div>
            );
        }
        return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    }
}
