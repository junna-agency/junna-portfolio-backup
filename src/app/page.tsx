import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Projects from "@/components/Projects";
import Education from "@/components/Education";
import ReachOut from "@/components/ReachOut";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      {/* Content scrolling off the top passes under this: blur + dark fade
          ramp up toward the edge, so it dissolves instead of clipping.
          z-40 keeps it under the nav (z-50) so the nav stays sharp. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-32 bg-gradient-to-b from-black/70 via-black/30 to-transparent backdrop-blur-xs [mask-image:linear-gradient(to_bottom,black_0,rgba(0,0,0,0.85)_35%,rgba(0,0,0,0.45)_65%,transparent_100%)]"
      />
      <Hero />
      <Projects />
      <Education />
      <ReachOut />
      <div className="relative z-0">
        {/* Glass lives on its own layer so it does not fade the text with it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-[5] bg-black/60 backdrop-blur-xl"
        />
        <Footer />
      </div>
    </>
  );
}
