import type { Project } from "@/components/ProjectRow";

/**
 * Every string and URL the site renders, in one place.
 *
 * Icons and markup stay in the components — this file is what the site says,
 * not how it looks. Anything visual (class names, JSX) does not belong here.
 */

export const site = {
  name: "Junna Park",
  title: "Junna Park",
  description: "Junna's Portfolio.",
};

/** Single source for outbound URLs — each of these is used in two places. */
export const links = {
  linkedin: "https://www.linkedin.com/in/junnapark3636",
  github: "https://github.com/jjpp43",
  calendar: "https://calendar.app.google/Se3gBtLY7xoi3AAZA",
  // Plain rather than the base64 the previous site used: that resolved here on
  // the server, so the address shipped in the rendered HTML anyway and the
  // encoding bought nothing. Forwards to the personal inbox via Cloudflare
  // Email Routing, so it can change without touching the site.
  email: "mailto:hello@junnapark.com",
};

/** `id` must match the `id` on the matching section element. */
export const sections = [
  { id: "home", label: "Intro" },
  { id: "projects", label: "Projects" },
  { id: "education", label: "Education" },
  { id: "contact", label: "Contact" },
];

/** Dropdown entries. Each lowercases to a section id above. */
export const menu = ["Projects", "Education", "Contact"];

export const hero = {
  headline: "Building solutions for real world problems",
  intro:
    "I sit between business and development, turning ideas into products that match real needs.",
  location: "Based in Columbus, Ohio",
  // Non-breaking spaces so the two halves never split across lines.
  role: "Builder / Software Engineer",
  /** Cycled through by DecodeText. */
  quote: ["Per aspera ad astra", "Through hardship to the stars"],
  socials: [
    { label: "LinkedIn", href: links.linkedin, icon: "linkedin" },
    { label: "Github", href: links.github, icon: "github" },
    { label: "Email", href: links.email, icon: "email" },
  ] as const,
};

export const projectsIntro = [
  "Client projects &",
  "award-winning hackathon builds.",
];

export const projectLinkLabel = "View project";

export const projectLightbox = {
  dialogLabel: "Project image preview",
  openLabel: "View image",
};

export const projects: Project[] = [
  {
    name: "Oval Financial Forum",
    event: "Client",
    tags: ["Newsletter", "Brevo", "Custom CMS"],
    photos: ["ovalfinancialforum1.jpeg"],
    description: "Monthly financial newsletter.",
    detail:
      "A website for an Ohio State student organization that publishes a monthly financial newsletter. Uses Brevo for subscribers and Sanity for customized CMS.",
  },
  // {
  //   name: "Datacenters.world",
  //   event: "Project",
  //   tags: ["Datacenters", "Map", "API"],
  //   photos: ["ovalfinancialforum1.jpeg"],
  //   description: "Displaying datacenters across the globe with operators and facilities classified.",
  //   detail:
  //     "A website for an Ohio State student organization that publishes a monthly financial newsletter. Uses Brevo for subscribers and Sanity for customized CMS.",
  // },
  {
    name: "Lexia",
    rank: "1st",
    event: "GiveBackHack Hackathon",
    tags: [ "Healthcare", "Next.js", "Docling"],
    photos: ["lexia1.jpeg", "lexia2.jpeg", "lexia3.jpeg"],
    description: "Online reading tool for dyslexia.",
    detail:
      "Rebuilds dense academic readings into a layout dyslexic students can hold onto, adjusting typeface, spacing, and structure.",
  },
  {
    name: "Jac in the Block",
    rank: "2nd",
    url: "https://jac-in-the-block.vercel.app/",
    event: "JacHacks Hackathon",
    tags: ["Jaseci", "Social Impact"],
    photos: [
      "jacintheblock1.jpeg",
      "jacintheblock2.jpeg",
      "jacintheblock3.jpeg",
      "jacintheblock4.jpeg",
    ],
    description: "Scratch for Jac, a new agentic programming language.",
    detail:
      "Built a Scratch for Jac, which is an AI-native full-stack language developed by Jaseci Labs at University of Michigan.",
  },
  {
    name: "MaintAIn",
    rank: "3rd",
    event: "IBM Hackathon",
    tags: ["IBM", "AI agents"],
    photos: ["maintain1.jpeg", "maintain2.jpeg", "maintain3.jpeg"],
    description: "Institution level study assistant.",
    detail:
      "An institution wide dashboard that surfaces students at academic risk, burnout and falling engagement, weeks before an advisor would catch it, fed by a Chrome extension that reads how students actually study. Built on IBM WatsonX.",
  },
  {
    name: "Full Send",
    rank: "3rd",
    event: "HackAI Hackathon",
    tags: ["Python", "ML", "Strategic Energy Investment"],
    photos: ["fullsend1.jpeg"],
    description:
      "Energy investment prioritization platform",
    detail:
      "Data-driven platform analyzing 1.3M+ smart meter readings across 270+ campus buildings. Python, Streamlit, scikit-learn used with OLS regression, KMeans, and Isolation Forest, picked so every ranking ships with a plain language reason.",
  },
  {
    name: "Equit.io",
    rank: "2nd",
    event: "Code4Cause Hackathon",
    tags: ["Next.js", "STEM Education"],
    photos: ["equitio1.jpeg", "equitio2.jpeg"],
    description: "Built a pdf-converter for people with dyslexia.",
    detail:
      "My first hackathon win, and the one that got me hooked. Used Docling to parse the PDFs and Gemini to refine the texts.",
  },
];

export const education = [
  {
    school: "The Ohio State University",
    detail: "B.S. Computer Science & Engineering",
    tags: ["Specialization in AI"],
  },
];

export const reachOut = {
  label: "Reach out to me",
  href: links.calendar,
  photo: "/profile.jpeg",
};

export const footer = {
  links: [
    { label: "LinkedIn", href: links.linkedin, icon: "linkedin" },
    { label: "GitHub", href: links.github, icon: "github" },
  ] as const,
};
