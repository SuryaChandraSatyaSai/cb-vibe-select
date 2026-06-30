"use client";

import { useState, useEffect } from "react";
import { Shield, ArrowRight, AlignRight, X } from "lucide-react";

interface NavbarProps {
  session: any;
}

export default function Navbar({ session }: NavbarProps) {
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-[#090d16]/60 backdrop-blur-sm z-40 md:hidden cursor-pointer"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <nav className={`fixed top-0 inset-x-0 z-50 bg-[#090d16]/90 backdrop-blur-md border-b border-slate-900/40 transition-all duration-300 ${
        isScrolled 
          ? "py-3 shadow-lg" 
          : "py-5"
      }`}>
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        {/* Left Side: Brand Logo and Title */}
        <div className="flex items-center gap-3">
          <a href="#" className="flex items-center">
            <img 
              src="https://files.codebasics.io/v3/images/logo.svg" 
              className="h-8 w-auto filter brightness-0 invert" 
              alt="Codebasics Logo" 
            />
          </a>
          <div className="h-5 w-[1px] bg-slate-800" />
          <span className="text-base font-extrabold text-white tracking-tight">
            VibeSelect
          </span>
        </div>

        {/* Right Side: Navigation Links & Auth CTA */}
        <div className="hidden md:flex items-center gap-6">
          <a 
            href="#features" 
            onClick={(e) => handleLinkClick(e, "features")}
            className="text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
          >
            Features
          </a>
          <a 
            href="#how-it-works" 
            onClick={(e) => handleLinkClick(e, "how-it-works")}
            className="text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
          >
            Workflow
          </a>
          
          <div className="h-4 w-[1px] bg-slate-800" />

          {session ? (
            <a 
              href="/dashboard"
              className="px-5 py-2.5 bg-[#d4f210] hover:bg-[#c5e30e] text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-lg transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-yellow-500/10 hover:-translate-y-0.5"
            >
              Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </a>
          ) : (
            <>
              <a 
                href="/login" 
                className="text-[11px] font-bold text-slate-400 hover:text-white uppercase tracking-widest transition-colors"
              >
                Sign In
              </a>
              <a 
                href="/login"
                className="px-5 py-2.5 bg-[#d4f210] hover:bg-[#c5e30e] text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-lg transition-all flex items-center gap-1.5 cursor-pointer hover:shadow-yellow-500/10 hover:-translate-y-0.5"
              >
                Get Started Free <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          className="md:hidden p-2 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <AlignRight className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full inset-x-0 bg-[#090d16] border-b border-slate-900/50 py-6 px-6 shadow-2xl flex flex-col gap-5 text-sm font-bold tracking-wider uppercase">
          <a 
            href="#features" 
            onClick={(e) => handleLinkClick(e, "features")}
            className="text-slate-400 hover:text-white py-2"
          >
            Features
          </a>
          <a 
            href="#how-it-works" 
            onClick={(e) => handleLinkClick(e, "how-it-works")}
            className="text-slate-400 hover:text-white py-2"
          >
            Workflow
          </a>
          <hr className="border-slate-900 my-2" />
          {session ? (
            <a 
              href="/dashboard"
              className="py-3 bg-[#d4f210] text-slate-950 text-center rounded-lg text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5"
            >
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </a>
          ) : (
            <div className="flex flex-col gap-3">
              <a 
                href="/login" 
                className="text-center text-slate-300 py-2.5 text-xs uppercase tracking-wider"
              >
                Sign In
              </a>
              <a 
                href="/login"
                className="py-3 bg-[#d4f210] text-slate-950 text-center rounded-lg text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-1.5"
              >
                Get Started Free <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      )}
    </nav>
  </>
  );
}
