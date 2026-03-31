import React, { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useGetCourseCompletionReportQuery } from '@/Redux/AllApi/ProgressApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  GraduationCap,
  Download,
  Calendar,
  User,
  BookOpen,
  CheckCircle,
  XCircle,
  Award,
  BarChart3,
  Clock,
  Target,
  FileText,
  Printer
} from 'lucide-react'
// Dynamic imports for better Vite compatibility

const CourseReport = () => {
  const { courseId } = useParams()
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const reportRef = useRef(null)

  // Get current user from Redux state
  const { user } = useSelector((state) => state.auth)

  const { data, isLoading, error } = useGetCourseCompletionReportQuery(courseId, {
    skip: !courseId
  })


  // Add print-friendly styles
  useEffect(() => {
    const printStyles = `
      @media print {
        body * {
          visibility: hidden;
        }
        #report-content, #report-content * {
          visibility: visible;
        }
        #report-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        #download-button {
          display: none !important;
        }
        .print-break {
          page-break-after: always;
        }
      }
    `

    const styleSheet = document.createElement("style")
    styleSheet.type = "text/css"
    styleSheet.innerText = printStyles
    document.head.appendChild(styleSheet)

    return () => {
      document.head.removeChild(styleSheet)
    }
  }, [])

  const reportData = data?.data

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatTime = (seconds) => {
    if (!seconds) return 'N/A'
    const minutes = Math.round(seconds / 60)
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  const getQuizStatusColor = (status) => {
    return status === 'PASSED'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800'
  }

  const generatePDF = () => {
    if (!reportRef.current) return

    setIsGeneratingPDF(true)

    try {
      // Hide the download button during print
      const downloadButton = document.querySelector('#download-button')
      if (downloadButton) downloadButton.style.display = 'none'

      // Open print dialog
      window.print()

      // Show button again after a delay
      setTimeout(() => {
        if (downloadButton) downloadButton.style.display = 'block'
      }, 1000)
    } catch (error) {
      console.error('Error opening print dialog:', error)
      alert('Failed to open print dialog. You can try using Ctrl+P to save as PDF.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {error?.data?.message || 'Failed to load course completion report. Please ensure you have completed the course.'}
          </AlertDescription>
        </Alert>

        {/* Debug Information */}
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <strong>Debug Info:</strong><br />
            Current User Role: {user?.role || 'Not found'}<br />
            User Name: {user?.userName || 'Not found'}<br />
            Course ID: {courseId}<br />
            Error Status: {error?.status}<br />
            Token in localStorage: {localStorage.getItem('token') ? 'Present' : 'Missing'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!reportData) {
    return (
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Course completion report not available. Please complete all modules and quizzes first.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Download Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Course Completion Report</h1>
          <p className="text-muted-foreground">
            Your comprehensive course completion certificate and performance report
          </p>
        </div>
        <Button
          id="download-button"
          onClick={generatePDF}
          disabled={isGeneratingPDF}
          className="flex items-center gap-2"
        >
          {isGeneratingPDF ? (
            <>
              <Printer className="h-4 w-4 animate-spin" />
              Opening Print...
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" />
              Print/Save as PDF
            </>
          )}
        </Button>
      </div>

      {/* Report Content */}
      <div id="report-content" ref={reportRef} className="bg-white">
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center bg-gradient-to-r from-blue-50 to-indigo-100 border-b">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                <GraduationCap className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl text-primary">Course Completion Report</CardTitle>
            <p className="text-muted-foreground">Learning Management System</p>
          </CardHeader>

          <CardContent className="space-y-6 p-4 sm:p-6 md:p-8">
            {/* Student Information */}
            <div className="text-center space-y-4">
              <h2 className="text-xl font-semibold">This is to certify that</h2>
              <h1 className="text-2xl sm:text-3xl font-bold text-primary">{reportData.student.fullName}</h1>
              <p className="text-muted-foreground">(@{reportData.student.userName})</p>
              <p className="text-base sm:text-lg">has successfully completed the course</p>
              <h2 className="text-xl sm:text-2xl font-bold">{reportData.course.title}</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto px-4">{reportData.course.description}</p>
            </div>

            <Separator />

            {/* Course Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <Card className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Course Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted-foreground">Section:</span>
                    <span className="font-medium">{reportData.department.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted-foreground">Instructor:</span>
                    <span className="font-medium">{reportData.instructor.fullName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted-foreground">Start Date:</span>
                    <span className="font-medium">{formatDate(reportData.department.startDate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted-foreground">Completion Date:</span>
                    <span className="font-medium">{formatDate(reportData.progress.completedAt)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-muted">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Progress Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted-foreground">Modules Completed:</span>
                    <span className="font-medium">
                      {reportData.progress.completedModules}/{reportData.progress.totalModules}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted-foreground">Lessons Completed:</span>
                    <span className="font-medium">{reportData.progress.completedLessons}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted-foreground">Current Level:</span>
                    <Badge variant="secondary">{reportData.progress.currentLevel}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm gap-2">
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="font-medium text-green-600">{reportData.progress.progressPercent}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Quiz Performance */}
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5" />
                Test Performance Summary
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">{reportData.quizSummary.totalQuizzes}</div>
                    <div className="text-sm text-muted-foreground">Total Tests</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">{reportData.quizSummary.passedQuizzes}</div>
                    <div className="text-sm text-muted-foreground">Passed</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-red-600">{reportData.quizSummary.failedQuizzes}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">{reportData.quizSummary.averageScore}%</div>
                    <div className="text-sm text-muted-foreground">Average Score</div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Quiz Results */}
              {reportData.quizResults.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detailed Test Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Test Title</th>
                            <th className="text-left py-2">Type</th>
                            <th className="text-center py-2">Score</th>
                            <th className="text-center py-2">Percentage</th>
                            <th className="text-center py-2">Status</th>
                            <th className="text-left py-2">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.quizResults.map((quiz, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-3 font-medium">{quiz.quizTitle}</td>
                              <td className="py-3">
                                <Badge variant="outline" className="text-xs">
                                  {quiz.quizType}
                                </Badge>
                              </td>
                              <td className="py-3 text-center">
                                {quiz.score}/{quiz.totalQuestions}
                              </td>
                              <td className="py-3 text-center font-medium">
                                {quiz.scorePercent}%
                              </td>
                              <td className="py-3 text-center">
                                <Badge className={getQuizStatusColor(quiz.status)}>
                                  {quiz.status === 'PASSED' ? (
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                  ) : (
                                    <XCircle className="h-3 w-3 mr-1" />
                                  )}
                                  {quiz.status}
                                </Badge>
                              </td>
                              <td className="py-3 text-sm">
                                {formatDate(quiz.attemptDate)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* Certificate Footer */}
            <div className="text-center space-y-4 pt-4">
              <div className="flex justify-center">
                <Award className="h-12 w-12 text-yellow-500" />
              </div>
              <p className="text-lg font-semibold">Congratulations on your achievement!</p>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-6 sm:gap-0 pt-8 max-w-lg mx-auto">
                <div className="text-center">
                  <div className="border-t border-gray-400 w-32 mb-2"></div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatDate(reportData.generatedAt)}</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-gray-400 w-32 mb-2"></div>
                  <p className="text-sm text-muted-foreground">Instructor</p>
                  <p className="text-sm font-medium">{reportData.instructor.fullName}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default CourseReport
