import { TextGenerateEffect } from "../ui/TextGenerateEffect";
import styles from "./homepage-hero-content.module.css";

export const HOME_HERO={
 eyebrow:"Welcome to Codaine",
 headline:"A Journey Where Design Meets Functionality And Every Pixel Tells A Story.",
 description:"I'm Mahan. A Professional Web Developer",
 cta:"Read More",
};

/** Shared homepage hero content. Construction mode has no autonomous animation clock. */
export default function HomepageHeroContent({construction=false}:{construction?:boolean}){
 if(construction)return <article className={styles.preview} aria-label="Codaine homepage hero, light mode">
  <div className={styles.grid} aria-hidden="true"/>
  <div className={styles.glow} aria-hidden="true"/>
  <div className={styles.content}>
   <p data-build-part="0" className={styles.eyebrow}>{HOME_HERO.eyebrow}</p>
   <h3 className={styles.headline}>
    <span data-build-part="1">A <em>Journey</em> Where Design</span>
    <span data-build-part="2">Meets Functionality And</span>
    <span data-build-part="3">Every Pixel Tells A Story.</span>
   </h3>
   <p data-build-part="4" className={styles.description}>{HOME_HERO.description}</p>
   <span data-build-part="5" className={styles.cta}>{HOME_HERO.cta}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z"/></svg></span>
  </div>
 </article>;
 return (
      <div className="h-screen flex flex-col items-center justify-center relative z-10">
        <div className="max-w-[89vw] md:max-w-2xl lg:max-w-[60vw] flex flex-col justify-center items-center">
          <h2 className="uppercase tracking-widest text-md text-center text-blue-100 max-w-80">
            {HOME_HERO.eyebrow}
          </h2>
          <TextGenerateEffect
            words={HOME_HERO.headline}
            className="text-[32px] md:text-[60px] text-center"
          />

          <p className="text-center md:tracking-wider mt-12 text-sm md:text-lg lg:text-2xl">
            {HOME_HERO.description}
          </p>
        </div>
        <a
          className="relative items-center mt-6 justify-center inline-block p-4 px-5 py-3 overflow-hidden font-medium text-indigo-600 transition-all duration-500 rounded-lg group hover:scale-105"
          href="#about"
        >
          <span className="absolute top-0 left-0 w-40 h-40 -mt-10 -ml-3 transition-all duration-700 bg-[#FFFBAD] rounded-lg blur-md ease"></span>
          <span className="absolute inset-0 w-full h-full transition duration-700 ease">
            <span className="absolute bottom-0 left-0 w-24 h-24 -ml-10 bg-[#F9FFB3] rounded-lg blur-md"></span>
            <span className="absolute bottom-0 right-0 w-24 h-24 -mr-10 bg-[#FFFC84] rounded-lg blur-md"></span>
          </span>
          <span className="relative flex items-center gap-1">
            <span className="text-slate-900">{HOME_HERO.cta}</span>
            <div className="">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M7 15.5179V8.48207C7 6.93849 8.67443 5.97675 10.0077 6.75451L16.0385 10.2724C17.3615 11.0442 17.3615 12.9558 16.0385 13.7276L10.0077 17.2455C8.67443 18.0232 7 17.0615 7 15.5179Z"
                  stroke="#28303F"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </span>
        </a>
      </div>
 );
}
