import React, { useRef, useState, useEffect } from 'react';
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
    Image as ImageIcon,
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
import FileTransferProgress from '@/components/ui/FileTransferProgress';

const emptyFiles = () => ({
    beforeVideo: [], beforePdf: [], beforeExcel: [], beforeWord: [], beforePpt: [], beforeImage: [],
    afterVideo:  [], afterPdf:  [], afterExcel:  [], afterWord:  [], afterPpt:  [], afterImage:  [],
});

const FILE_TYPES = [
    { id: 'Video', label: 'Video',          icon: Video,           color: 'text-rose-500',    accept: 'video/*' },
    { id: 'Pdf',   label: 'PDF Document',    icon: FileText,        color: 'text-red-500',     accept: '.pdf' },
    { id: 'Excel', label: 'Excel Sheet',     icon: FileSpreadsheet, color: 'text-emerald-500', accept: '.xlsx,.xls,.csv' },
    { id: 'Word',  label: 'Word Document',   icon: FileIcon,        color: 'text-blue-500',    accept: '.doc,.docx' },
    { id: 'Ppt',   label: 'PowerPoint',      icon: Presentation,    color: 'text-orange-500',  accept: '.ppt,.pptx' },
    { id: 'Image', label: 'Image',           icon: ImageIcon,       color: 'text-purple-500',  accept: 'image/*' },
];

// Defined outside parent so the reference is stable across renders — prevents focus loss on textarea
const FileUploadInput = ({ label, field, icon: Icon, color, accept, staged, onFileChange, onRemove, onDescChange }) => (
    <div className="space-y-2">
        <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</Label>

        <div className="relative group">
            <input
                type="file"
                accept={accept}
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => onFileChange(e, field)}
            />
            <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-gray-300 group-hover:border-blue-400 group-hover:bg-blue-50/50 transition-all">
                <div className="p-2 rounded-md bg-gray-100 group-hover:bg-white group-hover:shadow-sm text-gray-400 group-hover:text-blue-500 transition-all">
                    <Upload className="w-4 h-4" />
                </div>
                <span className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors">
                    {staged.length > 0 ? `Add more ${label}` : `Upload ${label}`}
                </span>
            </div>
        </div>

        {staged.map((item, i) => (
            <div key={i} className="space-y-1">
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className={`p-1.5 rounded-md ${color} bg-white shadow-sm`}>
                            <Icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium text-emerald-900 truncate max-w-[160px]">
                            {item.file.name}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => onRemove(field, i)}
                        className="p-1 hover:bg-emerald-100 rounded-full text-emerald-600 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
                <textarea
                    placeholder="Add description for this file..."
                    value={item.description}
                    onChange={e => onDescChange(field, i, e.target.value)}
                    className="w-full text-xs rounded-lg border border-emerald-100 bg-white p-2 resize-none min-h-[52px] focus:outline-none focus:ring-1 focus:ring-emerald-300 text-gray-700 placeholder-gray-400"
                />
            </div>
        ))}
    </div>
);

