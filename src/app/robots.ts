import type { MetadataRoute } from "next";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

/* Search engines may index the public marketing pages only. The app, the
   API and the customer facing secret links (quotes, lead forms,
   unsubscribe) stay out of results. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/privacy", "/terms"],
      disallow: ["/dashboard", "/api/", "/q/", "/f/", "/u/", "/invite/", "/reset-password/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
