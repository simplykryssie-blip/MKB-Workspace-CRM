"""The three Business Financial Management inquiry forms (CRM Forms)."""
import json, sys, datetime
owner, stage, out = sys.argv[1], sys.argv[2], sys.argv[3]
t = datetime.datetime.now(datetime.UTC).isoformat()
q = lambda s: "'" + s.replace("'", "''") + "'"
def f(i, type, label, map="none", required=False, options=None, help=None, showIf=None):
    d = {"id": f"fld-{i}", "type": type, "label": label, "map": map}
    if required: d["required"] = True
    if options: d["options"] = options
    if help: d["help"] = help
    if showIf: d["showIf"] = showIf
    return d
CONTACT = lambda p: [
    f(f"{p}h1", "heading", "About you and your business"),
    f(f"{p}biz", "text", "Business name", "businessName", True),
    f(f"{p}name", "text", "Your full name", "fullName", True),
    f(f"{p}email", "email", "Email", "email", True),
    f(f"{p}phone", "phone", "Phone", "phone", True),
]
ENT = lambda p: f(f"{p}ent", "select", "Number of business entities", options=["1", "2", "3", "4 or more"], required=True)
TX = lambda p: f(f"{p}tx", "select", "Estimated monthly transactions", options=["Up to 150", "151–400", "401–750", "751–1,500", "More than 1,500", "Not sure"], required=True, help="Count the transactions in all your business accounts in a typical month. Transfers between your own accounts don't count.")
ACCTS = lambda p: f(f"{p}acct", "select", "Number of financial accounts", options=["1–3", "4–5", "6–8", "9–12", "More than 12"], required=True, help="Business checking, savings, credit and loan accounts.")
COND = lambda p: f(f"{p}cond", "radio", "Current bookkeeping condition", options=["Up to date", "A few months behind", "More than a year behind / needs cleanup", "Starting fresh — no books yet"], required=True)
EMP = lambda p: f(f"{p}emp", "select", "Number of workers paid through payroll", options=["1–5", "6–10", "11–25", "26–50", "More than 50"], required=True, help="Employees, contractors paid through payroll and owners on payroll.")
FREQ = lambda p: f(f"{p}freq", "radio", "Payroll frequency", options=["Weekly", "Biweekly", "Semi-monthly", "Monthly", "Not sure yet"], required=True)
SAFE = lambda p: f(f"{p}safe", "paragraph", "Please don't include employee names, ID numbers or pay details here. Once you're onboarded, we collect those securely through your client portal.")
NOTES = lambda p: f(f"{p}notes", "textarea", "Anything else we should know?", "notes")
MKT = lambda p: f(f"{p}mkt", "marketing", "Yes — send me tips, deadline reminders and offers from MKB Financial Group by email and text. Message frequency varies; message and data rates may apply. Reply STOP to opt out of texts.")
CONSENT = lambda p: f(f"{p}ok", "consent", "I agree that MKB Financial Group may contact me by phone, text or email about my request. Message and data rates may apply. I can opt out at any time.", required=True)

