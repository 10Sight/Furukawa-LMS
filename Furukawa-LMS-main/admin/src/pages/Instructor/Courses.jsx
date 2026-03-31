import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGetInstructorAssignedCoursesQuery } from '@/Redux/AllApi/InstructorApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  IconBook,
  IconEye,
  IconSearch,
  IconClock,
  IconUsers,
  IconStar,
} from '@tabler/icons-react'

const InstructorCourses = () => {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const { data, isLoading, error } = useGetInstructorAssignedCoursesQuery({
    page,
    limit: 12,
    search
  })

  const courses = data?.data?.courses || []
  const totalPages = data?.data?.totalPages || 1

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return <Badge variant="success">Published</Badge>
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>
      case 'ARCHIVED':
        return <Badge variant="outline">Archived</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getLevelColor = (level) => {
    switch (level) {
      case 'BEGINNER':
        return 'text-green-600'
      case 'INTERMEDIATE':
        return 'text-yellow-600'
      case 'ADVANCED':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-6 w-3/4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full mb-4" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-20" />
                </div>
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
          <p className="text-muted-foreground">Failed to load courses</p>
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
          <h1 className="text-2xl font-bold">My Courses</h1>
          <p className="text-muted-foreground">
            View your assigned published courses
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Courses Grid */}
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courses.map((course) => (
            <Card key={course.id || course._id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start mb-2">
                  {getStatusBadge(course.status)}
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    <IconStar className="h-3 w-3" />
                    <span>{course.rating || '0.0'}</span>
                  </div>
                </div>
                <CardTitle className="text-lg line-clamp-2">
                  {course.title}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {course.description}
                </p>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Category:</span>
                    <Badge variant="outline" className="text-xs">
                      {course.category}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Level:</span>
                    <span className={`font-medium ${getLevelColor(course.level)}`}>
                      {course.level}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1">
                      <IconClock className="h-3 w-3" />
                      <span>{course.duration || 'N/A'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <IconUsers className="h-3 w-3" />
                      <span>{course.enrolledStudents || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <Link to={`/trainer/courses/${course.id || course._id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      <IconEye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <IconBook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Courses Found</h3>
            <p className="text-muted-foreground">
              {search ?
                'No courses match your search criteria.' :
                'You don\'t have any assigned courses yet.'
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
                You can view course details, modules, and lessons but cannot make any modifications.
                Only published courses assigned to you are visible.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
};

export default InstructorCourses;


