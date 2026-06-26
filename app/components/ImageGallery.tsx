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
  Info
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
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
        <p className="text-zinc-400 text-sm">Loading media assets library...</p>
      </div>
    );
  }

  // Empty state
  if (images.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto text-center py-16 border border-zinc-800/40 rounded-2xl bg-zinc-950/20 backdrop-blur-sm">
        <div className="p-4 bg-zinc-900/60 border border-zinc-850 w-fit mx-auto rounded-2xl mb-4 shadow-lg">
          <ImageIcon className="w-10 h-10 text-zinc-600" />
        </div>
        <h3 className="text-zinc-200 font-semibold text-lg mb-1">No images cataloged</h3>
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
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-400" />
            Media Asset Library
          </h2>
          <p className="text-xs text-zinc-550 mt-0.5">
            Displaying {images.length} images grouped by upload dates.
          </p>
        </div>
        
        <button
          onClick={handleResetLibrary}
          disabled={clearing}
          className="flex items-center gap-2 px-3 py-1.5 border border-red-900/30 hover:border-red-900/60 bg-red-950/10 hover:bg-red-950/20 disabled:bg-zinc-900 text-red-400 disabled:text-zinc-600 text-xs font-semibold rounded-lg transition-colors"
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
              className="border border-zinc-800/60 rounded-xl overflow-hidden bg-zinc-900/20 backdrop-blur-xl shadow-lg transition-all duration-300"
            >
              {/* Collapsible Header */}
              <button
                onClick={() => toggleDateCollapse(date)}
                className="w-full px-5 py-4 flex items-center justify-between bg-zinc-950/40 border-b border-zinc-800/40 hover:bg-zinc-950/60 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span className="text-zinc-200 font-semibold text-sm sm:text-base">
                    {formatDate(date)}
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700/50 rounded-full text-zinc-400 text-xs font-medium">
                    {dateImages.length} {dateImages.length === 1 ? "image" : "images"}
                  </span>
                </div>
                <div>
                  {isCollapsed ? (
                    <ChevronRight className="w-4.5 h-4.5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4.5 h-4.5 text-zinc-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Body (Grid) */}
              {!isCollapsed && (
                <div className="p-5">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {dateImages.map((img) => {
                      const fromZip = img.originalPath && img.originalPath !== img.filename;
                      return (
                        <div
                          key={img._id}
                          onClick={() => setActiveLightboxImage(img)}
                          className="group relative cursor-pointer aspect-square bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800/80 hover:border-indigo-500/50 transition-all duration-300 shadow-md shadow-black/30"
                        >
                          {/* Image */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.cloudinaryUrl}
                            alt={img.filename}
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
                            loading="lazy"
                          />

                          {/* Hover Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                            <Eye className="w-5 h-5 text-indigo-400 absolute top-2 right-2 drop-shadow" />
                            <p className="text-zinc-200 font-medium text-xs truncate drop-shadow">
                              {img.filename}
                            </p>
                            <p className="text-indigo-400 text-[10px] font-semibold truncate drop-shadow">
                              By: {img.uploadedBy ? img.uploadedBy.split("@")[0] : "System"}
                            </p>
                            <p className="text-zinc-450 text-[10px] flex items-center gap-1 mt-0.5">
                              <HardDrive className="w-3 h-3" />
                              {formatSize(img.fileSize)}
                            </p>
                            {fromZip && (
                              <p className="text-amber-450 text-[9px] truncate font-mono mt-0.5">
                                ZIP: {img.originalPath}
                              </p>
                            )}
                          </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-all">
          <div className="relative w-full max-w-4xl bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl max-h-[90vh]">
            
            {/* Image display pane */}
            <div className="flex-1 bg-black/60 flex items-center justify-center p-4 min-h-[300px] md:min-h-0 relative">
              <button
                onClick={() => setActiveLightboxImage(null)}
                className="absolute top-4 left-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-full border border-zinc-700/50 text-zinc-300 hover:text-white md:hidden transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeLightboxImage.cloudinaryUrl}
                alt={activeLightboxImage.filename}
                className="max-w-full max-h-[60vh] object-contain rounded"
              />
            </div>

            {/* Sidebar pane */}
            <div className="w-full md:w-80 bg-zinc-900/90 border-t md:border-t-0 md:border-l border-zinc-800/80 p-5 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> File Details
                  </span>
                  <button
                    onClick={() => setActiveLightboxImage(null)}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-white hidden md:block transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Filename</span>
                    <span className="text-zinc-200 text-sm font-medium break-all">{activeLightboxImage.filename}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Uploaded Date</span>
                    <span className="text-zinc-200 text-sm font-medium">{formatDate(activeLightboxImage.uploadDate)}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Uploaded By</span>
                    <span className="text-zinc-200 text-sm font-medium break-all">{activeLightboxImage.uploadedBy || "System"}</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">File Size</span>
                    <span className="text-zinc-200 text-sm font-medium">{formatSize(activeLightboxImage.fileSize)}</span>
                  </div>

                  {activeLightboxImage.originalPath && activeLightboxImage.originalPath !== activeLightboxImage.filename && (
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-zinc-500 block">ZIP File Structure Path</span>
                      <span className="text-amber-400/90 text-xs font-mono break-all bg-black/40 border border-zinc-800/40 p-2 rounded block mt-1">
                        {activeLightboxImage.originalPath}
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Cloudinary Public ID</span>
                    <span className="text-zinc-350 text-xs font-mono break-all">{activeLightboxImage.cloudinaryPublicId}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <a
                  href={activeLightboxImage.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-center text-xs font-semibold rounded-lg transition-colors shadow-lg hover:shadow-indigo-500/10"
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
