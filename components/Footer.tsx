import { socialMedia } from "@/data";
import Image from "next/image";
import React from "react";

const Footer = () => {
  return (
    <div className="flex flex-col gap-8 md:gap-0 md:flex-row items-center justify-between pt-28 pb-14">
      <div>
        <Image src="/assets/logo.svg" alt="" width={200} height={200} />
      </div>
      <span className="hidden lg:block text-[14px] text-white/60">Copyright © 2023 Codaine. All Rights Reserved</span>
      <div>
        <ul className="flex items-center gap-2">
          {socialMedia.map((item) => (
            <li key={item.id}>
              <a href={item.link}>
                <Image src={item.img} alt="" width={50} height={50} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Footer;
