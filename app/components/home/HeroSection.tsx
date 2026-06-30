"use client";

import { Sparkles, ArrowRight, ShieldCheck, Zap, Scan } from "lucide-react";

interface HeroSectionProps {
  session: any;
}

export default function HeroSection({ session }: HeroSectionProps) {
  const handleScrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative bg-[#090d16] text-white pt-32 pb-24 px-6 overflow-hidden bg-grid-pattern-dark">
      {/* Background Gradient Mesh Orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-blue-600/10 rounded-full filter blur-[100px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[450px] h-[450px] bg-[#d4f210]/5 rounded-full filter blur-[100px] animate-pulse-slow-delayed pointer-events-none" />
      
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Side Content */}
        <div className="lg:col-span-7 text-left space-y-6">
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
            Curate Your <span className="text-[#5ebbff] bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300">Best Event Shots</span> in Seconds
          </h1>
          
          <p className="text-slate-400 text-sm sm:text-base md:text-lg max-w-xl font-medium leading-relaxed">
            Upload large event photos and let our aesthetic engines detect blurry, low-contrast, overexposed, and duplicate files. Stop manual grading today.
          </p>

          <div className="flex gap-4 flex-wrap pt-2">
            {session ? (
              <a
                href="/dashboard"
                className="px-8 py-3.5 bg-[#d4f210] hover:bg-[#c5e30e] text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-lg hover:shadow-yellow-500/20 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                Launch Workspace <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  className="px-8 py-3.5 bg-[#d4f210] hover:bg-[#c5e30e] text-slate-950 text-xs font-black uppercase tracking-wider rounded-lg shadow-lg hover:shadow-yellow-500/20 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  Start Analyzing Free <ArrowRight className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleScrollToSection("how-it-works")}
                  className="px-8 py-3.5 border border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center cursor-pointer"
                >
                  View Workflow
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Side Visual: Floating Product Preview Mockup */}
        <div className="lg:col-span-5 flex justify-center relative">
          <div className="relative w-[340px] h-[340px] sm:w-[400px] sm:h-[400px] flex items-center justify-center">
            
            {/* Background glowing rings */}
            <div className="absolute inset-0 rounded-full border border-blue-500/10 scale-90 animate-pulse" />
            <div className="absolute inset-0 rounded-full border border-blue-500/5 scale-110" />

            {/* Float Card 1: Technical Score Profile */}
            <div className="absolute top-4 left-0 glass-card-dark rounded-2xl p-4 shadow-2xl border border-white/10 w-48 text-left z-20 animate-float-1">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] font-black text-[#5ebbff] uppercase tracking-widest">METRICS ENGINE</span>
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[8px] rounded font-bold uppercase">Pass</span>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[8px] font-bold text-slate-400 mb-1">
                    <span>Sharpness</span>
                    <span>89%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: "89%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[8px] font-bold text-slate-400 mb-1">
                    <span>Color Contrast</span>
                    <span>74%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: "74%" }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Float Card 2: Interactive Photo Preview */}
            <div className="glass-card-dark rounded-xl p-3 shadow-2xl border border-white/10 w-64 text-left z-10 relative overflow-hidden animate-float-2 bg-gradient-to-b from-[#111827] to-[#0f172a]">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-800 border border-white/5 mb-3 group">
                <img 
                  src="https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=600&auto=format&fit=crop" 
                  alt="Mock Asset Analysis" 
                  className="w-full h-full object-cover opacity-80"
                />
                
                {/* Floating Face Detection Box */}
                <div className="absolute top-[25%] left-[30%] w-[35%] h-[35%] border-2 border-[#d4f210] rounded-xl animate-pulse">
                  <span className="absolute -top-5 left-0 px-1 bg-[#d4f210] text-[#111827] text-[7px] font-bold rounded uppercase">
                    Speaker A
                  </span>
                </div>

                <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded text-[8px] font-black text-emerald-400 border border-emerald-500/20">
                  92 / 100
                </div>
              </div>
              <div className="px-1.5 pb-1">
                <h4 className="text-[10px] font-extrabold text-white uppercase tracking-wider truncate">conference_keynote.jpg</h4>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="px-1.5 py-0.5 bg-slate-800/80 border border-slate-700/50 rounded text-[7px] text-slate-400 font-bold uppercase">KEYNOTE</span>
                  <span className="px-1.5 py-0.5 bg-slate-800/80 border border-slate-700/50 rounded text-[7px] text-slate-400 font-bold uppercase">FACE</span>
                </div>
              </div>
            </div>

            {/* Float Card 3: Ingest Complete indicator */}
            <div className="absolute bottom-4 right-0 glass-card-dark rounded-2xl p-4 shadow-2xl border border-white/10 w-44 text-left z-20 animate-float-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
              </div>
              <div>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block">Status</span>
                <span className="text-xs font-black text-white">Ingest Completed</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
