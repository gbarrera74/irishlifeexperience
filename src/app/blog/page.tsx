import type { Metadata } from "next";
import BlogList from "@/components/BlogList";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Stories, photos and dispatches from Irish Life Experience students and staff in Ireland.",
  alternates: { canonical: "/blog/" },
};

export default function BlogIndex() {
  return <BlogList page={1} />;
}
