import type { Metadata } from "next";

export const PUBLIC_SITE_URL = "https://www.trysitepulse.com";
export const DEFAULT_OG_IMAGE = "/opengraph-image.png";

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
  const canonical = path === "/" ? PUBLIC_SITE_URL : `${PUBLIC_SITE_URL}${path}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical
    },
    openGraph: {
      title,
      description,
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
      description,
      images: [imageUrl]
    },
    robots: {
      index: !noIndex,
      follow: !noIndex
    }
  };
}
