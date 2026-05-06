import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
    Video, 
    FileText, 
    FileSpreadsheet, 
    File as FileIcon, 
    Presentation, 
    Upload, 
    X, 
    Plus, 
    ArrowLeft,
    CheckCircle2,
    Loader2,
    Eye,
    Clock,
    Image as ImageIcon,
    ChevronDown
} from 'lucide-react';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from 'sonner';
import axiosInstance from '@/Helper/axiosInstance';

const EditLearningComparison = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [formData, setFormData] = useState({
        title: '',
        beforeDescription: '',
        afterDescription: ''
    });

    const [existingFiles, setExistingFiles] = useState({});
    const [deletedFields, setDeletedFields] = useState([]);
    const [files, setFiles] = useState({
        beforeVideo: null,
        beforePdf: null,
        beforeExcel: null,
        beforeWord: null,
        beforePpt: null,
        beforeImage: null,
        afterVideo: null,
        afterPdf: null,
        afterExcel: null,
        afterWord: null,
        afterPpt: null,
        afterImage: null
    });

    const [selectedTypeBefore, setSelectedTypeBefore] = useState('beforeVideo');
    const [selectedTypeAfter, setSelectedTypeAfter] = useState('afterVideo');

    const fileTypes = [
        { id: 'Video', label: 'Video', icon: Video, color: 'text-rose-500', accept: 'video/*' },
        { id: 'Pdf', label: 'PDF Document', icon: FileText, color: 'text-red-500', accept: '.pdf' },
        { id: 'Excel', label: 'Excel Sheet', icon: FileSpreadsheet, color: 'text-emerald-500', accept: '.xlsx,.xls,.csv' },
        { id: 'Word', label: 'Word Document', icon: FileIcon, color: 'text-blue-500', accept: '.doc,.docx' },
        { id: 'Ppt', label: 'PowerPoint', icon: Presentation, color: 'text-orange-500', accept: '.ppt,.pptx' },
        { id: 'Image', label: 'Image', icon: ImageIcon, color: 'text-purple-500', accept: 'image/*' },
    ];

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axiosInstance.get(`/api/learning-comparisons/${id}`);
                const data = res.data.data;
                setFormData({
                    title: data.title || '',
                    beforeDescription: data.beforeDescription || '',
                    afterDescription: data.afterDescription || ''
                });
                
                // Store existing file paths
                setExistingFiles({
                    beforeVideo: data.beforeVideo,
                    beforePdf: data.beforePdf,
                    beforeExcel: data.beforeExcel,
                    beforeWord: data.beforeWord,
                    beforePpt: data.beforePpt,
                    beforeImage: data.beforeImage,
                    afterVideo: data.afterVideo,
                    afterPdf: data.afterPdf,
                    afterExcel: data.afterExcel,
                    afterWord: data.afterWord,
                    afterPpt: data.afterPpt,
                    afterImage: data.afterImage
                });
            } catch (error) {
                toast.error("Failed to load content details");
                navigate('/admin/learning');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate]);

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            setFiles(prev => ({ ...prev, [field]: file }));
        }
    };

    const removeFile = (field) => {
        setFiles(prev => ({ ...prev, [field]: null }));
    };

    const handleDeleteExisting = (field) => {
        setExistingFiles(prev => ({ ...prev, [field]: null }));
        setDeletedFields(prev => [...prev, field]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title) {
            toast.error("Please provide a title");
            return;
        }

        setSaving(true);
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('beforeDescription', formData.beforeDescription);
            data.append('afterDescription', formData.afterDescription);

            Object.keys(files).forEach(key => {
                if (files[key]) {
                    data.append(key, files[key]);
                }
            });

            // Handle deleted fields
            deletedFields.forEach(field => {
                // Only send delete if no new file is being uploaded for this field
                if (!files[field]) {
                    data.append(field, "");
                }
            });

            await axiosInstance.put(`/api/learning-comparisons/${id}`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success("Learning content updated successfully!");
            navigate('/admin/learning');
        } catch (error) {
            console.error(error);
            toast.error("Failed to update learning content");
        } finally {
            setSaving(false);
        }
    };

    const FileUploadInput = ({ label, field, icon: Icon, color, accept }) => (
        <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</Label>
            
            {files[field] ? (
                /* New File Selection */
                <div className="flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/50 animate-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2 rounded-lg ${color} bg-white shadow-sm`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-sm font-bold text-blue-900 truncate block">
                                {files[field].name}
                            </span>
                            <span className="text-[10px] text-blue-500 font-medium">New file selected</span>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => removeFile(field)}
                        className="p-1.5 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : existingFiles[field] ? (
                /* Existing File */
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <div className="min-w-0">
                            <span className="text-sm font-semibold text-gray-900 truncate block">
                                {existingFiles[field].split('/').pop()}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium">Currently active</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative group">
                            <input 
                                type="file" 
                                accept={accept}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={(e) => handleFileChange(e, field)}
                            />
                            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                Replace
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                /* No File */
                <div className="relative group">
                    <input 
                        type="file" 
                        id={field}
                        accept={accept}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => handleFileChange(e, field)}
                    />
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 group-hover:border-blue-400 group-hover:bg-blue-50/50 transition-all">
                        <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-white group-hover:shadow-sm text-gray-400 group-hover:text-blue-500 transition-all">
                            <Upload className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors font-medium">
                            Upload {label}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-gray-500 font-medium">Loading comparison data...</p>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-6">
                <div className="flex items-center gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => navigate('/admin/learning')}
                        className="hover:bg-blue-50 hover:text-blue-600"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-900">Edit Comparison Content</h1>
                            <Badge variant="outline" className="text-blue-600 border-blue-100">#{id}</Badge>
                        </div>
                        <p className="text-gray-500 text-sm">Modify existing "Before" and "After" learning materials</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" 
                        onClick={() => navigate('/admin/learning')}
                        className="h-11 px-6 border-gray-200"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] h-11 shadow-lg shadow-blue-100"
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Updating...</>
                        ) : "Update Comparison"}
                    </Button>
                </div>
            </div>

            <form className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Info */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">General Information</CardTitle>
                            <CardDescription>Update basic details for this comparison</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input 
                                    id="title" 
                                    placeholder="e.g., SOP for Machine Operation" 
                                    value={formData.title}
                                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                                    className="h-11"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Files */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Before Section */}
                        <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-amber-400">
                            <CardHeader className="bg-amber-50/50">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                    </div>
                                    BEFORE State
                                </CardTitle>
                                <CardDescription>Update legacy materials and context</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="beforeDesc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Before Description</Label>
                                    <Textarea 
                                        id="beforeDesc" 
                                        placeholder="Explain the original process..." 
                                        className="min-h-[80px] bg-white border-amber-100 focus:border-amber-300 resize-none"
                                        value={formData.beforeDescription}
                                        onChange={(e) => setFormData(p => ({ ...p, beforeDescription: e.target.value }))}
                                    />
                                </div>
                                <div className="h-px bg-amber-100/50 my-2" />

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase">Upload or Replace File</Label>
                                        <Select value={selectedTypeBefore} onValueChange={setSelectedTypeBefore}>
                                            <SelectTrigger className="w-full bg-white border-amber-100">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fileTypes.map(type => (
                                                    <SelectItem key={type.id} value={`before${type.id}`}>
                                                        <div className="flex items-center gap-2">
                                                            <type.icon className={`w-4 h-4 ${type.color}`} />
                                                            {type.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(() => {
                                        const type = fileTypes.find(t => `before${t.id}` === selectedTypeBefore);
                                        return <FileUploadInput label={type.label} field={selectedTypeBefore} icon={type.icon} color={type.color} accept={type.accept} />;
                                    })()}

                                    <div className="space-y-2 mt-4">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase">Current Files</Label>
                                        <div className="space-y-2">
                                            {fileTypes.filter(t => files[`before${t.id}`] || existingFiles[`before${t.id}`]).map(type => (
                                                <div key={type.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-100 shadow-sm">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <type.icon className={`w-4 h-4 ${type.color}`} />
                                                        <div className="min-w-0">
                                                            <span className="text-xs font-medium truncate block max-w-[150px]">
                                                                {files[`before${type.id}`] ? files[`before${type.id}`].name : existingFiles[`before${type.id}`].split('/').pop()}
                                                            </span>
                                                            {files[`before${type.id}`] ? (
                                                                <span className="text-[9px] text-blue-500 font-bold uppercase">New</span>
                                                            ) : (
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase">Existing</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!files[`before${type.id}`] && existingFiles[`before${type.id}`] && (
                                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => handleDeleteExisting(`before${type.id}`)}>
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                    {files[`before${type.id}`] && (
                                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeFile(`before${type.id}`)}>
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                            {!fileTypes.some(t => files[`before${t.id}`] || existingFiles[`before${t.id}`]) && (
                                                <p className="text-xs text-gray-400 italic">No files attached yet</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* After Section */}
                        <Card className="border-none shadow-sm overflow-hidden border-t-4 border-t-emerald-400">
                            <CardHeader className="bg-emerald-50/50">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <Plus className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    AFTER State
                                </CardTitle>
                                <CardDescription>Update optimized materials and context</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="afterDesc" className="text-xs font-bold text-gray-500 uppercase tracking-wider">After Description</Label>
                                    <Textarea 
                                        id="afterDesc" 
                                        placeholder="Explain the improved process..." 
                                        className="min-h-[80px] bg-white border-emerald-100 focus:border-emerald-300 resize-none"
                                        value={formData.afterDescription}
                                        onChange={(e) => setFormData(p => ({ ...p, afterDescription: e.target.value }))}
                                    />
                                </div>
                                <div className="h-px bg-emerald-100/50 my-2" />

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase">Upload or Replace File</Label>
                                        <Select value={selectedTypeAfter} onValueChange={setSelectedTypeAfter}>
                                            <SelectTrigger className="w-full bg-white border-emerald-100">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fileTypes.map(type => (
                                                    <SelectItem key={type.id} value={`after${type.id}`}>
                                                        <div className="flex items-center gap-2">
                                                            <type.icon className={`w-4 h-4 ${type.color}`} />
                                                            {type.label}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {(() => {
                                        const type = fileTypes.find(t => `after${t.id}` === selectedTypeAfter);
                                        return <FileUploadInput label={type.label} field={selectedTypeAfter} icon={type.icon} color={type.color} accept={type.accept} />;
                                    })()}

                                    <div className="space-y-2 mt-4">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase">Current Files</Label>
                                        <div className="space-y-2">
                                            {fileTypes.filter(t => files[`after${t.id}`] || existingFiles[`after${t.id}`]).map(type => (
                                                <div key={type.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-100 shadow-sm">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <type.icon className={`w-4 h-4 ${type.color}`} />
                                                        <div className="min-w-0">
                                                            <span className="text-xs font-medium truncate block max-w-[150px]">
                                                                {files[`after${type.id}`] ? files[`after${type.id}`].name : existingFiles[`after${type.id}`].split('/').pop()}
                                                            </span>
                                                            {files[`after${type.id}`] ? (
                                                                <span className="text-[9px] text-blue-500 font-bold uppercase">New</span>
                                                            ) : (
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase">Existing</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {!files[`after${type.id}`] && existingFiles[`after${type.id}`] && (
                                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:bg-red-50" onClick={() => handleDeleteExisting(`after${type.id}`)}>
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                    {files[`after${type.id}`] && (
                                                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeFile(`after${type.id}`)}>
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                            {!fileTypes.some(t => files[`after${t.id}`] || existingFiles[`after${t.id}`]) && (
                                                <p className="text-xs text-gray-400 italic">No files attached yet</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default EditLearningComparison;
