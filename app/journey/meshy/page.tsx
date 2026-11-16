import MeshySurfaceStudio from "@/components/journey/meshy-surface-studio";
import { notFound } from "next/navigation";

export default function MeshyReviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MeshySurfaceStudio />;
}
