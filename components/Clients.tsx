import React from "react";
import { InfiniteMovingCards } from "./ui/InfiniteMovingCards";
import { companies, testimonials } from "@/data";

const Clients = () => {
  return (
    <div className="pt-20 bg-[url('/assets/pattern.svg')] bg-cover bg-no-repeat bg-opacity-10" id="testimonials">
      <h2 className="text-[32px] font-bold text-center">
        Kind Words From{" "}
        <span className="text-[#FFFF99]">Satisfied Clients</span>
      </h2>
      <div className="flex flex-col items-center mt-20">
        <div className="h-[50vh] md:h-[30rem] rounded-md flex flex-col antialiased items-center relative overflow-hidden">
          <InfiniteMovingCards
            items={testimonials}
            direction="right"
            speed="slow"
          />
          {/* Companies will go here in case the exist */}
        </div>
      </div>
    </div>
  );
};

export default Clients;
