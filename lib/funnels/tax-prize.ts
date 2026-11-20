/**
 * Black Friday / Cyber Monday 2026 "Tax Prize" scratch-off: every ticket wins $25, $50 or
 * $75 off 2026 tax preparation with MKB; opting in to texts adds the VIP bonus (the Credit
 * Comeback Vault and priority filing). Shared by the page and the server.
 */
export const TAX_PRIZE = {
  campaign: "mkb_bfcm_2026_tax_prize",
  path: "/black-friday",
  closesAt: "2026-12-01T05:59:59Z", // Nov 30, 2026, 11:59 pm Central
  redeemBy: "April 15, 2027",
  /** Instant-win amounts and their chances (out of 100). */
  prizes: [{ cents: 2500, odds: 60 }, { cents: 5000, odds: 30 }, { cents: 7500, odds: 10 }],
};
export const usd0 = (cents: number) => `$${Math.round(cents / 100)}`;

export const FILER = { me: "Me / my household", biz: "My business" } as const;
export const IND_TYPES = ["Personal return", "Self-employed or single-member LLC (Schedule C)"] as const;
export const BIZ_TYPES = ["S corporation", "C corporation", "Partnership or multi-member LLC", "Self-employed or single-member LLC (Schedule C)"] as const;

export const SMS_DISCLOSURE =
  "By checking this box, you agree to receive recurring automated marketing texts (tax tips, deadlines and offers) from MKB Financial Group at the number provided. Consent is not a condition of winning or of any purchase. Message frequency varies. Message and data rates may apply. Reply STOP to cancel, HELP for help.";

export const OFFICIAL_RULES = `## Black Friday Tax Prize — Official Rules
NO PURCHASE NECESSARY TO ENTER OR WIN. A purchase does not improve your chances of winning.

## Sponsor
MKB Financial Group, 4459 Nelson Road Suite 105 PMB 1089, Lake Charles, LA 70605 · 888-379-9372 · info@mkbfinancialgroup.com.

## Promotion period
Begins November 20, 2026 and ends November 30, 2026 at 11:59 pm Central Time.

## Eligibility
Open to legal U.S. residents 18 or older. Prizes can only be used for tax preparation services MKB Financial Group provides (virtual service; MKB serves clients in Louisiana and Texas). Employees and contractors of the Sponsor and their households are not eligible. Void where prohibited.

## How to enter
Visit the promotion page, scratch the ticket, and submit your name, email, mobile phone and state. Limit one prize per person, email address, phone number and household. Duplicate entries receive the same prize already awarded.

## Prizes and odds
Every valid entry wins one instant prize, chosen at random by the Sponsor's system: $25 off (approximate odds 6 in 10), $50 off (3 in 10) or $75 off (1 in 10) the Sponsor's fee to prepare your 2026 federal tax return (individual or business).

## Using your prize
Redeem by ${TAX_PRIZE.redeemBy}, on a 2026 tax return prepared by MKB Financial Group. Mention your prize code when you file. The discount applies to MKB's preparation fees only (not taxes, IRS or state amounts, or third-party fees), cannot exceed the fee, has no cash value, cannot be transferred or sold, and cannot be combined with other offers unless the Sponsor agrees in writing.

## VIP bonus
Entrants who choose to receive text messages also receive the Credit Comeback Vault (a free do-it-yourself credit packet) and priority filing scheduling. Opting in to texts is not required to enter or win.

## General
The Sponsor may disqualify entries that are fraudulent or made by automated means, and may end or change the promotion if it cannot run as planned. Information you provide is handled under the Sponsor's Privacy Policy.`;
