import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Video, 
    FileText, 
    FileSpreadsheet, 
    File as FileIcon, 
    Presentation, 
    Copy, 
    Download, 
    Eye,
    ArrowLeft,
    Clock,
    User,
    ChevronRight,
    ExternalLink,
    Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import axiosInstance, { BASE_URL } from '@/Helper/axiosInstance';

const LearningComparisonDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);

    const baseUrl = BASE_URL;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axiosInstance.get(`/api/learning-comparisons/${id}`);
                setContent(res.data.data);
            } catch (error) {
                toast.error("Failed to load content details");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const copyToClipboard = (path) => {
        const fullUrl = `${baseUrl}${path}`;
        navigator.clipboard.writeText(fullUrl);
        toast.success("Link copied to clipboard!");
    };

    const handleDownload = (path, fileName) => {
        const fullUrl = `${baseUrl}${path}`;
        const link = document.createElement('a');
        link.href = fullUrl;
        link.download = fileName || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleView = (path) => {
        const fullUrl = `${baseUrl}${path}`;
        window.open(fullUrl, '_blank');
    };

    const MediaPreview = ({ label, path, type }) => {
        if (!path) return null;
        const fullUrl = `${baseUrl}${path}`;
        
        const isVideo = type === 'video' || path.match(/\.(mp4|webm|ogg)$/i);
        
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        {isVideo ? <Video className="w-4 h-4 text-rose-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                        {label}
                    </h4>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(path)}><Copy className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(path, label)}><Download className="w-3.5 h-3.5" /></Button>
                    </div>
                </div>
                
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-inner group">
                    {isVideo ? (
                        <video 
                            src={fullUrl} 
                            controls 
                            className="w-full h-full object-contain"
                            poster="/video-placeholder.png"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400">
                            <FileText className="w-12 h-12 mb-2" />
                            <span className="text-xs font-medium">Document Preview Not Available</span>
                            <Button variant="outline" size="sm" className="mt-4 bg-white" onClick={() => handleView(path)}>
                                <Eye className="w-4 h-4 mr-2" /> View Document
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const FileCard = ({ label, path, icon: Icon, color }) => {
        if (!path) return null;
        return (
            <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-all group">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-2 rounded-lg ${color} bg-opacity-10 shrink-0`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{label}</h4>
                        <p className="text-[10px] text-gray-400 truncate">{path.split('/').pop()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => copyToClipboard(path)}><Copy className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-emerald-600" onClick={() => handleDownload(path, label)}><Download className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-indigo-600" onClick={() => handleView(path)}><Eye className="w-3.5 h-3.5" /></Button>
                </div>
            </div>
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (!content) return (
        <div className="text-center py-20">
            <h2 className="text-xl font-semibold text-gray-600">Content not found</h2>
            <Button onClick={() => navigate('/admin/learning')} className="mt-4">Back to Learning</Button>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
            {/* Navigation & Header */}
            <div className="flex flex-col gap-6 border-b pb-8">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate('/admin/learning')}
                        className="hover:bg-blue-50 hover:text-blue-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Learning Comparison</Badge>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{content.title}</h1>
                        <p className="text-lg text-gray-500 max-w-2xl">{content.description || "No description provided."}</p>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-400 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{new Date(content.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="w-px h-4 bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>ID: #{content.id}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Before State */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-amber-600 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-600" />
                            </div>
                            Before Implementation
                        </h2>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Initial State</Badge>
                    </div>
                    <Card className="border-none shadow-sm bg-gray-50/30 overflow-hidden">
                        <CardContent className="p-6 space-y-8">
                            {content.beforeDescription && (
                                <div className="p-4 rounded-xl bg-amber-50/30 border border-amber-100 text-amber-900 text-sm italic">
                                    {content.beforeDescription}
                                </div>
                            )}
                            <MediaPreview label="Before Video" path={content.beforeVideo} type="video" />
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Documents</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <FileCard label="SOP Document" path={content.beforePdf} icon={FileText} color="text-red-500" />
                                    <FileCard label="Data Sheet" path={content.beforeExcel} icon={FileSpreadsheet} color="text-emerald-500" />
                                    <FileCard label="Word Manual" path={content.beforeWord} icon={FileIcon} color="text-blue-500" />
                                    <FileCard label="Presentation" path={content.beforePpt} icon={Presentation} color="text-orange-500" />
                                </div>
                            </div>
                            
                            {![content.beforeVideo, content.beforePdf, content.beforeExcel, content.beforeWord, content.beforePpt].some(x => x) && (
                                <div className="text-center py-12 text-gray-400 italic">No files uploaded for this section</div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* After State */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-emerald-600 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                                <Plus className="w-5 h-5 text-emerald-600" />
                            </div>
                            After Implementation
                        </h2>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Optimized State</Badge>
                    </div>
                    <Card className="border-none shadow-sm bg-gray-50/30 overflow-hidden">
                        <CardContent className="p-6 space-y-8">
                            {content.afterDescription && (
                                <div className="p-4 rounded-xl bg-emerald-50/30 border border-emerald-100 text-emerald-900 text-sm italic">
                                    {content.afterDescription}
                                </div>
                            )}
                            <MediaPreview label="After Video" path={content.afterVideo} type="video" />
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Documents</h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <FileCard label="SOP Document" path={content.afterPdf} icon={FileText} color="text-red-500" />
                                    <FileCard label="Data Sheet" path={content.afterExcel} icon={FileSpreadsheet} color="text-emerald-500" />
                                    <FileCard label="Word Manual" path={content.afterWord} icon={FileIcon} color="text-blue-500" />
                                    <FileCard label="Presentation" path={content.afterPpt} icon={Presentation} color="text-orange-500" />
                                </div>
                            </div>

                            {![content.afterVideo, content.afterPdf, content.afterExcel, content.afterWord, content.afterPpt].some(x => x) && (
                                <div className="text-center py-12 text-gray-400 italic">No files uploaded for this section</div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default LearningComparisonDetail;
