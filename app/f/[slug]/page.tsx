import type { Metadata } from "next";
import { PublicFormPage } from "@/components/forms/PublicFormPage";
import { SAMPLE_FORMS } from "@/lib/sample/forms-seed";

export function generateStaticParams() {
  return SAMPLE_FORMS.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: SAMPLE_FORMS.find((f) => f.slug === slug)?.title ?? "Form" };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicFormPage slug={slug} />;
}
