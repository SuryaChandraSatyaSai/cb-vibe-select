"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { bytes } from "@/lib/format";
import { 
  X, 
  Image as ImageIcon, 
  AlertTriangle, 
  CheckCircle2, 
  UploadCloud, 
  FolderOpen, 
  File, 
  FileArchive, 
  Clock, 
  HardDrive, 
  Zap, 
  Loader2 
} from "lucide-react";

interface SkippedItem {
  filename: string;
  reason: string;
}

interface UploadZoneProps {
  onUploadComplete: () => void;
  onUploadStart?: (fileCount: number, totalSize: number) => void;
  onUploadProgress?: (progress: number) => void;
}

export default function UploadZone({ onUploadComplete, onUploadStart, onUploadProgress }: UploadZoneProps) {
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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

  const triggerFileInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const triggerFolderInput = (e: React.MouseEvent) => {
    e.stopPropagation();
    folderInputRef.current?.click();
  };

  const handleUpload = () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);
    setUploadResult(null);

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (onUploadStart) {
      onUploadStart(files.length, totalSize);
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload", true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setProgress(percentComplete);
        if (onUploadProgress) {
          onUploadProgress(percentComplete);
        }
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
          setFiles([]);
          onUploadComplete();
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

  const totalCount = files.length;
  const totalSizeSum = files.reduce((sum, file) => sum + file.size, 0);
  const totalSizeFormatted = totalCount > 0 ? (totalSizeSum / (1024 * 1024)).toFixed(1) + " MB" : "0 MB";
  const estTimeFormatted = totalCount > 0 ? `${Math.ceil(totalCount * 0.6)} seconds` : "—";

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Stat Cards Row */}
      {totalCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm flex flex-col items-center justify-center hover:border-slate-350 transition-colors">
            <ImageIcon className="w-6 h-6 text-slate-400 mb-2" />
            <div className="text-2xl font-extrabold text-[#0f172a]">{totalCount}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Images Loaded</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm flex flex-col items-center justify-center hover:border-slate-350 transition-colors">
            <HardDrive className="w-6 h-6 text-slate-400 mb-2" />
            <div className="text-2xl font-extrabold text-[#0f172a]">{totalSizeFormatted}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Total Size</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center shadow-sm flex flex-col items-center justify-center hover:border-slate-350 transition-colors">
            <Clock className="w-6 h-6 text-slate-400 mb-2" />
            <div className="text-2xl font-extrabold text-[#0f172a]">{estTimeFormatted}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Estimated Duration</div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".zip,image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: "", directory: "" } as any)}
        multiple
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {/* Drag & Drop Zone */}
      {!uploading && !uploadResult && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 ${
            dragActive
              ? "border-[#2563EB] bg-[#2563EB]/5 scale-[1.01] shadow-lg shadow-[#2563EB]/5"
              : "border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-[#2563EB] hover:shadow-lg hover:shadow-[#2563EB]/5"
          }`}
        >
          <UploadCloud className="w-12 h-12 text-[#2563EB]/80 mb-4" />
          <h3 className="text-lg font-bold text-[#0f172a] mb-1">Drag &amp; Drop Your Image Folder Here</h3>
          <p className="text-sm text-slate-500 mb-6">or use the actions below to select files from your computer</p>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none justify-center px-4">
            <button 
              className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-lg shadow-md hover:shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto whitespace-nowrap" 
              type="button" 
              onClick={triggerFileInput}
            >
              <File className="w-3.5 h-3.5" /> Select Images
            </button>
            <button 
              className="px-5 py-2.5 border border-slate-350 hover:border-[#2563EB] text-slate-700 hover:text-[#2563EB] hover:bg-[#2563EB]/5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto whitespace-nowrap" 
              type="button" 
              onClick={triggerFolderInput}
            >
              <FolderOpen className="w-3.5 h-3.5" /> Select Folder
            </button>
          </div>
        </div>
      )}

      {/* Queue Listing */}
      {files.length > 0 && !uploading && !uploadResult && (
        <div className="mt-6 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/20">
          <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-700">
              Pending Queue ({files.length} {files.length === 1 ? "file" : "files"})
            </span>
            <button
              onClick={clearFiles}
              className="text-xs font-bold text-red-500 hover:text-red-750 transition-colors cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear All
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-150">
            {files.map((file, idx) => {
              const isZip = file.name.endsWith(".zip");
              return (
                <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-slate-100/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    {isZip ? (
                      <FileArchive className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate max-w-[280px] sm:max-w-lg">
                        {file.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{bytes(file.size, 1)}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    className="p-1 text-slate-400 hover:text-slate-650 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Start Button */}
      {files.length > 0 && !uploading && !uploadResult && (
        <div className="text-center mt-8">
          <button 
            className="px-8 py-3.5 bg-[#d4f210] hover:bg-[#c5e30e] text-[#111827] text-base font-extrabold rounded-lg shadow-lg hover:shadow-yellow-500/10 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
            onClick={handleUpload}
          >
            <Zap className="w-5 h-5 fill-zinc-900" /> Start Ingestion &amp; Quality Curation
          </button>
        </div>
      )}

      {/* Uploading progress bar */}
      {uploading && !onUploadStart && (
        <div className="mt-8 p-8 border border-slate-200 rounded-2xl text-center bg-white shadow-sm flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin mb-4" />
          <h3 className="text-base font-extrabold text-[#0f172a] mb-2">
            Uploading assets... {progress}%
          </h3>
          <div className="w-full max-w-sm bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 mb-4">
            <div
              className="h-full bg-[#2563EB] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            Extracting ZIP contents and transmitting images to Cloudinary. Please keep this window open.
          </p>
        </div>
      )}

      {/* Upload Result Alert Block */}
      {uploadResult && (
        <div
          className="mt-8 border rounded-2xl p-6 shadow-sm"
          style={{
            borderColor:
              uploadResult.status === "success"
                ? "var(--color-accent-green)"
                : uploadResult.status === "partial_success"
                  ? "var(--color-accent-yellow)"
                  : "var(--color-accent-red)",
            backgroundColor:
              uploadResult.status === "success"
                ? "rgba(34, 197, 94, 0.03)"
                : uploadResult.status === "partial_success"
                  ? "rgba(251, 191, 36, 0.03)"
                  : "rgba(239, 68, 68, 0.03)"
          }}
        >
          <div className="flex gap-4 items-start">
            {uploadResult.status === "success" ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className={`w-6 h-6 flex-shrink-0 mt-0.5 ${uploadResult.status === "partial_success" ? "text-amber-500" : "text-red-500"}`} />
            )}
            <div className="flex-1">
              <h3 className="text-base font-extrabold text-[#0f172a] mb-1">
                {uploadResult.message}
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                Ingested <strong>{uploadResult.processedCount}</strong> out of{" "}
                <strong>{uploadResult.totalCount}</strong> files successfully.
              </p>

              {/* Skipped Items list */}
              {uploadResult.skipped.length > 0 && (
                <div className="mt-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    Skipped/Failed Items ({uploadResult.skipped.length})
                  </span>
                  <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-40 overflow-y-auto text-xs">
                    {uploadResult.skipped.map((skip, idx) => (
                      <div key={idx} className="px-4 py-2.5 flex justify-between gap-4">
                        <span className="font-semibold text-slate-700 truncate max-w-[200px] sm:max-w-md">{skip.filename}</span>
                        <span className="font-bold flex-shrink-0 text-red-650">{skip.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end mt-5">
                <button
                  onClick={clearFiles}
                  className="px-4 py-2 border border-slate-350 hover:border-slate-500 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Close &amp; Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
