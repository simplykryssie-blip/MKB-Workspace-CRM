/**
 * WISP Generator (Monarch Tax Suite funnel): the questions a tax practice
 * answers and the plan text built from them. Organized around the elements the
 * FTC Safeguards Rule asks for and IRS Publication 5708 walks through. The
 * result is a starting template the practice reviews and adapts — not legal
 * advice and not a certification of compliance. Shared by the page and server.
 */

export type Answer = "yes" | "no" | "unsure";

export type Safeguard = {
  key: string;
  area: string;
  question: string;
  /** Policy sentence when in place. */
  inPlace: string;
  /** Action item when missing or unsure. */
  action: string;
};

export const SAFEGUARDS: Safeguard[] = [
  { key: "mfa_software", area: "Access controls", question: "Is multi-factor authentication (MFA) turned on for your tax software?", inPlace: "Multi-factor authentication is required for the tax software.", action: "Turn on multi-factor authentication for the tax software for every user." },
  { key: "mfa_email", area: "Access controls", question: "Is MFA turned on for business email and cloud storage accounts?", inPlace: "Multi-factor authentication is required for business email and cloud storage.", action: "Turn on multi-factor authentication for business email and every cloud storage account." },
  { key: "unique_logins", area: "Access controls", question: "Does every person have their own login (no shared usernames or passwords)?", inPlace: "Each person uses their own login; logins are not shared.", action: "Give every person their own login and stop sharing usernames and passwords." },
  { key: "least_access", area: "Access controls", question: "Do staff only have access to the client information they need for their job?", inPlace: "Access to client information is limited to what each person needs for their role.", action: "Review user access and limit each person to the client information their role requires." },
  { key: "offboarding", area: "Access controls", question: "When someone leaves, are their accounts and access removed the same day?", inPlace: "Accounts and access are removed on a person's last day.", action: "Create a checklist to remove accounts and access on a person's last day." },
  { key: "passwords", area: "Access controls", question: "Do you require strong, unique passwords (or use a password manager)?", inPlace: "Strong, unique passwords are required; a password manager is used where practical.", action: "Require strong, unique passwords and adopt a password manager." },
  { key: "encryption", area: "Devices & data", question: "Are computers and laptops encrypted (e.g., BitLocker or FileVault)?", inPlace: "Computers and laptops that store client information are encrypted.", action: "Turn on full-disk encryption (BitLocker or FileVault) on every computer and laptop." },
  { key: "antivirus", area: "Devices & data", question: "Do all computers have up-to-date security software (antivirus / anti-malware)?", inPlace: "All computers run current security software.", action: "Install and keep current security software on every computer." },
  { key: "updates", area: "Devices & data", question: "Are operating systems and software updated promptly?", inPlace: "Operating systems and software are kept up to date.", action: "Turn on automatic updates and check monthly that devices are current." },
  { key: "firewall", area: "Devices & data", question: "Is a firewall turned on for your network and computers?", inPlace: "Firewalls are enabled on the office network and computers.", action: "Turn on the firewall on the office router and every computer." },
  { key: "wifi", area: "Devices & data", question: "Is office Wi-Fi password-protected and separate from guest Wi-Fi?", inPlace: "Office Wi-Fi is secured and separated from any guest network.", action: "Secure office Wi-Fi with a strong password and set up a separate guest network." },
  { key: "remote", area: "Devices & data", question: "Is remote access (working from home) secured (e.g., VPN or secure remote tools with MFA)?", inPlace: "Remote access uses secure, multi-factor protected tools.", action: "Use a VPN or secure remote-access tool with MFA for any work outside the office." },
  { key: "backups", area: "Devices & data", question: "Is client data backed up regularly, with a copy kept off-site or in secure cloud storage?", inPlace: "Client data is backed up regularly with a secure off-site or cloud copy.", action: "Set up regular backups with a secure off-site or cloud copy, and test a restore." },
  { key: "secure_sharing", area: "Devices & data", question: "Do you exchange documents with clients through a secure portal or encrypted method (not plain email)?", inPlace: "Client documents are exchanged through a secure portal or encrypted method.", action: "Use a secure client portal or encrypted method instead of plain email for client documents." },
  { key: "physical", area: "Physical security", question: "Are paper files and devices locked up when the office is closed?", inPlace: "Paper files and devices are locked up when the office is closed.", action: "Lock paper files and devices away when the office is closed." },
  { key: "disposal", area: "Physical security", question: "Are old paper records shredded and old devices wiped before disposal?", inPlace: "Paper records are shredded and devices are securely wiped before disposal.", action: "Shred paper records and securely wipe devices before disposal." },
  { key: "training", area: "People", question: "Do staff get security awareness training (phishing, scams, handling client data)?", inPlace: "Staff receive security awareness training at hire and at least yearly.", action: "Train staff on phishing, scams and handling client data at hire and at least yearly." },
  { key: "vendors", area: "Service providers", question: "Do you check that software and cloud providers protect client data (and is it in their contracts)?", inPlace: "Service providers that handle client data are reviewed and required by contract to protect it.", action: "List every provider that handles client data and confirm their security commitments in writing." },
  { key: "monitoring", area: "Monitoring", question: "Do you review account activity and security alerts regularly?", inPlace: "Account activity and security alerts are reviewed regularly.", action: "Review account activity and security alerts at least monthly." },
  { key: "incident", area: "Incident response", question: "Do you have written steps for what to do if client data is stolen or exposed?", inPlace: "Written incident response steps are in place.", action: "Adopt the incident response steps in this plan and share them with staff." },
];

export type WispPractice = {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  /** The person responsible for the security program (FTC "Qualified Individual"). */
  qualifiedIndividual: string;
  people: string;
  locations: string;
  software: string;
};
export type WispAnswers = { practice: WispPractice; safeguards: Record<string, Answer> };

export const PEOPLE_OPTIONS = ["Just me", "2–5", "6–15", "16 or more"];
export const LOCATION_OPTIONS = ["1", "2–3", "4 or more", "Fully remote"];

export function readiness(a: WispAnswers) {
  const yes = SAFEGUARDS.filter((s) => a.safeguards[s.key] === "yes").length;
  const gaps = SAFEGUARDS.filter((s) => a.safeguards[s.key] !== "yes");
  return { score: Math.round((yes / SAFEGUARDS.length) * 100), yes, total: SAFEGUARDS.length, gaps };
}

export const WISP_DISCLAIMER = "This plan is a starting template generated from your answers. It is not legal advice and does not certify compliance with any law or IRS requirement. Review it, adapt it to your practice, and keep it current. See IRS Publication 5708 and the FTC Safeguards Rule for requirements.";
