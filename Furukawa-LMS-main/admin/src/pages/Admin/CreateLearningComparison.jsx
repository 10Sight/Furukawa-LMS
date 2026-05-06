import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { toast } from 'sonner';
import axiosInstance from '@/Helper/axiosInstance';

const CreateLearningComparison = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        beforeDescription: '',
        afterDescription: ''
    });

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

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            setFiles(prev => ({ ...prev, [field]: file }));
        }
    };

    const removeFile = (field) => {
        setFiles(prev => ({ ...prev, [field]: null }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title) {
            toast.error("Please provide a title");
            return;
        }

        setLoading(true);
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

            await axiosInstance.post('/api/learning-comparisons', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success("Learning content created successfully!");
            navigate('/admin/learning');
        } catch (error) {
            console.error(error);
            toast.error("Failed to create learning content");
        } finally {
            setLoading(false);
        }
    };

    const FileUploadInput = ({ label, field, icon: Icon, color, accept }) => (
        <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</Label>
            {files[field] ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2 rounded-md ${color} bg-white shadow-sm`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-emerald-900 truncate max-w-[150px]">
                            {files[field].name}
                        </span>
                    </div>
                    <button 
                        type="button" 
                        onClick={() => removeFile(field)}
                        className="p-1 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="relative group">
                    <input 
                        type="file" 
                        id={field}
                        accept={accept}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        onChange={(e) => handleFileChange(e, field)}
                    />
                    <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 group-hover:border-blue-400 group-hover:bg-blue-50/50 transition-all">
                        <div className="p-2 rounded-md bg-gray-100 group-hover:bg-white group-hover:shadow-sm text-gray-400 group-hover:text-blue-500 transition-all">
                            <Upload className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors">
                            Upload {label}
                        </span>
                    </div>
                </div>
            )}
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
                        <h1 className="text-2xl font-bold text-gray-900">Create Comparison Content</h1>
                        <p className="text-gray-500">Define "Before" and "After" learning materials</p>
                    </div>
                </div>
                <Button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] h-11"
                >
                    {loading ? "Creating..." : "Save Comparison"}
                </Button>
            </div>

            <form className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Info */}
                <div className="space-y-6">
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">General Information</CardTitle>
                            <CardDescription>Basic details about this learning comparison</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input 
                                    id="title" 
                                    placeholder="e.g., SOP for Machine Operation" 
                                    value={formData.title}
                                    onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
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
                                        <ArrowLeft className="w-4 h-4 text-amber-600" />
                                    </div>
                                    BEFORE State
                                </CardTitle>
                                <CardDescription>Original or legacy materials</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="beforeDesc" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Before Description</Label>
                                    <Textarea 
                                        id="beforeDesc" 
                                        placeholder="Explain the original process..." 
                                        className="min-h-[80px] bg-white border-amber-100 focus:border-amber-300"
                                        value={formData.beforeDescription}
                                        onChange={(e) => setFormData(p => ({ ...p, beforeDescription: e.target.value }))}
                                    />
                                </div>
                                <div className="h-px bg-amber-100 my-2" />
                                
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase">Select File Type to Upload</Label>
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
                                        <Label className="text-xs font-semibold text-gray-500 uppercase">Attached Files</Label>
                                        <div className="space-y-2">
                                            {fileTypes.filter(t => files[`before${t.id}`]).map(type => (
                                                <div key={type.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-100">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <type.icon className={`w-4 h-4 ${type.color}`} />
                                                        <span className="text-xs font-medium truncate max-w-[150px]">{files[`before${type.id}`].name}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeFile(`before${type.id}`)}>
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {!fileTypes.some(t => files[`before${t.id}`]) && (
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
                                <CardDescription>Optimized or new materials</CardDescription>
                            </CardHeader>
                            <CardContent className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <Label htmlFor="afterDesc" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">After Description</Label>
                                    <Textarea 
                                        id="afterDesc" 
                                        placeholder="Explain the improved process..." 
                                        className="min-h-[80px] bg-white border-emerald-100 focus:border-emerald-300"
                                        value={formData.afterDescription}
                                        onChange={(e) => setFormData(p => ({ ...p, afterDescription: e.target.value }))}
                                    />
                                </div>
                                <div className="h-px bg-emerald-100 my-2" />

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold text-gray-500 uppercase">Select File Type to Upload</Label>
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
                                        <Label className="text-xs font-semibold text-gray-500 uppercase">Attached Files</Label>
                                        <div className="space-y-2">
                                            {fileTypes.filter(t => files[`after${t.id}`]).map(type => (
                                                <div key={type.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-emerald-100">
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <type.icon className={`w-4 h-4 ${type.color}`} />
                                                        <span className="text-xs font-medium truncate max-w-[150px]">{files[`after${type.id}`].name}</span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeFile(`after${type.id}`)}>
                                                        <X className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ))}
                                            {!fileTypes.some(t => files[`after${t.id}`]) && (
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

export default CreateLearningComparison;
