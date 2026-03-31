import React, { useState } from 'react'
import { useGetInstructorDepartmentAssignmentSubmissionsQuery, useGetInstructorAssignedDepartmentsQuery, useGetInstructorSubmissionDetailsQuery, useGradeInstructorSubmissionMutation } from '@/Redux/AllApi/InstructorApi'
import axiosInstance from '@/Helper/axiosInstance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  IconClipboard,
  IconEye,
  IconUser,
  IconClock,
  IconCheck,
  IconExternalLink,
  IconFile,
  IconCalendar,
} from '@tabler/icons-react'

const AssignmentMonitoring = () => {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null)
  const [gradeForm, setGradeForm] = useState({ grade: '', feedback: '' })

  const { data: departmentsData } = useGetInstructorAssignedDepartmentsQuery({ limit: 100 })
  const { data, isLoading, error } = useGetInstructorDepartmentAssignmentSubmissionsQuery(
    { departmentId: selectedDepartmentId },
    { skip: !selectedDepartmentId }
  )
  const { data: submissionDetails, isLoading: detailsLoading } = useGetInstructorSubmissionDetailsQuery(
    selectedSubmissionId,
    { skip: !selectedSubmissionId }
  )

  const [gradeSubmission, { isLoading: gradingLoading }] = useGradeInstructorSubmissionMutation()

  const submissions = data?.data?.submissions || []
  const departments = departmentsData?.data?.departments || []
  const submission = submissionDetails?.data

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUBMITTED':
        return <Badge variant="info"><IconCheck className="h-3 w-3 mr-1" />Submitted</Badge>
      case 'GRADED':
        return <Badge variant="success"><IconCheck className="h-3 w-3 mr-1" />Graded</Badge>
      case 'LATE':
        return <Badge variant="destructive"><IconClock className="h-3 w-3 mr-1" />Late</Badge>
      case 'PENDING':
        return <Badge variant="warning"><IconClock className="h-3 w-3 mr-1" />Pending</Badge>
      case 'DRAFT':
        return <Badge variant="secondary">Draft</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getGradeColor = (grade, maxScore) => {
    if (!maxScore || grade === null) return 'text-gray-500'
    const percentage = (grade / maxScore) * 100
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleViewSubmission = (submissionId) => {
    setSelectedSubmissionId(submissionId)
    setGradeForm({ grade: '', feedback: '' })
  }

  const handleCloseDialog = () => {
    setSelectedSubmissionId(null)
    setGradeForm({ grade: '', feedback: '' })
  }

  const handleGradeSubmit = async () => {
    if (!submission) return

    try {
      const gradeValue = gradeForm.grade === '' ? null : parseFloat(gradeForm.grade)
      if (gradeValue !== null && (isNaN(gradeValue) || gradeValue < 0)) {
        toast.error('Please enter a valid grade')
        return
      }

      if (gradeValue !== null && submission.assignment?.maxScore && gradeValue > submission.assignment.maxScore) {
        toast.error(`Grade cannot exceed maximum score of ${submission.assignment.maxScore}`)
        return
      }

      await gradeSubmission({
        submissionId: selectedSubmissionId,
        grade: gradeValue,
        feedback: gradeForm.feedback || ''
      }).unwrap()

      toast.success('Submission graded successfully')
      handleCloseDialog()
    } catch (error) {
      toast.error(error?.data?.message || 'Error grading submission')
    }
  }

  const handleDownloadFile = async (fileIndex) => {
    try {
      const response = await axiosInstance({
        url: `/api/instructor/submissions/${selectedSubmissionId}/files/${fileIndex}`,
        method: 'GET',
        responseType: 'blob'
      })

      // Create download link
      const url = window.URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url

      // Get filename from response headers or use fallback
      const contentDisposition = response.headers['content-disposition']
      let fileName = `file-${fileIndex}`

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="([^"]*)"/)
        if (fileNameMatch) {
          fileName = fileNameMatch[1]
        }
      } else if (submission?.attachments?.[fileIndex]?.originalName) {
        fileName = submission.attachments[fileIndex].originalName
      } else if (fileIndex === 'legacy') {
        fileName = 'legacy-file'
      }

      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('File downloaded successfully')
    } catch (error) {
      console.error('Download error:', error)
      toast.error(error?.response?.data?.message || 'Error downloading file')
    }
  }

  // Set initial grade values when submission loads
  React.useEffect(() => {
    if (submission && selectedSubmissionId) {
      setGradeForm({
        grade: submission.grade !== null ? submission.grade.toString() : '',
        feedback: submission.feedback || ''
      })
    }
  }, [submission, selectedSubmissionId])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Assignment Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor student assignment submissions and progress across your departments
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          <IconClipboard className="h-3 w-3 mr-1" />
          Assignment Grading
        </Badge>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center mt-0.5">
              <IconClipboard className="h-3 w-3 text-white" />
            </div>
            <div>
              <h3 className="font-medium text-amber-900">Assignment Monitoring & Grading</h3>
              <p className="text-sm text-amber-700 mt-1">
                View student assignment submissions, download files, and grade assignments.
                Click "View" on any submission to see details and provide grades with feedback.
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
          <div className="w-full max-w-md">
            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a department to view assignment data" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id || department._id} value={department.id ? String(department.id) : String(department._id)}>
                    <div className="flex flex-col sm:flex-row sm:justify-between w-full">
                      <span className="font-medium">{department.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {department.students?.length || 0} students
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!selectedDepartmentId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <IconClipboard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Section</h3>
            <p className="text-muted-foreground">
              Choose a section from your assigned sections to view assignment monitoring data.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Recent Assignment Submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : submissions.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Student</TableHead>
                      <TableHead className="min-w-[180px]">Assignment</TableHead>
                      <TableHead className="min-w-[100px]">Status</TableHead>
                      <TableHead className="min-w-[120px]">Grade</TableHead>
                      <TableHead className="min-w-[120px]">Submitted</TableHead>
                      <TableHead className="min-w-[120px]">Files</TableHead>
                      <TableHead className="min-w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((submission) => (
                      <TableRow key={submission._id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <IconUser className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="font-medium truncate">{submission.student?.fullName}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                @{submission.student?.userName}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{submission.assignment?.title}</p>
                            <div className="flex items-center space-x-1 text-sm text-muted-foreground mt-1">
                              <IconCalendar className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">Due: {new Date(submission.assignment?.dueDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {getStatusBadge(submission.status)}
                        </TableCell>

                        <TableCell>
                          {submission.grade !== null && submission.assignment?.maxScore ? (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2">
                              <span className={`font-medium ${getGradeColor(submission.grade, submission.assignment.maxScore)}`}>
                                {submission.grade}/{submission.assignment.maxScore}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({Math.round((submission.grade / submission.assignment.maxScore) * 100)}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not graded</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {submission.submittedAt ? (
                            <div className="min-w-0">
                              <p className="text-sm truncate">
                                {new Date(submission.submittedAt).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {new Date(submission.submittedAt).toLocaleTimeString()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not submitted</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {submission.attachments?.length > 0 ? (
                            <div className="space-y-1">
                              {submission.attachments.slice(0, 2).map((file, index) => (
                                <div key={index} className="flex items-center space-x-1 text-sm">
                                  <IconFile className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate max-w-24 sm:max-w-32">{file.filename}</span>
                                  <span className="text-xs text-muted-foreground hidden sm:inline">
                                    ({formatFileSize(file.fileSize)})
                                  </span>
                                </div>
                              ))}
                              {submission.attachments.length > 2 && (
                                <p className="text-xs text-muted-foreground">
                                  +{submission.attachments.length - 2} more
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">No files</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs px-2"
                              onClick={() => handleViewSubmission(submission._id)}
                            >
                              <IconEye className="h-3 w-3 sm:mr-1" />
                              <span className="hidden sm:inline">View</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8">
                <IconClipboard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Assignment Submissions</h3>
                <p className="text-muted-foreground">
                  No assignment submissions found for the selected department.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submission Details Dialog */}
      <Dialog open={!!selectedSubmissionId} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <IconClipboard className="h-5 w-5" />
              <span>Submission Details</span>
            </DialogTitle>
          </DialogHeader>

          {detailsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : submission ? (
            <div className="space-y-6">
              {/* Student and Assignment Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Student Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-sm font-medium">Name</Label>
                      <p className="text-sm">{submission.student?.fullName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Username</Label>
                      <p className="text-sm text-muted-foreground">@{submission.student?.userName}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <p className="text-sm text-muted-foreground">{submission.student?.email}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Assignment Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <Label className="text-sm font-medium">Title</Label>
                      <p className="text-sm">{submission.assignment?.title}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Due Date</Label>
                      <p className="text-sm">{new Date(submission.assignment?.dueDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Max Score</Label>
                      <p className="text-sm">{submission.assignment?.maxScore}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(submission.status)}
                        {submission.isLate && (
                          <Badge variant="destructive" className="text-xs">
                            Late
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Submitted Files */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Submitted Files</CardTitle>
                </CardHeader>
                <CardContent>
                  {submission.attachments?.length > 0 ? (
                    <div className="space-y-3">
                      {submission.attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <IconFile className="h-8 w-8 text-blue-500" />
                            <div>
                              <p className="font-medium text-sm">{file.originalName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.fileSize)} • {file.mimeType}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Uploaded: {new Date(file.uploadedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadFile(index)}
                            className="flex items-center space-x-2"
                          >
                            <IconExternalLink className="h-4 w-4" />
                            <span>Download</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : submission.fileUrl ? (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <IconFile className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">Legacy File</p>
                          <p className="text-xs text-muted-foreground">Click to download</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadFile('legacy')}
                        className="flex items-center space-x-2"
                      >
                        <IconExternalLink className="h-4 w-4" />
                        <span>Download</span>
                      </Button>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No files attached</p>
                  )}
                </CardContent>
              </Card>

              {/* Grading Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Grading</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="grade">Grade (Max: {submission.assignment?.maxScore})</Label>
                      <Input
                        id="grade"
                        type="number"
                        min="0"
                        max={submission.assignment?.maxScore}
                        placeholder="Enter grade"
                        value={gradeForm.grade}
                        onChange={(e) => setGradeForm(prev => ({ ...prev, grade: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Current Status</Label>
                      <div className="flex items-center space-x-2 pt-2">
                        {submission.grade !== null ? (
                          <div className="flex items-center space-x-2">
                            <span className={`font-medium ${getGradeColor(submission.grade, submission.assignment?.maxScore)}`}>
                              {submission.grade}/{submission.assignment?.maxScore}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({Math.round((submission.grade / submission.assignment?.maxScore) * 100)}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not graded yet</span>
                        )}
                      </div>
                      {submission.gradedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Graded on {new Date(submission.gradedAt).toLocaleString()}
                          {submission.gradedBy && ` by ${submission.gradedBy.fullName}`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="feedback">Feedback</Label>
                    <Textarea
                      id="feedback"
                      rows={4}
                      placeholder="Enter feedback for the student"
                      value={gradeForm.feedback}
                      onChange={(e) => setGradeForm(prev => ({ ...prev, feedback: e.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleGradeSubmit}
                      disabled={gradingLoading}
                    >
                      {gradingLoading ? 'Grading...' : 'Save Grade'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Submission not found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AssignmentMonitoring
