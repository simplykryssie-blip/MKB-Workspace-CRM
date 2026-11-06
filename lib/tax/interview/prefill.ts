import type { Client } from "@/lib/types";
import type { Answers, Prefill, Section } from "./engine";

/** What the client's MKB profile already knows — asked once, never again. */
export function prefillFrom(c: Client): Prefill {
  const [first, ...rest] = (c.type === "individual" ? c.name : c.contactName ?? "").split(" ");
  return {
    firstName: c.type === "individual" ? first : undefined,
    lastName: c.type === "individual" ? rest.join(" ") : undefined,
    taxId: c.taxIdLast4 ? `•••-••-${c.taxIdLast4}` : undefined,
    dob: c.dob,
    phone: c.phone,
    email: c.email,
    street: [c.address.line1, c.address.line2].filter(Boolean).join(", "),
    city: c.address.city,
    state: c.address.state,
    zip: c.address.zip,
    bizName: c.business?.legalName,
    ein: c.business?.einLast4 ? `••-•••${c.business.einLast4}` : undefined,
    formed: c.business?.formedAt,
    bizState: c.business?.state ?? c.address.state,
    activity: c.business?.industry,
  };
}

/** Fill unanswered questions from the profile. Returns the answers and which ids were pre-filled. */
export function applyPrefill(sections: Section[], a: Answers, p: Prefill): { answers: Answers; ids: Set<string> } {
  const out: Answers = { ...a };
  const ids = new Set<string>();
  sections.forEach((s) => {
    if (s.repeat) return;
    s.questions.forEach((q) => {
      const v = q.prefill && p[q.prefill];
      if (!v) return;
      if (out[q.id] === undefined || out[q.id] === "") { out[q.id] = v; ids.add(q.id); }
      else if (out[q.id] === v) ids.add(q.id);
    });
  });
  return { answers: out, ids };
}
