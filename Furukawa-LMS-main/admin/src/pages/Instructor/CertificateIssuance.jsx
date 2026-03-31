import React, { useState } from 'react'
import { useGetInstructorAssignedDepartmentsQuery } from '@/Redux/AllApi/InstructorApi'
import {
  useCheckCertificateEligibilityQuery,
  useIssueCertificateWithTemplateMutation,
  useGenerateCertificatePreviewMutation
} from '@/Redux/AllApi/CertificateApi'
import { useGetCertificateTemplatesQuery } from '@/Redux/AllApi/CertificateTemplateApi'
import { useGradeSubmissionMutation } from '@/Redux/AllApi/SubmissionApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Award,
  Users,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  AlertTriangle,
  GraduationCap
} from 'lucide-react'
import { toast } from 'sonner'

const CertificateIssuance = () => {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showEligibilityDialog, setShowEligibilityDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [showIssueDialog, setShowIssueDialog] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [grade, setGrade] = useState('')
  const [previewHtml, setPreviewHtml] = useState('')

  const { data: departmentsData } = useGetInstructorAssignedDepartmentsQuery({ limit: 100 })
  const { data: templatesData } = useGetCertificateTemplatesQuery()

  const departments = departmentsData?.data?.departments || []
  const templates = templatesData?.data || []

  const selectedDepartment = departments.find(b => b._id === selectedDepartmentId)
  const students = selectedDepartment?.students || []

  const {
    data: eligibilityData,
    isLoading: checkingEligibility,
    refetch: recheckEligibility
  } = useCheckCertificateEligibilityQuery(
    {
      studentId: selectedStudent?._id,
      courseId: selectedDepartment?.course?._id
    },
    {
      skip: !selectedStudent?._id || !selectedDepartment?.course?._id
    }
  )

  const [issueCertificate, { isLoading: isIssuing }] = useIssueCertificateWithTemplateMutation()
  const [generatePreview, { isLoading: generatingPreview }] = useGenerateCertificatePreviewMutation()
  const [gradeSubmission] = useGradeSubmissionMutation()

  const handleCheckEligibility = (student) => {
    setSelectedStudent(student)
    setShowEligibilityDialog(true)
  }

  const handleGeneratePreview = async () => {
    if (!selectedStudent || !selectedDepartment) return

    try {
      const response = await generatePreview({
        studentId: selectedStudent._id,
        courseId: selectedDepartment.course._id,
        templateId: selectedTemplateId || undefined
      }).unwrap()

      const styles = response?.data?.preview?.styles || ''
      const html = response?.data?.preview?.html || '<p>Preview not available</p>'

      const finalHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Certificate Preview</title>
  <style>
    body { 
      margin: 0; 
      padding: 20px; 
      font-family: Arial, sans-serif; 
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .preview-container {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    ${styles}
  </style>
</head>
<body>
  <div class="preview-container">
    ${html}
  </div>
</body>
</html>`

      setPreviewHtml(finalHtml)
      setShowPreviewDialog(true)
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to generate preview')
    }
  }

  const handleIssueCertificate = async () => {
    if (!selectedStudent || !selectedDepartment) return

    try {
      await issueCertificate({
        studentId: selectedStudent._id,
        courseId: selectedDepartment.course._id,
        grade: grade || 'PASS',
        templateId: selectedTemplateId || undefined
      }).unwrap()

      toast.success('Certificate issued successfully!')
      setShowIssueDialog(false)
      setSelectedStudent(null)
      setGrade('')
      recheckEligibility()
    } catch (error) {
      toast.error(error?.data?.message || 'Failed to issue certificate')
    }
  }

  const getEligibilityIcon = (eligible) => {
    return eligible ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    )
  }

  const getRequirementIcon = (met) => {
    return met ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6" />
            Certificate Issuance
          </h1>
          <p className="text-muted-foreground">
            Check student eligibility and issue course completion certificates
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Students must complete all course modules, pass all quizzes, and have all assignments graded before certificates can be issued.
        </AlertDescription>
      </Alert>

      {/* Department Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Department</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full max-w-md">
            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a department to view students" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department._id} value={department._id}>
                    {department.name} - {department.course?.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedDepartmentId && (
        <Card>
          <CardHeader>
            <CardTitle>Students - {selectedDepartment?.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {students.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.fullName}</p>
                          <p className="text-sm text-muted-foreground">
                            @{student.userName}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${student.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {student.progress || 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'ACTIVE' ? 'success' : 'secondary'}>
                          {student.status || 'ACTIVE'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCheckEligibility(student)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Check Eligibility
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Students Found</h3>
                <p className="text-muted-foreground">
                  This department doesn't have any enrolled students yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Eligibility Dialog */}
      <Dialog open={showEligibilityDialog} onOpenChange={setShowEligibilityDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Certificate Eligibility - {selectedStudent?.fullName}
            </DialogTitle>
          </DialogHeader>

          {checkingEligibility ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : eligibilityData?.data ? (
            <div className="space-y-6">
              {/* Overall Eligibility */}
              <Card className={eligibilityData?.data?.eligible ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    {getEligibilityIcon(eligibilityData?.data?.eligible)}
                    <div>
                      <h3 className="font-medium">
                        {eligibilityData?.data?.eligible ? 'Eligible for Certificate' : 'Not Eligible'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {eligibilityData?.data?.reason || 'Checking eligibility...'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Requirements Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      {getRequirementIcon(eligibilityData?.data?.requirements?.courseCompletion)}
                      <div>
                        <h4 className="font-medium">Course Completion</h4>
                        <p className="text-sm text-muted-foreground">
                          {eligibilityData?.data?.details?.progress?.completedModules || 0}/
                          {eligibilityData?.data?.details?.progress?.totalModules || 0} modules
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      {getRequirementIcon(eligibilityData?.data?.requirements?.quizPassed)}
                      <div>
                        <h4 className="font-medium">Test Performance</h4>
                        <p className="text-sm text-muted-foreground">
                          {eligibilityData?.data?.details?.quizzes?.passedQuizzes || 0}/
                          {eligibilityData?.data?.details?.quizzes?.totalAttempts || 0} passed
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      {getRequirementIcon(eligibilityData?.data?.requirements?.assignmentsGraded)}
                      <div>
                        <h4 className="font-medium">Assignments</h4>
                        <p className="text-sm text-muted-foreground">
                          {eligibilityData?.data?.details?.assignments?.gradedSubmissions || 0}/
                          {eligibilityData?.data?.details?.assignments?.totalSubmissions || 0} graded
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Assignment Details */}
              {eligibilityData?.data?.details?.assignments?.submissions && eligibilityData.data.details.assignments.submissions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Assignment Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Assignment</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Max Score</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eligibilityData.data.details.assignments.submissions.map((sub, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {sub.assignment}
                            </TableCell>
                            <TableCell>
                              {sub.grade !== null ? sub.grade : 'Not graded'}
                            </TableCell>
                            <TableCell>{sub.maxScore}</TableCell>
                            <TableCell>
                              <Badge variant={sub.isGraded ? 'success' : 'secondary'}>
                                {sub.isGraded ? 'Graded' : 'Pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowEligibilityDialog(false)}
                >
                  Close
                </Button>
                {eligibilityData?.data?.eligible && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleGeneratePreview}
                      disabled={generatingPreview}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {generatingPreview ? 'Generating...' : 'Preview'}
                    </Button>
                    <Button
                      onClick={() => setShowIssueDialog(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Award className="h-4 w-4 mr-2" />
                      Issue Certificate
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load eligibility data. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* Issue Certificate Dialog */}
      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Certificate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="template">Certificate Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Use default template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template._id} value={template._id}>
                      {template.name} {template.isDefault && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="grade">Grade (Optional)</Label>
              <Input
                id="grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Enter grade (e.g., A+, PASS)"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowIssueDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleIssueCertificate} disabled={isIssuing}>
                <GraduationCap className="h-4 w-4 mr-2" />
                {isIssuing ? 'Issuing...' : 'Issue Certificate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Certificate Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 border rounded-lg bg-white overflow-hidden" style={{ minHeight: '500px', height: '70vh' }}>
            <iframe
              srcDoc={previewHtml}
              className="w-full h-full border-0"
              sandbox="allow-same-origin allow-scripts"
              title="Certificate Preview"
              loading="eager"
            />
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setShowPreviewDialog(false)
              setShowIssueDialog(true)
            }}>
              Issue Certificate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CertificateIssuance
