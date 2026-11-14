import axiosInstance from "../config/axios-instance";
import { isAxiosError } from "axios";

/**
 * Upload a file to the backend storage via /files/upload
 * Returns the URL of the uploaded file
 */
export const uploadFile = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await axiosInstance.post("/files/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data.data.url;
  } catch (error: unknown) {
    console.error("File upload error:", error);
    if (isAxiosError(error)) {
      throw new Error(
        (error.response?.data as { message?: string } | undefined)?.message ||
          error.message ||
          "Failed to upload file",
      );
    }
    throw new Error(
      error instanceof Error ? error.message : "Failed to upload file",
    );
  }
};

/**
 * Validate file before upload
 */
export const validateFile = (
  file: File,
  options?: {
    maxSizeMB?: number;
    allowedTypes?: string[];
  },
): { valid: boolean; error?: string } => {
  const {
    maxSizeMB = 5,
    allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"],
  } = options || {};

  // Check file size
  if (file.size > maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
    };
  }

  return { valid: true };
};
