import React from "react";
import { Spotlight } from "./ui/Spotlight";
import HomepageHeroContent from "./home/homepage-hero-content";

const Hero = () => {
  return (
    <div className="py-10 md:py-20 h-screen relative">
      <div>
        <Spotlight
          className="-top-40 -left-10 md:-left-32 md:-top-20 h-screen"
          fill="white"
        />
        <Spotlight
          className="top-10 left-full h-[80vh] w-[50vw]"
          fill="purple"
        />
      </div>

      <div className="h-[50rem] w-full dark:bg-black-100 dark:bg-grid-white/[0.03] bg-grid-black/[0.2] flex items-center justify-center absolute top-0 left-0">
        {/* Radial gradient for the container to give a faded look */}
        <div className="absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-black-100 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      </div>

      <HomepageHeroContent />
    </div>
  );
};

export default Hero;
