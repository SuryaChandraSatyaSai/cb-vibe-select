"use client";

import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import FeaturesGrid from "./FeaturesGrid";
import HowItWorks from "./HowItWorks";
import Footer from "./Footer";

interface HomePageProps {
  session: any;
}

export default function HomePage({ session }: HomePageProps) {
  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col font-sans selection:bg-[#2563EB] selection:text-white">
      {/* Sticky Navbar */}
      <Navbar session={session} />

      {/* Hero Block */}
      <HeroSection session={session} />

      {/* Features Grid */}
      <FeaturesGrid />

      {/* How it Works timeline */}
      <HowItWorks />

      {/* Portal Footer */}
      <Footer />
    </div>
  );
}
