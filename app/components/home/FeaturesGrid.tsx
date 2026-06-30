"use client";

import { Scan, Palette, Copy, Layout } from "lucide-react";

export default function FeaturesGrid() {
  return (
    <section className="py-24 px-6 bg-slate-50 relative bg-grid-pattern" id="features">
      <div className="max-w-6xl mx-auto">
        
        {/* Title Block */}
        <div className="text-center mb-16 space-y-3">
          <span className="text-[10px] font-extrabold text-blue-600 tracking-widest uppercase">DIAGNOSTICS SUITE</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight uppercase">
            Aesthetic Metrics Engine
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto leading-relaxed font-semibold">
            Our ingestion pipelines run heavy structural checks on every asset to isolate top visual assets.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Card 1: Focus */}
          <div className="md:col-span-8 bg-white border border-slate-200/80 rounded-xl p-8 hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex-shrink-0 text-blue-600">
              <Scan className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider">Laplacian Focus Analysis</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Uses second-order derivatives to measure variance and identify shutter blur, camera shake, and soft textures. Soft shots are flagged immediately.
              </p>
            </div>
          </div>

          {/* Card 2: Color */}
          <div className="md:col-span-4 bg-white border border-slate-200/80 rounded-xl p-8 hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col gap-4">
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-500 w-fit">
              <Palette className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider">Dynamic Brightness</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Scans pixel values to flag overexposed keynotes, backlit subjects, and dark silhouette failures.
              </p>
            </div>
          </div>

          {/* Card 3: Duplicates */}
          <div className="md:col-span-4 bg-white border border-slate-200/80 rounded-xl p-8 hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col gap-4">
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-500 w-fit">
              <Copy className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider">Perceptual Grouping</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Client-side size and signature matching groups identical shots, labeling secondary duplicates so you download only the hero files.
              </p>
            </div>
          </div>

          {/* Card 4: Composition */}
          <div className="md:col-span-8 bg-white border border-slate-200/80 rounded-xl p-8 hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex-shrink-0 text-emerald-500">
              <Layout className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold text-slate-950 uppercase tracking-wider">Aesthetic Framing</h3>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                Verifies subject framing bounds, alignment parameters, and colorfulness metrics to score catalog visuals against real marketing specifications.
              </p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
