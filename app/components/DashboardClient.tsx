"use client";

import { useState, useEffect } from "react";
import { bytes } from "@/lib/format";
import { 
  Sparkles, 
  Activity, 
  Database, 
  Cloudy, 
  Images, 
  BookOpen, 
  FileText,
  AlertCircle,
  LogOut,
  User as UserIcon,
  Shield,
  Search,
  X,
  Settings
} from "lucide-react";
import { signOut } from "next-auth/react";
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
 
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
 
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
    fetchStorage(); // Refresh storage metrics concurrently
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
 
  // Debounce search input modifications
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 450);
 
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);
 
  // Fetch image records when search query parameter changes
  useEffect(() => {
    fetchImages(searchQuery);
  }, [searchQuery]);
 
  // Poll for status updates if there are any active queue processing jobs
  useEffect(() => {
    const hasActiveJobs = images.some((img) => img.status === "pending" || img.status === "processing");
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
  }, [images, searchQuery]);

  // Compute stats
  const uniqueDatesCount = new Set(images.map((img) => img.uploadDate)).size;
  const totalStorageBytes = images.reduce((sum, img) => sum + img.fileSize, 0);

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-550 flex flex-col font-sans selection:bg-primary selection:text-white">
      
      {/* Top Navbar */}
      <nav className="w-full bg-white border-b border-zinc-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left Side: Logo & Project Name */}
          <div className="flex items-center gap-3">
            <a href="https://codebasics.io" target="_blank" rel="noopener noreferrer" className="flex items-center">
              <img 
                src="https://files.codebasics.io/v3/images/logo.svg" 
                className="h-7 w-auto" 
                alt="Codebasics Logo" 
              />
            </a>
            <div className="h-5 w-[1px] bg-zinc-200" />
            <span className="text-base font-extrabold text-zinc-900 tracking-tight font-sans">
              VibeSelect
            </span>
          </div>

          {/* Right Side: Settings & Profile Dropdowns */}
          <div className="flex items-center gap-3">
            
            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen);
                  setIsProfileOpen(false);
                }}
                className={`p-2 rounded-lg border text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all ${
                  isSettingsOpen 
                    ? "bg-zinc-100 border-zinc-300 text-zinc-900 shadow-inner" 
                    : "bg-white border-zinc-200"
                }`}
                title="System Settings & Storage"
              >
                <Settings className={`w-5 h-5 ${isSettingsOpen ? "rotate-45" : ""} transition-transform duration-200`} />
              </button>

              {isSettingsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 rounded-xl p-5 shadow-lg z-50 flex flex-col gap-4 text-xs">
                  <div>
                    <h3 className="font-extrabold text-zinc-900 text-sm mb-1">System & Metrics</h3>
                    <p className="text-zinc-400 text-[10px]">Cloudinary storage and database status</p>
                  </div>
                  
                  <div className="h-[1px] bg-zinc-150" />

                  {/* Cloudinary Storage Details */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between font-bold text-zinc-700">
                      <span className="flex items-center gap-1">
                        <Cloudy className="w-3.5 h-3.5 text-primary" /> Cloud Storage
                      </span>
                      {storageLoading ? (
                        <span className="text-zinc-400 font-normal">Loading...</span>
                      ) : storageData ? (
                        <span className="text-zinc-900">{bytes(storageData.free)} Free</span>
                      ) : (
                        <span className="text-zinc-405">Unavailable</span>
                      )}
                    </div>

                    {!storageLoading && storageData && (
                      <div>
                        <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden border border-zinc-200">
                          <div 
                            className="bg-primary h-full rounded-full transition-all duration-500" 
                            style={{ width: `${Math.max(1, Math.min(100, storageData.usedPercent))}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[9px] text-zinc-400 mt-1">
                          <span>{bytes(storageData.used)} used</span>
                          <span>{bytes(storageData.limit)} max ({storageData.plan})</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="h-[1px] bg-zinc-150" />

                  {/* General Stats */}
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="bg-zinc-50 border border-zinc-150 rounded-lg p-2.5">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Total Images</span>
                      <span className="text-base font-extrabold text-zinc-900">{images.length} assets</span>
                    </div>
                    <div className="bg-zinc-50 border border-zinc-150 rounded-lg p-2.5">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block mb-1">Data Storage</span>
                      <span className="text-base font-extrabold text-zinc-900 truncate block" title={bytes(totalStorageBytes)}>
                        {bytes(totalStorageBytes, 1)}
                      </span>
                    </div>
                  </div>

                  <div className="h-[1px] bg-zinc-150" />

                  {/* DB Connection Status */}
                  <div className="flex items-center justify-between bg-zinc-50 border border-zinc-150 p-2.5 rounded-lg">
                    <span className="flex items-center gap-1 font-bold text-zinc-700">
                      <Database className="w-3.5 h-3.5 text-emerald-500" /> Database Status
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-zinc-900">
                      <span className={`w-2 h-2 rounded-full ${
                        dbConnected === true 
                          ? "bg-emerald-500 shadow-[0_0_8px_rgba(63,202,130,0.3)]" 
                          : dbConnected === false 
                            ? "bg-red-500" 
                            : "bg-amber-400 animate-pulse"
                      }`} />
                      {dbConnected === true ? "Connected" : dbConnected === false ? "Disconnected" : "Pending"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsSettingsOpen(false);
                }}
                className={`flex items-center gap-2 pl-2 pr-3 py-1.5 border rounded-lg hover:bg-zinc-50 transition-all ${
                  isProfileOpen 
                    ? "bg-zinc-100 border-zinc-300 shadow-inner" 
                    : "bg-white border-zinc-200"
                }`}
                title="User Profile"
              >
                <div className="w-6 h-6 bg-zinc-100 border border-zinc-250 rounded-full flex items-center justify-center text-zinc-500 relative flex-shrink-0">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-emerald-500 border border-white rounded-full" />
                </div>
                <span className="text-xs font-bold text-zinc-700 hidden sm:inline max-w-[100px] truncate">
                  {user?.name || "User"}
                </span>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-zinc-200 rounded-xl p-4 shadow-lg z-50 flex flex-col gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-zinc-100 border border-zinc-200 rounded-full flex items-center justify-center text-zinc-650">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-zinc-900 truncate">{user?.name || "User"}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{user?.email}</p>
                    </div>
                  </div>

                  <div className="h-[1px] bg-zinc-150" />

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Access Role</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-50 border border-zinc-200 rounded text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      <Shield className="w-2.5 h-2.5 text-zinc-400" /> {userRole}
                    </span>
                  </div>

                  <div className="h-[1px] bg-zinc-150" />

                  <button
                    onClick={handleSignOut}
                    className="w-full py-2 px-3 border border-red-200 bg-red-50 hover:bg-red-100 hover:text-red-750 text-red-650 text-center font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </nav>

      {/* Invisible backdrop to dismiss dropdowns */}
      {(isSettingsOpen || isProfileOpen) && (
        <div 
          className="fixed inset-0 z-30 bg-transparent" 
          onClick={() => {
            setIsSettingsOpen(false);
            setIsProfileOpen(false);
          }} 
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-12">
        
        {/* Connection status and notifications */}
        {dbConnected === false && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Configuration Connection Alert</h3>
              <p className="text-xs text-red-700 mt-1">
                {errorMessage || "Database connection could not be established. Please verify your MONGODB_URI is correctly configured in your .env.local file."}
              </p>
            </div>
          </div>
        )}

        {/* Section 1: Drag & Drop Ingestion Panel */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
            <h2 className="text-lg font-bold text-zinc-900 tracking-tight">1. Ingestion Pipeline</h2>
            <span className="text-xs text-zinc-400">Upload ZIP or Raw Images</span>
          </div>
          <UploadZone onUploadComplete={() => fetchImages(searchQuery)} />
        </section>

        {/* Section 2: Catalog Browser & Gallery */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-200 pb-2 gap-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-bold text-zinc-900 tracking-tight">2. Media Asset Library</h2>
              <span className="text-xs text-zinc-400">Explore cataloged database records</span>
            </div>
            
            {/* Search Input inside Section 2 Header */}
            <div className="relative w-full sm:w-80">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search filenames, paths, tags..."
                className="w-full pl-9 pr-9 py-2 bg-zinc-50 border border-zinc-200 hover:border-zinc-250 focus:border-primary focus:bg-white text-xs text-zinc-800 placeholder-zinc-400 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-650 transition-colors"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {searchQuery && (
            <div className="text-xs font-semibold text-zinc-500 bg-zinc-50 border border-zinc-200 px-3.5 py-2.5 rounded-lg select-none flex items-center justify-between">
              <div>
                Found <span className="text-primary font-bold">{images.length}</span> matching {images.length === 1 ? "asset" : "assets"} for &ldquo;{searchQuery}&rdquo;
              </div>
              <button 
                onClick={() => setSearchInput("")}
                className="text-[10px] font-bold text-zinc-400 hover:text-primary uppercase tracking-wider"
              >
                Reset Search
              </button>
            </div>
          )}

          {/* Grid images section */}
          <ImageGallery 
            images={images} 
            loading={loading} 
            onResetComplete={() => fetchImages(searchQuery)} 
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-450 bg-white">
        <p>VibeSelect Application • Secured by Microsoft Entra ID OAuth 2.0 • Codebasics Inc.</p>
      </footer>
    </div>
  );
}
