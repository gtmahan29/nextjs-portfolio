import React from "react";
import ExperienceCard from "./ExperienceCard";
import { workExperience } from "@/data";

const Experiences = () => {
  return (
    <div className="pt-40" id="projects">
      <h2 className="text-[32px] font-bold text-center">
        My Work{" "}
        <span className="text-[#FFFF99]">Experiences</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 mt-20">
        {workExperience.map((item) => (
          <ExperienceCard
            title={item.title}
            id={item.id}
            key={item.id}
            img={item.thumbnail}
            description={item.desc}
          />
        ))}
      </div>
    </div>
  );
};

export default Experiences;
