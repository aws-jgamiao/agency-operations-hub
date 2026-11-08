// Leaf-safe loading boundary (see client-portal-mini case study 2):
// pages that call notFound() must not sit under a loading boundary.
export { PageSkeleton as default } from "@/components/page-skeleton";
