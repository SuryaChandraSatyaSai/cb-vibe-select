"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { bytes } from "@/lib/format";
import { UploadCloud, FileSpreadsheet, Image as ImageIcon, X, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

interface SkippedItem {
  filename: string;
  reason: string;
}

interface UploadZoneProps {
  onUploadComplete: () => void;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<{
    status: "success" | "partial_success" | "error";
    message: string;
    processedCount: number;
    totalCount: number;
    skipped: SkippedItem[];
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    setFiles([]);
    setUploadResult(null);
    setProgress(0);
  };

  const triggerInputClick = () => {
    inputRef.current?.click();
  };

  const handleUpload = () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    setUploadResult(null);

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      setUploading(false);
      try {
        const responseData = JSON.parse(xhr.responseText);
        if (xhr.status === 200 || xhr.status === 207) {
          setUploadResult({
            status: responseData.status,
            message: responseData.message,
            processedCount: responseData.processedCount,
            totalCount: responseData.totalCount,
            skipped: responseData.skipped || [],
          });
          setFiles([]); // Clear file queue on success/partial success
          onUploadComplete(); // Trigger gallery refresh
        } else {
          setUploadResult({
            status: "error",
            message: responseData.message || "Failed to process files.",
            processedCount: 0,
            totalCount: files.length,
            skipped: responseData.skipped || [{ filename: "Upload Queue", reason: responseData.message }],
          });
        }
      } catch (err) {
        setUploadResult({
          status: "error",
          message: "An unexpected server response occurred.",
          processedCount: 0,
          totalCount: files.length,
          skipped: [{ filename: "Upload Interface", reason: "JSON Parse error on response." }],
        });
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadResult({
        status: "error",
        message: "Network request failed. Please check your connection.",
        processedCount: 0,
        totalCount: files.length,
        skipped: [{ filename: "Network Connection", reason: "XHR transmission failed." }],
      });
    };

    xhr.send(formData);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-8 bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
        <UploadCloud className="w-5 h-5 text-primary animate-pulse" />
        Ingestion Pipeline
      </h2>

      {/* Drag & Drop Zone */}
      {!uploading && !uploadResult && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerInputClick}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
            dragActive
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-zinc-350 hover:border-zinc-400 bg-zinc-50/50 hover:bg-zinc-50"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".zip,image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="p-4 bg-white border border-zinc-250 rounded-full mb-4 shadow-sm group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8 text-zinc-500 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-zinc-800 font-medium text-lg mb-1">
            Drag & drop files here, or <span className="text-primary underline hover:text-primary-hover">browse</span>
          </p>
          <p className="text-zinc-500 text-sm">
            Supports raw images (JPEG, PNG, WEBP, GIF) and ZIP archives containing image folders.
          </p>
        </div>
      )}

      {/* Queue Listing */}
      {files.length > 0 && !uploading && !uploadResult && (
        <div className="mt-6 border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/20">
          <div className="px-4 py-3 bg-zinc-100/50 border-b border-zinc-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700">
              Upload Queue ({files.length} {files.length === 1 ? "file" : "files"})
            </span>
            <button
              onClick={clearFiles}
              className="text-xs font-semibold text-zinc-550 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-zinc-150">
            {files.map((file, idx) => {
              const isZip = file.name.endsWith(".zip");
              return (
                <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-zinc-100/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {isZip ? (
                      <FileSpreadsheet className="w-5 h-5 text-amber-650 flex-shrink-0" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate max-w-lg">
                        {file.name}
                      </p>
                      <p className="text-xs text-zinc-500">{bytes(file.size, 2)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 hover:bg-zinc-200 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="p-4 bg-zinc-100/30 border-t border-zinc-200 flex justify-end">
            <button
              onClick={handleUpload}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover active:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-primary/10 transition-all"
            >
              Start Uploading Ingestion
            </button>
          </div>
        </div>
      )}

      {/* Uploading progress bar */}
      {uploading && (
        <div className="mt-4 p-8 flex flex-col items-center justify-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
          <p className="text-zinc-800 font-semibold text-base mb-2">
            Uploading assets... {progress}%
          </p>
          <div className="w-full max-w-md bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200 shadow-inner">
            <div
              style={{ width: `${progress}%` }}
              className="h-full bg-primary shadow-sm rounded-full transition-all duration-300"
            />
          </div>
          <p className="text-zinc-500 text-xs mt-3">
            Please wait. Extracting ZIP components and transferring images to Cloudinary...
          </p>
        </div>
      )}

      {/* Upload Result Modal / Block */}
      {uploadResult && (
        <div className={`mt-4 border rounded-xl p-5 ${
          uploadResult.status === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : uploadResult.status === "partial_success"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-800"
        }`}>
          <div className="flex items-start gap-3">
            {uploadResult.status === "success" ? (
              <CheckCircle className="w-6 h-6 text-emerald-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className={`w-6 h-6 mt-0.5 flex-shrink-0 ${
                uploadResult.status === "partial_success" ? "text-amber-600" : "text-red-600"
              }`} />
            )}
            <div className="flex-1">
              <h3 className={`text-base font-bold ${
                uploadResult.status === "success"
                  ? "text-emerald-800"
                  : uploadResult.status === "partial_success"
                    ? "text-amber-800"
                    : "text-red-800"
              }`}>
                {uploadResult.message}
              </h3>
              <p className="text-zinc-650 text-sm mt-1">
                Processed <strong className="text-zinc-800">{uploadResult.processedCount}</strong> out of{" "}
                <strong className="text-zinc-800">{uploadResult.totalCount}</strong> identified image files.
              </p>

              {/* Skipped files details */}
              {uploadResult.skipped.length > 0 && (
                <div className="mt-4">
                  <span className="text-xs font-bold text-zinc-700 uppercase tracking-wider block mb-2">
                    Skipped/Failed Items ({uploadResult.skipped.length})
                  </span>
                  <div className="bg-white border border-zinc-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-zinc-100 text-xs">
                    {uploadResult.skipped.map((skip, idx) => (
                      <div key={idx} className="p-3 flex justify-between gap-4">
                        <span className="font-medium text-zinc-550 truncate max-w-sm">
                          {skip.filename}
                        </span>
                        <span className="text-red-650 font-bold text-right max-w-xs">
                          {skip.reason}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFiles}
                  className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300/60 text-zinc-700 hover:text-zinc-900 text-xs font-bold rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
