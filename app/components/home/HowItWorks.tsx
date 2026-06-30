"use client";

import { UploadCloud, Cpu, Download } from "lucide-react";

export default function HowItWorks() {
  return (
    <section className="py-24 px-6 bg-white border-b border-slate-200" id="how-it-works">
      <div className="max-w-6xl mx-auto">
        
        {/* Title */}
        <div className="text-center mb-16 space-y-3">
          <span className="text-[10px] font-extrabold text-blue-600 tracking-widest uppercase">PIPELINE FLOW</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight uppercase">
            Three Steps to Curation
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed font-semibold">
            Upload messy event folders and instantly download a polished folder matching social media specs.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          
          {/* Connector Line for Desktop */}
          <div className="hidden md:block absolute top-[52px] left-[15%] right-[15%] h-[1px] border-t border-dashed border-slate-200 z-0" />

          {/* Step 1 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center relative z-10">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-[11px] text-slate-600 mb-6 shadow-sm">
              01
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-widest mb-2">Ingest Directory</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Drop directories or zip files directly in browser. Files are cataloged securely.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center relative z-10">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-[11px] text-slate-600 mb-6 shadow-sm">
              02
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#d4f210]/15 text-slate-950 flex items-center justify-center mb-4">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-widest mb-2">AI Grading Checks</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Background analysis measures image attributes, flags technical errors, and indexes content signatures.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-8 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col items-center text-center relative z-10">
            <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-[11px] text-slate-600 mb-6 shadow-sm">
              03
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-bold text-slate-950 uppercase tracking-widest mb-2">Crop &amp; Package</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-semibold">
              Filter out soft duplicates, select preset social layout crops, and export an organized bundle archive.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
