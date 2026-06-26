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

  const user = session?.user;
  const userRole = user?.role || "VIEWER";

  const fetchImages = async () => {
    setLoading(true);
    setErrorMessage(null);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background visual blobs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header / Brand Title & Profile */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-zinc-800/80 pb-6 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Stage 1
              </span>
              <span className="text-zinc-550 text-xs">• Ingestion & Auth Active</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mt-2 bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              VibeSelect Ingestion
            </h1>
            <p className="text-zinc-450 text-sm mt-1 max-w-xl">
              Upload raw images or ZIP folders, catalog assets date-wise in Cloudinary, and retrieve shared assets tracked in MongoDB Atlas.
            </p>
          </div>

          {/* Profile Section */}
          <div className="w-full md:w-auto bg-zinc-900/60 border border-zinc-800/85 rounded-xl p-3.5 flex items-center justify-between md:justify-start gap-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-500/30 rounded-full flex items-center justify-center text-indigo-400 relative">
                <UserIcon className="w-5 h-5" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-200 truncate max-w-[150px]">
                  {user?.name || "User"}
                </p>
                <p className="text-[11px] text-zinc-500 truncate max-w-[150px] mb-0.5">
                  {user?.email}
                </p>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-800 border border-zinc-700/60 rounded text-[9px] font-bold text-indigo-300 uppercase tracking-widest">
                  <Shield className="w-2.5 h-2.5" /> {userRole}
                </span>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              className="p-2 hover:bg-zinc-800 hover:text-red-400 rounded-lg text-zinc-400 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Connection status and notifications */}
        {dbConnected === false && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-900/40 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">Configuration Connection Alert</h3>
              <p className="text-xs text-zinc-400 mt-1">
                {errorMessage || "Database connection could not be established. Please verify your MONGODB_URI is correctly configured in your .env.local file."}
              </p>
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Images className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-medium">Total Images</span>
            </div>
            <p className="text-2xl font-bold text-zinc-200">
              {loading ? "..." : images.length}
            </p>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium">DB Status</span>
            </div>
            <p className="text-sm font-bold text-zinc-200 flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${
                dbConnected === true 
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
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

          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Cloudy className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-medium">Cloud Storage</span>
            </div>
            <p className="text-sm font-bold text-zinc-200 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
              Cloudinary Configured
            </p>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4 backdrop-blur-xl">
            <div className="flex items-center gap-2 text-zinc-500 mb-1.5">
              <Activity className="w-4 h-4 text-violet-400" />
              <span className="text-xs font-medium">Data Storage</span>
            </div>
            <p className="text-sm font-bold text-zinc-200 mt-1">
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
      <footer className="border-t border-zinc-900/80 py-6 text-center text-xs text-zinc-650 bg-zinc-950">
        <p>VibeSelect Application • Secured by Microsoft Entra ID OAuth 2.0</p>
      </footer>
    </div>
  );
}
