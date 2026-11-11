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
CONSENT = lambda p: f(f"{p}ok", "consent", "I agree that MKB Financial Group may contact me by phone, text or email about my request. Message and data rates may apply. I can opt out at any time.", required=True)

forms = [
  ("bookkeeping-inquiry", "Bookkeeping inquiry", "Bookkeeping — get started", "Bookkeeping Only", ["books"],
   CONTACT("bk") + [f("bktype", "select", "Business type", "entityType", True, ["Sole proprietor", "LLC", "S corporation", "C corporation", "Partnership", "Nonprofit", "Not sure"]),
   f("bkh2", "heading", "Your bookkeeping"), ENT("bk"),
   f("bkents", "textarea", "Briefly list the other entities (names and types)", showIf={"fieldId": "fld-bkent", "equals": "2"}), TX("bk"), ACCTS("bk"), COND("bk"),
   f("bkbehind", "select", "About how far behind are the books?", options=["Under 6 months", "6–12 months", "More than a year", "Not sure"], showIf={"fieldId": "fld-bkcond", "equals": "More than a year behind / needs cleanup"}),
   f("bkpkg", "select", "Package you're interested in", options=["Foundation — $399/mo", "Essential — $549/mo", "Growth — $749/mo", "Advanced — $999+/mo", "Not sure — recommend one"], required=True),
   NOTES("bk"), CONSENT("bk")]),
  ("payroll-inquiry", "Payroll inquiry", "Payroll — get started", "Payroll Only", ["books"],
   CONTACT("pr") + [f("prh2", "heading", "Your payroll"), EMP("pr"), FREQ("pr"),
   f("prhas", "radio", "Do you currently use a payroll provider?", options=["Yes", "No"], required=True),
   f("prwho", "text", "Which payroll provider?", showIf={"fieldId": "fld-prhas", "equals": "Yes"}),
   f("prstart", "date", "Desired payroll start date"),
   f("prneeds", "checkboxes", "Payroll services you need", options=["Payroll processing", "Payroll tax compliance (federal + 1 state)", "Payroll bookkeeping (recording & reconciling payroll)", "Not sure — help me decide"], required=True),
   SAFE("pr"), NOTES("pr"), CONSENT("pr")]),
  ("combined-inquiry", "Bookkeeping + Payroll inquiry", "Bookkeeping + Payroll — request a combined quote", "Bookkeeping + Payroll", ["books"],
   CONTACT("cb") + [f("cbh2", "heading", "Your business"), ENT("cb"), EMP("cb"), TX("cb"), ACCTS("cb"), COND("cb"),
   f("cbbehind", "select", "About how far behind are the books?", options=["Under 6 months", "6–12 months", "More than a year", "Not sure"], showIf={"fieldId": "fld-cbcond", "equals": "More than a year behind / needs cleanup"}),
   FREQ("cb"),
   f("cbhas", "radio", "Do you currently use a payroll provider?", options=["Yes", "No"], required=True),
   f("cbwho", "text", "Which payroll provider?", showIf={"fieldId": "fld-cbhas", "equals": "Yes"}),
   f("cbneeds", "checkboxes", "Services requested", options=["Monthly bookkeeping", "Payroll processing", "Payroll tax compliance (federal + 1 state)", "Payroll bookkeeping", "Catch-up / cleanup bookkeeping", "Additional entity support"], required=True),
   SAFE("cb"), NOTES("cb"), CONSENT("cb")]),
]
sql = []
for slug, name, title, tag, services, fields in forms:
    routing = {"ownerId": owner, "stageId": stage, "source": "Website", "sourceDetail": name, "tags": ["Website", tag], "followUpHours": 24}
    thanks = "Thank you! We received your request and will follow up within one business day."
    sql.append(f"INSERT INTO forms (id, name, slug, title, intro, status, fields, services, routing, thank_you, created_at, updated_at, published_at) VALUES ({q('form-' + slug)}, {q(name)}, {q(slug)}, {q(title)}, NULL, 'published', {q(json.dumps(fields))}, {q(json.dumps(services))}, {q(json.dumps(routing))}, {q(thanks)}, {q(t)}, {q(t)}, {q(t)}) ON CONFLICT(slug) DO UPDATE SET name = excluded.name, title = excluded.title, fields = excluded.fields, routing = excluded.routing, thank_you = excluded.thank_you, status = 'published', updated_at = excluded.updated_at;")
import re
SENS=re.compile(r"\b(ssn|social security|tax ?id|itin|\bein\b|bank|routing|account number|credit card|card number|password|date of birth|birth ?date|dob|arrest|conviction|convicted|criminal|charges?|offense|felony|misdemeanor|diagnos|medical record)", re.I)
for slug,_,_,_,_,fields in forms:
  for x in fields:
    t=" ".join([x["label"],x.get("help","")]+x.get("options",[]))
    m=SENS.search(t)
    if m: raise SystemExit(f"{slug}: {x['label']} -> {m.group(0)}")
open(out, "w").write("\n".join(sql)); print(len(sql), "forms")
