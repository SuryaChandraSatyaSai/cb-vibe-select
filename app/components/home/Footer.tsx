"use client";

export default function Footer() {
  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-[#090d16] text-white py-16 border-t border-slate-900">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-12 gap-10 items-start">
        
        {/* Brand Column */}
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-3">
            <img 
              src="https://files.codebasics.io/v3/images/logo.svg" 
              className="h-8 w-auto filter brightness-0 invert" 
              alt="Codebasics Logo" 
            />
            <div className="h-5 w-[1px] bg-slate-800" />
            <span className="text-base font-extrabold tracking-tight">VibeSelect</span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed font-semibold">
            High-performance visual asset curation, technical metrics assessment, and metadata cataloging platform.
          </p>
        </div>

        {/* Links Column 1 */}
        <div className="md:col-span-3 space-y-3 text-left">
          <h4 className="text-[10px] font-extrabold text-[#d4f210] uppercase tracking-widest">Platform</h4>
          <ul className="space-y-2 text-xs text-slate-400">
            <li>
              <a href="#features" onClick={(e) => handleLinkClick(e, "features")} className="hover:text-white transition-colors">Key Features</a>
            </li>
            <li>
              <a href="#how-it-works" onClick={(e) => handleLinkClick(e, "how-it-works")} className="hover:text-white transition-colors">Ingestion Pipeline</a>
            </li>
            <li>
              <a href="/login" className="hover:text-white transition-colors">Secure Console</a>
            </li>
          </ul>
        </div>

        {/* Links Column 2 */}
        <div className="md:col-span-4 space-y-3 text-left">
          <h4 className="text-[10px] font-extrabold text-[#d4f210] uppercase tracking-widest">Security Specifications</h4>
          <p className="text-[11px] text-slate-400 leading-relaxed font-semibold">
            Secured via Microsoft Entra ID (Azure AD) OAuth 2.0 corporate access limits. Integrates Cloudinary storage quotas and MongoDB metadata tables.
          </p>
        </div>

      </div>

      <div className="max-w-6xl mx-auto px-6 mt-12 pt-8 border-t border-slate-900 text-center md:flex md:justify-between md:items-center text-[10px] text-slate-500 font-semibold">
        <p>© 2026 Codebasics Inc. All rights reserved.</p>
        <p className="mt-2 md:mt-0">VibeSelect Enterprise Portal • Secured Corporate Connection Only</p>
      </div>
    </footer>
  );
}
