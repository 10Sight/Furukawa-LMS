import React from 'react'
import { Link } from 'react-router-dom'
import { useGetInstructorDashboardStatsQuery } from '@/Redux/AllApi/InstructorApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  IconBook,
  IconUsers,
  IconClipboardList,
  IconFileText,
  IconEye,
  IconTrendingUp,
  IconCalendar,
  IconClipboard,
} from '@tabler/icons-react'

const InstructorDashboard = () => {
  const { data: stats, isLoading, error } = useGetInstructorDashboardStatsQuery()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Failed to load dashboard data</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const { courses, departments, students, recentActivities } = stats?.data || {}

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to your Instructor Dashboard
        </h2>
        <p className="text-muted-foreground">
          Create and manage your courses, modules, lessons, quizzes, and assignments. Monitor student progress and performance.
        </p>
        <Badge variant="success" className="mt-2">
          Full Content Management Access
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Assigned Courses
            </CardTitle>
            <IconBook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courses?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {courses?.published || 0} published courses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Departments
            </CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {departments?.active || 0} currently active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Students
            </CardTitle>
            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across all your departments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Recent Activity
            </CardTitle>
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentActivities?.count || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/trainer/courses">
              <Button variant="outline" className="w-full justify-start">
                <IconBook className="h-4 w-4 mr-2" />
                View My Courses
                <IconEye className="h-4 w-4 ml-auto" />
              </Button>
            </Link>

            <Link to="/trainer/departments">
              <Button variant="outline" className="w-full justify-start">
                <IconUsers className="h-4 w-4 mr-2" />
                View My Departments
                <IconEye className="h-4 w-4 ml-auto" />
              </Button>
            </Link>

            <Link to="/trainer/employees">
              <Button variant="outline" className="w-full justify-start">
                <IconUsers className="h-4 w-4 mr-2" />
                Monitor Students
                <IconEye className="h-4 w-4 ml-auto" />
              </Button>
            </Link>

            <Link to="/trainer/quiz-monitoring">
              <Button variant="outline" className="w-full justify-start">
                <IconClipboardList className="h-4 w-4 mr-2" />
                Test Monitoring
                <IconEye className="h-4 w-4 ml-auto" />
              </Button>
            </Link>

            <Link to="/trainer/assignment-monitoring">
              <Button variant="outline" className="w-full justify-start">
                <IconClipboard className="h-4 w-4 mr-2" />
                Assignment Monitoring
                <IconEye className="h-4 w-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities?.items?.length > 0 ? (
              <div className="space-y-3">
                {recentActivities.items.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content Management Capabilities */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
            <div>
              <h3 className="font-medium text-green-900">Full Content Management</h3>
              <p className="text-sm text-green-700 mt-1">
                You now have full authority to create, edit, and delete courses, modules, lessons,
                resources, quizzes, and assignments. You can also manage student departments,
                grade submissions, and issue certificates for your courses.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
};

export default InstructorDashboard;


