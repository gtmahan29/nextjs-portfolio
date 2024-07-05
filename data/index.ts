import { link } from "fs";

export const navItems = [
  { name: "About", link: "#about" },
  { name: "Projects", link: "#projects" },
  { name: "Testimonials", link: "#testimonials" },
  { name: "Contact", link: "#contact" },
];

export const gridItems = [
  {
    id: 1,
    title: "Where tech meets creativity, that's where I thrive",
    description: "",
    className: "lg:col-span-2 md:col-span-2 md:row-span-4",
    imgClassName: "",
    titleClassName: "justify-start",
    img: "/grid.svg",
    spareImg: "/b4.svg",
  },
  {
    id: 2,
    title: "Let's work together",
    description: "",
    className: "lg:col-span-3 md:col-span-4 md:row-span-4 lg:min-h-[30vh]",
    imgClassName: "",
    titleClassName: "justify-center md:max-w-full max-w-60 text-center",
    img: "",
    spareImg: "",
  },
  {
    id: 3,
    title: "Debugging life, one skill at a time: My ever-growing tech repertoire",
    description: "I constantly try to improve",
    className: "lg:col-span-3 md:col-span-6 md:row-span-3 lg:min-h-[60vh]",
    imgClassName: "",
    titleClassName: "justify-center",
    img: "",
    spareImg: "",
  },
  {
    id: 4,
    title: "Syncing schedules across the globe - it's my superpower",
    description: "",
    className: "lg:col-span-2 md:col-span-3 md:row-span-2",
    imgClassName: "",
    titleClassName: "justify-start",
    img: "",
    spareImg: "",
  },
  {
    id: 5,
    title: "Turning ideas into reality through collaborative synergy",
    description: "",
    className: "lg:col-span-2 md:col-span-3 md:row-span-1",
    imgClassName: "w-full h-full",
    titleClassName: "justify-start",
    img: "",
    spareImg: "",
  },
];

export const projects = [
  {
    id: 1,
    title: "3D Solar System Planets to Explore",
    des: "Explore the wonders of our solar system with this captivating 3D simulation of the planets using Three.js.",
    img: "/assets/project1.png",
    iconLists: ["/re.svg", "/tail.svg", "/ts.svg", "/three.svg", "/fm.svg"],
    link: "https://github.com/adrianhajdin?tab=repositories",
  },
  {
    id: 2,
    title: "Yoom - Video Conferencing App",
    des: "Simplify your video conferencing experience with Yoom. Seamlessly connect with colleagues and friends.",
    img: "/assets/project2.png",
    iconLists: ["/next.svg", "/tail.svg", "/ts.svg", "/stream.svg", "/c.svg"],
    link: "https://github.com/adrianhajdin/zoom-clone",
  },
  {
    id: 3,
    title: "AI Image SaaS - Canva Application",
    des: "A REAL Software-as-a-Service app with AI features and a payments and credits system using the latest tech stack.",
    img: "/assets/project3.png",
    iconLists: ["/re.svg", "/tail.svg", "/ts.svg", "/three.svg", "/c.svg"],
    link: "https://github.com/adrianhajdin/ai_saas_app",
  },
  {
    id: 4,
    title: "Animated Apple Iphone 3D Website",
    des: "Recreated the Apple iPhone 15 Pro website, combining GSAP animations and Three.js 3D effects..",
    img: "/assets/project2.png",
    iconLists: ["/next.svg", "/tail.svg", "/ts.svg", "/three.svg", "/gsap.svg"],
    link: "https://github.com/adrianhajdin/iphone",
  },
];

