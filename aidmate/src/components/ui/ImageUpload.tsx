import React, { useState, useRef, useCallback } from 'react';
import { Camera, X, UploadCloud, AlertCircle, Loader2 } from 'lucide-react';

export interface ImageUploadProps {
  images?: string[];
  onChange?: (files: File[], previews: string[]) => void;
  onRemove?: (index: number) => void;
  multiple?: boolean;
  maxFiles?: number;
  maxSizeMB?: number;
  progress?: number;
  disabled?: boolean;
  label?: string;
  error?: string;
  className?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  images: controlledImages = [],
  onChange,
  onRemove,
  multiple = true,
  maxFiles = 5,
  maxSizeMB = 5,
  progress,
  disabled = false,
  label = 'Upload Images',
  error: externalError,
  className = '',
}) => {
  const [internalPreviews, setInternalPreviews] = useState<string[]>([]);
  const [internalFiles, setInternalFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const previews = controlledImages.length > 0 ? controlledImages : internalPreviews;
  const isUploading = progress !== undefined && progress >= 0 && progress < 100;
  const displayError = externalError || localError;

  const validateFiles = useCallback(
    (fileList: FileList | File[]): File[] => {
      setLocalError(null);
      const validFiles: File[] = [];
      const filesArray = Array.from(fileList);

      const maxBytes = maxSizeMB * 1024 * 1024;

      for (const file of filesArray) {
        if (!file.type.startsWith('image/')) {
          setLocalError('Only image files (JPG, PNG, WebP) are allowed.');
          return [];
        }
        if (file.size > maxBytes) {
          setLocalError(`Each image must be smaller than ${maxSizeMB}MB.`);
          return [];
        }
        validFiles.push(file);
      }

      const totalAllowed = multiple ? maxFiles - previews.length : 1;
      if (validFiles.length > totalAllowed) {
        setLocalError(`You can only upload up to ${maxFiles} images.`);
        return validFiles.slice(0, totalAllowed);
      }

      return validFiles;
    },
    [maxSizeMB, multiple, maxFiles, previews.length]
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const validFiles = validateFiles(fileList);
      if (validFiles.length === 0) return;

      const newPreviews: string[] = [];
      validFiles.forEach((file) => {
        const previewUrl = URL.createObjectURL(file);
        newPreviews.push(previewUrl);
      });

      const updatedFiles = multiple ? [...internalFiles, ...validFiles] : validFiles;
      const updatedPreviews = multiple ? [...internalPreviews, ...newPreviews] : newPreviews;

      setInternalFiles(updatedFiles);
      setInternalPreviews(updatedPreviews);
      onChange?.(updatedFiles, updatedPreviews);
    },
    [validateFiles, multiple, internalFiles, internalPreviews, onChange]
  );

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isUploading) return;

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || isUploading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleRemoveImage = (index: number) => {
    if (disabled || isUploading) return;

    const updatedPreviews = previews.filter((_, i) => i !== index);
    const updatedFiles = internalFiles.filter((_, i) => i !== index);

    setInternalPreviews(updatedPreviews);
    setInternalFiles(updatedFiles);
    onRemove?.(index);
    onChange?.(updatedFiles, updatedPreviews);

    // Reset file input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const canAddMore = multiple ? previews.length < maxFiles : previews.length === 0;

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wider text-[#1A1D3E]/80">
          {label}
        </span>
      )}

      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled || isUploading}
        className="hidden"
      />

      {/* Empty State / Dropzone */}
      {previews.length === 0 ? (
        <div
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`
            w-full flex flex-col items-center justify-center p-8 rounded-3xl
            border-2 border-dashed transition-all duration-200 cursor-pointer
            ${
              dragActive
                ? 'border-[#FF6B4A] bg-[#FFF8F5] scale-[1.01]'
                : 'border-slate-200 hover:border-[#FF6B4A]/50 bg-white hover:bg-[#FFF8F5]/40'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}
          `}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#FF6B4A]/10 text-[#FF6B4A] mb-3">
            <Camera className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-[#1A1D3E] text-center">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-slate-400 mt-1 text-center">
            PNG, JPG, or WebP (max {maxSizeMB}MB)
          </p>
        </div>
      ) : (
        /* Image Previews Grid */
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {previews.map((previewUrl, index) => (
              <div
                key={index}
                className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm"
              >
                <img
                  src={previewUrl}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                />

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  disabled={disabled || isUploading}
                  aria-label="Remove image"
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-opacity opacity-90 group-hover:opacity-100 focus:outline-none"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {/* "Add more" button if limit not reached */}
            {canAddMore && (
              <button
                type="button"
                onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="aspect-square flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#FF6B4A] hover:bg-[#FFF8F5]/50 text-slate-400 hover:text-[#FF6B4A] transition-all duration-200 focus:outline-none"
              >
                <UploadCloud className="w-6 h-6 mb-1" />
                <span className="text-xs font-semibold">Add more</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="w-full flex flex-col gap-1.5 mt-2 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-medium text-[#1A1D3E]">
            <span className="flex items-center gap-1.5 text-[#FF6B4A]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Uploading images...</span>
            </span>
            <span className="font-bold">{progress}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full bg-[#FF6B4A] transition-all duration-300 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {displayError && (
        <div className="flex items-center gap-1.5 text-xs text-[#EF4444] font-medium mt-1 animate-slide-down">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
