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
  AlertTriangle,
  SlidersHorizontal,
  RotateCcw
} from "lucide-react";

export interface ImageRecord {
  _id: string;
  filename: string;
  originalPath?: string;
  hash?: string;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
  fileSize: number;
  uploadDate: string; // YYYY-MM-DD
  uploadedBy: string; // Uploader email
  createdAt: string;
  status?: "pending" | "processing" | "completed" | "failed";
  analysisError?: string;
  qualityScore?: number;
  qualityReason?: string;
  attributes?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    colorfulness?: number;
    temperature?: "warm" | "cool" | "neutral";
    sharpness?: number;
  };
  tags?: string[];
  people?: Array<{
    // personId is populated by /api/images (object) but may be a bare id string
    personId?: { _id?: string; name?: string; title?: string; links?: { label?: string; url: string }[] } | string;
    name: string;
    distance: number;
    box?: { x: number; y: number; width: number; height: number };
  }>;
}

interface ImageGalleryProps {
  images: ImageRecord[];
  loading: boolean;
  onResetComplete: () => void;
}

export default function ImageGallery({ images, loading, onResetComplete }: ImageGalleryProps) {
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});
  const [activeLightboxImageRaw, setActiveLightboxImage] = useState<ImageRecord | null>(null);
  const [reprocessing, setReprocessing] = useState<boolean>(false);
  const [reprocessSuccessMessage, setReprocessSuccessMessage] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);

  // Sync activeLightboxImage to get updates from parent array polling
  const activeLightboxImage = activeLightboxImageRaw 
    ? (images.find(img => img._id === activeLightboxImageRaw._id) || activeLightboxImageRaw) 
    : null;
  const [clearing, setClearing] = useState<boolean>(false);
  
  // Natural image dimensions for the resolution readout.
  const [renderedDimensions, setRenderedDimensions] = useState<{
    naturalWidth: number;
    naturalHeight: number;
  } | null>(null);

  // Filters & Sorting state
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [moodFilter, setMoodFilter] = useState<string>("all");
  const [minBrightness, setMinBrightness] = useState<number>(0);
  const [maxBrightness, setMaxBrightness] = useState<number>(100);
  const [minSaturation, setMinSaturation] = useState<number>(0);
  const [maxSaturation, setMaxSaturation] = useState<number>(100);
  const [minSharpness, setMinSharpness] = useState<number>(0);

  const hasActiveFilters = 
    moodFilter !== "all" ||
    minBrightness > 0 ||
    maxBrightness < 100 ||
    minSaturation > 0 ||
    maxSaturation < 100 ||
    minSharpness > 0 ||
    sortBy !== "date_desc";

  const handleResetFilters = () => {
    setSortBy("date_desc");
    setMoodFilter("all");
    setMinBrightness(0);
    setMaxBrightness(100);
    setMinSaturation(0);
    setMaxSaturation(100);
    setMinSharpness(0);
  };

  const handleReprocessImage = async (id: string) => {
    setReprocessing(true);
    setReprocessSuccessMessage("");
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: id })
      });
      const data = await res.json();
      if (data.success) {
        setReprocessSuccessMessage("Re-queued for analysis!");
        setTimeout(() => setReprocessSuccessMessage(""), 4000);
      } else {
        alert(data.message || "Failed to trigger analysis reprocessing.");
      }
    } catch (err) {
      console.error("Failed to reprocess:", err);
      alert("An error occurred while calling the reprocess API.");
    } finally {
      setReprocessing(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const getDownloadUrl = (url: string) => {
    return url.replace("/image/upload/", "/image/upload/fl_attachment/");
  };

  // Compute filtered & sorted list of images
  const filteredImages = images.filter((img) => {
    // 1. Mood Filter
    if (moodFilter !== "all" && img.attributes?.temperature !== moodFilter) {
      return false;
    }
    // 2. Brightness Filter
    const brightness = img.attributes?.brightness ?? 50;
    if (brightness < minBrightness || brightness > maxBrightness) {
      return false;
    }
    // 3. Saturation Filter
    const saturation = img.attributes?.saturation ?? 50;
    if (saturation < minSaturation || saturation > maxSaturation) {
      return false;
    }
    // 4. Sharpness Filter
    const sharpness = img.attributes?.sharpness ?? 80;
    if (sharpness < minSharpness) {
      return false;
    }
    return true;
  });

  const sortedImages = [...filteredImages].sort((a, b) => {
    if (sortBy === "date_desc") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === "date_asc") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === "aesthetics_desc") {
      return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
    }
    if (sortBy === "aesthetics_asc") {
      return (a.qualityScore ?? 0) - (b.qualityScore ?? 0);
    }
    return 0;
  });

  const isDateGrouped = sortBy.startsWith("date");

  // Group images by uploadDate
  const groupedImages = isDateGrouped
    ? sortedImages.reduce<Record<string, ImageRecord[]>>((acc, img) => {
        const date = img.uploadDate || "Uncategorized";
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(img);
        return acc;
      }, {})
    : {};

  // Sort dates descending or ascending
  const sortedDates = isDateGrouped
    ? Object.keys(groupedImages).sort((a, b) => {
        if (sortBy === "date_desc") return b.localeCompare(a);
        return a.localeCompare(b);
      })
    : [];

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
          <p className="text-xs text-zinc-500 mt-0.5 font-medium">
            Displaying {filteredImages.length} of {images.length} images.
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all shadow-sm ${
              showFilters || hasActiveFilters
                ? "bg-primary/5 border-primary/30 text-primary"
                : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filter & Sort
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
          </button>

          <button
            onClick={handleResetLibrary}
            disabled={clearing}
            className="flex items-center gap-2 px-3 py-1.5 border border-red-200 hover:border-red-300 bg-red-50 hover:bg-red-100 disabled:bg-zinc-100 text-red-650 disabled:text-zinc-400 text-xs font-bold rounded-lg transition-colors shadow-sm"
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
      </div>

      {/* Collapsible Filters Panel */}
      {showFilters && (
        <div className="mb-6 p-5 border border-zinc-200 rounded-xl bg-white shadow-sm space-y-4 transition-all">
          <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
            <span className="text-sm font-bold text-zinc-800 flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
              Gallery Refinements
            </span>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-[10px] font-extrabold text-zinc-500 hover:text-red-650 transition-colors uppercase tracking-wider"
              >
                <RotateCcw className="w-3 h-3" /> Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Sorting & Mood */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">Sorting Profile</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-50 border border-zinc-250 hover:border-zinc-350 focus:border-primary focus:bg-white rounded-lg text-xs font-semibold text-zinc-700 focus:outline-none"
                >
                  <option value="date_desc">Upload Date (Newest First)</option>
                  <option value="date_asc">Upload Date (Oldest First)</option>
                  <option value="aesthetics_desc">Quality Score (Highest First) ★</option>
                  <option value="aesthetics_asc">Quality Score (Lowest First)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">Chromatic Mood</label>
                <div className="flex gap-1.5">
                  {["all", "warm", "cool", "neutral"].map((mood) => (
                    <button
                      key={mood}
                      onClick={() => setMoodFilter(mood)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border capitalize transition-colors ${
                        moodFilter === mood
                          ? mood === "warm"
                            ? "bg-orange-50 border-orange-300 text-orange-700 shadow-sm"
                            : mood === "cool"
                              ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm"
                              : mood === "neutral"
                                ? "bg-zinc-100 border-zinc-300 text-zinc-700 shadow-sm"
                                : "bg-primary/5 border-primary/30 text-primary shadow-sm"
                          : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Exposure & Saturation Ranges */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase mb-1.5">
                  <span>Luminance Range</span>
                  <span className="text-zinc-700 font-extrabold">{minBrightness}% - {maxBrightness}%</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minBrightness}
                    onChange={(e) => setMinBrightness(Number(e.target.value))}
                    className="w-full accent-primary h-1 bg-zinc-150 rounded"
                    title="Min brightness"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={maxBrightness}
                    onChange={(e) => setMaxBrightness(Number(e.target.value))}
                    className="w-full accent-primary h-1 bg-zinc-150 rounded"
                    title="Max brightness"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase mb-1.5">
                  <span>Saturation Range</span>
                  <span className="text-zinc-700 font-extrabold">{minSaturation}% - {maxSaturation}%</span>
                </div>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minSaturation}
                    onChange={(e) => setMinSaturation(Number(e.target.value))}
                    className="w-full accent-primary h-1 bg-zinc-150 rounded"
                    title="Min saturation"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={maxSaturation}
                    onChange={(e) => setMaxSaturation(Number(e.target.value))}
                    className="w-full accent-primary h-1 bg-zinc-150 rounded"
                    title="Max saturation"
                  />
                </div>
              </div>
            </div>

            {/* 3. Sharpness threshold */}
            <div>
              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase mb-1.5">
                <span>Min Focus/Sharpness</span>
                <span className="text-zinc-700 font-extrabold">{minSharpness}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={minSharpness}
                onChange={(e) => setMinSharpness(Number(e.target.value))}
                className="w-full accent-primary h-1 bg-zinc-150 rounded mb-3"
              />
              <div className="text-[10px] text-zinc-400 leading-normal">
                Filter soft or motion-blurred photos. Slide right to only show pin-sharp focused images.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid rendering branches */}
      {filteredImages.length === 0 ? (
        <div className="w-full text-center py-16 border border-zinc-200 rounded-2xl bg-white shadow-sm">
          <div className="p-4 bg-zinc-50 border border-zinc-250 w-fit mx-auto rounded-2xl mb-4 shadow-sm">
            <SlidersHorizontal className="w-8 h-8 text-zinc-400" />
          </div>
          <h3 className="text-zinc-800 font-bold text-lg mb-1">No matching assets found</h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6">
            No assets match your current combination of sorting, chromatic mood, exposure, saturation, or focus filters.
          </p>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
          >
            Clear Filters
          </button>
        </div>
      ) : isDateGrouped ? (
        /* Date-grouped Accordion list */
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
                          onClick={() => {
                            setActiveLightboxImage(img);
                            setRenderedDimensions(null);
                          }}
                          className="group relative cursor-pointer aspect-square bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 hover:border-primary/50 transition-all duration-300 shadow-sm"
                        >
                          {/* Aesthetic Score Badge */}
                          {status === "completed" && typeof img.qualityScore === "number" && (
                            <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/65 backdrop-blur-md border border-white/10 rounded-md text-white text-[11px] font-extrabold flex items-center gap-1 shadow-sm select-none transition-all duration-300">
                              <span className="text-amber-400">★</span>
                              <span>{img.qualityScore.toFixed(1)}</span>
                            </div>
                          )}

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
                              {/* Preview Tags */}
                              {Array.isArray(img.tags) && img.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1 max-h-5 overflow-hidden">
                                  {img.tags.slice(0, 3).map((tag, idx) => (
                                    <span
                                      key={idx}
                                      className="px-1.5 py-0.5 bg-white/10 border border-white/5 rounded text-[8px] text-zinc-350 font-extrabold uppercase tracking-wide"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {fromZip && (
                                <p className="text-amber-455 text-[9px] truncate font-mono mt-1">
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
    ) : (
      /* Flat Grid for Global Aesthetics sorting */
      <div className="p-5 border border-zinc-200 rounded-xl bg-white shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {sortedImages.map((img) => {
            const fromZip = img.originalPath && img.originalPath !== img.filename;
            const status = img.status || "completed";
            return (
              <div
                key={img._id}
                onClick={() => {
                  setActiveLightboxImage(img);
                  setRenderedDimensions(null);
                }}
                className="group relative cursor-pointer aspect-square bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 hover:border-primary/50 transition-all duration-300 shadow-sm"
              >
                {/* Aesthetic Score Badge */}
                {status === "completed" && typeof img.qualityScore === "number" && (
                  <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-black/65 backdrop-blur-md border border-white/10 rounded-md text-white text-[11px] font-extrabold flex items-center gap-1 shadow-sm select-none transition-all duration-300">
                    <span className="text-amber-400">★</span>
                    <span>{img.qualityScore.toFixed(1)}</span>
                  </div>
                )}

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
                        <Clock className="w-5 h-5 text-zinc-350 animate-pulse mb-1" />
                        <span className="text-zinc-350 text-[10px] font-bold uppercase tracking-wider">Queued</span>
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
                    {/* Preview Tags */}
                    {Array.isArray(img.tags) && img.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1 max-h-5 overflow-hidden">
                        {img.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-white/10 border border-white/5 rounded text-[8px] text-zinc-350 font-extrabold uppercase tracking-wide"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {fromZip && (
                      <p className="text-amber-455 text-[9px] truncate font-mono mt-1">
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
    )
  }

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
              
              <div className="relative max-w-full max-h-[60vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeLightboxImage.cloudinaryUrl}
                  alt={activeLightboxImage.filename}
                  onLoad={(e) => {
                    setRenderedDimensions({
                      naturalWidth: e.currentTarget.naturalWidth,
                      naturalHeight: e.currentTarget.naturalHeight,
                    });
                  }}
                  className="max-w-full max-h-[60vh] object-contain rounded shadow-sm"
                />
              </div>
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

                  {/* Aesthetic Quality Rating Meter */}
                  {typeof activeLightboxImage.qualityScore === "number" && (
                    <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/50 shadow-inner">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 block">Quality Score</span>
                        <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                          activeLightboxImage.qualityScore >= 7.0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : activeLightboxImage.qualityScore >= 5.0
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {activeLightboxImage.qualityScore >= 9.0 ? "Exceptional" :
                           activeLightboxImage.qualityScore >= 8.0 ? "Very Good" :
                           activeLightboxImage.qualityScore >= 7.0 ? "Good" :
                           activeLightboxImage.qualityScore >= 5.0 ? "Average" : "Low Quality"}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-zinc-900 leading-none">
                          {activeLightboxImage.qualityScore.toFixed(1)}
                        </span>
                        <span className="text-xs font-semibold text-zinc-400">/ 10.0</span>
                      </div>
                      {/* Progress Bar */}
                      <div className="w-full bg-zinc-200/60 h-2 rounded-full overflow-hidden border border-zinc-200/40 mt-2">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            activeLightboxImage.qualityScore >= 7.0
                              ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                              : activeLightboxImage.qualityScore >= 5.0
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${activeLightboxImage.qualityScore * 10}%` }}
                        />
                      </div>
                      {activeLightboxImage.qualityReason && (
                        <p className="text-[11px] text-zinc-500 italic mt-2 leading-snug">
                          &ldquo;{activeLightboxImage.qualityReason}&rdquo;
                        </p>
                      )}
                    </div>
                  )}

                  {/* Recognized People */}
                  {Array.isArray(activeLightboxImage.people) && activeLightboxImage.people.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-2">People</span>
                      <div className="flex flex-wrap gap-2">
                        {activeLightboxImage.people.map((p, idx) => {
                          const person = typeof p.personId === "object" && p.personId ? p.personId : null;
                          const url = person?.links?.[0]?.url;
                          // face-api distance: 0 = identical, threshold 0.55. Show as a friendly confidence %.
                          const confidence = Math.max(0, Math.round((1 - p.distance) * 100));
                          const label = (
                            <>
                              {p.name}
                              {person?.title && <span className="text-indigo-400 font-normal"> · {person.title}</span>}
                              <span className="ml-1.5 text-indigo-400 font-normal">{confidence}%</span>
                            </>
                          );
                          const cls = "px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold";
                          return url ? (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" title={`Match distance ${p.distance}`} className={`${cls} hover:bg-indigo-100 transition-colors`}>
                              {label}
                            </a>
                          ) : (
                            <span key={idx} title={`Match distance ${p.distance}`} className={cls}>
                              {label}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Technical Metrics Card */}
                  {activeLightboxImage.attributes && (
                    <div className="border border-zinc-200 rounded-xl p-3 bg-zinc-50/50 shadow-inner space-y-3">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Technical Profiles</span>

                      {/* Brightness */}
                      {typeof activeLightboxImage.attributes.brightness === "number" && (
                        <div>
                          <div className="flex justify-between text-[11px] font-medium text-zinc-650 mb-1">
                            <span>Luminance (Brightness)</span>
                            <span className="font-bold text-zinc-800">{activeLightboxImage.attributes.brightness}%</span>
                          </div>
                          <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden border border-zinc-200/40">
                            <div
                              className="bg-amber-450 h-full rounded-full transition-all duration-500"
                              style={{ width: `${activeLightboxImage.attributes.brightness}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Saturation */}
                      {typeof activeLightboxImage.attributes.saturation === "number" && (
                        <div>
                          <div className="flex justify-between text-[11px] font-medium text-zinc-650 mb-1">
                            <span>Color Saturation</span>
                            <span className="font-bold text-zinc-800">{activeLightboxImage.attributes.saturation}%</span>
                          </div>
                          <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden border border-zinc-200/40">
                            <div
                              className="bg-violet-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${activeLightboxImage.attributes.saturation}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Contrast */}
                      {typeof activeLightboxImage.attributes.contrast === "number" && (
                        <div>
                          <div className="flex justify-between text-[11px] font-medium text-zinc-650 mb-1">
                            <span>Contrast (Dynamic Range)</span>
                            <span className="font-bold text-zinc-800">{activeLightboxImage.attributes.contrast}%</span>
                          </div>
                          <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden border border-zinc-200/40">
                            <div
                              className="bg-sky-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${activeLightboxImage.attributes.contrast}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Colorfulness */}
                      {typeof activeLightboxImage.attributes.colorfulness === "number" && (
                        <div>
                          <div className="flex justify-between text-[11px] font-medium text-zinc-650 mb-1">
                            <span>Colorfulness (Vibrancy)</span>
                            <span className="font-bold text-zinc-800">{activeLightboxImage.attributes.colorfulness}%</span>
                          </div>
                          <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden border border-zinc-200/40">
                            <div
                              className="bg-pink-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${activeLightboxImage.attributes.colorfulness}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Sharpness */}
                      {typeof activeLightboxImage.attributes.sharpness === "number" && (
                        <div>
                          <div className="flex justify-between text-[11px] font-medium text-zinc-650 mb-1">
                            <span>Sharpness (Focus)</span>
                            <span className="font-bold text-zinc-800">{activeLightboxImage.attributes.sharpness}%</span>
                          </div>
                          <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden border border-zinc-200/40">
                            <div
                              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${activeLightboxImage.attributes.sharpness}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Focus Clarity Classification */}
                      {typeof activeLightboxImage.attributes.sharpness === "number" && (
                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-650 pt-1 border-t border-zinc-200/40">
                          <span>Focus Clarity</span>
                          <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase tracking-wider ${
                            activeLightboxImage.attributes.sharpness >= 50
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : activeLightboxImage.attributes.sharpness >= 30
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-red-50 text-red-700 border-red-200"
                          }`}>
                            {activeLightboxImage.attributes.sharpness >= 50
                              ? "Sharp & Focused"
                              : activeLightboxImage.attributes.sharpness >= 30
                                ? "Soft / Mild Blur"
                                : "Blurry / Motion Blur"}
                          </span>
                        </div>
                      )}

                      {/* Color Temperature */}
                      {activeLightboxImage.attributes.temperature && (
                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-650 pt-1 border-t border-zinc-200/40">
                          <span>Chromatic Mood</span>
                          <span className={`px-2 py-0.5 border rounded text-[9px] font-bold uppercase tracking-wider ${
                            activeLightboxImage.attributes.temperature === "warm"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : activeLightboxImage.attributes.temperature === "cool"
                                ? "bg-blue-50 text-blue-755 border-blue-200"
                                : "bg-zinc-100 text-zinc-600 border-zinc-200"
                          }`}>
                            {activeLightboxImage.attributes.temperature} tone
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visual Tags */}
                  {Array.isArray(activeLightboxImage.tags) && activeLightboxImage.tags.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1.5">Visual Keywords</span>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                        {activeLightboxImage.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 rounded text-zinc-650 text-[10px] font-semibold transition-colors cursor-default"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Filename</span>
                    <span className="text-zinc-800 text-sm font-semibold break-all leading-normal">{activeLightboxImage.filename}</span>
                  </div>

                  {renderedDimensions && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Resolution</span>
                      <span className="text-zinc-800 text-sm font-medium">
                        {renderedDimensions.naturalWidth} x {renderedDimensions.naturalHeight} px
                      </span>
                    </div>
                  )}

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

              {/* Reprocess Success Feedback */}
              {reprocessSuccessMessage && (
                <div className="mt-4 px-3 py-2 bg-emerald-50 border border-emerald-250 text-emerald-700 text-[11px] font-semibold rounded-lg text-center animate-pulse">
                  {reprocessSuccessMessage}
                </div>
              )}

              <div className="mt-6 space-y-2">
                {/* Reprocess / Retry Action Button */}
                {activeLightboxImage.status === "failed" ? (
                  <button
                    onClick={() => handleReprocessImage(activeLightboxImage._id)}
                    disabled={reprocessing}
                    className="w-full py-2 px-4 bg-red-650 hover:bg-red-700 disabled:bg-zinc-350 text-white text-center text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {reprocessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Retry Analysis
                      </>
                    )}
                  </button>
                ) : activeLightboxImage.status === "pending" || activeLightboxImage.status === "processing" ? (
                  <button
                    disabled
                    className="w-full py-2 px-4 bg-zinc-200 text-zinc-500 text-center text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-not-allowed border border-zinc-250"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                    Analyzing Metadata...
                  </button>
                ) : (
                  <button
                    onClick={() => handleReprocessImage(activeLightboxImage._id)}
                    disabled={reprocessing}
                    className="w-full py-2 px-4 border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-700 text-center text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {reprocessing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Re-queueing...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
                        Re-analyze Asset
                      </>
                    )}
                  </button>
                )}

                {/* Primary Action Button Options */}
                <div className="flex gap-2">
                  <a
                    href={getDownloadUrl(activeLightboxImage.cloudinaryUrl)}
                    download={activeLightboxImage.filename}
                    className="flex-1 py-2 px-3 border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-750 text-center text-xs font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => handleCopyUrl(activeLightboxImage.cloudinaryUrl)}
                    className="flex-1 py-2 px-3 border border-zinc-250 bg-white hover:bg-zinc-50 text-zinc-750 text-center text-xs font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1"
                  >
                    {copiedUrl ? "Copied URL!" : "Copy Link"}
                  </button>
                </div>

                <a
                  href={activeLightboxImage.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-center text-xs font-semibold rounded-lg transition-colors shadow-sm flex items-center justify-center mt-1"
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
