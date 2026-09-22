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
    EyeOff,
    ArrowLeft,
    Clock,
    User,
    Plus,
    Image as ImageIcon,
} from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import axiosInstance, { BASE_URL } from '@/Helper/axiosInstance';

const LearningComparisonDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showBefore, setShowBefore] = useState(false);

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

    const copyToClipboard = async (path) => {
        const text = `${baseUrl}${path}`;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                if (!document.execCommand('copy')) throw new Error();
                document.body.removeChild(textarea);
            }
            toast.success("Link copied to clipboard!");
        } catch {
            toast.error("Failed to copy link — clipboard not available");
        }
    };

    const handleDownload = (path) => {
        // Files can be up to 10 GB — reading them into an in-memory Blob (the old Axios
        // approach) would exceed browser memory limits and crash the tab. Instead we hand
        // the URL to the browser's native download manager, which streams straight to disk.
        const token = localStorage.getItem('token');
        const downloadUrl = `${baseUrl}/api/learning-comparisons/download?path=${encodeURIComponent(path)}&token=${encodeURIComponent(token)}`;
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleView = (path) => {
        window.open(`${baseUrl}${path}`, '_blank');
    };

    // Renders a single video player entry
    const VideoPreview = ({ path, index, total, description }) => {
        const fullUrl = `${baseUrl}${path}`;
        const label = total > 1 ? `Video ${index + 1}` : 'Video';
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                        <Video className="w-4 h-4 text-rose-500" />
                        {label}
                    </h4>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(path)}><Copy className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(path, label)}><Download className="w-3.5 h-3.5" /></Button>
                    </div>
                </div>
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video shadow-inner">
                    <video src={fullUrl} controls className="w-full h-full object-contain" poster="/video-placeholder.png" />
                </div>
                {description && <p className="text-xs text-gray-500 italic px-1">{description}</p>}
            </div>
        );
    };

    // Renders a single non-video file card
    const FileCard = ({ path, label, icon: Icon, color, description }) => (
        <div className="space-y-1">
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
            {description && <p className="text-xs text-gray-500 italic px-1">{description}</p>}
        </div>
    );

    // Renders all files of a given non-video type (array)
    const FileSection = ({ paths, descs, label, icon, color }) => {
        if (!paths || paths.length === 0) return null;
        return (
            <div className="space-y-2">
                {paths.map((path, i) => (
                    <FileCard
                        key={i}
                        path={path}
                        label={paths.length > 1 ? `${label} ${i + 1}` : label}
                        icon={icon}
                        color={color}
                        description={descs?.[i] || ''}
                    />
                ))}
            </div>
        );
    };

    const SideSection = ({ prefix, accentColor, bgColor, borderColor, title, icon: HeaderIcon, badgeClass, badgeText }) => {
        const videos  = content[`${prefix}Video`]  || [];
        const pdfs    = content[`${prefix}Pdf`]    || [];
        const excels  = content[`${prefix}Excel`]  || [];
        const words   = content[`${prefix}Word`]   || [];
        const ppts    = content[`${prefix}Ppt`]    || [];
        const images  = content[`${prefix}Image`]  || [];
        const descText = content[`${prefix}Description`];

        const videoDescs  = content[`${prefix}VideoDescriptions`]  || [];
        const pdfDescs    = content[`${prefix}PdfDescriptions`]    || [];
        const excelDescs  = content[`${prefix}ExcelDescriptions`]  || [];
        const wordDescs   = content[`${prefix}WordDescriptions`]   || [];
        const pptDescs    = content[`${prefix}PptDescriptions`]    || [];
        const imageDescs  = content[`${prefix}ImageDescriptions`]  || [];

        const hasAnyFile = videos.length || pdfs.length || excels.length || words.length || ppts.length || images.length;

        return (
            <div className={`space-y-6 ${prefix === 'after' && !showBefore ? 'animate-in fade-in duration-700' : ''}`}>
                <div className="flex items-center justify-between">
                    <h2 className={`text-2xl font-bold ${accentColor} flex items-center gap-3`}>
                        <div className={`w-10 h-10 rounded-2xl ${bgColor} flex items-center justify-center`}>
                            <HeaderIcon className={`w-5 h-5 ${accentColor}`} />
                        </div>
                        {title}
                    </h2>
                    <Badge variant="outline" className={badgeClass}>{badgeText}</Badge>
                </div>
                <Card className="border-none shadow-sm bg-gray-50/30 overflow-hidden">
                    <CardContent className="p-6 space-y-6">
                        {descText && (
                            <div className={`p-4 rounded-xl ${borderColor} text-sm italic`}>
                                {descText}
                            </div>
                        )}

                        {/* Videos */}
                        {videos.length > 0 && (
                            <div className="space-y-4">
                                {videos.map((path, i) => (
                                    <VideoPreview key={i} path={path} index={i} total={videos.length} description={videoDescs[i] || ''} />
                                ))}
                            </div>
                        )}

                        {/* Documents & Images */}
                        {(pdfs.length || excels.length || words.length || ppts.length || images.length) > 0 && (
                            <div className="space-y-3 pt-2 border-t border-gray-100">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Documents & Images</h4>
                                <div className="space-y-2">
                                    <FileSection paths={pdfs}   descs={pdfDescs}   label="SOP Document"  icon={FileText}        color="text-red-500" />
                                    <FileSection paths={excels} descs={excelDescs} label="Data Sheet"     icon={FileSpreadsheet} color="text-emerald-500" />
                                    <FileSection paths={words}  descs={wordDescs}  label="Word Manual"    icon={FileIcon}        color="text-blue-500" />
                                    <FileSection paths={ppts}   descs={pptDescs}   label="Presentation"   icon={Presentation}    color="text-orange-500" />
                                    <FileSection paths={images} descs={imageDescs} label="Image"          icon={ImageIcon}       color="text-purple-500" />
                                </div>
                            </div>
                        )}

                        {!hasAnyFile && (
                            <div className="text-center py-12 text-gray-400 italic">No files uploaded for this section</div>
                        )}
                    </CardContent>
                </Card>
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
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin/learning')} className="hover:bg-blue-50 hover:text-blue-600">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Learning Comparison</Badge>
                        {content.groupName && (
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                📁 Group: {content.groupName}
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{content.title}</h1>
                        <p className="text-lg text-gray-500">{content.description || "No description provided."}</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <Button
                            onClick={() => setShowBefore(!showBefore)}
                            variant="outline"
                            className={`group relative overflow-hidden rounded-2xl px-5 py-6 transition-all duration-300 border-2 ${showBefore ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-amber-100 shadow-lg' : 'border-gray-100 hover:border-amber-300 hover:bg-amber-50/50'}`}
                        >
                            <div className="flex items-center gap-3 relative z-10">
                                <div className={`p-2 rounded-xl transition-colors duration-300 ${showBefore ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-amber-100 group-hover:text-amber-600'}`}>
                                    {showBefore ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </div>
                                <div className="text-left">
                                    <span className="block text-[10px] font-bold uppercase tracking-widest opacity-60">View Mode</span>
                                    <span className="block text-sm font-extrabold">{showBefore ? "Full Comparison" : "Final State Only"}</span>
                                </div>
                            </div>
                        </Button>

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
            </div>

            {/* Comparison Grid */}
            <div className={`grid grid-cols-1 ${showBefore ? 'lg:grid-cols-2' : 'max-w-4xl mx-auto'} gap-8 transition-all duration-500`}>
                {showBefore && (
                    <div className="animate-in slide-in-from-left duration-500">
                        <SideSection
                            prefix="before"
                            title="Before Implementation"
                            icon={Clock}
                            accentColor="text-amber-600"
                            bgColor="bg-amber-100"
                            borderColor="bg-amber-50/30 border border-amber-100 text-amber-900"
                            badgeClass="bg-amber-50 text-amber-700 border-amber-200"
                            badgeText="Initial State"
                        />
                    </div>
                )}
                <SideSection
                    prefix="after"
                    title="After Implementation"
                    icon={Plus}
                    accentColor="text-emerald-600"
                    bgColor="bg-emerald-100"
                    borderColor="bg-emerald-50/30 border border-emerald-100 text-emerald-900"
                    badgeClass="bg-emerald-50 text-emerald-700 border-emerald-200"
                    badgeText="Optimized State"
                />
            </div>
        </div>
    );
};

export default LearningComparisonDetail;
