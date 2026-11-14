"use client";

import { useState, useRef, useEffect } from "react";
import { uploadFile, validateFile } from "@/lib/services/upload/upload.service";
import { FiUpload, FiX, FiCheck } from "react-icons/fi";
import Image from "next/image";

interface FileUploadProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  preview?: boolean;
}

export default function FileUpload({
  label,
  value,
  onChange,
  accept = "image/*",
  maxSizeMB = 5,
  preview = true,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>(value || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreviewUrl(value || "");
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, { maxSizeMB });
    if (!validation.valid) {
      setError(validation.error || "Invalid file");
      return;
    }

    setError("");
    setIsUploading(true);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      const uploadedUrl = await uploadFile(file);
      onChange(uploadedUrl);
      setPreviewUrl(uploadedUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
      setPreviewUrl("");
      onChange("");
    } finally {
      setIsUploading(false);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleRemove = () => {
    setPreviewUrl("");
    onChange("");
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
        {preview && previewUrl && (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 border-gray-200">
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-cover"
              sizes="80px"
            />
            <button
              type="button"
              onClick={handleRemove}
              className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white transition-colors hover:bg-red-600"
              aria-label="Remove image"
            >
              <FiX size={12} />
            </button>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              isUploading
                ? "border-blue-400 bg-blue-50"
                : error
                  ? "border-red-400 bg-red-50"
                  : previewUrl
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileChange}
              className="hidden"
              disabled={isUploading}
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                <p className="text-sm text-blue-600">Uploading...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2">
                <FiX className="text-red-500" size={24} />
                <p className="text-sm text-red-600">{error}</p>
                <p className="text-xs text-gray-500">Click to try again</p>
              </div>
            ) : previewUrl ? (
              <div className="flex flex-col items-center gap-2">
                <FiCheck className="text-green-500" size={24} />
                <p className="text-sm text-green-600">Upload successful!</p>
                <p className="text-xs text-gray-500">Click to replace</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FiUpload className="text-gray-400" size={24} />
                <p className="text-sm text-gray-600">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to {maxSizeMB}MB
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
