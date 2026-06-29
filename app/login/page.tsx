import { signIn } from "@/auth";
import { Sparkles, AlertTriangle } from "lucide-react";

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
    <div className="relative min-h-screen bg-zinc-50 text-zinc-500 flex flex-col items-center justify-center p-4 overflow-hidden selection:bg-primary selection:text-white font-sans">
      {/* Login Card */}
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-8 shadow-sm flex flex-col items-center text-center">
        {/* Brand Logo Header */}
        <div className="mb-6 flex justify-center">
          <img 
            src="https://files.codebasics.io/v3/images/logo.svg" 
            className="h-10 w-auto" 
            alt="Codebasics Logo" 
          />
        </div>


        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
          VibeSelect Authorization
        </h1>
        <p className="text-zinc-400 text-xs mt-2 max-w-xs leading-relaxed">
          Authorized team members can access visual asset libraries, quality analyses, and metadata tracking.
        </p>

        {/* Dynamic Error State */}
        {error && (
          <div className="w-full mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-left flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-red-800">Sign-in Blocked</h3>
              <p className="text-[11px] text-red-700 mt-1 leading-relaxed">
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
            className="w-full py-3 px-4 bg-primary hover:bg-primary-hover active:bg-blue-750 text-white text-sm font-bold rounded-lg shadow-sm flex items-center justify-center gap-3 transition-all duration-300 transform active:scale-[0.98]"
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

        <p className="text-[10px] text-zinc-400 mt-8">
          Strictly secured with Microsoft Entra ID OAuth 2.0 protocol.
        </p>
      </div>

      <footer className="mt-8 text-center text-[10px] text-zinc-400">
        <p>VibeSelect Secure Gateway • Codebasics Inc.</p>
      </footer>
    </div>
  );
}
