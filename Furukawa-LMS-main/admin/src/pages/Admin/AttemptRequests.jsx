import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useGetExtraAttemptRequestsQuery, useApproveExtraAttemptMutation, useRejectExtraAttemptMutation } from "@/Redux/AllApi/AttemptedQuizApi";
import { IconClipboardList, IconCheck, IconX, IconSend } from "@tabler/icons-react";

const AttemptRequests = ({ canApprove = true }) => {
  const [status, setStatus] = useState('PENDING');
  const { data, isLoading, refetch } = useGetExtraAttemptRequestsQuery({ status });
  const [approve, { isLoading: approving }] = useApproveExtraAttemptMutation();
  const [reject, { isLoading: rejecting }] = useRejectExtraAttemptMutation();

  const requests = Array.isArray(data?.data) ? data.data : [];
  const [grants, setGrants] = useState({});

  const handleApprove = async (reqId) => {
    const extraAttempts = Number(grants[reqId] ?? 1) || 1;
    await approve({ requestId: reqId, extraAttempts }).unwrap();
    setGrants(prev => ({ ...prev, [reqId]: '' }));
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Attempt Requests</h1>
          <p className="text-muted-foreground text-sm">Manage extra test attempt requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => { setStatus(v); refetch(); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Filtered by status: {status}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : requests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Quiz</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested At</TableHead>
                  {canApprove && status === 'PENDING' && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium">{r.student?.fullName}</div>
                        <div className="text-xs text-muted-foreground">{r.student?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{r.quiz?.title}</TableCell>
                    <TableCell className="max-w-md truncate" title={r.reason}>{r.reason || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'PENDING' ? 'secondary' : r.status === 'APPROVED' ? 'success' : 'destructive'}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                    {canApprove && status === 'PENDING' && (
                      <TableCell className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Input
                            type="number"
                            min={1}
                            className="w-24"
                            placeholder="1"
                            value={grants[r._id] ?? ''}
                            onChange={(e) => setGrants(prev => ({ ...prev, [r._id]: e.target.value }))}
                          />
                          <Button size="sm" variant="destructive" onClick={async () => { await reject({ requestId: r._id }).unwrap(); refetch(); }} disabled={rejecting}>
                            <IconX className="h-4 w-4 mr-1" /> Reject
                          </Button>
                          <Button size="sm" onClick={() => handleApprove(r._id)} disabled={approving}>
                            <IconSend className="h-4 w-4 mr-1" /> Approve
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <IconClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No requests found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttemptRequests;