// Defined outside parent for the same reason — stable reference prevents SidePanel children from remounting
const SidePanel = ({
    prefix, selectedType, setSelectedType,
    files, formData, setFormData,
    borderColor, headerBg, dividerColor, accentBorder, placeholderDesc, descLabel,
    onFileChange, onRemove, onDescChange,
}) => {
    const totalFiles = FILE_TYPES.reduce((sum, t) => sum + files[`${prefix}${t.id}`].length, 0);
    const selectedTypeDef = FILE_TYPES.find(t => `${prefix}${t.id}` === selectedType);

    return (
        <Card className={`border-none shadow-sm overflow-hidden border-t-4 ${borderColor}`}>
            <CardHeader className={headerBg}>
                <CardTitle className="text-lg flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${prefix === 'before' ? 'bg-amber-100' : 'bg-emerald-100'} flex items-center justify-center`}>
                        {prefix === 'before'
                            ? <ArrowLeft className="w-4 h-4 text-amber-600" />
                            : <Plus className="w-4 h-4 text-emerald-600" />
                        }
                    </div>
                    {prefix === 'before' ? 'BEFORE State' : 'AFTER State'}
                    {totalFiles > 0 && (
                        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${prefix === 'before' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {totalFiles} file{totalFiles !== 1 ? 's' : ''}
                        </span>
                    )}
                </CardTitle>
                <CardDescription>{prefix === 'before' ? 'Original or legacy materials' : 'Optimized or new materials'}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
                <div className="space-y-2">
                    <Label htmlFor={`${prefix}Desc`} className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{descLabel}</Label>
                    <Textarea
                        id={`${prefix}Desc`}
                        placeholder={placeholderDesc}
                        className={`min-h-[80px] bg-white ${accentBorder}`}
                        value={formData[`${prefix}Description`]}
                        onChange={(e) => setFormData(p => ({ ...p, [`${prefix}Description`]: e.target.value }))}
                    />
                </div>
                <div className={`h-px ${dividerColor} my-2`} />

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-500 uppercase">Select File Type to Upload</Label>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger className={`w-full bg-white ${accentBorder}`}>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {FILE_TYPES.map(type => (
                                    <SelectItem key={type.id} value={`${prefix}${type.id}`}>
                                        <div className="flex items-center gap-2">
                                            <type.icon className={`w-4 h-4 ${type.color}`} />
                                            {type.label}
                                            {files[`${prefix}${type.id}`].length > 0 && (
                                                <span className="ml-1 text-[10px] font-bold text-gray-400">
                                                    ({files[`${prefix}${type.id}`].length})
                                                </span>
                                            )}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedTypeDef && (
                        <FileUploadInput
                            label={selectedTypeDef.label}
                            field={selectedType}
                            icon={selectedTypeDef.icon}
                            color={selectedTypeDef.color}
                            accept={selectedTypeDef.accept}
                            staged={files[selectedType]}
                            onFileChange={onFileChange}
                            onRemove={onRemove}
                            onDescChange={onDescChange}
                        />
                    )}

                    {/* Summary: all types that have files */}
                    {FILE_TYPES.some(t => files[`${prefix}${t.id}`].length > 0) && (
                        <div className="space-y-2 mt-2">
                            <Label className="text-xs font-semibold text-gray-500 uppercase">All Attached Files</Label>
                            <div className="space-y-1.5">
                                {FILE_TYPES.flatMap(type =>
                                    files[`${prefix}${type.id}`].map((item, i) => (
                                        <div key={`${type.id}-${i}`} className={`flex items-center justify-between p-2 rounded-lg bg-white border ${prefix === 'before' ? 'border-amber-100' : 'border-emerald-100'}`}>
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <type.icon className={`w-3.5 h-3.5 ${type.color}`} />
                                                <span className="text-xs font-medium truncate max-w-[150px]">{item.file.name}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => onRemove(`${prefix}${type.id}`, i)}
                                                className="p-1 hover:bg-red-50 rounded-full text-red-400 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const CreateLearningComparison = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ title: '', groupName: '', beforeDescription: '', afterDescription: '' });
    const [files, setFiles] = useState(emptyFiles());
    const [selectedTypeBefore, setSelectedTypeBefore] = useState('beforeVideo');
    const [selectedTypeAfter, setSelectedTypeAfter] = useState('afterVideo');
    const [transfer, setTransfer] = useState({ open: false, fileName: '', percent: 0, loaded: 0, total: 0 });
    const [groups, setGroups] = useState([]);
    const [isNewGroup, setIsNewGroup] = useState(false);
    const abortControllerRef = useRef(null);

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const res = await axiosInstance.get('/api/learning-comparisons/groups');
                setGroups(res.data.data || []);
            } catch {
                // Non-critical: group suggestions are optional
            }
        };
        fetchGroups();
    }, []);

    const handleFileChange = (e, field) => {
        const newFiles = Array.from(e.target.files);
        if (newFiles.length) {
            setFiles(prev => ({
                ...prev,
                [field]: [...prev[field], ...newFiles.map(f => ({ file: f, description: '' }))]
            }));
        }
        e.target.value = '';
    };

    const removeFile = (field, index) => {
        setFiles(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
    };

    const updateFileDesc = (field, index, value) => {
        setFiles(prev => ({
            ...prev,
            [field]: prev[field].map((item, i) => i === index ? { ...item, description: value } : item)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title) { toast.error("Please provide a title"); return; }

        const allFiles = Object.values(files).flat();
        const totalSize = allFiles.reduce((sum, item) => sum + item.file.size, 0);
        const transferLabel = allFiles.length === 1 ? allFiles[0].file.name : `${allFiles.length} files`;

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setTransfer({ open: true, fileName: transferLabel, percent: 0, loaded: 0, total: totalSize });
        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('groupName', formData.groupName || '');
            data.append('beforeDescription', formData.beforeDescription);
            data.append('afterDescription', formData.afterDescription);

            Object.keys(files).forEach(key => {
                files[key].forEach(item => data.append(key, item.file));
                data.append(`${key}Descriptions`, JSON.stringify(files[key].map(i => i.description || '')));
            });

            await axiosInstance.post('/api/learning-comparisons', data, {
                signal: controller.signal,
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const total = progressEvent.total || totalSize;
                    const percent = total ? Math.round((progressEvent.loaded * 100) / total) : 0;
                    setTransfer(prev => ({ ...prev, percent, loaded: progressEvent.loaded, total }));
                }
            });
            toast.success("Learning content created successfully!");
            navigate('/admin/learning');
        } catch (error) {
            if (error.code === 'ERR_CANCELED') {
                toast.info("Upload cancelled");
            } else {
                console.error(error);
                toast.error("Failed to create learning content");
            }
        } finally {
            setLoading(false);
            setTransfer(prev => ({ ...prev, open: false }));
            abortControllerRef.current = null;
        }
    };

    const handleCancelUpload = () => {
        abortControllerRef.current?.abort();
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
            <FileTransferProgress
                open={transfer.open}
                mode="upload"
                fileName={transfer.fileName}
                percent={transfer.percent}
                loaded={transfer.loaded}
                total={transfer.total}
                onCancel={handleCancelUpload}
            />

            {/* Header */}
            <div className="flex items-center justify-between border-b pb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin/learning')} className="hover:bg-blue-50 hover:text-blue-600">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Create Comparison Content</h1>
                        <p className="text-gray-500">Define "Before" and "After" learning materials</p>
                    </div>
                </div>
                <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] h-11">
                    {loading ? "Creating..." : "Save Comparison"}
                </Button>
            </div>

            <form className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: General Info */}
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
                            <div className="space-y-2">
                                <Label htmlFor="group">Group</Label>
                                {isNewGroup ? (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="group"
                                            autoFocus
                                            placeholder="Enter new group name"
                                            value={formData.groupName}
                                            onChange={(e) => setFormData(p => ({ ...p, groupName: e.target.value }))}
                                        />
                                        {groups.length > 0 && (
                                            <Button type="button" variant="outline" size="sm" onClick={() => { setIsNewGroup(false); setFormData(p => ({ ...p, groupName: '' })); }}>
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <Select
                                        value={formData.groupName}
                                        onValueChange={(val) => {
                                            if (val === '__new__') { setIsNewGroup(true); setFormData(p => ({ ...p, groupName: '' })); }
                                            else setFormData(p => ({ ...p, groupName: val }));
                                        }}
                                    >
                                        <SelectTrigger id="group" className="w-full">
                                            <SelectValue placeholder="Select or create a group" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {groups.map(g => (
                                                <SelectItem key={g.groupName} value={g.groupName}>
                                                    {g.groupName} <span className="text-gray-400">({g.count})</span>
                                                </SelectItem>
                                            ))}
                                            <SelectItem value="__new__">
                                                <span className="flex items-center gap-1 text-blue-600 font-medium"><Plus className="w-3.5 h-3.5" /> New Group</span>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Before / After cards */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SidePanel
                            prefix="before"
                            selectedType={selectedTypeBefore}
                            setSelectedType={setSelectedTypeBefore}
                            files={files}
                            formData={formData}
                            setFormData={setFormData}
                            onFileChange={handleFileChange}
                            onRemove={removeFile}
                            onDescChange={updateFileDesc}
                            borderColor="border-t-amber-400"
                            headerBg="bg-amber-50/50"
                            dividerColor="bg-amber-100"
                            accentBorder="border-amber-100 focus:border-amber-300"
                            placeholderDesc="Explain the original process..."
                            descLabel="Before Description"
                        />
                        <SidePanel
                            prefix="after"
                            selectedType={selectedTypeAfter}
                            setSelectedType={setSelectedTypeAfter}
                            files={files}
                            formData={formData}
                            setFormData={setFormData}
                            onFileChange={handleFileChange}
                            onRemove={removeFile}
                            onDescChange={updateFileDesc}
                            borderColor="border-t-emerald-400"
                            headerBg="bg-emerald-50/50"
                            dividerColor="bg-emerald-100"
                            accentBorder="border-emerald-100 focus:border-emerald-300"
                            placeholderDesc="Explain the improved process..."
                            descLabel="After Description"
                        />
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CreateLearningComparison;
