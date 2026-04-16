import type { ClientDashboardIssue, ClientDashboardRecommendation } from "@/types";

type MatcherRule = {
  pattern: RegExp;
  copy: string;
};

const ISSUE_NEXT_STEP_BY_KEY: Record<string, string> = {
  "largest-contentful-paint":
    "Reduce the size of the main above-the-fold image or section, preload the key asset, and remove anything delaying it from rendering.",
  "first-contentful-paint":
    "Trim the assets needed for the first screen and defer non-essential files so visitors see meaningful content sooner.",
  "interactive":
    "Delay non-essential scripts and reduce startup work so the page becomes usable faster after it loads.",
  "speed-index":
    "Prioritize the first screen by reducing heavy images, fonts, and scripts that slow down visible content.",
  "total-blocking-time":
    "Reduce heavy JavaScript on page load, delay non-essential scripts, and break large browser tasks into smaller ones.",
  "render-blocking-resources":
    "Defer non-critical CSS and JavaScript, and inline only the small styles needed for the first screen.",
  "unused-javascript":
    "Remove unused libraries or lazy-load them so visitors do not download code the page never uses.",
  "unused-css-rules":
    "Remove unused CSS from this template or split styles by page so visitors load only what they need.",
  "modern-image-formats":
    "Convert heavy images to WebP or AVIF so the page keeps the same look with much smaller files.",
  "uses-optimized-images":
    "Resize oversized images before upload and serve smaller versions to mobile visitors.",
  "offscreen-images":
    "Lazy-load images below the fold so they do not compete with the content visitors see first.",
  "uses-responsive-images":
    "Serve image sizes that match the device so mobile users do not download desktop-sized assets.",
  "unminified-javascript":
    "Minify JavaScript before deployment so browsers download less code on every visit.",
  "unminified-css":
    "Minify CSS before deployment so styling files load faster without changing the design.",
  "uses-text-compression":
    "Turn on Brotli or Gzip for HTML, CSS, and JavaScript so the same pages are delivered in smaller files.",
  "server-response-time":
    "Review hosting, caching, and slow backend calls so the server starts responding much faster.",
  redirects:
    "Update internal links to point directly to the final destination and remove redirect hops wherever possible.",
  "font-display":
    "Set fonts to swap and preload only the files used above the fold so text appears faster.",
  "total-byte-weight":
    "Reduce the total page weight by trimming heavy scripts, images, video, and font files.",
  "critical-request-chains":
    "Shorten dependency chains so the browser is not forced to wait on too many files in sequence.",
  "mainthread-work-breakdown":
    "Audit third-party scripts and large bundles so the browser spends less time blocked during startup.",
  "bootup-time":
    "Reduce the JavaScript work required at startup so the page feels responsive sooner.",
  "dom-size":
    "Simplify the page template and reduce unnecessary nested elements so the browser can render it more efficiently.",
  "uses-http2":
    "Serve the site over HTTP/2 or newer so assets can load more efficiently in parallel.",
  "cumulative-layout-shift":
    "Set fixed dimensions for images, embeds, banners, and dynamic sections so the page stops jumping while it loads.",
  "document-title":
    "Write a unique page title that clearly states what the page is about and who it is for.",
  "meta-description":
    "Add a concise meta description that tells searchers what they will get before they click.",
  "link-text":
    "Replace vague anchor text like 'click here' with descriptive wording that tells people exactly where the link goes.",
  "image-alt":
    "Add descriptive alt text to meaningful images and leave decorative images with empty alt text.",
  "crawlable-anchors":
    "Use normal anchor tags with real href values so visitors and search engines can follow the links reliably.",
  "is-crawlable":
    "Review robots rules, headers, and login gates so search engines can access the pages you want indexed.",
  "http-status-code":
    "Fix broken URLs and make sure important pages return a normal 200 response instead of an error.",
  "tap-targets":
    "Increase tap target size and spacing so buttons and links are easier to use on phones.",
  "live-broken-links":
    "Update or remove the broken internal links listed below and add redirects anywhere an old URL should still work.",
  "live-security-headers":
    "Add the missing security headers at the server or hosting level so browsers get the right protection policies."
};

