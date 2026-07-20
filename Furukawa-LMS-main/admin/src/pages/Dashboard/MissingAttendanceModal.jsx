import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Search, RefreshCcw, UserMinus, Download } from 'lucide-react';
import axiosInstance from '../../Helper/axiosInstance';

// Excel-compatible .xls export without adding any new frontend dependency.
const escapeExcelHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const downloadExcelTable = ({ rows, columns, fileName, title }) => {
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!safeRows.length) return false;

    const headerHtml = columns
        .map((column) => `<th>${escapeExcelHtml(column.header)}</th>`)
        .join("");

    const bodyHtml = safeRows
        .map((row, rowIndex) => {
            const cells = columns
                .map((column) => {
                    const value = typeof column.value === "function"
                        ? column.value(row, rowIndex)
                        : row?.[column.value];

                    return `<td style="mso-number-format:'\\@';">${escapeExcelHtml(value)}</td>`;
                })
                .join("");

            return `<tr>${cells}</tr>`;
        })
        .join("");

    const workbookHtml = `<!DOCTYPE html>
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="UTF-8" />
                <style>
                    table { border-collapse: collapse; font-family: Arial, sans-serif; }
                    th { background: #ffedd5; font-weight: 700; }
                    th, td { border: 1px solid #94a3b8; padding: 6px 8px; white-space: nowrap; }
                    .sheet-title { font-size: 16px; font-weight: 700; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <div class="sheet-title">${escapeExcelHtml(title)}</div>
                <table>
                    <thead><tr>${headerHtml}</tr></thead>
                    <tbody>${bodyHtml}</tbody>
                </table>
            </body>
        </html>`;

    const blob = new Blob(["\ufeff", workbookHtml], {
        type: "application/vnd.ms-excel;charset=utf-8;",
    });

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = String(fileName || "unmapped-attendance.xls")
        .replace(/[\\/:*?"<>|]+/g, "-");

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);

    return true;
};

