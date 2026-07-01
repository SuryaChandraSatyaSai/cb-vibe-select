"use client";

import { useState, useEffect } from "react";
import { bytes } from "@/lib/format";
import { signOut } from "next-auth/react";
import { 
  Search, 
  Database, 
  Shield, 
  LogOut, 
  AlertCircle, 
  X, 
  Loader2,
  UploadCloud,
  Cpu,
  Download,
  Scan,
  Palette,
  Copy,
  Layout,
  PanelLeft,
  PanelLeftClose,
  CheckCircle,
  Clock,
  ChevronRight,
  Image as ImageIcon,
  Pin
} from "lucide-react";
import UploadZone from "./UploadZone";
import ImageGallery, { ImageRecord } from "./ImageGallery";

interface DashboardClientProps {
  session: any;
}

export default function DashboardClient({ session }: DashboardClientProps) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
 
  // Dashboard active panel view state: "overview", "gallery"
  const [activePanel, setActivePanel] = useState<"overview" | "gallery">("overview");
  
  // Search state
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dropdown & sidebar navigation toggle states
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [sidebarDocked, setSidebarDocked] = useState<boolean>(true);

  useEffect(() => {
    const saved = localStorage.getItem("sidebarDocked");
    if (saved !== null) {
      const isDocked = JSON.parse(saved);
      setSidebarDocked(isDocked);
      // Ensure sidebar is open on mount if docked and on desktop
      if (isDocked && window.innerWidth >= 768) {
        setSidebarOpen(true);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarDocked", JSON.stringify(sidebarDocked));
  }, [sidebarDocked]);
 
  // Ingestion states
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStats, setUploadStats] = useState<{ fileCount: number; totalSize: number } | null>(null);

  // Storage stats
  const [storageData, setStorageData] = useState<{
    used: number;
    limit: number;
    usedPercent: number;
    free: number;
    plan: string;
  } | null>(null);
  const [storageLoading, setStorageLoading] = useState<boolean>(true);

  const user = session?.user;
  const userRole = user?.role || "VIEWER";
  
  // Initials for avatar
  const userInitials = user?.name 
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() 
    : "US";

  const fetchStorage = async () => {
    setStorageLoading(true);
    try {
      const response = await fetch("/api/storage");
      const data = await response.json();
      if (data.success) {
        setStorageData({
          used: data.storage.used,
          limit: data.storage.limit,
          usedPercent: data.storage.usedPercent,
          free: data.storage.free,
          plan: data.plan,
        });
      } else {
        setStorageData(null);
      }
    } catch (err) {
      console.error("Error fetching storage metrics:", err);
      setStorageData(null);
    } finally {
      setStorageLoading(false);
    }
  };

  const fetchImages = async (query?: string) => {
    setLoading(true);
    setErrorMessage(null);
    fetchStorage();
    try {
      const url = query ? `/api/images?search=${encodeURIComponent(query)}` : "/api/images";
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setImages(data.images || []);
        setDbConnected(true);
      } else {
        setDbConnected(false);
        setErrorMessage(data.message || "Failed to load image library.");
      }
    } catch (err: any) {
      setDbConnected(false);
      setErrorMessage("Could not connect to the backend server.");
      console.error("Error loading library:", err);
    } finally {
      setLoading(false);
    }
  };
 
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 450);
 
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);
 
  useEffect(() => {
    fetchImages(searchQuery);
  }, [searchQuery]);

  // Track if there are active processing jobs
  const hasActiveJobs = images.some((img) => img.status === "pending" || img.status === "processing");
 
  useEffect(() => {
    if (!hasActiveJobs) return;
 
    const interval = setInterval(() => {
      const url = searchQuery ? `/api/images?search=${encodeURIComponent(searchQuery)}` : "/api/images";
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.images) {
            setImages(data.images);
          }
        })
        .catch((err) => console.error("Error polling image updates:", err));
    }, 3000);
 
    return () => clearInterval(interval);
  }, [hasActiveJobs, searchQuery]);

  const totalStorageBytes = images.reduce((sum, img) => sum + img.fileSize, 0);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (val && activePanel !== "gallery") {
      setActivePanel("gallery");
    }
  };

  const handleUploadStart = (fileCount: number, totalSize: number) => {
    setUploading(true);
    setUploadProgress(0);
    setUploadStats({ fileCount, totalSize });
  };

  const handleUploadProgress = (prog: number) => {
    setUploadProgress(prog);
  };

  const handleUploadComplete = () => {
    setUploading(false);
    fetchImages(searchQuery);
    setActivePanel("gallery");
  };

  const handleNewUploadClick = () => {
    setActivePanel("overview");
    setSearchInput("");
  };

  const getActiveStage = () => {
    if (uploading) return 1;
    const hasPending = images.some((img) => img.status === "pending" || img.status === "processing");
    if (hasPending) {
      const total = images.length;
      const completed = images.filter((img) => img.status === "completed" || img.status === "failed").length;
      if (completed < total * 0.6) {
        return 2;
      } else {
        return 3;
      }
    }
    return 4;
  };

  const activeStage = getActiveStage();

  const completedCount = images.filter((img) => img.status === "completed" || img.status === "failed").length;
  const totalImagesCount = images.length;
  const analysisPercent = totalImagesCount > 0 ? Math.round((completedCount / totalImagesCount) * 100) : 0;

  const currentProgressPercent = uploading ? uploadProgress : analysisPercent;
  const progressLabel = uploading 
    ? "Ingesting files to Cloudinary repository..." 
    : activeStage === 2 
      ? "Running technical assessment scoring..." 
      : activeStage === 3 
        ? "Classifying faces & tagging objects..." 
        : "Analysis complete!";
        
  const progressCountText = uploading
    ? `${uploadStats?.fileCount ?? 0} files`
    : `${completedCount} / ${totalImagesCount} assets`;

  const liveBest = images.filter((img) => Math.round((img.qualityScore || 0) * 10) >= 65 && img.status === "completed").length;
  const liveAcceptable = images.filter((img) => Math.round((img.qualityScore || 0) * 10) >= 50 && Math.round((img.qualityScore || 0) * 10) < 65 && img.status === "completed").length;
  const liveRejected = images.filter((img) => Math.round((img.qualityScore || 0) * 10) < 50 && img.status === "completed").length;

  const dupesList = new Set<string>();
  const seenSizes = new Map<number, string>();
  const seenNames = new Map<string, string>();
  images.forEach((img) => {
    if (img.tags?.includes("dupe")) {
      dupesList.add(img._id);
    } else if (seenSizes.has(img.fileSize) || seenNames.has(img.filename)) {
      dupesList.add(img._id);
    } else {
      seenSizes.set(img.fileSize, img._id);
      seenNames.set(img.filename, img._id);
    }
  });
  const liveDuplicates = images.filter((img) => dupesList.has(img._id)).length;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col font-sans selection:bg-[#2563EB] selection:text-white">
      
      <div className="flex-1 flex relative h-0 min-h-0 overflow-hidden">
        
        <aside className={`bg-[#0f172a] text-slate-300 border-r border-slate-900 flex flex-col justify-between flex-shrink-0 transition-all duration-300 z-20 h-full overflow-hidden ${
          sidebarOpen 
            ? "translate-x-0 absolute md:relative inset-y-0 left-0 w-full md:w-64" 
            : "-translate-x-full absolute md:translate-x-0 md:w-0 overflow-hidden border-r-0"
        }`}>
          <div>
            {/* Header / Brand Logo */}
            <div className="h-16 px-6 border-b border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <a href="/" className="flex items-center">
                  <img 
                    src="https://files.codebasics.io/v3/images/logo.svg" 
                    className="h-7 w-auto filter brightness-0 invert" 
                    alt="Codebasics Logo" 
                  />
                </a>
                <div className="h-4 w-[1px] bg-slate-800" />
                <span className="text-sm font-extrabold text-white tracking-tight uppercase">
                  VibeSelect
                </span>
              </div>
              
              {/* Mobile Sidebar Toggle */}
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white md:hidden cursor-pointer"
                title="Toggle Sidebar"
              >
                {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
              </button>

              {/* Desktop Dock Toggle Button */}
              <button 
                onClick={() => setSidebarDocked(!sidebarDocked)}
                className={`p-1.5 rounded transition-all hidden md:flex cursor-pointer ${
                  sidebarDocked 
                    ? "text-blue-400 bg-blue-950/40 border border-blue-900/50" 
                    : "text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent"
                }`}
                title={sidebarDocked ? "Unpin Sidebar (Floating Mode)" : "Pin Sidebar (Always Visible)"}
              >
                <Pin className={`w-4 h-4 transition-transform ${sidebarDocked ? "rotate-45" : ""}`} />
              </button>
            </div>

            {/* Storage Quota widget in Sidebar */}
            <div className="p-4 mx-3 my-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl space-y-2.5 text-[11px]">
              <div className="flex justify-between items-center font-bold text-slate-400">
                <span>Cloudinary Quota</span>
                {!storageLoading && storageData && (
                  <span className="text-white font-extrabold">{storageData.free ? bytes(storageData.free) : "0 MB"} Free</span>
                )}
              </div>
              {!storageLoading && storageData ? (
                <div>
                  <div className="w-full bg-slate-850 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div 
                      className="bg-[#2563EB] h-full rounded-full transition-all duration-500" 
                      style={{ width: `${Math.max(1, Math.min(100, storageData.usedPercent))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-bold mt-1.5">
                    <span>{bytes(storageData.used)} used</span>
                    <span>{storageData.plan}</span>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500 text-[10px] animate-pulse">Loading quota metrics...</div>
              )}
            </div>

            {/* Navigation Lists */}
            <div className="px-3 space-y-1">
              <span className="px-3 text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block mb-2">Workspace</span>
              <button
                onClick={() => { 
                  setActivePanel("overview"); 
                  if (!sidebarDocked || window.innerWidth < 768) {
                    setSidebarOpen(false); 
                  }
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                  activePanel === "overview" 
                    ? "bg-[#2563EB] text-white shadow-lg shadow-blue-500/10 font-extrabold" 
                    : "hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layout className="w-4 h-4" />
                <span>Overview &amp; Upload</span>
              </button>
              <button
                onClick={() => { 
                  setActivePanel("gallery"); 
                  if (!sidebarDocked || window.innerWidth < 768) {
                    setSidebarOpen(false); 
                  }
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                  activePanel === "gallery" 
                    ? "bg-[#2563EB] text-white shadow-lg shadow-blue-500/10 font-extrabold" 
                    : "hover:bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Media Library</span>
                {images.length > 0 && (
                  <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    activePanel === "gallery" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                  }`}>
                    {images.length}
                  </span>
                )}
              </button>

            </div>
          </div>

          {/* User Profile Block at Sidebar Bottom */}
          <div className="p-4 border-t border-slate-900 bg-slate-900/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/10 border border-blue-500/20 text-[#2563EB] rounded-full flex items-center justify-center text-[10px] font-black tracking-tighter relative flex-shrink-0">
                {userInitials}
                <span className="absolute bottom-0 right-0 w-2 h-2 bg-[#22c55e] border border-slate-900 rounded-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-xs truncate leading-none">{user?.name || "User"}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">{userRole}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE CANVAS AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
          
          {/* Header Bar */}
          <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between z-10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                title="Toggle Sidebar"
              >
                {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
              </button>
              <div className="flex items-center text-xs font-bold text-slate-400 uppercase tracking-widest gap-2">
                <span>VibeSelect</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-slate-800">{activePanel}</span>
              </div>
            </div>

            {/* Catalog search bar inside header */}
            {activePanel === "gallery" && (
              <div className="flex-1 max-w-sm relative mx-6 hidden sm:block">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search filename, attributes, tags..."
                  className="w-full pl-9 pr-10 py-1.5 border border-slate-200 hover:border-slate-350 focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/10 rounded-md text-xs bg-slate-50 focus:bg-white outline-none transition-all"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Database & Cloud Quota Badges */}
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border bg-white ${
                dbConnected === true ? "border-emerald-200 text-emerald-600" : "border-red-200 text-red-600"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dbConnected === true ? "bg-emerald-500" : "bg-red-500"}`} />
                DB {dbConnected === true ? "Online" : "Offline"}
              </span>
            </div>
          </header>

          {/* Database offline alert banners */}
          {dbConnected === false && (
            <div className="p-4 bg-red-50 border-b border-red-250 flex items-start gap-3">
              <AlertCircle className="w-4.5 h-4.5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-red-800">Database Connection Error</h3>
                <p className="text-[11px] text-red-700 mt-0.5">
                  {errorMessage || "Database catalog offline. Please verify the server configuration parameters."}
                </p>
              </div>
            </div>
          )}

          {/* Main workspace panels */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50 bg-grid-pattern">
            
            {/* ACTIVE INGESTION / PROCESSING CONTAINER WIDGET */}
            {(uploading || hasActiveJobs) && (
              <div className="max-w-4xl mx-auto mb-8 bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <Cpu className="w-4.5 h-4.5 text-blue-600 animate-spin" /> Ingestion Pipeline
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 font-semibold">Running Laplacian focus scanning and duplication filters.</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-50 border border-blue-150 text-blue-600 rounded text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Stage {activeStage} of 4
                  </span>
                </div>

                {/* Progress bar info */}
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider">
                    <span className="font-bold text-slate-500">{progressLabel}</span>
                    <span className="font-bold text-slate-800">{progressCountText}</span>
                  </div>
                  <div className="w-full bg-slate-100 border border-slate-200 h-2 rounded-full overflow-hidden relative shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 to-[#5ebbff] rounded-full transition-all duration-300 animate-shimmer" 
                      style={{ width: `${currentProgressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Micro Stats */}
                <div className="grid grid-cols-4 gap-3 text-center mb-6">
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Best Shots</span>
                    <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{liveBest}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Acceptable</span>
                    <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{liveAcceptable}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Low-Score</span>
                    <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{liveRejected}</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                    <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider block">Duplicates</span>
                    <span className="text-sm font-extrabold text-slate-800 mt-0.5 block">{liveDuplicates}</span>
                  </div>
                </div>

                {/* Mini Thumbnails Queue grid */}
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2.5 max-h-44 overflow-y-auto pr-1">
                  {images.map((img) => {
                    const hasScore = img.status === "completed" && typeof img.qualityScore === "number";
                    const isBest = hasScore && Math.round((img.qualityScore || 0) * 10) >= 50;

                    return (
                      <div 
                        key={img._id} 
                        className={`relative aspect-square rounded-xl overflow-hidden border bg-slate-50 ${
                          img.status === "completed" 
                            ? (isBest ? "border-emerald-500 shadow-sm" : "border-red-200 opacity-60") 
                            : "border-slate-200"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={img.cloudinaryUrl} 
                          alt={img.filename} 
                          className="w-full h-full object-cover"
                        />
                        
                        {/* Processing overlay */}
                        {img.status !== "completed" && img.status !== "failed" && (
                          <div className="absolute inset-0 bg-[#2563EB]/25 flex items-center justify-center">
                            <div className="w-3.5 h-3.5 border-2 border-t-transparent border-white rounded-full animate-spin" />
                          </div>
                        )}
                        {img.status === "failed" && (
                          <div className="absolute inset-0 bg-red-650/40 flex items-center justify-center text-white text-[8px] font-black tracking-wider uppercase">
                            Err
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB VIEW 1: OVERVIEW & INGEST */}
            {activePanel === "overview" && (
              <div className="max-w-4xl mx-auto space-y-8">
                
                {/* Dashboard summary overview stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <Layout className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Images</span>
                      <span className="text-base font-extrabold text-slate-900 mt-0.5 block">{images.length}</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Best Shots</span>
                      <span className="text-base font-extrabold text-slate-900 mt-0.5 block">{liveBest}</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center flex-shrink-0">
                      <Copy className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Duplicates</span>
                      <span className="text-base font-extrabold text-slate-900 mt-0.5 block">{liveDuplicates}</span>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center flex-shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Library Size</span>
                      <span className="text-base font-extrabold text-slate-900 mt-0.5 block truncate" title={bytes(totalStorageBytes)}>
                        {bytes(totalStorageBytes, 1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dropzone Upload Block */}
                <div className="bg-white border border-slate-200/80 shadow-sm rounded-xl p-6 sm:p-8">
                  <div className="mb-6">
                    <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider">Asset Ingestion</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Drag directories, folders, or ZIP archives containing event photos.</p>
                  </div>

                  <UploadZone 
                    onUploadComplete={handleUploadComplete} 
                    onUploadStart={handleUploadStart}
                    onUploadProgress={handleUploadProgress}
                  />
                </div>

              </div>
            )}

            {/* TAB VIEW 2: IMAGE LIBRARY / CATALOG */}
            {activePanel === "gallery" && (
              <div className="max-w-5xl mx-auto">
                {images.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-16 text-center shadow-sm max-w-xl mx-auto flex flex-col items-center">
                    <UploadCloud className="w-12 h-12 text-slate-300 mb-4" />
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Empty Library Catalog</h3>
                    <p className="text-xs text-slate-500 mt-2 max-w-xs leading-relaxed font-semibold">
                      You have not uploaded any images to this event workspace yet. Go to the Overview tab to ingest photos.
                    </p>
                    <button
                      onClick={() => setActivePanel("overview")}
                      className="mt-6 px-6 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Inbound Upload
                    </button>
                  </div>
                ) : (
                  <ImageGallery 
                    images={images} 
                    loading={loading} 
                    onResetComplete={() => fetchImages(searchQuery)}
                    onNewUploadClick={handleNewUploadClick}
                  />
                )}
              </div>
            )}



          </div>



        </div>

      </div>

    </div>
  );
}
