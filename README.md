# Agentic Thinking Site

## Running Locally

**Prerequisites:** Node.js 24+

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Start the dev server:
   ```bash
   yarn dev
   ```

3. Open [http://localhost:4321/agentic-thinking-site/](http://localhost:4321/agentic-thinking-site/) in your browser.

## Other Commands

| Command | Description |
|---------|-------------|
| `yarn build` | Build the site to `dist/` |
| `yarn preview` | Preview the production build locally |
# GitHub Pages Setup

This site is configured to deploy to GitHub Pages at `https://mikecarlo.github.io/agentic-thinking-site`.

## Prerequisites

- GitHub account with an existing repository
- Repository should be named `agentic-thinking-site` (or update the `base` path in `astro.config.mjs`)
- Local repository cloned and ready for changes

## Deployment Steps - how to deploy to GitHub Pages

1. **Build the site:**
   ```bash
   yarn build
   ```
   This generates the production build in the `dist/` directory.

2. **Create a GitHub Actions workflow (preferred option):**
   
   Create `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy to GitHub Pages

   on:
     push:
       branches: [ main ]
     workflow_dispatch:

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         
         - name: Install Node.js
           uses: actions/setup-node@v4
           with:
             node-version: '24'
         
         - name: Install dependencies
           run: yarn install
         
         - name: Build
           run: yarn build
         
         - name: Deploy to GitHub Pages
           uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

3. **Configure GitHub Pages:**
   - Go to repository **Settings** → **Pages**
   - Under "Build and deployment":
     - Set **Source** to "GitHub Actions"
     - Or set **Source** to "Deploy from a branch" with `gh-pages` branch if deploying manually

4. **Manual deployment (if not using GitHub Actions - not preferred):**
   ```bash
   yarn build
   git add dist/
   git commit -m "Deploy to GitHub Pages"
   git push origin main
   ```
   Then configure the repository to deploy from the `dist/` directory.

5. **Visit your site:**
   After deployment, access it at `https://mikecarlo.github.io/agentic-thinking-site/`

## Configuration

The site base path is set in `astro.config.mjs`. Update these if needed:
- `site`: Full domain URL
- `base`: Repository path (must start with `/`)

---

# Tech Stack

| Technology | Where Used | Why |
|---|---|---|
| [Astro](https://astro.build) | Core framework (`astro.config.mjs`, all `src/` files) | Static site generator with first-class MDX and content collections support; outputs zero-JS by default for fast page loads |
| [MDX](https://mdxjs.com) | All blog posts in `src/content/blog/` | Extends Markdown with JSX component embedding; allows rich content while keeping posts as readable text files |
| [Tailwind CSS v4](https://tailwindcss.com) | All `.astro` layout and component files | Utility-first CSS; no separate CSS files to manage per component; v4 uses the Vite plugin instead of PostCSS |
| [@tailwindcss/vite](https://tailwindcss.com/docs/installation/using-vite) | `astro.config.mjs` Vite plugins | Wires Tailwind v4 into Astro's Vite build pipeline |
| [@astrojs/mdx](https://docs.astro.build/en/guides/integrations-guide/mdx/) | `astro.config.mjs` integrations | Astro integration that processes `.mdx` files through the content collections system |
| [@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/) | `astro.config.mjs` integrations | Auto-generates `sitemap.xml` on build for SEO |
| [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/) | `src/content.config.ts`, `src/pages/[...slug].astro` | Type-safe schema validation for post frontmatter; enables querying posts in pages |
| [Yarn](https://yarnpkg.com) | Package management (`package.json`) | Dependency installation and script runner |
| [GitHub Actions](https://github.com/features/actions) | `.github/workflows/deploy.yml` | CI/CD pipeline that builds and deploys the site to GitHub Pages on push to `main` |
| [GitHub Pages](https://pages.github.com) | Hosting | Free static site hosting directly from the repository |
| [TypeScript](https://www.typescriptlang.org) | `src/content.config.ts`, layout `Props` interfaces, `tsconfig.json` | Type safety in Astro components and content schema definitions |

---

# Writing Blog Posts

## File & Folder Structure

Each post lives in its own folder under `src/content/blog/YYYY/MM/DD/post-slug/`:

```
src/content/blog/
└── 2025/
    └── 05/
        └── 06/
            └── my-post-title/
                └── index.mdx
```

- **Year folder** (`YYYY/`) — organizes posts by publish year
- **Month folder** (`MM/`) — two-digit month (e.g. `05` for May)
- **Day folder** (`DD/`) — two-digit day (e.g. `06`)
- **Post slug folder** (`my-post-title/`) — becomes the URL path segment; use lowercase kebab-case
- **`index.mdx`** — the post content file

The resulting URL will be: `/agentic-thinking-site/blog/2025/05/06/my-post-title/`

### Frontmatter Schema

Every post **must** begin with a YAML frontmatter block. All fields below are validated by `src/content.config.ts`:

```yaml
---
title: "Your Post Title Here"          # required — displayed in the page <title> and header
date: 2025-06-15                        # required — ISO 8601 date (YYYY-MM-DD)
author: "Your Name"                     # optional — defaults to "Agentic Thinking"
tags: ["agents", "AI", "tooling"]       # optional — array of strings; used for tag pages and filtering
excerpt: "A short one or two sentence summary of the post."  # optional — shown in post header and as meta description
featuredImage: ./cover.png             # optional — relative path to an image in the same folder
---
```

**Rules:**
- `title` and `date` are **required**; the build will fail without them
- `tags` should be lowercase where possible (e.g. `"AI"` is fine, avoid mixed casing for the same concept across posts)
- `excerpt` should be 1–2 sentences; it is used as the HTML meta description and post card subtitle
- `featuredImage` must be a relative path (e.g. `./cover.png`) so Astro can optimize it at build time

## Post Content Standards

- Write content in standard Markdown below the frontmatter block
- Use `##` (`h2`) as the top-level heading inside posts — the post `title` from frontmatter renders as the `h1`
- Use fenced code blocks with a language identifier for all code samples:
  ````md
  ```python
  def my_function():
      pass
  ```
  ````
- Prefer short paragraphs and section headings to break up long content
- Link to other posts using root-relative paths: `/agentic-thinking-site/blog/2025/05/06/other-post/`

## Example Post

```mdx
---
title: "Understanding Tool Use in AI Agents"
date: 2025-06-15
author: "Mike Carlo"
tags: ["agents", "tool-use", "LLM"]
excerpt: "A practical look at how AI agents invoke external tools and why structured output is key."
---

## What Is Tool Use?

Tool use allows an LLM to call external functions — APIs, file systems, databases — to retrieve information or take action.

## How It Works

...
```

## Creating a New Post (Step by Step)

1. Create a folder: `src/content/blog/YYYY/MM/DD/your-post-slug/`
2. Create `index.mdx` inside that folder
3. Add the frontmatter block with at minimum `title` and `date`
4. Write the post body in Markdown below the frontmatter
5. Run `yarn dev` to preview locally at `http://localhost:4321/agentic-thinking-site/`
6. Commit and push — GitHub Actions will build and deploy automatically