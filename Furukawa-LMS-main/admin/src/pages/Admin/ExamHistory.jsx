import React, { useMemo, useState, useEffect } from 'react'
import { useGetExamHistoryStatsQuery, useLazyExportExamHistoryQuery } from '@/Redux/AllApi/AnalyticsApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { IconChartBar, IconDownload } from '@tabler/icons-react'

const Bar = ({ value = 0, max = 1, color = 'bg-blue-600' }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full bg-muted rounded h-2">
      <div className={`${color} h-2 rounded`} style={{ width: `${pct}%` }} />
    </div>
  )
}

const ExamHistory = () => {
  const [groupBy, setGroupBy] = useState('month')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [studentId, setStudentId] = useState('')

  const params = useMemo(() => ({ groupBy, year: groupBy === 'month' ? year : '' , studentId: studentId || '' }), [groupBy, year, studentId])
  const { data, isLoading, refetch } = useGetExamHistoryStatsQuery(params)
  const [triggerExport, { isFetching: isExporting }] = useLazyExportExamHistoryQuery()

  const labels = data?.data?.labels || []
  const series = data?.data?.series || { total: [], passed: [], failed: [] }
  const maxValue = Math.max(1, ...series.total)

  useEffect(() => { refetch() }, [groupBy, year, studentId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exam History</h1>
          <p className="text-muted-foreground">Pass/Fail trend grouped by {groupBy}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={isExporting} onClick={async () => {
            const { data: blobData } = await triggerExport({ ...params, format: 'excel' })
            const blob = new Blob([blobData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `exam_history_${groupBy}.xlsx`
            document.body.appendChild(a)
            a.click(); a.remove(); window.URL.revokeObjectURL(url)
          }}>
            <IconDownload className="h-4 w-4 mr-2"/> Excel
          </Button>
          <Button variant="outline" disabled={isExporting} onClick={async () => {
            const { data: blobData } = await triggerExport({ ...params, format: 'pdf' })
            const blob = new Blob([blobData], { type: 'application/pdf' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `exam_history_${groupBy}.pdf`
            document.body.appendChild(a)
            a.click(); a.remove(); window.URL.revokeObjectURL(url)
          }}>
            <IconDownload className="h-4 w-4 mr-2"/> PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
<CardTitle className="flex items-center gap-2"><IconChartBar className="h-5 w-5"/> Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48">
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger><SelectValue placeholder="Group By"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="month">By Month</SelectItem>
                <SelectItem value="year">By Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {groupBy === 'month' && (
            <Input className="w-full sm:w-40" type="number" min="2000" max="2100" value={year} onChange={e => setYear(e.target.value)} placeholder="Year" />
          )}
          <Input className="w-full sm:w-64" value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Student ID (optional)" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pass/Fail Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : labels.length === 0 ? (
            <div className="text-muted-foreground">No data</div>
          ) : (
            <div className="space-y-4">
              {labels.map((label, idx) => (
                <div key={label} className="space-y-2">
                  <div className="text-sm font-medium">{label} <span className="text-muted-foreground">(Total {series.total[idx]})</span></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="flex justify-between text-xs"><span>Passed</span><span>{series.passed[idx]}</span></div>
                      <Bar value={series.passed[idx]} max={maxValue} color="bg-green-600"/>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs"><span>Failed</span><span>{series.failed[idx]}</span></div>
                      <Bar value={series.failed[idx]} max={maxValue} color="bg-red-600"/>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs"><span>Total</span><span>{series.total[idx]}</span></div>
                      <Bar value={series.total[idx]} max={maxValue} color="bg-blue-600"/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ExamHistory
