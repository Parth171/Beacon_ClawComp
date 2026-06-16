import Cta from "@/components/sections/cta";
import Difference from "@/components/sections/difference";
import Faq from "@/components/sections/faq";
import { Footer } from "@/components/sections/footer";
import Hero from "@/components/sections/hero";
import Logos from "@/components/sections/logos";
import { Navbar } from "@/components/sections/navbar";
import Pillars from "@/components/sections/pillars";
import Pipeline from "@/components/sections/pipeline";
import Statement from "@/components/sections/statement";
import Stats from "@/components/sections/stats";
import Testimonials from "@/components/sections/testimonials";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="relative">
        <Hero />
        <Logos />
        <Pillars />
        <Statement />
        <Stats />
        <Pipeline />
        <Difference />
        <Testimonials />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
