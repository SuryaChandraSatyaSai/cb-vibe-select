"use client";

import React, { useState, useEffect } from "react";
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
  Shield
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

  const fetchImages = async () => {
    setLoading(true);
    setErrorMessage(null);
    fetchStorage(); // Refresh storage metrics concurrently
    try {
      const response = await fetch("/api/images");
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
    fetchImages();
  }, []);

  // Poll for status updates if there are any active queue processing jobs
  useEffect(() => {
    const hasActiveJobs = images.some((img) => img.status === "pending" || img.status === "processing");
    if (!hasActiveJobs) return;

    const interval = setInterval(() => {
      fetch("/api/images")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.images) {
            setImages(data.images);
          }
        })
        .catch((err) => console.error("Error polling image updates:", err));
    }, 3000);

    return () => clearInterval(interval);
  }, [images]);

  // Compute stats
  const uniqueDatesCount = new Set(images.map((img) => img.uploadDate)).size;
  const totalStorageBytes = images.reduce((sum, img) => sum + img.fileSize, 0);
  const formatTotalSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) {
      return mb.toFixed(1) + " MB";
    }
    return (mb / 1024).toFixed(2) + " GB";
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header / Brand Title & Profile */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-zinc-200 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Stage 2
              </span>
              <span className="text-zinc-500 text-xs">• Ingestion & Queue Active</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-zinc-900">
              VibeSelect Curation
            </h1>
            <p className="text-zinc-500 text-sm mt-1 max-w-xl">
              Upload raw images or ZIP folders, catalog assets date-wise, and process quality assessment in the background.
            </p>
          </div>

          {/* Profile Section */}
          <div className="w-full md:w-auto bg-white border border-zinc-200 rounded-xl p-3.5 flex items-center justify-between md:justify-start gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-zinc-100 border border-zinc-200 rounded-full flex items-center justify-center text-zinc-600 relative">
                <UserIcon className="w-5 h-5" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 truncate max-w-[150px]">
                  {user?.name || "User"}
                </p>
                <p className="text-[11px] text-zinc-500 truncate max-w-[150px] mb-0.5">
                  {user?.email}
                </p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                  <Shield className="w-2.5 h-2.5 text-zinc-400" /> {userRole}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-zinc-100 hover:text-red-600 rounded-lg text-zinc-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Connection status and notifications */}
        {dbConnected === false && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">Configuration Connection Alert</h3>
              <p className="text-xs text-red-700 mt-1">
                {errorMessage || "Database connection could not be established. Please verify your MONGODB_URI is correctly configured in your .env.local file."}
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Images className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Total Images</span>
            </div>
            <p className="text-2xl font-bold text-zinc-900">
              {loading ? "..." : images.length}
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Database className="w-4 h-4 text-emerald-500" />
              <span className="text-xs font-medium">DB Status</span>
            </div>
            <p className="text-sm font-bold text-zinc-900 flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${
                dbConnected === true 
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" 
                  : dbConnected === false 
                    ? "bg-red-500" 
                    : "bg-amber-500"
              }`} />
              {dbConnected === true 
                ? "MongoDB Atlas" 
                : dbConnected === false 
                  ? "Disconnected" 
                  : "Connecting..."
              }
            </p>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Cloudy className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Cloud Storage</span>
            </div>
            {storageLoading ? (
              <div className="space-y-2 mt-2">
                <div className="h-5 bg-zinc-100 rounded animate-pulse w-3/4" />
                <div className="h-1.5 bg-zinc-100 rounded animate-pulse w-full" />
                <div className="h-3 bg-zinc-100 rounded animate-pulse w-1/2" />
              </div>
            ) : storageData ? (
              <div>
                <p className="text-sm font-bold text-zinc-900 mt-1">
                  {formatTotalSize(storageData.free)} Free
                </p>
                <div className="w-full bg-zinc-100 rounded-full h-1.5 mt-2 overflow-hidden border border-zinc-200">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.max(1, Math.min(100, storageData.usedPercent))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-zinc-400 mt-1.5 font-medium">
                  <span>{formatTotalSize(storageData.used)} used</span>
                  <span>{formatTotalSize(storageData.limit)} max ({storageData.plan})</span>
                </div>
              </div>
            ) : (
              <p className="text-sm font-bold text-zinc-500 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                Status Unavailable
              </p>
            )}
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-zinc-550 mb-1.5">
              <Activity className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-medium text-zinc-500">Data Storage</span>
            </div>
            <p className="text-sm font-bold text-zinc-900 mt-1">
              {loading ? "..." : `${formatTotalSize(totalStorageBytes)} across ${uniqueDatesCount} folders`}
            </p>
          </div>
        </section>

        {/* Upload Panel */}
        <section className="mb-8">
          <UploadZone onUploadComplete={fetchImages} />
        </section>

        {/* Image Browser Gallery */}
        <section>
          <ImageGallery 
            images={images} 
            loading={loading} 
            onResetComplete={fetchImages} 
          />
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-500 bg-white">
        <p>VibeSelect Application • Secured by Microsoft Entra ID OAuth 2.0</p>
      </footer>
    </div>
  );
}