const UnmappedPresentModal = ({ open, onOpenChange, initialDate }) => {
    const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [data, setData] = useState([]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 25;

    // Reset filters and sync date when modal opens
    useEffect(() => {
        if (open) {
            setDate(initialDate || new Date().toISOString().split('T')[0]);
            setSearch("");
            setCurrentPage(1);
        }
    }, [open, initialDate]);

    // Fetch Unmapped Present Data
    const fetchUnmappedPresent = async () => {
        setLoading(true);
        try {
            const queryParams = new URLSearchParams({
                date,
                search,
                page: currentPage,
                limit
            }).toString();

            const res = await axiosInstance.get(`/api/attendance/unmapped-present?${queryParams}`);
            if (res.data.success) {
                setData(res.data.data || []);
                setTotalCount(res.data.pagination?.totalCount || 0);
                setTotalPages(res.data.pagination?.totalPages || 1);
            } else {
                setData([]);
                setTotalCount(0);
                setTotalPages(1);
            }
        } catch (error) {
            console.error("Failed to fetch unmapped present logs", error);
            setData([]);
            setTotalCount(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    };

    // Debounced query execution on date/search/page change
    useEffect(() => {
        if (!open) return;

        const handler = setTimeout(() => {
            fetchUnmappedPresent();
        }, 300);

        return () => clearTimeout(handler);
    }, [open, date, search, currentPage]);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleDownloadUnmappedExcel = async () => {
        setExporting(true);

        try {
            // Download in safe paginated batches instead of requesting an extremely
            // large SQL FETCH limit in a single call. This keeps the existing API
            // unchanged and exports the complete filtered unmapped list.
            const exportPageSize = 500;
            let exportPage = 1;
            let exportTotalPages = 1;
            const exportRows = [];

            do {
                const queryParams = new URLSearchParams({
                    date,
                    search,
                    page: String(exportPage),
                    limit: String(exportPageSize),
                }).toString();

                const res = await axiosInstance.get(`/api/attendance/unmapped-present?${queryParams}`);

                // Supports both normal Axios responses and interceptor-unwrapped responses.
                const payload = res?.data?.success !== undefined ? res.data : res;

                if (!payload?.success) {
                    throw new Error(payload?.message || "Unable to fetch unmapped employees for export");
                }

                const pageRows = Array.isArray(payload.data) ? payload.data : [];
                exportRows.push(...pageRows);

                exportTotalPages = Math.max(
                    1,
                    Number(payload.pagination?.totalPages) || 1
                );

                exportPage += 1;
            } while (exportPage <= exportTotalPages);

            const exported = downloadExcelTable({
                rows: exportRows,
                fileName: `unmapped-present-${date || "selected-date"}.xls`,
                title: `Unmapped Present Employees - ${date || "Selected Date"}`,
                columns: [
                    { header: "Sr.No", value: (_row, index) => index + 1 },
                    { header: "Date", value: () => date || "" },
                    { header: "PayCode", value: "payCode" },
                    { header: "Card No", value: "cardNo" },
                    { header: "Employee Name", value: "employeeName" },
                    { header: "Department", value: "department" },
                    { header: "Designation", value: "designation" },
                    { header: "Shift", value: "shift" },
                    { header: "Status", value: "status" },
                    { header: "In Time", value: "inTime" },
                    { header: "Out Time", value: "outTime" },
                    { header: "Hrs Worked", value: (row) => row.hrsWorked ?? "" },
                    { header: "Reason", value: "reason" },
                ],
            });

            if (!exported) {
                alert("No unmapped employees available to download.");
            }
        } catch (error) {
            console.error("Failed to download unmapped employees", error);
            alert(error?.response?.data?.message || error?.message || "Failed to download unmapped employees Excel file.");
        } finally {
            setExporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl w-full p-6 bg-slate-50">
                <DialogHeader className="flex flex-row justify-between items-center border-b border-slate-200 pb-4 mb-4">
                    <div className="w-full flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-orange-50 text-orange-500">
                                    <UserMinus className="h-5 w-5" />
                                </span>
                                Unmapped Present (Not in Master)
                            </DialogTitle>
                            <p className="text-xs text-slate-500 mt-1">
                                Present employees from the uploaded attendance file who are not found in the users/master database.
                            </p>
                        </div>
                        <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-1 rounded-full">
                            Total unmapped present employees: {totalCount}
                        </span>
                    </div>
                </DialogHeader>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4">
                    {/* Date Picker */}
                    <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Date</label>
                        <Input
                            type="date"
                            value={date}
                            onChange={(e) => { setDate(e.target.value); setCurrentPage(1); }}
                            className="h-9 w-full sm:w-[150px] text-xs text-slate-700 bg-slate-50 border-slate-200 focus:bg-white"
                        />
                    </div>

                    <div className="hidden sm:block h-8 w-[1px] bg-slate-200"></div>

                    {/* Search Input */}
                    <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                placeholder="Search by paycode, card no, name, department..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                className="h-9 w-full pl-9 text-xs text-slate-700 bg-slate-50 border-slate-200 focus:bg-white placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 self-end">
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 border-slate-200 text-slate-400 hover:text-blue-600"
                            onClick={fetchUnmappedPresent}
                            disabled={loading}
                        >
                            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>

                    <div className="flex flex-col gap-1 self-end">
                        <Button
                            variant="outline"
                            className="h-9 text-xs border-green-300 text-green-700 hover:bg-green-50 flex items-center gap-1.5"
                            onClick={handleDownloadUnmappedExcel}
                            disabled={loading || exporting || totalCount === 0}
                        >
                            {exporting
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Download className="h-3.5 w-3.5" />}
                            {exporting ? "Downloading..." : "Download Excel"}
                        </Button>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative min-h-[300px] flex flex-col justify-between">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase font-semibold">
                                <tr>
                                    <th className="py-3 pl-6 pr-3 font-medium whitespace-nowrap w-[60px]">Sr.No</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[100px]">PayCode</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[120px]">Card No</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[180px]">Employee Name</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[130px]">Department</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap min-w-[130px]">Designation</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap w-[80px] text-center">Shift</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap w-[80px] text-center">Status</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap w-[85px] text-center">In Time</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap w-[85px] text-center">Out Time</th>
                                    <th className="py-3 pl-3 pr-3 font-medium whitespace-nowrap w-[90px] text-center">Hrs Worked</th>
                                    <th className="py-3 pl-3 pr-6 font-medium whitespace-nowrap min-w-[180px]">Reason</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 relative">
                                {loading ? (
                                    <tr>
                                        <td colSpan="12" className="py-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-500 gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                                                <span className="text-xs">Fetching unmapped present logs...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((emp, index) => (
                                        <tr key={emp.payCode || index} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 pl-6 pr-3 text-slate-400 text-xs w-[60px]">
                                                {(currentPage - 1) * limit + index + 1}
                                            </td>
                                            <td className="py-3 pl-3 pr-3">
                                                <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                                                    {emp.payCode || '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-500 font-mono text-xs">
                                                {emp.cardNo || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 font-medium text-slate-800 text-xs">
                                                {emp.employeeName || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-600 text-xs">
                                                {emp.department || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-500 text-xs">
                                                {emp.designation || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-slate-600 text-xs text-center w-[80px]">
                                                <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] uppercase font-semibold">
                                                    {emp.shift || '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-center w-[80px]">
                                                <span className="inline-block px-1.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-semibold">
                                                    {emp.status || 'Present'}
                                                </span>
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center text-green-700 font-semibold bg-slate-50/30">
                                                {emp.inTime || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center text-red-700 font-semibold bg-slate-50/30">
                                                {emp.outTime || '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-3 text-xs font-mono text-center font-bold text-slate-700">
                                                {emp.hrsWorked ? Number(emp.hrsWorked).toFixed(2) : '-'}
                                            </td>
                                            <td className="py-3 pl-3 pr-6 text-xs text-slate-600">
                                                <span className="inline-block text-[11px] text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                                                    {emp.reason || 'User not found in master'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="12" className="py-20 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <div className="p-3 bg-green-50 text-green-500 rounded-full mb-3">
                                                    <RefreshCcw className="h-6 w-6" />
                                                </div>
                                                <p className="text-sm font-semibold text-slate-700">No unmapped present employees found.</p>
                                                <p className="text-xs text-slate-400 mt-1">All Present employees match registered database users.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    {data.length > 0 && (
                        <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                            <div className="text-xs text-slate-400">
                                Total <span className="font-semibold text-slate-600">{totalCount}</span> unmapped present employee{totalCount !== 1 ? 's' : ''} found
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs px-2.5"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1 || loading}
                                >
                                    Previous
                                </Button>
                                <div className="px-3 text-xs font-semibold text-slate-600">
                                    Page {currentPage} of {totalPages || 1}
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs px-2.5"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages || totalPages === 0 || loading}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-5 border-t border-slate-200 pt-4">
                    <Button
                        variant="outline"
                        className="text-xs h-9"
                        onClick={() => onOpenChange(false)}
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default UnmappedPresentModal;