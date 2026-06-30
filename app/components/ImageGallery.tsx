"use client";

import { useState, useEffect } from "react";
import { bytes } from "@/lib/format";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Info,
  Clock,
  AlertTriangle,
  RotateCcw,
  Download,
  Copy,
  ExternalLink,
  Check,
  CheckSquare,
  Trash2,
  Sun,
  Upload,
  Sparkles,
  Contrast,
  Droplet,
  Palette,
  Target,
  FileImage,
  RefreshCw
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
    contrast?: number;
    saturation?: number;
    colorfulness?: number;
    temperature?: "warm" | "cool" | "neutral";
    sharpness?: number;
  };
  tags?: string[];
  people?: Array<{
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
  onNewUploadClick?: () => void;
}

const PLATFORM_DIMENSIONS: Record<string, Array<{ id: string; label: string; w: number; h: number; hint: string }>> = {
  instagram: [
    { id: "ig-square", label: "Feed — Square", w: 1080, h: 1080, hint: "1:1" },
    { id: "ig-portrait", label: "Feed — Portrait", w: 1080, h: 1350, hint: "4:5" },
    { id: "ig-landscape", label: "Feed — Landscape", w: 1080, h: 566, hint: "1.91:1" },
    { id: "ig-story", label: "Story / Reel", w: 1080, h: 1920, hint: "9:16" },
    { id: "ig-profile", label: "Profile Picture", w: 320, h: 320, hint: "1:1" },
    { id: "ig-carousel", label: "Carousel Slide", w: 1080, h: 1080, hint: "1:1" }
  ],
  linkedin: [
    { id: "li-post", label: "Post Image", w: 1200, h: 627, hint: "1.91:1" },
    { id: "li-square", label: "Post — Square", w: 1080, h: 1080, hint: "1:1" },
    { id: "li-cover", label: "Profile Cover", w: 1584, h: 396, hint: "4:1" },
    { id: "li-portrait", label: "Portrait Post", w: 627, h: 1200, hint: "1:1.91" },
    { id: "li-company", label: "Company Logo", w: 300, h: 300, hint: "1:1" }
  ],
  twitter: [
    { id: "tw-post", label: "Post Image", w: 1200, h: 675, hint: "16:9" },
    { id: "tw-square", label: "Post — Square", w: 1080, h: 1080, hint: "1:1" },
    { id: "tw-header", label: "Header / Banner", w: 1500, h: 500, hint: "3:1" },
    { id: "tw-profile", label: "Profile Picture", w: 400, h: 400, hint: "1:1" }
  ],
  original: [
    { id: "orig", label: "Keep Original Size", w: 0, h: 0, hint: "No resize" }
  ]
};

const QUALITY_TAG_NAMES = [
  "blur", "dupe", "master", "dark", "bright", "overexp", "overexposed", "backlit", 
  "cropped-subject", "error", "underexposed", "low-contrast", "high-contrast", 
  "desaturated", "oversaturated", "poor-composition"
];

