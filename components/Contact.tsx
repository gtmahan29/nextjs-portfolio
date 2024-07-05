import React from "react";

const Contact = () => {
  return (
    <div className="pt-40">
      <div className="flex flex-col gap-8 items-center">
        <h2 className="text-[32px] md:text-[60px] font-bold text-center w-2/3 md:w-10/12">
          Ready to take{" "}
          <span className="text-[#FFFF99]">your digital presence</span> to the
          next level?
        </h2>
        <span className="text-[16px] font-normal text-center text-white/60">
          Reach out to me today and let's discuss how i can help you achieve
          your goals.
        </span>
      </div>
      <div className="w-full flex items-center justify-center">
        <a
          className="relative items-center mt-6 justify-center inline-block p-4 px-5 py-3 overflow-hidden font-medium text-indigo-600 transition-all duration-500 rounded-lg group hover:scale-105"
          href="/#about"
        >
          <span className="absolute top-0 left-0 w-40 h-40 -mt-10 -ml-3 transition-all duration-700 bg-[#FFFBAD] rounded-lg blur-md ease"></span>
          <span className="absolute inset-0 w-full h-full transition duration-700 ease">
            <span className="absolute bottom-0 left-0 w-24 h-24 -ml-10 bg-[#F9FFB3] rounded-lg blur-md"></span>
            <span className="absolute bottom-0 right-0 w-24 h-24 -mr-10 bg-[#FFFC84] rounded-lg blur-md"></span>
          </span>
          <span className="relative flex items-center gap-1">
            <span className="text-slate-900">Get In Touch!</span>
          </span>
        </a>
      </div>
    </div>
  );
};

export default Contact;
