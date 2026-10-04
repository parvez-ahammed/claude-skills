# SEO and AEO checklist

Mark each item: done / missing / wrong / not applicable. Give `file:line` for done and wrong.

## A. Crawl and index

| # | Item | How to check |
|---|------|--------------|
| A1 | Main content is in the first HTML response (no JavaScript needed) | `audit-url.mjs` visible text size; `/nojs` screenshot |
| A2 | Same HTML for browser, Googlebot, GPTBot, OAI-SearchBot, PerplexityBot, ClaudeBot | `audit-url.mjs` per-agent table |
| A3 | `robots.txt` returns 200, allows public pages, links the sitemap | `curl -i /robots.txt` |
| A4 | AI bots allowed or blocked on purpose (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, CCBot) | read `robots.txt`; also check CDN bot rules (Cloudflare "Block AI bots") |
| A5 | `sitemap.xml` is valid XML with the sitemap namespace, absolute URLs, only indexable pages | parse it; `curl -i` content type |
| A6 | Only production is indexable; test sites send `noindex` + `Disallow: /` | build with both settings, compare |
| A7 | Private / signed-in routes: `noindex`, no canonical, not in sitemap | fetch an app route |
| A8 | Unknown URL returns status 404 (not 200 app shell) | `curl -o /dev/null -w "%{http_code}" /does-not-exist-xyz` |
| A9 | One host: http goes to https, www and non-www go to one of them (301) | needs deploy |
| A10 | Deep links to app routes still work (not 404) | fetch each route prefix |
| A11 | Page is fast: small first-load JavaScript, no render-blocking app CSS, images sized, video has a poster | Lighthouse mobile + desktop, compare with the base branch |
| A12 | `<html lang="...">` set | view source |

## B. Page metadata and structured data

| # | Item | Notes |
|---|------|-------|
| B1 | `<title>` unique, says what it is: "Brand \| What it does" | 50-60 characters. A title that is only the brand name says nothing to an engine |
| B2 | Meta description, about 150-160 characters, plain sentence | Often quoted as-is in results |
| B3 | `<link rel="canonical" href="https://...">` absolute | One per page; not on private pages |
| B4 | Exactly one robots meta tag | Two conflicting tags: engines take the stricter one |
| B5 | Open Graph: `og:title`, `og:description`, `og:url` (= canonical), `og:type`, `og:image` (absolute https, 1200x630), `og:image:alt` | Controls previews in Slack, LinkedIn, Teams |
| B6 | Twitter: `twitter:card` (`summary_large_image`), title, description, image | |
| B7 | `<meta charset>` in the first 1024 bytes | Browsers ignore it later |
| B8 | JSON-LD valid JSON, validated at validator.schema.org | See templates below |
| B9 | `Organization` with `name`, `url`, `logo`, `sameAs` | `sameAs` = LinkedIn, Wikipedia, Wikidata, Crunchbase, GitHub. Helps engines match the brand |
| B10 | `WebSite` + `WebPage`, linked with `@id` | |
| B11 | Product type: `SoftwareApplication` / `Product` / `Service` / `LocalBusiness` / `Article` | `description`, `featureList`, `applicationCategory`, `offers` if prices are public |
| B12 | `FAQPage` only if the questions and answers are visible on the page, same words | Google shows FAQ rich results only for gov/health since 2023; answer engines still read it |
| B13 | Brand name spelled the same everywhere (title, JSON-LD, manifest, alt text, llms.txt) | grep build output for wrong spellings |
| B14 | `llms.txt` at the site root | Markdown: `# Name`, `> one-line definition`, who it is for/not for, features, links |
| B15 | Favicon, `manifest.json` name matches | |

## C. Answer-ready content (AEO)

These change text that users see. Propose; do not change without the owner's approval.

| # | Item | Notes |
|---|------|-------|
| C1 | A direct answer to "What is X?" near the top, 40-60 words, starting "X is ..." | This is the paragraph engines quote. The first sentence must work alone |
| C2 | One `h1`; `h2` per section; `h3` inside | Check the real tags, not the visual size |
| C3 | Some `h2`s are questions users ask: "What is X?", "How does X work?", "Who is X for?", "How much does X cost?" | Put the question in the heading tag, not in a small label above it |
| C4 | Steps as a numbered list ("How to ...", "Steps to ...") | Engines take lists for step answers |
| C5 | Comparisons as a table | |
| C6 | Short paragraphs (2-4 lines), plain words, one idea each | Good for voice answers too |
| C7 | FAQ section at the end, 4-8 questions, 2-3 sentence answers | Source the questions from support tickets, sales calls, Google "People also ask", AnswerThePublic |
| C8 | Say what the product is NOT when the name is ambiguous | e.g. "Acme Forms is not a survey tool" |
| C9 | Concrete facts engines can quote: numbers, supported systems, time to set up, prices | Vague claims are not quoted |
| C10 | Links to trusted sources (standards bodies, Wikipedia, docs) and to the company's own pages | |
| C11 | Author / company and date visible on articles | Trust signal |

## D. Not code (list them, do not do them)

- Google Search Console + Bing Webmaster Tools: verify site, submit sitemap, request indexing.
- Track question queries, featured snippets, impressions and clicks.
- Competitor snippet research (Semrush, Ahrefs).
- Ask ChatGPT / Perplexity / Copilot "What is X?" after deploy and record the answers; repeat monthly.

## JSON-LD templates

One `@graph` block in `<head>`. Replace every value; remove fields you cannot fill honestly.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://company.example/#organization",
      "name": "Company",
      "url": "https://company.example/",
      "logo": "https://product.example/logo512.png",
      "sameAs": ["https://www.linkedin.com/company/company"]
    },
    {
      "@type": "WebSite",
      "@id": "https://product.example/#website",
      "name": "Product",
      "url": "https://product.example/",
      "inLanguage": "en",
      "publisher": { "@id": "https://company.example/#organization" }
    },
    {
      "@type": "WebPage",
      "@id": "https://product.example/#webpage",
      "url": "https://product.example/",
      "name": "Product | What it does",
      "description": "Same text as the meta description.",
      "inLanguage": "en",
      "isPartOf": { "@id": "https://product.example/#website" },
      "primaryImageOfPage": "https://product.example/og-image.png"
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://product.example/#software",
      "name": "Product",
      "url": "https://product.example/",
      "description": "Product is ... (same as the 'What is' answer on the page).",
      "applicationCategory": "BusinessApplication",
      "operatingSystem": "Web browser",
      "featureList": ["Feature one", "Feature two"],
      "mainEntityOfPage": { "@id": "https://product.example/#webpage" },
      "publisher": { "@id": "https://company.example/#organization" }
    }
  ]
}
</script>
```

FAQPage (only with a visible FAQ that uses the same words):

```json
{
  "@type": "FAQPage",
  "@id": "https://product.example/#faq",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is Product?",
      "acceptedAnswer": { "@type": "Answer", "text": "Product is ..." }
    }
  ]
}
```
