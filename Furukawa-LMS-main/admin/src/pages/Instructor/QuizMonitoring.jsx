import React, { useState } from 'react'
import { useGetInstructorDepartmentQuizAttemptsQuery, useGetInstructorAssignedDepartmentsQuery } from '@/Redux/AllApi/InstructorApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { IconEye, IconClipboardList, IconUser } from "@tabler/icons-react";
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import AttemptReviewModal from '@/components/common/AttemptReviewModal'

const QuizMonitoring = () => {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [viewAttemptId, setViewAttemptId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const { data: departmentsData } = useGetInstructorAssignedDepartmentsQuery({ limit: 100 })
  const { data, isLoading, error } = useGetInstructorDepartmentQuizAttemptsQuery(
    { departmentId: selectedDepartmentId },
    { skip: !selectedDepartmentId }
  )

  const quizAttempts = data?.data?.attempts || []
  const departments = departmentsData?.data?.departments || []

  const getScoreColor = (score, totalScore) => {
    if (!totalScore || totalScore === 0) return 'text-gray-500'
    const percentage = (score / totalScore) * 100
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success"><IconCheck className="h-3 w-3 mr-1" />Completed</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="warning"><IconClock className="h-3 w-3 mr-1" />In Progress</Badge>
      case 'NOT_STARTED':
        return <Badge variant="secondary">Not Started</Badge>
      case 'SUBMITTED':
        return <Badge variant="info">Submitted</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Test Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor student test attempts and performance across your departments
          </p>
        </div>
        <Badge variant="outline">
          <IconEye className="h-3 w-3 mr-1" />
          Read-only View
        </Badge>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center mt-0.5">
              <IconClipboardList className="h-3 w-3 text-white" />
            </div>
            <div>
              <h3 className="font-medium text-amber-900">Test Monitoring</h3>
              <p className="text-sm text-amber-700 mt-1">
                You can view test results, attempts, and student performance but cannot create,
                edit, or grade quizzes. Select a department to view test data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Department Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Department</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a department to view test data" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id || department._id} value={department.id ? String(department.id) : String(department._id)}>
                  {department.name} - {department.students?.length || 0} students
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!selectedDepartmentId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <IconClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Section</h3>
            <p className="text-muted-foreground">
              Choose a section from your assigned sections to view test monitoring data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Test Attempts</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <IconClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2 text-red-600">Error Loading Data</h3>
                <p className="text-muted-foreground">
                  {error?.data?.message || 'Failed to load test attempts. Please try again.'}
                </p>
              </div>
            ) : quizAttempts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempt Date</TableHead>
                    <TableHead>Time Taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizAttempts.map((attempt) => (
                    <TableRow key={attempt._id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <IconUser className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{attempt.student?.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              @{attempt.student?.userName}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <p className="font-medium">{attempt.quiz?.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {attempt.quiz?.questions?.length || 0} questions
                        </p>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium ${getScoreColor(attempt.score, attempt.totalScore)}`}>
                            {attempt.score}/{attempt.totalScore}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({attempt.totalScore > 0 ? Math.round((attempt.score / attempt.totalScore) * 100) : 0}%)
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        {getStatusBadge(attempt.status)}
                      </TableCell>

                      <TableCell>
                        <p className="text-sm">
                          {new Date(attempt.submittedAt || attempt.startedAt).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(attempt.submittedAt || attempt.startedAt).toLocaleTimeString()}
                        </p>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <p className="text-sm">
                            {attempt.timeTaken ? `${Math.round(attempt.timeTaken / 60)} min` : 'N/A'}
                          </p>
                          <Button size="sm" variant="outline" onClick={() => { setViewAttemptId(attempt._id); setModalOpen(true); }}>
                            <IconEye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <IconClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Test Attempts</h3>
                <p className="text-muted-foreground">
                  No test attempts found for the selected department.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Attempt Review Modal (read-only for instructor) */}
      <AttemptReviewModal attemptId={viewAttemptId} isOpen={modalOpen} onClose={() => setModalOpen(false)} canEdit={false} />
    </div>
  )
}

export default QuizMonitoring
