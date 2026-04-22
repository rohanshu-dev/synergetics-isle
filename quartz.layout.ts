import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

const explorerConfig = {
  // Hide from explorer
  filterFn: (node: any) => {
    const hidden = new Set(["systems", "synergetics-ai", "systems-stack"]);
    const slug = node.data?.slug ?? "";
    const name = (node.path || node.displayName || "").toLowerCase();
    return !hidden.has(slug) && !hidden.has(name);
  },
  sortFn: (a: any, b: any) => {
    const order: Record<string, number> = {
      "Copyright": 1,
      "Dedication": 2,
      "Acknowledgment": 3,
      "Table of Contents": 4,
      "A Note on Collaboration": 5,
      "Preface": 6,
      "Moral of the Work": 7,
      "Author's Note on the Rationale for Repetition in This Work": 8,
      "Explicit - A note to the reader": 9,
      "Introduction - The Wellspring of Reality": 10,
      "Humans In Universe": 11,
      "Scenarios": 12,
      "100.00 Synergy": 13,
      "200.00 Synergetics": 14,
      "300.00 Universe": 15,
      "400.00 System": 16,
      "500.00 Conceptuality": 17,
      "600.00 Structure": 18,
      "700.00 Tensegrity": 19,
      "800.00 Operational Mathematics": 20,
      "900.00 Modelability": 21,
      "1000.00 Omnitopology": 22,
      "1100.00 Constant Zenith Projection": 23,
      "1200.00 Numerology": 24,
      "Afterpiece": 25,
      "32 Color Plates": 26,
      "Evolution of Synergetics": 27,
      "Book Index": 28,
      "Extras": 99,
    }
    const aOrder = order[a.displayName] ?? 98
    const bOrder = order[b.displayName] ?? 98
    return aOrder - bOrder
  },
}

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [
    Component.ConditionalRender({
      component: Component.SynergeticsAI(),
      condition: (page) => page.fileData.slug === "synergetics-ai",
    }),
  ],
  footer: Component.Footer({
    links: {
      GitHub: "",
      "Discord Community": "",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
    //Component.SystemsDashboard(),
    Component.ConditionalRender({
      component: Component.SystemsDashboard(),
      condition: (page) => page.fileData.slug === "systems-stack",
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
        { Component: Component.AIButton() },
      ],
    }),
    Component.Explorer(explorerConfig),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [Component.Breadcrumbs(), Component.ArticleTitle(), Component.ContentMeta()],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        { Component: Component.ReaderMode() },
        { Component: Component.AIButton() },
      ],
    }),
    Component.Explorer(explorerConfig),
  ],
  right: [],
}
