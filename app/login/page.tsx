import React from "react";
import { signIn } from "@/auth";
import { ShieldCheck, Sparkles, AlertTriangle } from "lucide-react";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;

  // Map OAuth errors to user-friendly messages
  const getErrorMessage = (errCode: string): string => {
    switch (errCode) {
      case "AccessDenied":
      case "CallbackRouteError":
        return "Access denied. Please ensure you are logging in with an authorized corporate account (e.g., @codebasics.io).";
      case "Configuration":
        return "Server authentication configuration error. Please check server logs.";
      default:
        return "An authentication error occurred. Please try again.";
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-150 flex flex-col items-center justify-center p-4 overflow-hidden selection:bg-indigo-500 selection:text-white">
      {/* Decorative Blur Blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[80px] pointer-events-none -z-10" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
        {/* Brand Logo Header */}
        <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-2xl mb-6 shadow-xl relative group">
          <div className="absolute inset-0 bg-indigo-500/10 rounded-2xl blur-md group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
          <ShieldCheck className="w-10 h-10 text-indigo-400 relative z-10" />
        </div>

        <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-2">
          <Sparkles className="w-3 h-3 animate-pulse" /> Corporate Portal
        </span>

        <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-300 via-violet-300 to-indigo-300 bg-clip-text text-transparent">
          VibeSelect Authorization
        </h1>
        <p className="text-zinc-500 text-xs mt-2 max-w-xs">
          Authorized team members can access visual asset libraries, quality analyses, and metadata tracking.
        </p>

        {/* Dynamic Error State */}
        {error && (
          <div className="w-full mt-6 p-4 bg-red-950/20 border border-red-900/40 rounded-xl text-left flex gap-3 animate-headShake">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-red-300">Sign-in Blocked</h3>
              <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                {getErrorMessage(error)}
              </p>
            </div>
          </div>
        )}

        {/* Action Button */}
        <form
          action={async () => {
            "use server";
            await signIn("microsoft-entra-id");
          }}
          className="w-full mt-8"
        >
          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-3 transition-all duration-300 transform active:scale-[0.98]"
          >
            {/* Microsoft Windows Icon */}
            <svg
              className="w-4 h-4 fill-current text-white flex-shrink-0"
              viewBox="0 0 23 23"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M0 0h11v11H0zM12 0h11v11H12zM0 12h11v11H0zM12 12h11v11H12z" />
            </svg>
            Sign in with Microsoft Account
          </button>
        </form>

        <p className="text-[10px] text-zinc-650 mt-8">
          Strictly secured with Microsoft Entra ID OAuth 2.0 protocol.
        </p>
      </div>

      <footer className="mt-8 text-center text-[10px] text-zinc-700">
        <p>VibeSelect Secure Gateway • Codebasics Inc.</p>
      </footer>
    </div>
  );
}
