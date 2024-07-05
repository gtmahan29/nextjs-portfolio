import Image from "next/image";
import React from "react";

const ExperienceCard = ({
  id,
  title,
  description,
  img,
}: {
  id: number;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  img: string;
}) => {
  return (
    <div
      className="bg-gradient-to-br from-gray-600/20 from-0% to-60% to-transparent border border-white/10 p-8 rounded-xl"
      key={id}
    >
      <div className="flex items-center gap-4">
        <div className="w-1/5">
          <Image src={img} width={100} height={100} alt="" />
        </div>
        <div className="flex flex-col gap-1 w-4/5">
          <h4 className="text-[16px] font-bold text-white">{title}</h4>
          <p className="text-[14px] text-white/60">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default ExperienceCard;
