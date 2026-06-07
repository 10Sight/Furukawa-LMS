import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  Search,
  Plus,
  ArrowRight,
  FileText,
  Edit,
  Trash2,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from 'react-router-dom';
import axiosInstance from '@/Helper/axiosInstance';
import { toast } from 'sonner';
import { usePrivileges } from '@/hooks/usePrivileges';
import { AlertCircle } from 'lucide-react';

const Learning = () => {
  const navigate = useNavigate();
  const { hasPrivilege } = usePrivileges();
  const [comparisons, setComparisons] = useState([]);
  const [loading, setLoading] = useState(true);

  const canCreate = hasPrivilege("learning:create");
  const canUpdate = hasPrivilege("learning:update");
  const canDelete = hasPrivilege("learning:delete");
  const canRead = hasPrivilege("learning:read");

  useEffect(() => {
    const fetchComparisons = async () => {
      try {
        const res = await axiosInstance.get('/api/learning-comparisons');
        setComparisons(res.data.data);
      } catch (error) {
        toast.error("Failed to load learning comparisons");
      } finally {
        setLoading(false);
      }
    };
    if (canRead) fetchComparisons();
    else if (!loading) setLoading(false);
  }, [canRead, loading]);

  const handleDelete = async (id) => {
    if (!canDelete) return toast.error("You don't have permission to delete");
    if (!window.confirm("Are you sure you want to delete this comparison?")) return;
    try {
      await axiosInstance.delete(`/api/learning-comparisons/${id}`);
      setComparisons(prev => prev.filter(c => c.id !== id));
      toast.success("Comparison deleted successfully");
    } catch (error) {
      toast.error("Failed to delete comparison");
    }
  };

  if (!canRead && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-500">You don't have permission to view learning comparisons.</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/admin')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-10 px-4">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Learning Comparison Content</h1>
          <p className="text-gray-500 mt-1">Manage and view "Before & After" educational materials.</p>
        </div>
        {canCreate && (
          <Button 
            onClick={() => navigate('/admin/learning/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11 px-6 shadow-lg shadow-blue-100 shrink-0"
          >
            <Plus className="w-4 h-4" /> Create Comparison Content
          </Button>
        )}
      </div>

      <div className="space-y-6">
        {/* Main Content Area - Table Layout */}
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="bg-gray-50/50 flex flex-row items-center justify-between px-6 py-4">
            <div>
              <CardTitle className="text-xl">Comparisons List</CardTitle>
              <CardDescription>Visual comparisons of process improvements</CardDescription>
            </div>
            <div className="relative w-72 hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search comparisons..." className="pl-9 bg-white border-gray-200 h-10" />
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center justify-center gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                <p className="text-sm text-gray-500 font-medium">Fetching comparisons...</p>
              </div>
            ) : comparisons.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-200">
                  <FileText className="w-10 h-10 text-gray-200" />
                </div>
                <div className="space-y-1">
                  <p className="text-xl font-bold text-gray-900">No comparisons found</p>
                  <p className="text-sm text-gray-500">Create your first comparison to start tracking improvements.</p>
                </div>
                <Button variant="outline" className="mt-2 h-10 px-6" onClick={() => navigate('/admin/learning/create')}>
                  <Plus className="w-4 h-4 mr-2" /> Start Creating
                </Button>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Materials (B/A)</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Created Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {comparisons.map((item) => (
                    <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                      <td className="px-6 py-4 text-sm font-bold text-blue-600">#{item.id}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{item.title}</span>
                          <span className="text-xs text-gray-400 mt-0.5">{item.description || "No description"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] h-5 px-1.5 font-bold">
                            B: {['beforeVideo','beforePdf','beforeExcel','beforeWord','beforePpt','beforeImage'].reduce((s, k) => s + (Array.isArray(item[k]) ? item[k].length : 0), 0)}
                          </Badge>
                          <ArrowRight className="w-3 h-3 text-gray-300" />
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px] h-5 px-1.5 font-bold">
                            A: {['afterVideo','afterPdf','afterExcel','afterWord','afterPpt','afterImage'].reduce((s, k) => s + (Array.isArray(item[k]) ? item[k].length : 0), 0)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(item.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => navigate(`/admin/learning/${item.id}`)}
                            className="h-9 w-9 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            title="View Details"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                          {canUpdate && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => navigate(`/admin/learning/edit/${item.id}`)}
                              className="h-9 w-9 text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDelete(item.id)}
                              className="h-9 w-9 text-gray-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Learning;