export const testimonials = [
  {
    quote:
      "Collaborating with Adrian was an absolute pleasure. His professionalism, promptness, and dedication to delivering exceptional results were evident throughout our project. Adrian's enthusiasm for every facet of development truly stands out. If you're seeking to elevate your website and elevate your brand, Adrian is the ideal partner.",
    name: "Michael Johnson",
    title: "Director of AlphaStream Technologies",
    image: "/profile.svg",
  },
  {
    quote:
      "Collaborating with Adrian was an absolute pleasure. His professionalism, promptness, and dedication to delivering exceptional results were evident throughout our project. Adrian's enthusiasm for every facet of development truly stands out. If you're seeking to elevate your website and elevate your brand, Adrian is the ideal partner.",
    name: "Michael Johnson",
    title: "Director of AlphaStream Technologies",
    image: "/profile.svg",
  },
  {
    quote:
      "Collaborating with Adrian was an absolute pleasure. His professionalism, promptness, and dedication to delivering exceptional results were evident throughout our project. Adrian's enthusiasm for every facet of development truly stands out. If you're seeking to elevate your website and elevate your brand, Adrian is the ideal partner.",
    name: "Michael Johnson",
    title: "Director of AlphaStream Technologies",
    image: "/profile.svg",
  },
  {
    quote:
      "Collaborating with Adrian was an absolute pleasure. His professionalism, promptness, and dedication to delivering exceptional results were evident throughout our project. Adrian's enthusiasm for every facet of development truly stands out. If you're seeking to elevate your website and elevate your brand, Adrian is the ideal partner.",
    name: "Michael Johnson",
    title: "Director of AlphaStream Technologies",
    image: "/profile.svg",
  },
  {
    quote:
      "Collaborating with Adrian was an absolute pleasure. His professionalism, promptness, and dedication to delivering exceptional results were evident throughout our project. Adrian's enthusiasm for every facet of development truly stands out. If you're seeking to elevate your website and elevate your brand, Adrian is the ideal partner.",
    name: "Michael Johnson",
    title: "Director of AlphaStream Technologies",
    image: "/profile.svg",
  },
];

export const companies = [
  {
    id: 1,
    name: "cloudinary",
    img: "/cloud.svg",
    nameImg: "/cloudName.svg",
  },
  {
    id: 2,
    name: "appwrite",
    img: "/app.svg",
    nameImg: "/appName.svg",
  },
  {
    id: 3,
    name: "HOSTINGER",
    img: "/host.svg",
    nameImg: "/hostName.svg",
  },
  {
    id: 4,
    name: "stream",
    img: "/s.svg",
    nameImg: "/streamName.svg",
  },
  {
    id: 5,
    name: "docker.",
    img: "/dock.svg",
    nameImg: "/dockerName.svg",
  },
];

export const workExperience = [
  {
    id: 1,
    title: "Frontend Engineer Intern At Vandaw",
    desc: "Crafting user-friendly interfaces, learning modern web technologies, and contributing to innovative digital solutions.",
    className: "md:col-span-2",
    thumbnail: "./exp1.svg",
  },
  {
    id: 2,
    title: "Frontend Developer At Vandaw",
    desc: "Frontend Developer at Vandaw. Working on one of the country's biggest digital projects. Creating responsive, user-friendly web interfaces.",
    className: "md:col-span-2",
    thumbnail: "./exp2.svg",
  },
  {
    id: 3,
    title: "Freelance UI/UX Designer",
    desc: "Freelance UI/UX Designer: Crafting intuitive, visually appealing digital experiences. Specializing in user-centered design for web and mobile apps.",
    className: "md:col-span-2",
    thumbnail: "./exp3.svg",
  },
  {
    id: 4,
    title: "Freelance Frontend Developer",
    desc: "Freelance Frontend Developer: Building responsive, user-friendly web interfaces with modern JavaScript frameworks.",
    className: "md:col-span-2", // change to md:col-span-2
    thumbnail: "./exp4.svg",
  },
];

export const socialMedia = [
  {
    id: 1,
    img: "/assets/instagram.svg",
    link: "#instagram"
  },
  {
    id: 2,
    img: "/assets/twitter.svg",
    link: "#twitter"
  },
  {
    id: 3,
    img: "/assets/github.svg",
    link: "#github"
  },
  {
    id: 4,
    img: "/assets/telegram.svg",
    link: "#telegram"
  },
  {
    id: 5,
    img: "/assets/whatsapp.svg",
    link: "#whatsapp"
  },
];