const ISSUE_TITLE_RULES: MatcherRule[] = [
  {
    pattern: /contrast/i,
    copy: "Adjust the text and background color pairing so important content stays readable for every visitor."
  },
  {
    pattern: /link.+discernible|discernible.+link|link text/i,
    copy: "Give each link a clear label so visitors know where it goes before they click."
  },
  {
    pattern: /button.+discernible|discernible.+button/i,
    copy: "Add clear text or accessible labels to each button so the intended action is obvious."
  },
  {
    pattern: /heading/i,
    copy: "Rework the heading order so the page follows a clear hierarchy from main heading to supporting sections."
  },
  {
    pattern: /label/i,
    copy: "Add visible labels or programmatic labels to each form field so visitors know exactly what to enter."
  },
  {
    pattern: /image.+alt|alt text/i,
    copy: "Add meaningful alt text to informative images so the content still makes sense when the image is not seen."
  },
  {
    pattern: /keyboard/i,
    copy: "Make sure every interactive control can be reached and used with a keyboard, not only a mouse."
  },
  {
    pattern: /focus/i,
    copy: "Add a clear visible focus style so keyboard users can always see where they are on the page."
  },
  {
    pattern: /aria|landmark|navigation/i,
    copy: "Use the correct accessibility attributes and landmarks so assistive technology can understand the page structure."
  }
];

const RECOMMENDATION_WHY_BY_KEY: Record<string, string> = {
  "largest-contentful-paint":
    "This improves the first impression visitors get and reduces the chance they leave before the main content appears.",
  "first-contentful-paint":
    "Showing useful content sooner helps visitors feel the page is fast and worth staying on.",
  "interactive":
    "A page that becomes usable quickly is more likely to keep visitors engaged and converting.",
  "speed-index":
    "Faster visible loading makes the site feel more polished and lowers early abandonment.",
  "total-blocking-time":
    "A more responsive page reduces frustration, especially for mobile visitors trying to take action.",
  "render-blocking-resources":
    "Removing render delays helps the page appear faster on slower connections and older devices.",
  "unused-javascript":
    "Cutting wasted code reduces download time and helps the site stay responsive for more visitors.",
  "unused-css-rules":
    "Smaller style payloads help pages load faster without changing the visual design.",
  "modern-image-formats":
    "Smaller image files speed up visual loading and improve the browsing experience without sacrificing quality.",
  "uses-optimized-images":
    "Optimized images help pages load faster, especially for mobile visitors on weaker connections.",
  "offscreen-images":
    "Lazy-loading below-the-fold media protects the first impression and speeds up initial loading.",
  "uses-responsive-images":
    "Serving the right image size per device cuts wasted bandwidth and makes mobile pages feel faster.",
  "unminified-javascript":
    "Smaller JavaScript files mean less to download before the page feels ready.",
  "unminified-css":
    "Smaller CSS files help styles render faster and reduce unnecessary transfer size.",
  "uses-text-compression":
    "Compression is a quick performance win because the page stays the same while files get smaller.",
  "server-response-time":
    "A faster server improves every visit, every page, and every channel that sends traffic to the site.",
  redirects:
    "Removing extra redirect hops gets visitors to the right page faster and avoids wasting crawl budget.",
  "font-display":
    "Faster text rendering lets visitors start reading sooner instead of waiting on custom fonts.",
  "total-byte-weight":
    "Smaller pages load more reliably for mobile visitors and are less likely to lose impatient traffic.",
  "critical-request-chains":
    "Shorter file dependency chains help the page render sooner and reduce slow first loads.",
  "mainthread-work-breakdown":
    "Less browser work during startup means smoother interactions and fewer frustrating delays.",
  "bootup-time":
    "Reducing startup work helps the page feel polished instead of sluggish.",
  "dom-size":
    "Simpler page structure is easier for browsers to render and easier for teams to maintain over time.",
  "uses-http2":
    "Modern delivery protocols let browsers fetch assets more efficiently and improve page speed at scale.",
  "cumulative-layout-shift":
    "Stable layouts feel more trustworthy and prevent accidental taps while the page is loading.",
  "document-title":
    "A clear title helps searchers choose your result and helps Google understand the page topic.",
  "meta-description":
    "A stronger search snippet can lift click-through rate without needing new rankings first.",
  "link-text":
    "Clearer link wording helps people and search engines understand the paths that matter most.",
  "image-alt":
    "Alt text improves accessibility and gives search engines more context about visual content.",
  "crawlable-anchors":
    "If important links are not crawlable, visitors and search engines can miss key pages entirely.",
  "is-crawlable":
    "If search engines cannot access a page, it becomes much harder for that page to rank or appear reliably.",
  "http-status-code":
    "Broken or unstable pages damage trust and stop traffic from reaching the right destination.",
  "tap-targets":
    "Easy mobile tapping reduces friction for visitors who are ready to contact, book, or buy.",
  "live-rec-broken-links":
    "Fixing dead links protects trust and stops visitors from reaching dead ends during important journeys.",
  "live-rec-schema":
    "Schema helps search engines understand the business and can improve how listings appear in search."
};

