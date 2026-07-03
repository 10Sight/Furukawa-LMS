import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetAllUsersQuery } from "@/Redux/AllApi/UserApi";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SearchInput from "@/components/common/SearchInput";
import {
    IconArrowLeft,
    IconUsers,
    IconLoader,
    IconArrowUp,
} from "@tabler/icons-react";

const CHUNK_SIZE = 30;

const DesignationUsersPage = () => {
    const { designationName } = useParams();
    const navigate = useNavigate();
    const designation = decodeURIComponent(designationName || "");

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [users, setUsers] = useState([]);
    const [showScrollTop, setShowScrollTop] = useState(false);

    const sentinelRef = useRef(null);
    const isFetchingRef = useRef(false);

    const { data: response, isLoading, isFetching, isError } = useGetAllUsersQuery({
        designation,
        search,
        page,
        limit: CHUNK_SIZE,
        excludeAdmins: "true",
    });

    const totalUsers = response?.data?.totalUsers || 0;
    const totalPages = response?.data?.totalPages || 1;
    const hasMore = page < totalPages;

    useEffect(() => {
        isFetchingRef.current = isFetching;
    }, [isFetching]);

    // Reset the accumulated list whenever the (debounced) search term changes
    useEffect(() => {
        setPage(1);
        setUsers([]);
    }, [search, designation]);

    // Append each newly fetched chunk onto the accumulated list, skipping any ids already present
    useEffect(() => {
        if (!response?.data?.users) return;
        setUsers((prev) => {
            if (page === 1) return response.data.users;
            const seen = new Set(prev.map((u) => u._id || u.id));
            const newOnes = response.data.users.filter((u) => !seen.has(u._id || u.id));
            return [...prev, ...newOnes];
        });
    }, [response, page]);

    // Load the next chunk once the sentinel at the bottom of the list scrolls into view.
    // Reads isFetching via a ref (rather than as a dependency) so the observer isn't torn
    // down and recreated on every fetch — that recreation used to re-fire immediately for
    // an already-visible sentinel and over-eagerly load pages ahead of actual scroll position.
    useEffect(() => {
        if (!hasMore) return;
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isFetchingRef.current) {
                    setPage((p) => p + 1);
                }
            },
            { rootMargin: "100px" }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore]);

    // Toggle the "scroll to top" button based on page scroll position
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 100);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const isInitialLoading = isLoading && page === 1 && users.length === 0;
    const isLoadingMore = isFetching && page > 1;

    const getStatusBadge = (user) => {
        if (user.status === "LEFT") {
            return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Left</Badge>;
        }
        if (user.status === "ON_LEAVE") {
            return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">On Leave</Badge>;
        }
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Active</Badge>;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    onClick={() => navigate(-1)}
                >
                    <IconArrowLeft size={18} />
                </Button>
                <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Designations</p>
                    <h1 className="text-2xl font-bold text-gray-900">{designation}</h1>
                </div>
            </div>

            {/* Stats row */}
            {!isInitialLoading && !isError && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <IconUsers size={16} />
                    <span>
                        {totalUsers} operator{totalUsers !== 1 ? "s" : ""} with this designation
                    </span>
                </div>
            )}

            {/* Search */}
            <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search by name, username, or emp ID..."
                className="max-w-sm"
            />

            {/* Table */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50">
                            <TableHead className="w-12 text-center font-semibold">#</TableHead>
                            <TableHead className="font-semibold">Name</TableHead>
                            <TableHead className="font-semibold">Emp ID</TableHead>
                            <TableHead className="font-semibold">Department</TableHead>
                            <TableHead className="font-semibold">Hierarchy</TableHead>
                            <TableHead className="text-center font-semibold">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isInitialLoading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <IconLoader size={28} className="animate-spin" />
                                        <span className="text-sm">Loading operators...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {isError && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16 text-red-500 text-sm">
                                    Failed to load operators. Please try again.
                                </TableCell>
                            </TableRow>
                        )}

                        {!isInitialLoading && !isError && users.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16">
                                    <div className="flex flex-col items-center gap-2 text-gray-400">
                                        <IconUsers size={32} />
                                        <span className="text-sm">
                                            {search
                                                ? "No operators match your search."
                                                : "No operators found for this designation."}
                                        </span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}

                        {!isInitialLoading && !isError && users.map((user, idx) => (
                            <TableRow
                                key={user._id || user.id}
                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => navigate(`/admin/employees/${user._id || user.id}`)}
                            >
                                <TableCell className="text-center text-gray-400 text-sm">
                                    {idx + 1}
                                </TableCell>
                                <TableCell>
                                    <div>
                                        <p className="font-medium text-gray-800">{user.fullName}</p>
                                        <p className="text-xs text-gray-400">{user.userName}</p>
                                    </div>
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                    {user.empId || <span className="text-gray-300">—</span>}
                                </TableCell>
                                <TableCell className="text-sm text-gray-600">
                                    {user.deptName || <span className="text-gray-300">—</span>}
                                </TableCell>
                                <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">
                                    {user.fromInfo || <span className="text-gray-300">—</span>}
                                </TableCell>
                                <TableCell className="text-center">
                                    {getStatusBadge(user)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                {/* Sentinel: loading the next chunk fires when this scrolls into view */}
                {!isInitialLoading && !isError && hasMore && (
                    <div ref={sentinelRef} className="flex items-center justify-center py-6">
                        {isLoadingMore && (
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <IconLoader size={18} className="animate-spin" />
                                Loading more...
                            </div>
                        )}
                    </div>
                )}
            </div>

            {!isInitialLoading && !isError && users.length > 0 && (
                <p className="text-center text-sm text-gray-400">
                    Showing {users.length} of {totalUsers} operators
                </p>
            )}

            {/* Scroll to top */}
            {showScrollTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-6 right-6 z-50 flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all"
                    title="Scroll to top"
                >
                    <IconArrowUp size={20} />
                </button>
            )}
        </div>
    );
};

export default DesignationUsersPage;
