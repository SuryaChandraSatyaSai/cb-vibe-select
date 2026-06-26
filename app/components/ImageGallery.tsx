"use client";

import React, { useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  FolderOpen, 
  Calendar, 
  HardDrive, 
  Eye, 
  X, 
  Trash2, 
  Loader2, 
  Image as ImageIcon,
  Info,
  Clock,
  AlertTriangle
} from "lucide-react";

export interface ImageRecord {
  _id: string;
  filename: string;
  originalPath?: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  fileSize: number;
  uploadDate: string; // YYYY-MM-DD
  uploadedBy: string; // Uploader email
  createdAt: string;
  status?: "pending" | "processing" | "completed" | "failed";
  analysisError?: string;
  qualityScore?: number;
  attributes?: {
    brightness?: number;
    saturation?: number;
    temperature?: "warm" | "cool" | "neutral";
    palette?: string[];
  };
  tags?: string[];
}

interface ImageGalleryProps {
  images: ImageRecord[];
  loading: boolean;
  onResetComplete: () => void;
}

export default function ImageGallery({ images, loading, onResetComplete }: ImageGalleryProps) {
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [activeLightboxImage, setActiveLightboxImage] = useState<ImageRecord | null>(null);
  const [clearing, setClearing] = useState<boolean>(false);

  // Group images by uploadDate
  const groupedImages = images.reduce<Record<string, ImageRecord[]>>((acc, img) => {
    const date = img.uploadDate || "Uncategorized";
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(img);
    return acc;
  }, {});

  // Sort dates descending
  const sortedDates = Object.keys(groupedImages).sort((a, b) => b.localeCompare(a));

  const toggleDateCollapse = (date: string) => {
    setCollapsedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string): string => {
    if (dateStr === "Uncategorized") return dateStr;
    try {
      const date = new Date(dateStr + "T00:00:00");
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleResetLibrary = async () => {
    if (!confirm("Are you absolutely sure you want to reset the library? This will delete all catalog records and permanently erase files from Cloudinary!")) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/images", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onResetComplete();
      } else {
        alert(`Failed to reset: ${data.message}`);
      }
    } catch (err: any) {
      alert(`Network error during reset: ${err.message}`);
    } finally {
      setClearing(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <p className="text-zinc-500 text-sm">Loading media assets library...</p>
      </div>
    );
  }

  // Empty state
  if (images.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-16 border border-zinc-200 rounded-2xl bg-white shadow-sm">
        <div className="p-4 bg-zinc-50 border border-zinc-200 w-fit mx-auto rounded-2xl mb-4 shadow-sm">
          <ImageIcon className="w-10 h-10 text-zinc-400" />
        </div>
        <h3 className="text-zinc-800 font-bold text-lg mb-1">No images cataloged</h3>
        <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
          Your asset library is currently empty. Use the ingestion pipeline above to upload images or ZIP folders.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto pb-20">
      {/* Header and Quick stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Media Asset Library
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Displaying {images.length} images grouped by upload dates.
          </p>
        </div>
        
        <button
          onClick={handleResetLibrary}
          disabled={clearing}
          className="flex items-center gap-2 px-3 py-1.5 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 disabled:bg-zinc-100 text-red-600 disabled:text-zinc-400 text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          {clearing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              <Trash2 className="w-3.5 h-3.5" />
              Reset Library
            </>
          )}
        </button>
      </div>

      {/* Date Accordions */}
      <div className="space-y-4">
        {sortedDates.map((date) => {
          const dateImages = groupedImages[date];
          const isCollapsed = !!collapsedDates[date];

          return (
            <div 
              key={date}
              className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-sm transition-all duration-300"
            >
              {/* Collapsible Header */}
              <button
                onClick={() => toggleDateCollapse(date)}
                className="w-full px-5 py-4 flex items-center justify-between bg-zinc-50 border-b border-zinc-200 hover:bg-zinc-100/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-zinc-800 font-bold text-sm sm:text-base">
                    {formatDate(date)}
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded-full text-zinc-650 text-xs font-semibold">
                    {dateImages.length} {dateImages.length === 1 ? "image" : "images"}
                  </span>
                </div>
                <div>
                  {isCollapsed ? (
                    <ChevronRight className="w-4.5 h-4.5 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4.5 h-4.5 text-zinc-500" />
                  )}
                </div>
              </button>

              {/* Collapsible Body (Grid) */}
               {!isCollapsed && (
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {dateImages.map((img) => {
                      const fromZip = img.originalPath && img.originalPath !== img.filename;
                      const status = img.status || "completed";
                      return (
                        <div
                          key={img._id}
                          onClick={() => setActiveLightboxImage(img)}
                          className="group relative cursor-pointer aspect-square bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 hover:border-primary/50 transition-all duration-300 shadow-sm"
                        >
                          {/* Image */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.cloudinaryUrl}
                            alt={img.filename}
                            className={`object-cover w-full h-full transition-transform duration-500 ease-out ${
                              status === "completed" ? "group-hover:scale-105" : "opacity-50 blur-[0.5px]"
                            }`}
                            loading="lazy"
                          />

                          {/* Processing & Error Overlays */}
                          {status !== "completed" && (
                            <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center p-3 text-center select-none">
                              {status === "pending" && (
                                <>
                                  <Clock className="w-5 h-5 text-zinc-300 animate-pulse mb-1" />
                                  <span className="text-zinc-300 text-[10px] font-bold uppercase tracking-wider">Queued</span>
                                </>
                              )}
                              {status === "processing" && (
                                <>
                                  <Loader2 className="w-5 h-5 text-primary animate-spin mb-1" />
                                  <span className="text-primary text-[10px] font-bold uppercase tracking-wider animate-pulse">Analyzing</span>
                                </>
                              )}
                              {status === "failed" && (
                                <>
                                  <AlertTriangle className="w-5 h-5 text-red-500 mb-1" />
                                  <span className="text-red-400 text-[10px] font-bold uppercase tracking-wider">Failed</span>
                                </>
                              )}
                            </div>
                          )}

                          {/* Hover Overlay */}
                          {status === "completed" && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                              <Eye className="w-5 h-5 text-primary absolute top-2 right-2 drop-shadow" />
                              <p className="text-white font-medium text-xs truncate drop-shadow">
                                {img.filename}
                              </p>
                              <p className="text-primary text-[10px] font-bold truncate drop-shadow">
                                By: {img.uploadedBy ? img.uploadedBy.split("@")[0] : "System"}
                              </p>
                              <p className="text-zinc-300 text-[10px] flex items-center gap-1 mt-0.5">
                                <HardDrive className="w-3 h-3" />
                                {formatSize(img.fileSize)}
                              </p>
                              {fromZip && (
                                <p className="text-amber-455 text-[9px] truncate font-mono mt-0.5">
                                  ZIP: {img.originalPath}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal */}
      {activeLightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all">
          <div className="relative w-full max-w-4xl bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl max-h-[90vh]">
            
            {/* Image display pane */}
            <div className="flex-1 bg-zinc-50 flex items-center justify-center p-4 min-h-[300px] md:min-h-0 relative">
              <button
                onClick={() => setActiveLightboxImage(null)}
                className="absolute top-4 left-4 p-2 bg-white hover:bg-zinc-100 rounded-full border border-zinc-200 text-zinc-600 hover:text-zinc-800 md:hidden transition-colors shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeLightboxImage.cloudinaryUrl}
                alt={activeLightboxImage.filename}
                className="max-w-full max-h-[60vh] object-contain rounded shadow-sm"
              />
            </div>

            {/* Sidebar pane */}
            <div className="w-full md:w-80 bg-zinc-50 border-t md:border-t-0 md:border-l border-zinc-200 p-5 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> File Details
                  </span>
                  <button
                    onClick={() => setActiveLightboxImage(null)}
                    className="p-1.5 bg-white hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-800 border border-zinc-200 hidden md:block transition-colors shadow-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {activeLightboxImage.status && activeLightboxImage.status !== "completed" && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Analysis Status</span>
                      <div className={`mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold w-fit border ${
                        activeLightboxImage.status === "pending"
                          ? "bg-zinc-100 text-zinc-650 border-zinc-200"
                          : activeLightboxImage.status === "processing"
                            ? "bg-primary/5 text-primary border-primary/20 animate-pulse"
                            : "bg-red-50 text-red-700 border-red-200"
                      }`}>
                        {activeLightboxImage.status === "pending" && (
                          <>
                            <Clock className="w-3.5 h-3.5" />
                            <span>Queued</span>
                          </>
                        )}
                        {activeLightboxImage.status === "processing" && (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Analyzing...</span>
                          </>
                        )}
                        {activeLightboxImage.status === "failed" && (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            <span>Failed</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {activeLightboxImage.analysisError && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-red-500 block">Analysis Error</span>
                      <span className="text-red-700 text-xs font-mono break-all bg-red-50 border border-red-150 p-2 rounded block mt-1 leading-normal max-h-24 overflow-y-auto">
                        {activeLightboxImage.analysisError}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Filename</span>
                    <span className="text-zinc-800 text-sm font-semibold break-all leading-normal">{activeLightboxImage.filename}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Uploaded Date</span>
                    <span className="text-zinc-800 text-sm font-medium">{formatDate(activeLightboxImage.uploadDate)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Uploaded By</span>
                    <span className="text-zinc-800 text-sm font-medium break-all">{activeLightboxImage.uploadedBy || "System"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">File Size</span>
                    <span className="text-zinc-800 text-sm font-medium">{formatSize(activeLightboxImage.fileSize)}</span>
                  </div>

                  {activeLightboxImage.originalPath && activeLightboxImage.originalPath !== activeLightboxImage.filename && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">ZIP File Structure Path</span>
                      <span className="text-amber-700 text-xs font-mono break-all bg-amber-50 border border-amber-200/60 p-2 rounded block mt-1">
                        {activeLightboxImage.originalPath}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Cloudinary Public ID</span>
                    <span className="text-zinc-550 text-xs font-mono break-all leading-relaxed block">{activeLightboxImage.cloudinaryPublicId}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <a
                  href={activeLightboxImage.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white text-center text-xs font-semibold rounded-lg transition-colors shadow-sm hover:shadow-primary/10"
                >
                  Open Original Quality
                </a>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
