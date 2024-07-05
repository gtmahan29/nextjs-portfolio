"use client";
import { navItems } from "@/data";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";

const Header = () => {
  const [open, setOpen] = useState(false);
  const handleClose = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.id === "screen") {
      setOpen(!open);
    }
  };

  return (
    <div>
      <div className="hidden md:flex items-center justify-between h-[10rem]">
        <div>
          <Image src="/assets/logo.svg" width={250} height={250} alt="" />
        </div>
        <div>
          <ul className="flex items-center gap-8">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link href={item.link}>{item.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <a
            className="relative items-center justify-center inline-block p-4 px-5 py-3 overflow-hidden font-medium text-indigo-600 transition-all duration-500 rounded-lg group hover:scale-105"
            href="/#about"
          >
            <span className="absolute top-0 left-0 w-40 h-40 -mt-10 -ml-3 transition-all duration-700 bg-[#FFFBAD] rounded-lg blur-md ease"></span>
            <span className="absolute inset-0 w-full h-full transition duration-700 ease">
              <span className="absolute bottom-0 left-0 w-24 h-24 -ml-10 bg-[#F9FFB3] rounded-lg blur-md"></span>
              <span className="absolute bottom-0 right-0 w-24 h-24 -mr-10 bg-[#FFFC84] rounded-lg blur-md"></span>
            </span>
            <span className="relative flex items-center gap-1">
              <span className="text-slate-900">Contact Me</span>
            </span>
          </a>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className="w-full md:hidden flex items-center justify-between py-4 relative">
        <div>
          <Link href="/">
            <div className="font-Inter text-3xl cursor-pointer">
              <Image src="/assets/logo.svg" width={200} height={200} alt="" />
            </div>
          </Link>
        </div>
        <div>
          <button
            className="text-2xl cursor-pointer relative"
            onClick={() => setOpen(!open)}
          >
            <Image src="/assets/menu.svg" alt="" width={50} height={50} />
            {open && (
              <div
                className="absolute md:hidden top-12 right-0 z-[9999] bg-[00000070] backdrop-blur-lg border border-white/20 rounded-xl w-60"
                onClick={handleClose}
                id="screen"
              >
                <ul className="flex flex-col items-center gap-2 w-full">
                  {navItems.map((item, i) => (
                    <li key={item.name} className="w-full">
                      <Link href={item.link} className="text-[16px] w-full p-4">{item.name}</Link>
                      {i < navItems.length ? (
                        <div className="h-[1px] w-full bg-[#ffffff20] mt-3"></div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header;
