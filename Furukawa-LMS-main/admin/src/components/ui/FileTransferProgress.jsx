import React from 'react';
import { Upload, Download, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

// Dialog modal showing live progress for a single upload/download operation.
// Ignores backdrop clicks so an in-flight transfer can't be dismissed accidentally.
const FileTransferProgress = ({
    open,
    mode = 'upload', // 'upload' | 'download'
    fileName = '',
    percent = 0,
    loaded = 0,
    total = 0,
    onCancel,
}) => {
    const isUpload = mode === 'upload';
    const Icon = isUpload ? Upload : Download;
    const clampedPercent = Math.max(0, Math.min(100, percent || 0));

    return (
        <Dialog open={open} onOpenChange={() => {}} className="max-w-sm">
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isUpload ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        {isUpload ? 'Uploading...' : 'Downloading...'}
                    </DialogTitle>
                    {fileName && (
                        <DialogDescription className="truncate">{fileName}</DialogDescription>
                    )}
                </DialogHeader>

                <div className="space-y-3">
                    <Progress value={clampedPercent} />
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-bold text-gray-900">{clampedPercent}%</span>
                        {total > 0 && (
                            <span className="text-gray-500">{formatBytes(loaded)} of {formatBytes(total)}</span>
                        )}
                    </div>
                </div>

                {onCancel && (
                    <div className="mt-6 flex justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onCancel}
                            className="text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700"
                        >
                            <X className="w-3.5 h-3.5 mr-1.5" />
                            Cancel
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default FileTransferProgress;
