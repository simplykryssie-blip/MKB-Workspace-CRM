import type { Metadata } from "next";
import { FormBuilder } from "@/components/forms/FormBuilder";
import { SAMPLE_FORMS } from "@/lib/sample/forms-seed";

// Sample forms are pre-rendered; forms created during a preview session render on demand.
export function generateStaticParams() {
  return SAMPLE_FORMS.map((f) => ({ id: f.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: SAMPLE_FORMS.find((f) => f.id === id)?.name ?? "Form" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FormBuilder key={id} id={id} />;
}
