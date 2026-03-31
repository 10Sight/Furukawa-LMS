import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  FileText,
  GraduationCap,
  Calendar,
  CheckCircle,
  Award,
  BookOpen,
  Users,
  TrendingUp
} from 'lucide-react'
import { useGetMyAllProgressQuery } from '@/Redux/AllApi/ProgressApi'

const Reports = () => {
  const navigate = useNavigate()
  const { data, isLoading, error } = useGetMyAllProgressQuery()

  const progressData = data?.data || []

  // Filter courses with accessible reports (server computes reportAvailable based on modules + quizzes)
  const accessibleReports = progressData.filter(progress => progress.reportAvailable);

  // Separate other completed courses that are not yet report-ready
  const otherCompletedCourses = progressData.filter(progress => {
    const isComplete = progress.progressPercent === 100;
    return isComplete && !progress.reportAvailable;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleViewReport = (courseId) => {
    navigate(`/student/report/${courseId}`)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          <Skeleton className="h-4 w-96 mx-auto" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-48">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
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
      <Alert variant="destructive">
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Failed to load your course progress. Please try again later.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <GraduationCap className="h-8 w-8 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Course Reports</h1>
          <p className="text-base sm:text-lg text-muted-foreground mt-2">
            Download completion certificates and performance reports for your finished courses
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center flex-wrap gap-3 sm:gap-4 p-4 sm:p-6">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg mr-4">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{progressData.filter(p => p.progressPercent === 100).length}</p>
              <p className="text-sm text-muted-foreground">Completed Courses</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center flex-wrap gap-3 sm:gap-4 p-4 sm:p-6">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg mr-4">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{progressData.length}</p>
              <p className="text-sm text-muted-foreground">Total Enrolled</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center flex-wrap gap-3 sm:gap-4 p-4 sm:p-6">
            <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg mr-4">
              <Award className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{accessibleReports.length}</p>
              <p className="text-sm text-muted-foreground">Reports Available</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accessible Course Reports */}
      {accessibleReports.length > 0 ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Available Course Reports</h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {accessibleReports.map((progress) => (
              <Card key={progress._id} className="hover:shadow-lg transition-shadow border border-green-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base sm:text-lg leading-6 mb-2 break-words">
                        {progress.course?.title || 'Course Title'}
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground mb-2">
                        <Users className="h-4 w-4" />
                        <span>Section: {progress.department?.name || 'N/A'}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm gap-2">
                      <span className="text-muted-foreground">Progress:</span>
                      <span className="font-medium text-green-600">{progress.progressPercent}%</span>
                    </div>

                    <div className="flex justify-between text-xs sm:text-sm gap-2">
                      <span className="text-muted-foreground">Level:</span>
                      <Badge variant="outline" className="text-xs">
                        {progress.currentLevel}
                      </Badge>
                    </div>

                    <div className="flex justify-between text-xs sm:text-sm gap-2">
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="font-medium">
                        {formatDate(progress.completedAt)}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={() => handleViewReport(progress.course._id)}
                    className="w-full"
                    variant="outline"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Report
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-gray-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Course Reports Available</h3>
            <p className="text-muted-foreground mb-4">
              Complete a course, finish all modules, and pass all required quizzes to generate your first report and certificate!
            </p>
            <Button
              onClick={() => navigate('/student/course')}
              variant="outline"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Courses
            </Button>
          </CardContent>
        </Card>
      )}

      {/* In Progress Courses */}
      {progressData.length > accessibleReports.length && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <h2 className="text-2xl font-semibold text-gray-900">Courses In Progress</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {progressData
              .filter(progress => !progress.isCompleted || progress.progressPercent < 100)
              .map((progress) => (
                <Card key={progress._id} className="border border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base sm:text-lg">
                      {progress.course?.title || 'Course Title'}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Users className="h-4 w-4" />
                      <span>Section: {progress.department?.name || 'N/A'}</span>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs sm:text-sm gap-2">
                        <span className="text-muted-foreground">Progress:</span>
                        <span className="font-medium">{progress.progressPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${progress.progressPercent}%` }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Complete this course to generate your certificate
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