forms = [
  ("bookkeeping-inquiry", "Bookkeeping inquiry", "Bookkeeping — get started", "Bookkeeping Only", ["books"],
   CONTACT("bk") + [f("bktype", "select", "Business type", "entityType", True, ["Sole proprietor", "LLC", "S corporation", "C corporation", "Partnership", "Nonprofit", "Not sure"]),
   f("bkh2", "heading", "Your bookkeeping"), ENT("bk"),
   f("bkents", "textarea", "Briefly list the other entities (names and types)", showIf={"fieldId": "fld-bkent", "equals": "2"}), TX("bk"), ACCTS("bk"), COND("bk"),
   f("bkbehind", "select", "About how far behind are the books?", options=["Under 6 months", "6–12 months", "More than a year", "Not sure"], showIf={"fieldId": "fld-bkcond", "equals": "More than a year behind / needs cleanup"}),
   f("bkpkg", "select", "Package you're interested in", options=["Foundation — $399/mo", "Essential — $549/mo", "Growth — $749/mo", "Advanced — $999+/mo", "Not sure — recommend one"], required=True),
   NOTES("bk"), MKT("bk"), CONSENT("bk")]),
  ("payroll-inquiry", "Payroll inquiry", "Payroll — get started", "Payroll Only", ["books"],
   CONTACT("pr") + [f("prh2", "heading", "Your payroll"), EMP("pr"), FREQ("pr"),
   f("prhas", "radio", "Do you currently use a payroll provider?", options=["Yes", "No"], required=True),
   f("prwho", "text", "Which payroll provider?", showIf={"fieldId": "fld-prhas", "equals": "Yes"}),
   f("prstart", "date", "Desired payroll start date"),
   f("prneeds", "checkboxes", "Payroll services you need", options=["Payroll processing", "Payroll tax compliance (federal + 1 state)", "Payroll bookkeeping (recording & reconciling payroll)", "Not sure — help me decide"], required=True),
   SAFE("pr"), NOTES("pr"), MKT("pr"), CONSENT("pr")]),
  ("consultation-request", "Consultation request", "Request a consultation", "Consultation request", [],
   CONTACT("cr")[0:1] + [f("crname", "text", "Your full name", "fullName", True), f("cremail", "email", "Email", "email", True), f("crphone", "phone", "Phone", "phone", True), f("crbiz", "text", "Business name (if you have one)", "businessName"),
   f("crtopic", "checkboxes", "What would you like to talk about?", options=["Financial Management (bookkeeping and/or payroll)", "Business Solutions (formation and filings)", "Tax Services", "Record Relief (Louisiana)", "Not sure yet"], required=True),
   f("crhow", "radio", "How would you like to meet?", options=["Phone call", "Video call"], required=True),
   f("crdays", "checkboxes", "Which days work best?", options=["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], required=True),
   f("crtime", "radio", "What time of day?", options=["Morning", "Afternoon", "Either"], required=True),
   NOTES("cr"), MKT("cr"), CONSENT("cr")]),
  ("start-tax-prep", "Start: Tax preparation", "Start your tax preparation", "Start: Tax prep", ["tax"],
   [f("tsh", "heading", "About you"), f("tsname", "text", "Your full name", "fullName", True), f("tsemail", "email", "Email (we'll send your secure link here)", "email", True), f("tsphone", "phone", "Phone", "phone", True),
    f("tsh2", "heading", "Your return"),
    f("tsret", "radio", "Which return do you need?", options=["Personal return", "Self-employed or single-member LLC (Schedule C)", "S corporation", "Partnership or multi-member LLC", "C corporation", "Not sure"], required=True),
    f("tsbiz1", "text", "Business name", "businessName", True, showIf={"fieldId": "fld-tsret", "equals": "S corporation"}),
    f("tsbiz2", "text", "Business name", "businessName", True, showIf={"fieldId": "fld-tsret", "equals": "Partnership or multi-member LLC"}),
    f("tsbiz3", "text", "Business name", "businessName", True, showIf={"fieldId": "fld-tsret", "equals": "C corporation"}),
    f("tsyear", "radio", "Which tax year?", options=["Most recent tax year", "An earlier year"], required=True),
    f("tsnote", "paragraph", "Next, we'll email you a private link to your secure tax interview. That's where you'll answer the detailed questions and sign — it's protected, so nothing sensitive goes through this page."),
    MKT("ts"), CONSENT("ts")], {"kind": "tax", "returnFieldId": "fld-tsret", "yearFieldId": "fld-tsyear"},
   "Thank you! Watch your email for your private tax interview link — it usually arrives within a few minutes. If you chose \"Not sure\" or an earlier year, we'll reach out within one business day."),
  ("start-bookkeeping", "Start: Bookkeeping", "Start your bookkeeping", "Start: Bookkeeping", ["books"],
   [f("sbh", "heading", "About you and your business"), f("sbname", "text", "Your full name", "fullName", True), f("sbemail", "email", "Email (we'll send your secure link here)", "email", True), f("sbphone", "phone", "Phone", "phone", True),
    f("sbbiz", "text", "Business name", "businessName", True),
    f("sbtype", "select", "Business type", "entityType", True, ["Sole proprietor", "LLC", "S corporation", "C corporation", "Partnership", "Nonprofit", "Not sure"]),
    f("sbnote", "paragraph", "Next, we'll email you a private link to your secure bookkeeping intake. You'll tell us about your accounts and how the business runs there, then we'll send your price."),
    MKT("sb"), CONSENT("sb")], {"kind": "books"},
   "Thank you! Watch your email for your private bookkeeping intake link — it usually arrives within a few minutes."),
  ("start-payroll", "Start: Payroll", "Start your payroll", "Start: Payroll", ["books"],
   [f("sph", "heading", "About you and your business"), f("spname", "text", "Your full name", "fullName", True), f("spemail", "email", "Email", "email", True), f("spphone", "phone", "Phone", "phone", True),
    f("spbiz", "text", "Business name", "businessName", True), EMP("sp"), FREQ("sp"),
    f("spneeds", "checkboxes", "Payroll services you need", options=["Payroll processing", "Payroll tax compliance (federal + 1 state)", "Payroll bookkeeping", "Not sure — help me decide"], required=True),
    f("spnote", "paragraph", "Next, we'll email you a private link to your secure payroll intake, where you'll tell us about your team and schedule. Please don't include employee details here."),
    MKT("sp"), CONSENT("sp")], {"kind": "payroll"}, "Thank you! Watch your email for your private payroll intake link — it usually arrives within a few minutes."),
  ("start-business-solutions", "Start: Business Solutions", "Start your business filing", "Start: Business Solutions", ["biz"],
   [f("ssh", "heading", "About you"), f("ssname", "text", "Your full name", "fullName", True), f("ssemail", "email", "Email", "email", True), f("ssphone", "phone", "Phone", "phone", True),
    f("ssbiz", "text", "Business name (or the name you want)", "businessName"),
    f("ssneed", "checkboxes", "What do you need?", options=["Form an LLC or corporation", "IRS employer ID number application", "Trade name / registration", "Annual report", "Amendment, name change or dissolution", "Operating agreement or resolutions", "Not sure"], required=True),
    f("ssstate", "select", "Which state?", "state", True, ["Louisiana", "Texas", "Another state"]),
    f("ssnote", "paragraph", "Next, we'll email you a private link to your secure Business Solutions intake. We confirm the state filing fees with you before anything is filed."),
    MKT("ss"), CONSENT("ss")], {"kind": "biz"}, "Thank you! Watch your email for your private Business Solutions intake link — it usually arrives within a few minutes."),
  ("start-record-relief", "Start: Record Relief", "Start your Record Relief paperwork", "Start: Record Relief", ["expunge"],
   [f("srh", "heading", "About you"), f("srname", "text", "Your full name", "fullName", True), f("sremail", "email", "Email", "email", True), f("srphone", "phone", "Phone", "phone", True),
    f("srla", "radio", "Is the record you're asking about in Louisiana?", options=["Yes", "No", "Not sure"], required=True),
    f("srother", "paragraph", "We currently assist with Louisiana records only, so we may not be able to help — but we'll reply and let you know.", showIf={"fieldId": "fld-srla", "equals": "No"}),
    f("srnote", "paragraph", "Please don't include case details here. If your record is in Louisiana, we'll email you a private link to your secure Record Relief intake. MKB is not a law firm and does not give legal advice."),
    MKT("sr"), CONSENT("sr")], {"kind": "relief", "onlyIfFieldId": "fld-srla", "onlyIfEquals": "Yes"}, "Thank you! If your record is in Louisiana, watch your email for your private Record Relief intake link. Otherwise, we'll reach out within one business day."),
  ("combined-inquiry", "Bookkeeping + Payroll inquiry", "Bookkeeping + Payroll — request a combined quote", "Bookkeeping + Payroll", ["books"],
   CONTACT("cb") + [f("cbh2", "heading", "Your business"), ENT("cb"), EMP("cb"), TX("cb"), ACCTS("cb"), COND("cb"),
   f("cbbehind", "select", "About how far behind are the books?", options=["Under 6 months", "6–12 months", "More than a year", "Not sure"], showIf={"fieldId": "fld-cbcond", "equals": "More than a year behind / needs cleanup"}),
   FREQ("cb"),
   f("cbhas", "radio", "Do you currently use a payroll provider?", options=["Yes", "No"], required=True),
   f("cbwho", "text", "Which payroll provider?", showIf={"fieldId": "fld-cbhas", "equals": "Yes"}),
   f("cbneeds", "checkboxes", "Services requested", options=["Monthly bookkeeping", "Payroll processing", "Payroll tax compliance (federal + 1 state)", "Payroll bookkeeping", "Catch-up / cleanup bookkeeping", "Additional entity support"], required=True),
   SAFE("cb"), NOTES("cb"), MKT("cb"), CONSENT("cb")]),
]
sql = []
for row in forms:
    slug, name, title, tag, services, fields = row[:6]
    auto = row[6] if len(row) > 6 else None
    routing = {"ownerId": owner, "stageId": stage, "source": "Website", "sourceDetail": name, "tags": ["Website", tag], "followUpHours": 24}
    if auto: routing["autoIntake"] = auto
    thanks = row[7] if len(row) > 7 else "Thank you! We received your request and will follow up within one business day."
    sql.append(f"INSERT INTO forms (id, name, slug, title, intro, status, fields, services, routing, thank_you, created_at, updated_at, published_at) VALUES ({q('form-' + slug)}, {q(name)}, {q(slug)}, {q(title)}, NULL, 'published', {q(json.dumps(fields))}, {q(json.dumps(services))}, {q(json.dumps(routing))}, {q(thanks)}, {q(t)}, {q(t)}, {q(t)}) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, title = excluded.title, fields = excluded.fields, routing = excluded.routing, thank_you = excluded.thank_you, status = 'published', updated_at = excluded.updated_at;")
import re
SENS=re.compile(r"\b(ssn|social security|tax ?id|itin|\bein\b|bank|routing|account number|credit card|card number|password|date of birth|birth ?date|dob|arrest|conviction|convicted|criminal|charges?|offense|felony|misdemeanor|diagnos|medical record)", re.I)
for row in forms:
  slug, fields = row[0], row[5]
  for x in fields:
    t=" ".join([x["label"],x.get("help","")]+x.get("options",[]))
    m=SENS.search(t)
    if m: raise SystemExit(f"{slug}: {x['label']} -> {m.group(0)}")
open(out, "w").write("\n".join(sql)); print(len(sql), "forms")
