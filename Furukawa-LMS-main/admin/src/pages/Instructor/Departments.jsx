import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGetMyDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
    IconUsers,
    IconEye,
    IconSearch,
    IconCalendar,
    IconBook,
    IconClock,
} from '@tabler/icons-react'

const InstructorDepartments = () => {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const { data, isLoading, error } = useGetMyDepartmentsQuery()

    // All departments from the API
    const allDepartments = data?.data?.departments || []

    // Filter departments based on search
    const filteredDepartments = useMemo(() => {
        if (!search) return allDepartments
        return allDepartments.filter(department =>
            department.name.toLowerCase().includes(search.toLowerCase()) ||
            (department.course?.title || department.courses?.[0]?.title)?.toLowerCase().includes(search.toLowerCase()) ||
            department.notes?.toLowerCase().includes(search.toLowerCase())
        )
    }, [allDepartments, search])

    // Apply pagination to filtered results
    const itemsPerPage = 10
    const totalPages = Math.ceil(filteredDepartments.length / itemsPerPage)
    const startIndex = (page - 1) * itemsPerPage
    const departments = filteredDepartments.slice(startIndex, startIndex + itemsPerPage)

    // Reset page when search changes
    React.useEffect(() => {
        setPage(1)
    }, [search])

    const getStatusBadge = (status) => {
        switch (status) {
            case 'ACTIVE':
                return <Badge variant="success">Active</Badge>
            case 'UPCOMING':
                return <Badge variant="warning">Upcoming</Badge>
            case 'COMPLETED':
                return <Badge variant="outline">Completed</Badge>
            case 'PAUSED':
                return <Badge variant="secondary">Paused</Badge>
            default:
                return <Badge variant="secondary">{status}</Badge>
        }
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-9 w-64" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <Card key={i}>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <Skeleton className="h-6 w-48" />
                                    <Skeleton className="h-6 w-20" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-20 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <p className="text-muted-foreground">Failed to load departments</p>
                    <Button className="mt-4" onClick={() => window.location.reload()}>
                        Retry
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">My Sections</h1>
                    <p className="text-muted-foreground">
                        View your assigned sections and manage students
                    </p>
                </div>

                <div className="relative w-full sm:w-64">
                    <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search departments..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            {/* Departments List */}
            {departments.length > 0 ? (
                <div className="space-y-4">
                    {departments.map((department) => (
                        <Card key={department._id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg">{department.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {department.notes || 'No notes available'}
                                        </p>
                                    </div>
                                    {getStatusBadge(department.status)}
                                </div>
                            </CardHeader>

                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                    <div className="flex items-center space-x-2">
                                        <IconBook className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Course</p>
                                            <p className="font-medium text-sm">
                                                {department.course?.title || department.courses?.[0]?.title || 'No course assigned'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <IconUsers className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Students</p>
                                            <p className="font-medium text-sm">
                                                {department.students?.length || 0} enrolled
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <IconCalendar className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Start Date</p>
                                            <p className="font-medium text-sm">
                                                {formatDate(department.startDate)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <IconClock className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">End Date</p>
                                            <p className="font-medium text-sm">
                                                {formatDate(department.endDate)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t">
                                    <div className="text-xs text-muted-foreground">
                                        Created: {formatDate(department.createdAt)}
                                    </div>

                                    <div className="flex space-x-2">
                                        <Link to={`/trainer/employees?department=${department._id}`}>
                                            <Button variant="outline" size="sm">
                                                <IconUsers className="h-4 w-4 mr-2" />
                                                View Students
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="p-12">
                    <div className="text-center">
                        <IconUsers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Sections Found</h3>
                        <p className="text-muted-foreground">
                            {search ?
                                'No sections match your search criteria.' :
                                'You don\'t have any assigned sections yet.'
                            }
                        </p>
                    </div>
                </Card>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-4">
                    <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                    >
                        Previous
                    </Button>

                    <div className="flex items-center space-x-2">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNumber = i + 1
                            return (
                                <Button
                                    key={pageNumber}
                                    variant={page === pageNumber ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setPage(pageNumber)}
                                    className="w-10 h-10"
                                >
                                    {pageNumber}
                                </Button>
                            )
                        })}
                    </div>

                    <Button
                        variant="outline"
                        disabled={page === totalPages}
                        onClick={() => setPage(page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* Read-only Notice */}
            <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-6">
                    <div className="flex items-start space-x-3">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center mt-0.5">
                            <IconEye className="h-3 w-3 text-white" />
                        </div>
                        <div>
                            <h3 className="font-medium text-blue-900">Read-Only Access</h3>
                            <p className="text-sm text-blue-700 mt-1">
                                You can view section details and student information but cannot make modifications.
                                All sections assigned to you are visible (you can now be assigned to multiple sections).
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
};

export default InstructorDepartments;