export default function ImageGallery({ images, loading, onResetComplete, onNewUploadClick }: ImageGalleryProps) {
  const [currentTab, setCurrentTab] = useState<string>("best");
  const [sortBy, setSortBy] = useState<string>("score-desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeLightboxId, setActiveLightboxId] = useState<string | null>(null);
  
  // Reprocess states
  const [reprocessing, setReprocessing] = useState<boolean>(false);
  const [reprocessMsg, setReprocessMsg] = useState<string>("");

  // Export states
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [exportPlatform, setExportPlatform] = useState<string>("instagram");
  const [exportDimId, setExportDimId] = useState<string>("ig-square");
  const [exportFormat, setExportFormat] = useState<string>("jpeg");
  const [exporting, setExporting] = useState<boolean>(false);
  const [toastText, setToastText] = useState<string>("");
  const [toastType, setToastType] = useState<"success" | "info" | "error" | "">("");

  // Copy states
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Resolution states
  const [renderedDimensions, setRenderedDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (toastText) {
      const timer = setTimeout(() => {
        setToastText("");
        setToastType("");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastText]);

  const showToast = (text: string, type: "success" | "info" | "error") => {
    setToastText(text);
    setToastType(type);
  };

  // Client-side duplicates calculation
  const dupesList = new Set<string>();
  const seenSizes = new Map<number, string>();
  const seenNames = new Map<string, string>();

  images.forEach((img) => {
    if (img.tags?.includes("dupe")) {
      dupesList.add(img._id);
      return;
    }
    if (seenSizes.has(img.fileSize)) {
      dupesList.add(img._id);
    } else if (seenNames.has(img.filename)) {
      dupesList.add(img._id);
    } else {
      seenSizes.set(img.fileSize, img._id);
      seenNames.set(img.filename, img._id);
    }
  });

  const getTabFilteredImages = () => {
    return images.filter((img) => {
      const score = Math.round((img.qualityScore || 0) * 10);
      const isDupe = dupesList.has(img._id);

      switch (currentTab) {
        case "best":
          return score >= 50 && !isDupe;
        case "rejected":
          return score < 50 && !isDupe;
        case "overexposed":
          const hasOverexpTag = img.tags?.some(t => t.toLowerCase() === "overexposed" || t.toLowerCase() === "bright" || t.toLowerCase() === "overexp");
          const highBrightness = (img.attributes?.brightness ?? 0) > 80;
          return (hasOverexpTag || highBrightness) && !isDupe;
        case "duplicates":
          return isDupe;
        default:
          return true;
      }
    });
  };

  const getSortedImages = (list: ImageRecord[]) => {
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === "score-desc") {
        return (b.qualityScore || 0) - (a.qualityScore || 0);
      } else if (sortBy === "score-asc") {
        return (a.qualityScore || 0) - (b.qualityScore || 0);
      } else if (sortBy === "name-asc") {
        return a.filename.localeCompare(b.filename);
      } else if (sortBy === "size-desc") {
        return b.fileSize - a.fileSize;
      }
      return 0;
    });
    return sorted;
  };

  const filteredList = getTabFilteredImages();
  const sortedAndFilteredList = getSortedImages(filteredList);

  const bestCount = images.filter((img) => Math.round((img.qualityScore || 0) * 10) >= 50 && !dupesList.has(img._id)).length;
  const rejectedCount = images.filter((img) => Math.round((img.qualityScore || 0) * 10) < 50 && !dupesList.has(img._id)).length;
  const overexposedCount = images.filter((img) => {
    const hasOverexpTag = img.tags?.some(t => t.toLowerCase() === "overexposed" || t.toLowerCase() === "bright" || t.toLowerCase() === "overexp");
    const highBrightness = (img.attributes?.brightness ?? 0) > 80;
    return (hasOverexpTag || highBrightness) && !dupesList.has(img._id);
  }).length;
  const duplicatesCount = images.filter((img) => dupesList.has(img._id)).length;

  const toggleCardSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredList.map((img) => img._id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.add(id));
        return next;
      });
    } else {
      const allIds = filteredList.map((img) => img._id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  const isAllSelected = filteredList.length > 0 && filteredList.every((img) => selectedIds.has(img._id));

  const handleResetLibrary = async () => {
    if (!confirm("Are you absolutely sure you want to reset the library? This will delete all catalog records and permanently erase files from Cloudinary!")) {
      return;
    }

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
    }
  };

  const activeLightboxImage = activeLightboxId ? (images.find((img) => img._id === activeLightboxId) || null) : null;

  const navigateLightbox = (dir: "prev" | "next") => {
    if (!activeLightboxId) return;
    const currentIndex = sortedAndFilteredList.findIndex((img) => img._id === activeLightboxId);
    if (currentIndex === -1) return;

    let nextIndex = dir === "prev" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0) nextIndex = sortedAndFilteredList.length - 1;
    if (nextIndex >= sortedAndFilteredList.length) nextIndex = 0;

    setActiveLightboxId(sortedAndFilteredList[nextIndex]._id);
    setRenderedDimensions(null);
  };

  const handleCopyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast("Image URL copied!", "success");
  };

  const handleReprocessImage = async (id: string) => {
    setReprocessing(true);
    setReprocessMsg("");
    try {
      const res = await fetch("/api/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: id })
      });
      const data = await res.json();
      if (data.success) {
        setReprocessMsg("Re-queued for analysis!");
        setTimeout(() => setReprocessMsg(""), 4000);
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

  useEffect(() => {
    const platformDims = PLATFORM_DIMENSIONS[exportPlatform] || [];
    if (platformDims.length > 0) {
      setExportDimId(platformDims[0].id);
    }
  }, [exportPlatform]);

  const loadJSZip = async () => {
    if ((window as any).JSZip) return (window as any).JSZip;
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = () => resolve((window as any).JSZip);
      script.onerror = () => reject(new Error("Failed to load JSZip."));
      document.head.appendChild(script);
    });
  };

  const loadImageElement = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = src;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    });
  };

  const transformImage = (img: HTMLImageElement, w: number, h: number, format: string): Blob | null => {
    const canvas = document.createElement("canvas");
    const targetW = w || img.naturalWidth;
    const targetH = h || img.naturalHeight;
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    if (w && h) {
      const srcW = img.naturalWidth;
      const srcH = img.naturalHeight;
      const scaleX = w / srcW;
      const scaleY = h / srcH;
      const scale = Math.max(scaleX, scaleY);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const offsetX = (w - drawW) / 2;
      const offsetY = (h - drawH) / 2;

      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    } else {
      if (format === "jpeg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
      }
      ctx.drawImage(img, 0, 0);
    }

    const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, 0.92);
    const byteString = atob(dataUrl.split(",")[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mime });
  };

  const executeExport = async () => {
    const selectedList = images.filter((img) => selectedIds.has(img._id));
    if (selectedList.length === 0) {
      showToast("No images selected.", "error");
      return;
    }

    setExporting(true);
    showToast(`Zipping ${selectedList.length} files...`, "info");

    try {
      const JSZipLib = await loadJSZip();
      const zip = new JSZipLib();
      const folder = zip.folder("CB_VibeSelect_Export");

      const activePlatformDims = PLATFORM_DIMENSIONS[exportPlatform] || [];
      const activeDim = activePlatformDims.find((d) => d.id === exportDimId) || { w: 0, h: 0 };

      for (let i = 0; i < selectedList.length; i++) {
        const item = selectedList[i];
        try {
          const imgEl = await loadImageElement(item.cloudinaryUrl);
          const blob = transformImage(imgEl, activeDim.w, activeDim.h, exportFormat);
          if (blob) {
            const baseName = item.filename.substring(0, item.filename.lastIndexOf(".")) || item.filename;
            const ext = exportFormat === "jpeg" ? "jpg" : exportFormat;
            folder.file(`${baseName}.${ext}`, blob);
          }
        } catch (err) {
          console.error(`Skipped: ${item.filename}`, err);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `CB_VibeSelect_${exportPlatform}_export.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      showToast("ZIP download started!", "success");
      setIsExportOpen(false);
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, "error");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ height: "400px" }}>
        <Loader2 className="w-6 h-6 text-[#2563EB] animate-spin mb-3" />
        <p className="text-slate-500 text-xs font-semibold">Loading media assets library...</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Toast Notification */}
      {toastText && (
        <div className="fixed bottom-5 left-5 z-[100] max-w-sm w-full">
          <div className="bg-white border border-slate-200 shadow-2xl p-4 rounded-xl flex items-center justify-between gap-3 animate-fade-in" style={{ borderLeft: `4px solid ${toastType === "success" ? "#22c55e" : toastType === "error" ? "#ef4444" : "#2563eb"}` }}>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              {toastType === "success" && <Check className="w-4 h-4 text-emerald-500" />}
              {toastType === "error" && <AlertTriangle className="w-4 h-4 text-red-500" />}
              {toastText}
            </span>
            <button onClick={() => setToastText("")} className="text-slate-400 hover:text-slate-650 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-5xl mx-auto px-6 mb-8">
        <div>
          <h2 className="text-xl font-extrabold text-[#0f172a] uppercase tracking-tight">Analysis Complete</h2>
          <p className="text-xs text-slate-500 mt-1">Displaying {images.length} processed media records.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onNewUploadClick} className="px-4 py-2 border border-slate-3 border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" /> New Upload
          </button>
          {selectedIds.size > 0 && (
            <button 
              onClick={() => setIsExportOpen(true)}
              className="px-5 py-2.5 bg-[#feb602] hover:bg-[#feb602]/90 text-zinc-900 text-xs font-extrabold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" /> Export Selected ({selectedIds.size})
            </button>
          )}
          {images.length > 0 && selectedIds.size === images.length && (
            <button 
              onClick={handleResetLibrary} 
              className="px-4 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Catalog
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-6 border-b border-slate-200 max-w-5xl mx-auto px-6 mb-6">
        <button 
          onClick={() => setCurrentTab("best")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${currentTab === "best" ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-slate-500 hover:text-slate-900"}`}
        >
          <CheckSquare className="w-4 h-4" /> Best Shots <span className="ml-1 px-2 py-0.5 bg-slate-100 border border-slate-250 text-[9px] rounded-full text-slate-600 font-bold">{bestCount}</span>
        </button>
        <button 
          onClick={() => setCurrentTab("duplicates")}
          className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${currentTab === "duplicates" ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-slate-500 hover:text-slate-900"}`}
        >
          <Copy className="w-4 h-4" /> Duplicates <span className="ml-1 px-2 py-0.5 bg-slate-100 border border-slate-250 text-[9px] rounded-full text-slate-600 font-bold">{duplicatesCount}</span>
        </button>
      </div>

      {/* Toolbar filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-slate-200 rounded-2xl bg-slate-50/50 max-w-5xl mx-auto px-6 mb-6">
        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sort order</label>
          <select 
            id="sort-select" 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="score-desc">Score: High → Low</option>
            <option value="score-asc">Score: Low → High</option>
            <option value="name-asc">Name: A → Z</option>
            <option value="size-desc">Size: Large → Small</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="select-all"
            checked={isAllSelected}
            onChange={(e) => toggleSelectAll(e.target.checked)}
            className="w-4.5 h-4.5 text-blue-600 border-slate-300 rounded cursor-pointer accent-[#2563eb]"
          />
          <label htmlFor="select-all" className="text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer select-none">
            Select All
          </label>
        </div>
      </div>

      {/* Photos Grid */}
      <div className="max-w-5xl mx-auto px-6">
        {sortedAndFilteredList.length === 0 ? (
          <div className="text-center py-20 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No images found in this category</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
            {sortedAndFilteredList.map((img) => {
              const scoreVal = Math.round((img.qualityScore || 0) * 10);
              const isSelected = selectedIds.has(img._id);

              const contentTags: string[] = [];
              const activeQualityTags: string[] = [];

              (img.tags || []).forEach((tag) => {
                const tLower = tag.toLowerCase();
                if (QUALITY_TAG_NAMES.includes(tLower)) {
                  activeQualityTags.push(tLower);
                } else {
                  contentTags.push(tLower);
                }
              });

              const isDuplicateCard = dupesList.has(img._id);

              return (
                <div
                  key={img._id}
                  onClick={() => setActiveLightboxId(img._id)}
                  className={`group relative bg-white rounded-xl border transition-all duration-300 cursor-pointer overflow-hidden break-inside-avoid mb-3 flex flex-col ${
                    isSelected 
                      ? "border-2 border-[#2563EB] shadow-lg ring-2 ring-blue-500/10" 
                      : "border-slate-200 hover:border-slate-350 hover:shadow-lg hover:-translate-y-0.5"
                  }`}
                >
                  <div className="relative w-full bg-slate-100 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={img.cloudinaryUrl} 
                      alt={img.filename} 
                      className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy" 
                    />

                    {/* Selection Checkbox */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardSelect(img._id);
                      }}
                      className={`absolute top-3 left-3 z-20 w-4 h-4 rounded border border-slate-350 flex items-center justify-center font-bold text-xs shadow-sm transition-all cursor-pointer hover:scale-105 ${
                        isSelected 
                          ? "bg-[#2563EB] border-[#2563EB] text-white opacity-100" 
                          : "bg-white/70 backdrop-blur-[1px] text-transparent opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3px]" />}
                    </div>

                    {/* Score Badge */}
                    {img.status === "completed" && (
                      <div className="absolute top-3 right-3 z-20 px-2 py-0.5 text-white text-[10px] font-extrabold rounded backdrop-blur-md shadow-sm bg-slate-900/75 border border-white/10 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${scoreVal >= 65 ? "bg-emerald-400" : scoreVal >= 50 ? "bg-amber-400" : "bg-red-400"}`} />
                        {scoreVal}
                      </div>
                    )}

                    {/* Premium status badge */}
                    <div className="absolute bottom-14 right-3 z-20 flex flex-col gap-1.5 items-end">
                      {isDuplicateCard ? (
                        <span className="px-1.5 py-0.5 bg-slate-900/80 backdrop-blur text-white text-[8px] font-black tracking-wider rounded uppercase flex items-center gap-1">
                          <Copy className="w-2.5 h-2.5" /> Duplicate
                        </span>
                      ) : activeQualityTags.length > 0 ? (
                        <span className="px-1.5 py-0.5 bg-red-650/80 backdrop-blur text-white text-[8px] font-black tracking-wider rounded uppercase flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Technical Issue
                        </span>
                      ) : null}
                    </div>

                    {/* Frosted details overlay (hover-only) */}
                    <div className="absolute bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-slate-950/90 via-slate-950/65 to-transparent backdrop-blur-[2px] text-white flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[10px] font-bold text-white truncate max-w-[70%]" title={img.filename}>
                          {img.filename}
                        </h4>
                        <span className="text-[8px] text-slate-300 font-bold flex-shrink-0">{bytes(img.fileSize, 1)}</span>
                      </div>
                      
                      {contentTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {contentTags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="px-1.5 py-0.2 bg-white/10 border border-white/10 rounded text-[8px] font-bold text-slate-200 lowercase">
                              {tag}
                            </span>
                          ))}
                          {contentTags.length > 2 && (
                            <span className="px-1.5 py-0.2 bg-white/5 border border-white/5 border-dashed rounded text-[8px] font-bold text-slate-300">
                              +{contentTags.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox Modal Overlay */}
      {activeLightboxImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/25 backdrop-blur-md transition-all duration-300">
          <div className="absolute inset-0 cursor-zoom-out" onClick={() => setActiveLightboxId(null)} />
          
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col md:flex-row shadow-2xl max-h-[90vh] z-10">
            {/* Image pane */}
            <div className="flex-1 bg-slate-50 flex items-center justify-center p-4 min-h-[300px] md:min-h-0 relative">
              <button 
                onClick={() => setActiveLightboxId(null)}
                className="absolute top-4 left-4 p-2 bg-white rounded-full border border-slate-200 text-slate-600 hover:text-slate-850 md:hidden z-20 cursor-pointer shadow-sm text-xs font-bold"
              >
                Close
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={activeLightboxImage.cloudinaryUrl} 
                alt={activeLightboxImage.filename} 
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
                onLoad={(e) => {
                  setRenderedDimensions({
                    width: e.currentTarget.naturalWidth,
                    height: e.currentTarget.naturalHeight
                  });
                }}
              />

              {/* Navigation arrows with vector chevron icons */}
              <button 
                onClick={() => navigateLightbox("prev")}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg cursor-pointer shadow-md"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => navigateLightbox("next")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-lg cursor-pointer shadow-md"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar Details panel */}
            <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-col justify-between overflow-y-auto max-h-[90vh]">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
                  <span className="text-[10px] font-extrabold text-[#2563EB] uppercase tracking-widest flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" /> Asset Parameters
                  </span>
                  <button 
                    onClick={() => setActiveLightboxId(null)}
                    className="p-1 bg-slate-50 border border-slate-200 rounded text-slate-400 hover:text-slate-805 cursor-pointer hidden md:block"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Analysis warnings */}
                  {activeLightboxImage.status && activeLightboxImage.status !== "completed" && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                      <div className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold">
                        {activeLightboxImage.status === "processing" ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                            <span className="text-blue-600 animate-pulse uppercase tracking-wider text-[9px]">Analyzing...</span>
                          </>
                        ) : activeLightboxImage.status === "pending" ? (
                          <>
                            <Clock className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-amber-600 uppercase tracking-wider text-[9px]">Pending...</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-red-650 uppercase tracking-wider text-[9px]">Failed</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {activeLightboxImage.analysisError && (
                    <div>
                      <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest block mb-1">Engine Logs</span>
                      <div className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs font-mono rounded-lg overflow-x-auto">
                        {activeLightboxImage.analysisError}
                      </div>
                    </div>
                  )}

                  {/* Quality score circular ring */}
                  {typeof activeLightboxImage.qualityScore === "number" && (
                    <div className="flex items-center gap-4 border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                      <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-black text-lg shadow-inner ${
                        Math.round(activeLightboxImage.qualityScore * 10) >= 65 
                          ? "border-emerald-500 text-emerald-600" 
                          : Math.round(activeLightboxImage.qualityScore * 10) >= 50 
                            ? "border-amber-400 text-amber-600" 
                            : "border-red-500 text-red-600"
                      }`}>
                        {Math.round(activeLightboxImage.qualityScore * 10)}
                      </div>
                      <div>
                        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Quality score</h4>
                        <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                          {activeLightboxImage.qualityScore >= 9.0 ? "Aesthetic Excellence" :
                           activeLightboxImage.qualityScore >= 8.0 ? "Very Good" :
                           activeLightboxImage.qualityScore >= 7.0 ? "Good Quality" :
                           activeLightboxImage.qualityScore >= 5.0 ? "Average Framing" : "Technical Issue"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Technical Profile bars */}
                  {activeLightboxImage.attributes && (
                    <div className="space-y-3 bg-slate-50/50 border border-slate-200 rounded-2xl p-4">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Technical Sliders</span>

                      {/* Brightness */}
                      {typeof activeLightboxImage.attributes.brightness === "number" && (
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                            <span className="flex items-center gap-1"><Sun className="w-3 h-3 text-slate-400" /> Brightness</span>
                            <span>{activeLightboxImage.attributes.brightness}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden border border-slate-200/40">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${activeLightboxImage.attributes.brightness}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Contrast */}
                      {typeof activeLightboxImage.attributes.contrast === "number" && (
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                            <span className="flex items-center gap-1"><Contrast className="w-3 h-3 text-slate-400" /> Contrast</span>
                            <span>{activeLightboxImage.attributes.contrast}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden border border-slate-200/40">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${activeLightboxImage.attributes.contrast}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Saturation */}
                      {typeof activeLightboxImage.attributes.saturation === "number" && (
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                            <span className="flex items-center gap-1"><Droplet className="w-3 h-3 text-slate-400" /> Saturation</span>
                            <span>{activeLightboxImage.attributes.saturation}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden border border-slate-200/40">
                            <div className="h-full bg-red-500 rounded-full" style={{ width: `${activeLightboxImage.attributes.saturation}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Colorfulness */}
                      {typeof activeLightboxImage.attributes.colorfulness === "number" && (
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                            <span className="flex items-center gap-1"><Palette className="w-3 h-3 text-slate-400" /> Colorfulness</span>
                            <span>{activeLightboxImage.attributes.colorfulness}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden border border-slate-200/40">
                            <div className="h-full bg-purple-500 rounded-full" style={{ width: `${activeLightboxImage.attributes.colorfulness}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Sharpness */}
                      {typeof activeLightboxImage.attributes.sharpness === "number" && (
                        <div>
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 mb-1">
                            <span className="flex items-center gap-1"><Target className="w-3 h-3 text-slate-400" /> Sharpness</span>
                            <span>{activeLightboxImage.attributes.sharpness}%</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden border border-slate-200/40">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${activeLightboxImage.attributes.sharpness}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Faces list */}
                  {Array.isArray(activeLightboxImage.people) && activeLightboxImage.people.length > 0 && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Identified Faces</span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeLightboxImage.people.map((p, idx) => {
                          const confidence = Math.max(0, Math.round((1 - p.distance) * 100));
                          return (
                            <span key={idx} className="px-2.5 py-1 bg-indigo-50 border border-indigo-150 rounded text-indigo-700 text-[10px] font-bold">
                              {p.name} <span className="text-indigo-400 font-normal">{confidence}%</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tags cloud */}
                  {Array.isArray(activeLightboxImage.tags) && activeLightboxImage.tags.length > 0 && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Object Keywords</span>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                        {activeLightboxImage.tags.map((tag, idx) => {
                          const isQual = QUALITY_TAG_NAMES.includes(tag.toLowerCase());
                          return (
                            <span 
                              key={idx} 
                              className={`px-2 py-0.5 border rounded text-[9px] font-bold ${
                                isQual 
                                  ? "bg-red-50 border-red-200 text-red-700 uppercase" 
                                  : "bg-slate-100 border-slate-200 text-slate-600"
                              }`}
                            >
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Details metadata */}
                  <div className="border-t border-slate-200 pt-4 space-y-2">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Filename</span>
                      <span className="text-xs font-bold text-slate-800 break-all leading-normal">{activeLightboxImage.filename}</span>
                    </div>
                    {renderedDimensions && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Resolution</span>
                        <span className="text-xs font-extrabold text-slate-800">{renderedDimensions.width} x {renderedDimensions.height} px</span>
                      </div>
                    )}
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Date Ingested</span>
                      <span className="text-xs font-semibold text-slate-800">{activeLightboxImage.uploadDate}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">File Size</span>
                      <span className="text-xs font-semibold text-slate-800">{bytes(activeLightboxImage.fileSize)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {reprocessMsg && (
                <div className="mt-4 p-2 bg-emerald-50 border border-emerald-200 rounded text-center text-[10px] font-bold text-emerald-700">
                  {reprocessMsg}
                </div>
              )}

              {/* Action Buttons with vector icons */}
              <div className="border-t border-slate-200 pt-4 mt-6 space-y-2 flex-shrink-0">
                <button
                  onClick={() => handleReprocessImage(activeLightboxImage._id)}
                  disabled={reprocessing}
                  className="w-full py-2 bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 text-center text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {reprocessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Re-queuing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" /> Re-analyze Asset
                    </>
                  )}
                </button>

                <div className="flex gap-2">
                  <a
                    href={activeLightboxImage.cloudinaryUrl.replace("/image/upload/", "/image/upload/fl_attachment/")}
                    download={activeLightboxImage.filename}
                    className="flex-1 py-2 border border-slate-200 hover:border-slate-350 text-slate-700 text-center text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                  <button
                    onClick={() => handleCopyUrl(activeLightboxImage._id, activeLightboxImage.cloudinaryUrl)}
                    className="flex-1 py-2 border border-slate-200 hover:border-slate-350 text-slate-700 text-center text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> {copiedId === activeLightboxImage._id ? "Copied" : "Copy URL"}
                  </button>
                </div>

                <a
                  href={activeLightboxImage.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-[#0f172a] hover:bg-[#0f172a]/95 text-white text-center text-xs font-extrabold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 mt-1"
                >
                  Open Original Source <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal Overlay */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsExportOpen(false)} />
          
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-xl p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto z-10">
            <button 
              onClick={() => setIsExportOpen(false)} 
              className="absolute top-4 right-4 p-1.5 rounded bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-400 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-lg font-extrabold text-[#0f172a] border-b border-slate-200 pb-3 mb-5 uppercase tracking-wide flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-600" /> Export Visual Assets
            </h2>

            <div className="space-y-6">
              {/* Platforms with Vector Inline SVGs */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">1. Select Social Media Platform</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div 
                    onClick={() => setExportPlatform("instagram")}
                    className={`border rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 gap-2 ${
                      exportPlatform === "instagram" 
                        ? "border-[#2563EB] bg-blue-50/50 ring-2 ring-[#2563EB]/15 text-[#2563EB]" 
                        : "border-slate-200 hover:border-blue-500/50 text-slate-650"
                    }`}
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                    <div className="text-xs font-extrabold">Instagram</div>
                  </div>
                  <div 
                    onClick={() => setExportPlatform("linkedin")}
                    className={`border rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 gap-2 ${
                      exportPlatform === "linkedin" 
                        ? "border-[#2563EB] bg-blue-50/50 ring-2 ring-[#2563EB]/15 text-[#2563EB]" 
                        : "border-slate-200 hover:border-blue-500/50 text-slate-650"
                    }`}
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                    <div className="text-xs font-extrabold">LinkedIn</div>
                  </div>
                  <div 
                    onClick={() => setExportPlatform("twitter")}
                    className={`border rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 gap-2 ${
                      exportPlatform === "twitter" 
                        ? "border-[#2563EB] bg-blue-50/50 ring-2 ring-[#2563EB]/15 text-[#2563EB]" 
                        : "border-slate-200 hover:border-blue-500/50 text-slate-650"
                    }`}
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
                    <div className="text-xs font-extrabold">Twitter / X</div>
                  </div>
                  <div 
                    onClick={() => setExportPlatform("original")}
                    className={`border rounded-2xl p-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 gap-2 ${
                      exportPlatform === "original" 
                        ? "border-[#2563EB] bg-blue-50/50 ring-2 ring-[#2563EB]/15 text-[#2563EB]" 
                        : "border-slate-200 hover:border-blue-500/50 text-slate-650"
                    }`}
                  >
                    <FileImage className="w-6 h-6" />
                    <div className="text-xs font-extrabold">Original file</div>
                  </div>
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">2. Select Cropping Dimension (Smart Cover)</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(PLATFORM_DIMENSIONS[exportPlatform] || []).map((d) => (
                    <div
                      key={d.id}
                      onClick={() => setExportDimId(d.id)}
                      className={`border rounded-xl p-3 cursor-pointer transition-all duration-200 bg-slate-50/50 hover:bg-slate-50 ${
                        exportDimId === d.id 
                          ? "border-2 border-[#2563EB] bg-[#2563EB]/5" 
                          : "border-slate-200 hover:border-blue-500/50"
                      }`}
                    >
                      <div className="text-xs font-extrabold text-[#2563EB]">
                        {d.w && d.h ? `${d.w} × ${d.h}` : "Original"}
                      </div>
                      <div className="text-[10px] font-bold text-slate-700 mt-1">{d.label}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">{d.hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formats */}
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">3. Compression Format</span>
                <div className="flex gap-3">
                  {["jpeg", "png", "webp"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setExportFormat(f)}
                      className={`flex-1 py-2.5 border rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        exportFormat === f 
                          ? "border-[#2563EB] bg-[#2563EB]/5 text-[#2563EB] font-black" 
                          : "border-slate-200 bg-white text-slate-655 hover:bg-slate-50"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end border-t border-slate-200 pt-4 mt-6">
                <button 
                  onClick={() => setIsExportOpen(false)}
                  className="px-4 py-2 border border-slate-350 hover:border-slate-450 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
                <button
                  onClick={executeExport}
                  disabled={exporting}
                  className="px-6 py-2.5 bg-[#feb602] hover:bg-[#feb602]/90 text-zinc-900 text-xs font-extrabold rounded-lg shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Packaging ZIP...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" /> Download ZIP ({selectedIds.size} assets)
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
