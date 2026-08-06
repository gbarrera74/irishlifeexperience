/**
 * Site-wide navigation and contact details, transcribed from the WordPress
 * "Home" nav menu (export/menus.json) and verified against the links the live
 * Elementor header template (45) emits.
 */

export type NavItem = {
  label: string;
  href: string;
  children?: NavItem[];
};

export const nav: NavItem[] = [
  { label: "Programs", href: "/programs/" },
  {
    label: "Students",
    href: "/students/",
    children: [
      { label: "Classes", href: "/students/classes/" },
      { label: "Workshops", href: "/students/workshops/" },
      { label: "Tours", href: "/students/tours/" },
      { label: "Apply", href: "/apply/" },
    ],
  },
  {
    label: "Parents",
    href: "/parents/",
    children: [
      { label: "Accommodations", href: "/parents/accommodations/" },
      { label: "FAQ", href: "/parents/faq/" },
      { label: "Travel", href: "/parents/travel/" },
    ],
  },
  {
    label: "Alumni",
    href: "/alumni/",
    children: [
      { label: "In Memoriam", href: "/in-memoriam/" },
      { label: "Gallery", href: "/gallery/" },
    ],
  },
  { label: "Blog", href: "/blog/" },
  {
    label: "About",
    href: "/about-us/",
    children: [
      { label: "Meet the Team", href: "/meet-the-team/" },
      { label: "Contact", href: "/contact/" },
      { label: "Testimonials", href: "/testimonials/" },
    ],
  },
];

// The footer itself is rendered from src/content/footer.html, captured verbatim
// from the live template. This list mirrors it for the mobile menu only.
// The live footer menu misspells "Testimonials"; corrected in both places.
export const footerLinks: NavItem[] = [
  { label: "About Us", href: "/about-us/" },
  { label: "FAQ", href: "/parents/faq/" },
  { label: "Testimonials", href: "/testimonials/" },
  { label: "Blog", href: "/blog/" },
  { label: "Contact Us", href: "/contact/" },
  { label: "Privacy Policy", href: "/privacy-policy/" },
];

export const site = {
  name: "Irish Life Experience",
  description:
    "A four-week Irish summer program for high school students — classes, " +
    "workshops and tours across Ireland.",
  url: "https://irishlifeexperience.com",
  // The application portal stays on the existing external system.
  loginUrl: "https://portal.irishlifeexperience.com",
  address: ["1 Central Street", "Suite 205", "Middleton, MA 01949"],
  phone: "855-IRISH-LIFE",
  phoneHref: "tel:+18554747454",
  tripDates: "June 28-July 23, 2026",
  email: "Info@IrishLifeExperience.com",
  social: {
    facebook: "https://www.facebook.com/ILEFans",
    instagram: "https://www.instagram.com/irish_life_experience/",
  },
} as const;
