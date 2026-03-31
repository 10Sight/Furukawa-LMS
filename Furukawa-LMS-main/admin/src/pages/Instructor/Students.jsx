import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useGetInstructorDepartmentStudentsQuery, useGetInstructorAssignedDepartmentsQuery } from '@/Redux/AllApi/InstructorApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLazyExportStudentsQuery } from '@/Redux/AllApi/UserApi'
import { Badge } from '@/components/ui/badge'
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
import {
  IconUsers,
  IconEye,
  IconProgress,
  IconClipboardList,
  IconFileText,
  IconMail,
  IconPhone,
} from '@tabler/icons-react'

const InstructorStudents = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(searchParams.get('department') || '')

  const { data: departmentsData } = useGetInstructorAssignedDepartmentsQuery({ limit: 100 })
  const { data, isLoading, error } = useGetInstructorDepartmentStudentsQuery(
    selectedDepartmentId,
    { skip: !selectedDepartmentId }
  )

  const students = data?.data?.students || []
  const department = data?.data?.department
  const departments = departmentsData?.data?.departments || []
  const [triggerExportStudents, { isFetching: isExporting }] = useLazyExportStudentsQuery()

  useEffect(() => {
    const departmentFromParams = searchParams.get('department')
    if (departmentFromParams && departmentFromParams !== selectedDepartmentId) {
      setSelectedDepartmentId(departmentFromParams)
    }
  }, [searchParams, selectedDepartmentId])

  const handleDepartmentChange = (departmentId) => {
    setSelectedDepartmentId(departmentId)
    if (departmentId) {
      setSearchParams({ department: departmentId })
    } else {
      setSearchParams({})
    }
  }

  const getProgressColor = (progress) => {
    if (progress >= 80) return 'text-green-600'
    if (progress >= 60) return 'text-yellow-600'
    if (progress >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  if (isLoading && selectedDepartmentId) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {department?.name ? `${department.name} - Operators` : 'Operator Management'}
          </h1>
          <p className="text-muted-foreground">
            View and monitor operator progress and performance
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Select value={selectedDepartmentId} onValueChange={handleDepartmentChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a section" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id || department._id} value={department.id ? String(department.id) : String(department._id)}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={!selectedDepartmentId || isExporting}
            onClick={async () => {
              try {
                const { data } = await triggerExportStudents({ format: 'excel', departmentId: selectedDepartmentId })
                const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `department_${selectedDepartmentId}_employees_${new Date().toISOString().slice(0, 10)}.xlsx`
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
              } catch { }
            }}
          >
            Export Excel
          </Button>
          <Button
            variant="outline"
            disabled={!selectedDepartmentId || isExporting}
            onClick={async () => {
              try {
                const { data } = await triggerExportStudents({ format: 'pdf', departmentId: selectedDepartmentId })
                const blob = new Blob([data], { type: 'application/pdf' })
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `department_${selectedDepartmentId}_employees_${new Date().toISOString().slice(0, 10)}.pdf`
                document.body.appendChild(a)
                a.click()
                a.remove()
                window.URL.revokeObjectURL(url)
              } catch { }
            }}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {!selectedDepartmentId ? (
        <Card className="p-12">
          <div className="text-center">
            <IconUsers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Select a Section</h3>
            <p className="text-muted-foreground">
              Choose a section from your assigned sections to view operator data.
            </p>
          </div>
        </Card>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Failed to load employees</p>
        </div>
      ) : (
        <>
          {/* Students Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Employees ({students.length})</CardTitle>
                <Badge variant="outline">
                  <IconEye className="h-3 w-3 mr-1" />
                  Read-only View
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {students.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operator</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Test Scores</TableHead>
                      <TableHead>Assignments</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow key={student._id}>
                        <TableCell>
                          <div
                            className="cursor-pointer hover:underline text-blue-600"
                            onClick={() => navigate(`/trainer/employees/${student._id}`)}
                          >
                            <p className="font-medium">{student.fullName}</p>
                            <p className="text-sm text-muted-foreground">
                              @{student.userName}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center text-sm">
                              <IconMail className="h-3 w-3 mr-2" />
                              {student.email}
                            </div>
                            {student.phoneNumber && (
                              <div className="flex items-center text-sm text-muted-foreground">
                                <IconPhone className="h-3 w-3 mr-2" />
                                {student.phoneNumber}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${student.progress || 0}%` }}
                              ></div>
                            </div>
                            <span className={`text-sm font-medium ${getProgressColor(student.progress || 0)}`}>
                              {student.progress || 0}%
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">
                            <p>Avg: {student.averageQuizScore ?? 'N/A'}{student.averageQuizScore != null ? '%' : ''}</p>
                            <p className="text-muted-foreground">
                              {student.completedQuizzes || 0}/{student.totalQuizzes || 0} completed
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="text-sm">
                            <p>{student.submittedAssignments || 0}/{student.totalAssignments || 0}</p>
                            <p className="text-muted-foreground">submitted</p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={student.status === 'ACTIVE' ? 'success' : 'secondary'}>
                            {student.status || 'ACTIVE'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8">
                  <IconUsers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Employees Found</h3>
                  <p className="text-muted-foreground">
                    This department doesn't have any enrolled employees yet.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

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
                    You can view operator information, progress, test attempts, and assignment submissions
                    but cannot make any modifications or grade assignments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
};

export default InstructorStudents;


