import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"

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
        { Component: Component.AIButton() },
        { Component: Component.Darkmode() },
        //{ Component: Component.ReaderMode() },
      ],
    }),
Component.Explorer({
  filterFn: (node) => !(node as any).data?.tags?.includes("unlisted"),
}),
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
      ],
    }),
Component.Explorer({
  filterFn: (node) => !(node as any).data?.tags?.includes("unlisted"),
}),
  ],
  right: [],
}
