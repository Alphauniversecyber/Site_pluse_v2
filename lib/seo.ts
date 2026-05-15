import type { Metadata } from "next";

const CANONICAL_SITE_URL = "https://www.trysitepulse.com";
export const DEFAULT_OG_IMAGE = "/opengraph-image.png";
export const MAX_META_DESCRIPTION_LENGTH = 155;

function resolvePublicSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim();

  if (!configuredUrl) {
    return CANONICAL_SITE_URL;
  }

  try {
    const normalizedUrl = new URL(configuredUrl);
    const origin = normalizedUrl.origin.replace(/\/+$/, "");

    return origin === CANONICAL_SITE_URL ? origin : CANONICAL_SITE_URL;
  } catch {
    return CANONICAL_SITE_URL;
  }
}

export const PUBLIC_SITE_URL = resolvePublicSiteUrl();

export function trimMetaDescription(
  description: string,
  maxLength = MAX_META_DESCRIPTION_LENGTH
) {
  const normalizedDescription = description.replace(/\s+/g, " ").trim();

  if (normalizedDescription.length <= maxLength) {
    return normalizedDescription;
  }

  const truncatedDescription = normalizedDescription.slice(0, Math.max(maxLength - 3, 0));
  const lastWordBoundary = truncatedDescription.lastIndexOf(" ");
  const safeDescription =
    lastWordBoundary >= Math.max(Math.floor(maxLength * 0.6), 24)
      ? truncatedDescription.slice(0, lastWordBoundary)
      : truncatedDescription;

  return `${safeDescription.trim()}...`;
}

type BuildPageMetadataOptions = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  imageUrl?: string;
  imageAlt?: string;
  openGraphType?: "website" | "article";
  noIndex?: boolean;
};

export function buildPageMetadata({
  title,
  description,
  path,
  keywords,
  imageUrl = DEFAULT_OG_IMAGE,
  imageAlt,
  openGraphType = "website",
  noIndex = false
}: BuildPageMetadataOptions): Metadata {
  const canonical = path === "/" ? `${PUBLIC_SITE_URL}/` : `${PUBLIC_SITE_URL}${path}`;
  const metaDescription = trimMetaDescription(description);

  return {
    title,
    description: metaDescription,
    keywords,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description: metaDescription,
      url: canonical,
      siteName: "SitePulse",
      type: openGraphType,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt ?? title
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
      images: [imageUrl]
    },
    robots: {
      index: !noIndex,
      follow: !noIndex
    }
  };
}
