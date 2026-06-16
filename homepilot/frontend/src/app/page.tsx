import AgentsShowcase from "@/components/landing/AgentsShowcase";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Navbar from "@/components/landing/Navbar";
import ProblemSection from "@/components/landing/ProblemSection";
import StatsSection from "@/components/landing/StatsSection";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <StatsSection />
      <ProblemSection />
      <HowItWorks />
      <AgentsShowcase />
      <CTASection />
      <Footer />
    </main>
  );
}