const RECOMMENDATION_TITLE_RULES: MatcherRule[] = [
  {
    pattern: /contrast/i,
    copy: "Readable text keeps more visitors engaged and reduces frustration for users with visual impairments."
  },
  {
    pattern: /link.+discernible|discernible.+link|link text/i,
    copy: "Clear link labels make navigation easier to trust and easier to follow."
  },
  {
    pattern: /button.+discernible|discernible.+button/i,
    copy: "Clearly labeled buttons reduce missed actions and make the experience easier to understand."
  },
  {
    pattern: /heading/i,
    copy: "Clear heading structure makes content easier to scan and understand for both visitors and assistive technologies."
  },
  {
    pattern: /label/i,
    copy: "Properly labeled forms reduce hesitation and improve completion rates."
  },
  {
    pattern: /image.+alt|alt text/i,
    copy: "Alt text improves accessibility and helps search engines understand the purpose of visual content."
  },
  {
    pattern: /keyboard/i,
    copy: "Keyboard support keeps the site usable for more visitors and is a core accessibility expectation."
  },
  {
    pattern: /focus/i,
    copy: "Visible focus states help visitors understand where they are and make navigation less frustrating."
  },
  {
    pattern: /aria|landmark|navigation/i,
    copy: "Clear semantics help assistive technologies explain the page correctly, which improves usability and trust."
  }
];

function stripMarkdown(text: string | null | undefined) {
  if (!text) {
    return "";
  }

  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/[^\s)]+/g, "")
    .replace(/\[|\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeAuditKey(id: string) {
  return id.replace(/^(mobile|desktop)-/, "");
}

function matchRule(rules: MatcherRule[], ...parts: Array<string | null | undefined>) {
  const haystack = parts
    .map((part) => stripMarkdown(part))
    .join(" ")
    .toLowerCase();

  return rules.find((rule) => rule.pattern.test(haystack))?.copy ?? null;
}

export function getIssueSpecificNextStep(issue: Pick<ClientDashboardIssue, "id" | "title" | "description">) {
  const key = normalizeAuditKey(issue.id);

  return (
    ISSUE_NEXT_STEP_BY_KEY[key] ??
    matchRule(ISSUE_TITLE_RULES, issue.title, issue.description) ??
    stripMarkdown(issue.description)
  );
}

export function getRecommendationSpecificWhy(
  recommendation: Pick<ClientDashboardRecommendation, "id" | "title" | "action">
) {
  const key = normalizeAuditKey(recommendation.id);

  return (
    RECOMMENDATION_WHY_BY_KEY[key] ??
    matchRule(RECOMMENDATION_TITLE_RULES, recommendation.title, recommendation.action) ??
    stripMarkdown(recommendation.action)
  );
}
