// Environment-specific configuration for metadata
export const siteConfig = {
  name: "BuildPCB.ai",
  description: "AI-powered IDE for designing electronic circuits and PCBs",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ogImage: "/og-image.png",
  twitterImage: "/twitter-image.png",
  twitterCreator: "@buildpcb",
  keywords: [
    "PCB design",
    "circuit design",
    "electronics",
    "AI",
    "CAD",
    "circuit board",
    "electronic design automation",
    "schematic design",
    "PCB layout",
    "circuit simulation",
  ],
};

export const pages = {
  home: {
    title: "IDE - Circuit Design Studio",
    description:
      "Professional PCB design environment with AI-powered tools. Design, simulate, and validate electronic circuits with our advanced IDE featuring real-time collaboration and intelligent design assistance.",
    path: "/",
  },
  dashboard: {
    title: "Dashboard",
    description:
      "Manage your PCB projects, view recent designs, and collaborate with your team. Access all your electronic circuit designs in one place.",
    path: "/dashboard",
  },
};
