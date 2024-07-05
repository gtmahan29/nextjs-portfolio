"use client";
import { cn } from "@/utils/cn";
import Image from "next/image";
import { GlobeDemo } from "./GridGlobe";
import { LampContainer } from "./Lamp";
import Lottie from "lottie-react";
import { useState } from "react";
import animationData from "@/data/confetti.json";

export const BentoGrid = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-6 lg:grid-cols-5 md:grid-row-7 gap-4 lg:gap-8 mx-auto",
        className
      )}
    >
      {children}
    </div>
  );
};

export const BentoGridItem = ({
  className,
  id,
  title,
  description,
  img,
  imgClassName,
  titleClassName,
  spareImg,
}: {
  className?: string;
  id: number;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  img?: string;
  imgClassName?: string;
  titleClassName?: string;
  spareImg?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = "adeli27.ma@gmail.com";
    navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <div
      className={cn(
        "row-span-1 relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-br from-gray-700/20 from-0% to-60% to-transparent backdrop-blur-md group/bento hover:shadow-xl hover:bg-gradient-to-br hover:from-gray-500/20 cursor-pointer transition duration-200 dark:shadow-none justify-between flex flex-col space-y-4",
        className
      )}
    >
      <div className={`${id === 5} && 'flex justify-center h-full'`}>
        <div className="w-full h-full absolute">
          {img && (
            <Image
              alt=""
              src={img}
              width={100}
              height={100}
              className={cn(imgClassName, "object-cover, object-center")}
            />
          )}
        </div>
        <div
          className={`absolute right-0 -bottom-5 ${
            id === 4 && "w-full opacity-80"
          }`}
        >
          {spareImg && (
            <img
              src={spareImg}
              alt={`spare-image-${id}`}
              className={cn("w-full h-full", imgClassName)}
            />
          )}
        </div>
      </div>
      <div
        className={`${cn(
          "transition duration-200 relative md:h-full min-h-40 flex flex-col px-5 p-5",
        )} ${id === 2 ? "!p-0 items-center justify-center" : ""}`}
      >
        <div className="font-sans font-extralight text-[#c1c2d3] text-sm md:text-xs lg:text-base z-10">
          {description}
        </div>
        <div
          className={`${
            id === 2 ? "max-w-[unset]" : "max-w-96"
          } ${
            id === 3 ? "w-80" : ""
          } font-sans font-bold text-lg lg:text-3xl z-10`}
        >
          {title}
        </div>
        
        {id === 4 && <GlobeDemo />}

        {id === 5 && (
          <div className="flex gap-1 lg:gap-5 w-fit absolute -right-3 lg:-right-2">
            <div className="flex flex-col gap-3 lg:gap-8"></div>
          </div>
        )}

        {id === 3 && (
          <div className="absolute -right-12 md:right-4 -top-8 md:top-0 z-50 w-[80%] h-80 md:w-[60%] md:h-full">
            <Image src="/assets/tech.svg" alt="" fill />
          </div>
        )}

        {id === 2 && <LampContainer className="absolute" />}
        {id === 2 && (
          <div className="relative">
            <button
              onClick={handleCopy}
              className="relative items-center mt-6 justify-center inline-block p-4 px-5 py-3 overflow-hidden bg-white text-[#000] font-bold transition-all duration-500 rounded-lg group hover:scale-105"
            >
              {!copied ? (
                <span className="flex items-center gap-1">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 8V6C8 3.79086 9.79086 2 12 2L18 2C20.2091 2 22 3.79086 22 6V12C22 14.2091 20.2091 16 18 16H16M8 8H6C3.79086 8 2 9.79086 2 12V18C2 20.2091 3.79086 22 6 22H12C14.2091 22 16 20.2091 16 18V16M8 8H12C14.2091 8 16 9.79086 16 12V16"
                      stroke="#28303F"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                    />
                  </svg>
                  Copy My Email
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M8 8V6C8 3.79086 9.79086 2 12 2L18 2C20.2091 2 22 3.79086 22 6V12C22 14.2091 20.2091 16 18 16H16M8 8H6C3.79086 8 2 9.79086 2 12V18C2 20.2091 3.79086 22 6 22H12C14.2091 22 16 20.2091 16 18V16M8 8H12C14.2091 8 16 9.79086 16 12V16M6 15L7.75282 16.4023C8.1707 16.7366 8.7777 16.6826 9.13009 16.2799L12 13"
                      stroke="#28303F"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  Copied!
                </span>
              )}
            </button>
          </div>
        )}
      </div>
      {/* {img && <img src={img} alt={`image-${id}`} className={cn("w-full h-full", imgClassName)} />}
      {spareImg && <img src={spareImg} alt={`spare-image-${id}`} className={cn("w-full h-full", imgClassName)} />} */}
    </div>
  );
};
