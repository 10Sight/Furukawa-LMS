import { useState, useCallback } from 'react';
import axiosInstance from '@/Helper/axiosInstance';

const useFileUpload = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const uploadFile = useCallback(async (file, options = {}) => {
    if (!file) {
      throw new Error('No file provided');
    }

    const {
      allowedTypes = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png'],
      maxSizeBytes = 10 * 1024 * 1024, // 10MB default
      folder = 'submissions'
    } = options;

    // File validation
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      throw new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    if (file.size > maxSizeBytes) {
      throw new Error(`File too large. Maximum size: ${(maxSizeBytes / (1024 * 1024)).toFixed(1)}MB`);
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axiosInstance.post('/api/upload/single', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        }
      });

      if (response.data && response.data.success && response.data.data) {
        return {
          url: response.data.data.url,
          public_id: response.data.data.public_id,
          fileName: file.name,
          fileSize: file.size,
          fileType: fileExtension
        };
      } else {
        throw new Error('Upload failed: Invalid response');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Upload failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const resetState = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setError(null);
  }, []);

  return {
    uploadFile,
    isUploading,
    uploadProgress,
    error,
    resetState
  };
};

export default useFileUpload;
