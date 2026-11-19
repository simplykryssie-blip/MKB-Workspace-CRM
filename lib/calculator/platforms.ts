/** How to install the calculator on common website builders (shown on the customer's setup page). */
export type PlatformGuide = { id: string; label: string; uses: "code" | "url"; steps: string[]; note?: string };

export const PLATFORM_GUIDES: PlatformGuide[] = [
  {
    id: "gohighlevel", label: "GoHighLevel", uses: "code",
    steps: [
      "Open your funnel or website page in the GoHighLevel builder.",
      "Add a Custom Code (Custom JS/HTML) element where the calculator should appear.",
      "Paste your embed code and save.",
      "Publish, then open the page on your own domain to check it.",
    ],
    note: "It only shows on the website you add above, so it won't appear in GoHighLevel's preview — check it on your published page.",
  },
  {
    id: "wordpress", label: "WordPress", uses: "code",
    steps: ["Edit the page where the calculator should appear.", "Add a Custom HTML block.", "Paste your embed code, then update/publish the page."],
  },
  {
    id: "wix", label: "Wix", uses: "url",
    steps: ["In the Wix Editor click Add → Embed Code → Embed a Site.", "Click Enter Website Address and paste your calculator address (not the embed code).", "Make the element about 1,400px tall and publish."],
    note: "Use \"Embed a Site\". Wix's \"Embed HTML\" puts code inside an extra Wix frame that may be blocked.",
  },
  {
    id: "squarespace", label: "Squarespace", uses: "code",
    steps: ["Edit the page and add a Code block.", "Paste your embed code and turn off \"Display Source\".", "Save and publish."],
  },
  {
    id: "other", label: "Other website", uses: "code",
    steps: ["Find your site builder's HTML / custom code / embed block.", "Paste your embed code (or the calculator address if it only accepts a link).", "Publish on your website and check that the calculator shows."],
    note: "Your page must use https:// on a website you added above.",
  },
];
