import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "synergetics",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: true,
    analytics: {
      provider: "plausible",
    },
    locale: "en-US",
    baseUrl: "quartz.jzhao.xyz",
    ignorePatterns: ["private", "templates", ".obsidian"],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: {
          name: "Literata",
          weights: [100, 200, 300, 400, 500, 600, 700],
        },
        body: "Inter",
        code: "JetBrains Mono",
        title: {
          name: "Ubuntu Sans",
          weights: [100, 200, 300, 400, 500, 600, 700],
        },
      },
      colors: {
        lightMode: {
          light: "#FFF8E7", // Cosmic Latte
          lightgray: "#EBE3D5", // Soft, warm gray for subtle backgrounds/borders
          gray: "#8C847A", // Natural stone gray for meta text
          darkgray: "#4A443F", // Deep bark brown for highly readable body text
          dark: "#2C2825", // Near-black espresso for strong headings
          secondary: "#3A6351", // Synergetic botanical green for links
          tertiary: "#B85C38", // Terracotta clay for hover states/accents
          highlight: "rgba(58, 99, 81, 0.12)", // Soft botanical green highlight
          textHighlight: "#F4D35E88", // Golden ratio yellow
        },
        darkMode: {
          light: "#1A1918", // Deep warm void
          lightgray: "#36312D",
          gray: "#8C847A",
          darkgray: "#D4CFC9", // Soft ash for readable dark mode text
          dark: "#FFF8E7", // Cosmic Latte as the heading text!
          secondary: "#6DA38A", // Lighter sage green for visibility
          tertiary: "#E2B487", // Warm sandstone
          highlight: "rgba(109, 163, 138, 0.15)",
          textHighlight: "#D4A37388",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
      // Comment out CustomOgImages to speed up build time
      Plugin.CustomOgImages(),
    ],
  },
}

export default config