import Clients from "@/components/Clients";
import Contact from "@/components/Contact";
import Experiences from "@/components/Experiences";
import Footer from "@/components/Footer";
import Grid from "@/components/Grid";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import RecentProjects from "@/components/RecentProjects";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex justify-center items-center flex-col overflow-hidden mx-auto relative bg-black-100 sm:px-10 px-5">
      <div className="max-w-7xl w-full relative">
        <div className="absolute top-0 left-0 w-full z-50">
          <Header />
        </div>
        <Hero />
        <Grid />
        <RecentProjects />
        <Clients />
        <Experiences />
        <div className="bg-[url('/assets/pattern2.svg')] bg-cover bg-no-repeat bg-opacity-10">
          <Contact />
          <Footer />
        </div>
      </div>
    </main>
  );
}
