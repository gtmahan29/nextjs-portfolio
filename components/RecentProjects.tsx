'use client'
import { projects } from "@/data";
import React, { useEffect, useState } from "react";
import { PinContainer } from "./ui/3dPin";
import Image from "next/image";

const RecentProjects = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (!isMounted) {
      setIsMounted(true);
    }
  }, [isMounted]);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="pt-40" id="projects">
      <h2 className="text-[32px] font-bold text-center">
        A Small Selection of{" "}
        <span className="text-[#FFFF99]">Recent Projects</span>
      </h2>
      <div className="flex flex-wrap items-center justify-center p-4 gap-x-24 gap-y-8">
        {projects.map(({ id, title, des, img, iconLists, link }) => (
          <div
            key={id}
            className="lg:min-h-[32.5rem] flex items-center justify-center sm:w-[570px] w-[80vw] h-[32rem] sm:h-[41rem] "
          >
            <PinContainer title={link} href={link}>
              <div>
                <div className="relative flex items-center justify-center sm:w-[570px] w-[80vw] overflow-hidden sm:h-[40vh] h-[30vh mb-10">
                  <Image
                    src={img}
                    fill
                    alt=""
                    className="z-10 absolute bottom-0 object-cover object-bottom"
                  />
                </div>
                <h2 className="font-bold lg:text-2xl md:text-xl text-base line-clamp-1 max-w-[22rem]">
                  {title}
                </h2>
                <p className="lg:text-base lg:font-normal font-light text-sm line-clamp-2 text-[#aaa] mt-2">
                  {des}
                </p>
              </div>
            </PinContainer>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentProjects;
