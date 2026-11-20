/**
 * Documents MKB can send for an online signature besides engagement letters.
 * The records release is a starting draft for the Owner's attorney to review.
 * Format (same as letters): "## " heading, "- " bullet, blank line = new paragraph.
 * {{clientName}} and {{date}} are filled in when it's sent.
 */
export const RECORDS_RELEASE = {
  title: "Authorization to Request and Release Records",
  version: 1,
  body: `I, {{clientName}}, authorize MKB Financial Group ("MKB") to request, receive and review records about me on my behalf, for the purpose of assisting me with expungement relief.

## Records covered
- Arrest records, booking records and incident reports
- Court records, including bills of information, minute entries, docket sheets, judgments and dispositions
- Criminal history records, including from the Louisiana Bureau of Criminal Identification and Information (Louisiana State Police)
- Probation, parole and payment records related to the cases above

## Who may release them
Any law enforcement agency, sheriff's office, clerk of court, district attorney's office, court, probation or parole office, or state agency that holds these records may release them to MKB.

## How MKB uses them
MKB uses these records only to organize my information and prepare paperwork I ask for. MKB keeps them confidential and secure, and shares them only with me, with the court or agency where my paperwork is filed, or as I authorize in writing.

## Good to know
- MKB Financial Group provides administrative assistance and document preparation. MKB is not a law firm and does not give legal advice.
- Agencies may charge fees for records. MKB will tell me about any fee before paying it on my behalf.
- This authorization is valid for one year from {{date}}, unless I cancel it sooner in writing.
- A copy of this signed authorization is as valid as the original.`,
};

/** Fills {{clientName}} and {{date}}. */
export const fillDoc = (s: string, v: Record<string, string>) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => v[k] ?? m);
