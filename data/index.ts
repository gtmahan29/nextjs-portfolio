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
    title:
      "Debugging life, one skill at a time: My ever-growing tech repertoire",
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
    title: "Web Developer Portfolio",
    des: "lorem ipsum dolor sit amet. lorem ipsum dolor sit ametlorem ipsum dolor sit ametlorem ipsum dolor sit ametlorem ipsum dolor sit amet.",
    img: "/assets/project1.png",
    iconLists: ["/re.svg", "/tail.svg", "/ts.svg", "/three.svg", "/fm.svg"],
    link: "https://github.com/adrianhajdin?tab=repositories",
  },
  {
    id: 2,
    title: "AI Prompt Marketplace",
    des: "lorem ipsum dolor sit amet. lorem ipsum dolor sit ametlorem ipsum dolor sit ametlorem ipsum dolor sit ametlorem ipsum dolor sit amet.",
    img: "/assets/project2.png",
    iconLists: ["/next.svg", "/tail.svg", "/ts.svg", "/stream.svg", "/c.svg"],
    link: "https://github.com/adrianhajdin/zoom-clone",
  },
  {
    id: 3,
    title: "Admin Dashboard",
    des: "lorem ipsum dolor sit amet. lorem ipsum dolor sit ametlorem ipsum dolor sit ametlorem ipsum dolor sit ametlorem ipsum dolor sit amet.",
    img: "/assets/project3.png",
    iconLists: ["/re.svg", "/tail.svg", "/ts.svg", "/three.svg", "/c.svg"],
    link: "https://github.com/adrianhajdin/ai_saas_app",
  },
  {
    id: 4,
    title: "AI Prompt Marketplace",
    des: "lorem ipsum dolor sit amet. lorem ipsum dolor sit ametlorem ipsum dolor sit ametlorem ipsum dolor sit ametlorem ipsum dolor sit amet.",
    img: "/assets/project2.png",
    iconLists: ["/next.svg", "/tail.svg", "/ts.svg", "/three.svg", "/gsap.svg"],
    link: "https://github.com/adrianhajdin/iphone",
  },
];

export const testimonials = [
  {
    quote:
      "Mahan is a true web design wizard! They took my vision and turned it into an absolutely stunning website that has helped take my small business to the next level. I can't recommend them highly enough.",
    name: "Samantha Rodriguez",
    title: "Small Business Owner",
    image: ""
  },
  {
    quote:
      "Working with Mahan was a game-changer for my business. They designed a website that is not only beautiful, but also highly optimized for lead generation. The boost in traffic and conversions has been incredible. Hire them if you want real results!",
    name: "Liam Nguyen",
    title: "Marketing Consultant",
    image: ""
  },
  {
    quote:
      "Mahan is a web design superhero! They created an engaging and user-friendly website that has helped us reach so many more people in our community. The entire process was smooth and stress-free. I'm thrilled with the end product.",
    name: "Olivia Hernandez",
    title: "Non-Profit Coordinator",
    image: ""
  },
  {
    quote:
      "As an ecommerce business owner, I needed a website that could showcase my products in the best light. Mahan delivered just that and more. Their design skills are unparalleled, and they were able to optimize the site for maximum conversions. I've seen a huge boost in sales since launching the new website.",
    name: "Noah Gonzalez",
    title: "Ecommerce Entrepreneur",
    image: ""
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
    link: "#instagram",
  },
  {
    id: 2,
    img: "/assets/twitter.svg",
    link: "#twitter",
  },
  {
    id: 3,
    img: "/assets/github.svg",
    link: "#github",
  },
  {
    id: 4,
    img: "/assets/telegram.svg",
    link: "#telegram",
  },
  {
    id: 5,
    img: "/assets/whatsapp.svg",
    link: "#whatsapp",
  },
];
