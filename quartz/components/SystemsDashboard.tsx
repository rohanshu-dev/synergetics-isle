// quartz/components/SystemsDashboard.tsx

import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { QuartzPluginData } from "../plugins/vfile"

// ── Types ─────────────────────────────────────────────────────────────────────

type BaseStatus = "active" | "wip" | "down"
type RolledStatus = "active" | "wip" | "degraded" | "down"

interface SystemNode {
  url: string
  slug: string
  name: string
  ownStatus: BaseStatus
  critical: boolean
  retired: boolean
  attestation: string
  pingUrl: string
  childNames: string[]
  children: SystemNode[]
}


// ── Helpers ───────────────────────────────────────────────────────────────────

const parseWikilinks = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (typeof item !== "string") return null
      const match = item.match(/\[\[(.+?)\]\]/)
      return match ? match[1].trim() : item.trim()
    })
    .filter((x): x is string => Boolean(x))
}

const slugToName = (slug: string): string =>
  slug.split("/").pop()?.replace(/-/g, " ") ?? slug

const getDaysSince = (dateStr: string): number => {
  if (!dateStr) return 999
  const [y, m, d] = dateStr.split("-").map(Number)
  const local = new Date(y, m - 1, d)
  return Math.floor((Date.now() - local.getTime()) / 86_400_000)
}

const relativeDate = (dateStr: string): string => {
  if (!dateStr) return "Never reviewed"
  const days = getDaysSince(dateStr)
  if (days === 0) return "Reviewed today"
  if (days === 1) return "Reviewed yesterday"
  if (days < 7) return `Reviewed ${days}d ago`
  if (days < 30) return `Reviewed ${Math.floor(days / 7)}w ago`
  if (days < 365) return `Reviewed ${Math.floor(days / 30)}mo ago`
  return `Reviewed ${Math.floor(days / 365)}y ago`
}

const getAttestColorClass = (dateStr: string): string => {
  if (!dateStr) return "si-attest-old"
  const days = getDaysSince(dateStr)
  if (days <= 14) return "si-attest-fresh"
  if (days <= 60) return "si-attest-stale"
  return "si-attest-old"
}

const getDomain = (url: string): string => {
  if (!url || typeof url !== "string") return ""
  try { return new URL(url).hostname.replace(/^www\./, "") } catch { return "" }
}

const formatPingId = (slug: string, pingUrl: string): string | null =>
  pingUrl ? slug.replace("systems/", "").replace(/\s+/g, "-").toLowerCase() : null

// ── Parsers ───────────────────────────────────────────────────────────────────

const parseStatus = (raw: unknown): BaseStatus => {
  const vals = Array.isArray(raw) ? raw : [raw]
  if (vals.includes("defunct") || vals.includes("down")) return "down"
  if (vals.includes("wip")) return "wip"
  return "active"
}

const parseRetired = (raw: unknown): boolean => {
  if (raw === true || raw === "true") return true
  if (Array.isArray(raw)) {
    const strArr = raw.map(String).map(s => s.toLowerCase())
    if (strArr.includes("true") || strArr.includes("retired")) return true
  }
  if (typeof raw === "string" && raw.toLowerCase() === "retired") return true
  return false
}

const parseCritical = (raw: unknown): boolean => {
  if (raw === true || raw === "true") return true
  if (Array.isArray(raw)) {
    const arr = raw.map(String).map(s => s.toLowerCase())
    if (arr.includes("true") || arr.includes("critical")) return true
  }
  if (typeof raw === "string") {
    const lower = raw.toLowerCase()
    if (lower === "true" || lower === "critical") return true
  }
  return false
}

// ── Graph Logic ───────────────────────────────────────────────────────────────



const buildTree = (allFiles: QuartzPluginData[]): SystemNode[] => {
  const sysFiles = allFiles.filter((f) => {
    const parts = (f.slug ?? "").split("/")
    return parts.length === 2 && parts[0] === "systems" && parts[1] !== "index"
  })

  // 1. Build map of ALL nodes (including retired, but mark retired flag)
  const byName = new Map<string, SystemNode & { retired: boolean }>()

  for (const f of sysFiles) {
    const fm = (f.frontmatter ?? {}) as Record<string, unknown>
    const retired = parseRetired(fm.retired) || parseRetired(fm.lifecycle)
    const name = (fm.title as string | undefined) ?? slugToName(f.slug ?? "")

    byName.set(name.toLowerCase(), {
      slug: f.slug ?? "",
      name,
      ownStatus: parseStatus(fm.status),
      retired,
      critical: parseCritical(fm.critical),
      attestation: (fm.attestation as string | undefined) ?? "",
      pingUrl: (fm.ping_url as string | undefined) ?? "",
      url: (fm.url as string | undefined) ?? "",
      childNames: parseWikilinks(fm.children),
      children: [],
    })
  }

  // 2. Link children (ignoring retired children? no, link everything for now)
  for (const node of byName.values()) {
    for (const childName of node.childNames) {
      const child = byName.get(childName.toLowerCase())
      if (child) node.children.push(child)
    }
  }

  // 3. Prune any node that is retired or has a retired ancestor
  const isOrHasRetiredAncestor = (node: SystemNode & { retired: boolean }, ancestors: Set<SystemNode> = new Set()): boolean => {
    if (node.retired) return true
    for (const ancestor of ancestors) {
      if (ancestor.retired) return true
    }
    // Check ancestors recursively? Actually we pass the ancestor set down.
    // Simpler: mark all nodes that are descendants of any retired node.
    // We'll do a separate DFS.
    return false
  }

  // Better: mark all nodes that are reachable from any retired node
  const retiredRoots = [...byName.values()].filter(n => n.retired)
  const descendantsOfRetired = new Set<SystemNode>()
  const dfsMark = (node: SystemNode) => {
    if (descendantsOfRetired.has(node)) return
    descendantsOfRetired.add(node)
    for (const child of node.children) {
      dfsMark(child)
    }
  }
  for (const retiredNode of retiredRoots) {
    dfsMark(retiredNode)
  }

  // Remove retired nodes and descendants of retired nodes
  const validNodes = [...byName.values()].filter(n => !n.retired && !descendantsOfRetired.has(n))

  // 4. Rebuild the tree with only valid nodes, but keep child links only to valid nodes
  const validMap = new Map(validNodes.map(n => [n.name.toLowerCase(), n]))
  for (const node of validNodes) {
    node.children = node.childNames
      .map(cn => validMap.get(cn.toLowerCase()))
      .filter((c): c is SystemNode => c !== undefined)
  }

  // 5. Find roots (nodes that are not a child of any valid node)
  const allChildNames = new Set<string>()
  for (const node of validNodes) {
    for (const child of node.children) {
      allChildNames.add(child.name.toLowerCase())
    }
  }

  return validNodes.filter(n => !allChildNames.has(n.name.toLowerCase()))
}

// Core status propagation helpers
const hasCriticalDownInSubtree = (node: SystemNode): boolean => {
  for (const child of node.children) {
    if (child.ownStatus === "down" && child.critical) return true
    if (hasCriticalDownInSubtree(child)) return true
  }
  return false
}

const hasNonCriticalDownInSubtree = (node: SystemNode): boolean => {
  for (const child of node.children) {
    if (child.ownStatus === "down" && !child.critical) return true
    if (hasNonCriticalDownInSubtree(child)) return true
  }
  return false
}

const hasWipInSubtree = (node: SystemNode): boolean => {
  for (const child of node.children) {
    if (child.ownStatus === "wip") return true
    if (hasWipInSubtree(child)) return true
  }
  return false
}

const getRolledStatus = (node: SystemNode): RolledStatus => {
  // Own status overrides everything
  if (node.ownStatus === "down") return "down"
  if (node.ownStatus === "wip") return "wip"

  // Check subtree
  if (hasCriticalDownInSubtree(node)) return "down"
  if (hasNonCriticalDownInSubtree(node)) return "degraded"
  if (hasWipInSubtree(node)) return "wip"
  return "active"
}

const getPanelAccentColor = (status: RolledStatus): string => ({
  active: "#22c55e",
  wip: "#eab308",
  degraded: "#f97316",
  down: "#ef4444",
}[status])

// ── JSX Components ───────────────────────────────────────────────────────────

const Favicon = ({ url }: { url: string }) => {
  const d = getDomain(url)
  if (!d) {
    return (
      <div class="si-fav si-fav-placeholder" aria-hidden="true">
        <span />
      </div>
    )
  }
  return (
    <img
      class="si-fav"
      src={`https://icon.horse/icon/${d}`}
      data-domain={d}
      alt=""
      width="14"
      height="14"
    />
  )
}

const Badge = ({ own, rolled, isInherited }: { own: BaseStatus; rolled: RolledStatus; isInherited: boolean }) => {
  let displayStatus: "wip" | "down" | "degraded" | null = null

  // Direct badge (own status)
  if (own === "wip") displayStatus = "wip"
  else if (own === "down") displayStatus = "down"
  // Inherited badges (rolled status when own is active)
  else if (own === "active") {
    if (rolled === "wip") displayStatus = "wip"
    else if (rolled === "down") displayStatus = "down"
    else if (rolled === "degraded") displayStatus = "degraded"
  }

  if (!displayStatus) return null

  const labels: Record<string, string> = { wip: "WIP", down: "Down", degraded: "Degraded" }
  const label = labels[displayStatus]

  // For degraded, we need to add CSS classes
  if (displayStatus === "degraded") {
    return (
      <div class={`si-badge si-badge-${isInherited ? 'inherited' : 'direct'} si-badge-degraded`}>
        <span class={`si-badge-${isInherited ? 'dot-hollow' : 'dot'}`} />
        {label}
      </div>
    )
  }

  return (
    <div class={`si-badge si-badge-${isInherited ? 'inherited' : 'direct'} si-badge-${displayStatus}`}>
      <span class={`si-badge-${isInherited ? 'dot-hollow' : 'dot'}`} />
      {label}
    </div>
  )
}

const Chevron = ({ status }: { status: RolledStatus }) => {
  return (
    <svg class={`si-chevron si-chev-${status}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

const TreeNode = ({ node, depth = 0, defaultDepth = 2 }: {
  node: SystemNode;
  depth?: number;
  defaultDepth?: number;
}) => {
  const rolled = getRolledStatus(node)
  const pingId = formatPingId(node.slug, node.pingUrl)
  const hasChildren = node.children.length > 0
  const hasValidDomain = getDomain(node.url) !== ""
  const showFavicon = !hasChildren || hasValidDomain
  const shouldOpen = depth < defaultDepth
  const isInherited = node.ownStatus === "active"

  const RowContent = (
    <div class="si-item-row">
      <div class="si-item-left">
        {hasChildren ? (
          <Chevron status={rolled} />
        ) : (
          <span class="si-chevron-spacer" />
        )}
        {showFavicon && <Favicon url={node.url} />}
        <span class="si-iname" title={node.name}>{node.name}</span>
      </div>
      <div class="si-item-right">
        <Badge own={node.ownStatus} rolled={rolled} isInherited={isInherited} />
        {pingId && (
          <div class="si-ping-wrap" title={`Live check: ${node.pingUrl}`}>
            <span class="si-pdot" id={`si-pdot-${pingId}`} data-ping-url={node.pingUrl} />
          </div>
        )}
      </div>
    </div>
  )

  if (!hasChildren) return RowContent

  return (
    <details class="si-node-details" open={shouldOpen}>
      <summary class="si-node-summary">{RowContent}</summary>
      <div class="si-node-children">
        {node.children.map(child => (
          <TreeNode key={child.slug} node={child} depth={depth + 1} defaultDepth={defaultDepth} />
        ))}
      </div>
    </details>
  )
}

const Panel = ({ root }: { root: SystemNode }) => {
  const rolled = getRolledStatus(root)
  const accent = getPanelAccentColor(rolled)
  const attestColor = getAttestColorClass(root.attestation)
  const relTime = relativeDate(root.attestation)

  return (
    <div class={`si-panel si-panel-status-${rolled}`} style={`border-left-color: ${accent}`} data-si-panel>
      <div class="si-panel-header">
        <div class="si-panel-title-group">
          <div class="si-panel-title-row">
            {root.url && <Favicon url={root.url} />}
            <span class="si-panel-name">{root.name}</span>
          </div>
          <span class={`si-attest ${attestColor}`}>{relTime}</span>
        </div>
      </div>
      {root.children.length > 0 && (
        <div class="si-panel-body">
          {root.children.map(child => (
            <TreeNode key={child.slug} node={child} depth={1} defaultDepth={2} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

const SystemsDashboard: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  if (fileData.slug !== "systems-stack") return null

  const roots = buildTree(allFiles)
  const severityOf = (n: SystemNode) => {
    const s = getRolledStatus(n)
    return { down: 0, degraded: 1, wip: 2, active: 3 }[s]
  }
  roots.sort((a, b) => severityOf(a) - severityOf(b))

  const counts = { active: 0, wip: 0, degraded: 0, down: 0 }
  for (const r of roots) {
    counts[getRolledStatus(r)]++
  }

  return (
    <div class="si-root">
      <div class="si-summary-card">
        <div class="si-summary-col">
          <div class="si-summary-badge si-summary-active-badge">
            <span class="si-summary-dot si-summary-dot-active"></span>
            <span class="si-summary-count">{counts.active}</span>
            <span class="si-summary-label">Active</span>
          </div>
        </div>
        <div class="si-summary-divider"></div>
        <div class="si-summary-col">
          {counts.wip > 0 ? (
            <div class="si-badge si-badge-direct si-badge-wip si-summary-badge">
              <span class="si-badge-dot"></span>
              <span class="si-summary-count">{counts.wip}</span>
              <span>WIP</span>
            </div>
          ) : (
            <div class="si-summary-badge si-summary-zero-badge">
              <span class="si-summary-count">0</span>
              <span class="si-summary-label">WIP</span>
            </div>
          )}
        </div>
        <div class="si-summary-divider"></div>
        <div class="si-summary-col">
          {counts.degraded > 0 ? (
            <div class="si-summary-badge si-summary-degraded-badge">
              <span class="si-summary-dot si-summary-dot-degraded"></span>
              <span class="si-summary-count">{counts.degraded}</span>
              <span class="si-summary-label">Degraded</span>
            </div>
          ) : (
            <div class="si-summary-badge si-summary-zero-badge">
              <span class="si-summary-count">0</span>
              <span class="si-summary-label">Degraded</span>
            </div>
          )}
        </div>
        <div class="si-summary-divider"></div>
        <div class="si-summary-col">
          {counts.down > 0 ? (
            <div class="si-badge si-badge-direct si-badge-down si-summary-badge">
              <span class="si-badge-dot"></span>
              <span class="si-summary-count">{counts.down}</span>
              <span>Down</span>
            </div>
          ) : (
            <div class="si-summary-badge si-summary-zero-badge">
              <span class="si-summary-count">0</span>
              <span class="si-summary-label">Down</span>
            </div>
          )}
        </div>
      </div>

      <div class="si-grid" id="si-masonry">
        {roots.map((root) => <Panel key={root.slug} root={root} />)}
      </div>
    </div>
  )
}



// ── CSS ───────────────────────────────────────────────────────────────────────

SystemsDashboard.css = `

.si-root * {
  box-sizing: border-box;
}

.si-root { margin: 0; padding: 0; }

.si-panel-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.si-panel-name {
  font-family: var(--bodyFont);
  font-size: 12px;
  font-weight: 600;
  color: var(--dark);
  line-height: 1.2;
}

.si-summary-card {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  align-items: center;
  background: var(--light);
  border: 1px solid var(--lightgray);
  border-radius: var(--radius-md, 6px);
  padding: 8px 12px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.si-summary-col {
  display: flex;
  justify-content: center;
  align-items: center;
}
.si-summary-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--bodyFont);
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
}
.si-summary-active-badge {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}
.si-summary-degraded-badge {
  background: rgba(249, 115, 22, 0.1);
  color: #ea580c;
}
/* Summary card dot */
.si-summary-dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  display: inline-block;
  overflow: hidden;
  line-height: 0;
}
.si-summary-dot-active {
  background: #22c55e;
}
.si-summary-dot-degraded {
  background: #f97316;
}
.si-summary-zero-badge {
  background: var(--lightgray);
  color: var(--gray);
  opacity: 0.7;
}
.si-summary-count {
  font-weight: 700;
  font-size: 12px;
}
.si-summary-label {
  font-weight: 700;
}
.si-summary-divider {
  width: 1px;
  height: 24px;
  background: var(--lightgray);
}
.si-summary-card .si-badge {
  padding: 2px 8px;
  gap: 6px;
  font-size: 11px;
}
@media (max-width: 480px) {
  .si-summary-card {
    grid-template-columns: 1fr;
    gap: 6px;
    padding: 10px;
  }
  .si-summary-divider {
    display: none;
  }
  .si-summary-col {
    justify-content: space-between;
  }
  .si-summary-badge {
    width: 100%;
    justify-content: center;
  }
}

.si-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  box-sizing: border-box;
}
.si-grid.si-masonry-ready {
  flex-direction: row;
  align-items: flex-start;
}
.si-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 1 0;
  min-width: 0;
  width: 0;
}

.si-panel {
  background: var(--light);
  border: 1px solid var(--lightgray);
  border-left: 3px solid #22c55e;
  border-radius: var(--radius-md, 5px);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  width: 100%;
  transition: background 0.2s ease;
}
.si-panel-status-active {
  background-color: rgba(34, 197, 94, 0.04);
}
.si-panel-status-wip {
  background-color: rgba(234, 179, 8, 0.04);
}
.si-panel-status-degraded {
  background-color: rgba(249, 115, 22, 0.04);
}
.si-panel-status-down {
  background-color: rgba(239, 68, 68, 0.04);
}
.dark .si-panel-status-active {
  background-color: rgba(34, 197, 94, 0.08);
}
.dark .si-panel-status-wip {
  background-color: rgba(234, 179, 8, 0.08);
}
.dark .si-panel-status-degraded {
  background-color: rgba(249, 115, 22, 0.08);
}
.dark .si-panel-status-down {
  background-color: rgba(239, 68, 68, 0.08);
}

.si-panel-header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 8px 12px 8px 11px;
  border-bottom: 1px solid var(--lightgray);
  background: rgba(0,0,0,0.012);
}
.si-panel-title-group { display: flex; flex-direction: column; gap: 4px; }
.si-panel-name {
  font-family: var(--bodyFont); font-size: 12px; font-weight: 600;
  color: var(--dark); line-height: 1.2;
}
.si-attest { font-family: var(--bodyFont); font-size: 10px; font-weight: 500; line-height: 1; }
.si-attest-fresh { color: #16a34a; }
.si-attest-stale { color: #ca8a04; }
.si-attest-old   { color: #dc2626; }

.si-panel-body { display: flex; flex-direction: column; padding: 4px 8px 6px; }

.si-node-details > summary { list-style: none; cursor: pointer; }
.si-node-details > summary::-webkit-details-marker { display: none; }

.si-item-row {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 3px 4px; min-height: 32px;
  border-radius: var(--radius-sm, 3px);
  transition: background 0.1s ease;
}

.si-node-summary:hover .si-item-row { background: rgba(0,0,0,0.035); }

.si-node-children {
  margin-left: 8px; padding-left: 6px;
  border-left: 1.5px solid var(--lightgray);
}

.si-item-left { display: flex; align-items: center; gap: 6px; min-width: 0; }

.si-fav {
  width: 14px; height: 14px; flex-shrink: 0;
  border-radius: var(--radius-sm, 3px);
  object-fit: contain;
}
.si-fav-placeholder {
  display: inline-flex; align-items: center; justify-content: center;
  opacity: 0.3;
}
/* Favicon placeholder dot */
.si-fav-placeholder span {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: currentColor;
  display: inline-block;
  overflow: hidden;
  line-height: 0;
}

.si-chevron {
  width: 10px; height: 10px; color: var(--gray);
  transition: transform 0.15s ease, color 0.15s ease; flex-shrink: 0;
}
.si-chev-down { color: #ef4444; }
.si-chev-degraded { color: #f97316; }
.si-chev-wip  { color: #eab308; }
.si-node-details[open] > summary .si-chevron { transform: rotate(90deg); }
.si-chevron-spacer { width: 10px; flex-shrink: 0; }


.si-iname {
  font-size: 12px; font-family: var(--bodyFont); color: var(--darkgray);
  word-break: break-word; overflow-wrap: anywhere; min-width: 0;
  line-height: 1.3;
}
  

.si-item-right { display: flex; flex-shrink: 0; align-items: center; gap: 6px; }

.si-ping-wrap { display: flex; align-items: center; justify-content: center; width: 12px; height: 12px; }
.si-pdot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  background: transparent; cursor: default;
  transition: background 0.3s ease, opacity 0.3s ease;
}
.si-pdot.si-live     { background: #22c55e; }
.si-pdot.si-down     { background: #ef4444; box-shadow: 0 0 5px rgba(239,68,68,0.5); }
.si-pdot.si-cached   { background: #22c55e; opacity: 0.5; }
.si-pdot.si-checking { background: #eab308; animation: si-pulse 1.618s ease-in-out infinite; }

.si-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-family: var(--bodyFont); font-size: 10px; font-weight: 600;
  padding: 1px 5px; border-radius: 12px; letter-spacing: 0.04em; text-transform: uppercase;
  white-space: nowrap;
}

.si-badge-direct { border: 1px solid transparent; }
/* Solid badge dot */
.si-badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 9999px;   /* instead of 50% */
  flex-shrink: 0;
  display: inline-block;
  background: currentColor; /* fallback, but each variant sets its own */
  overflow: hidden;
  line-height: 0;
}
.si-badge-direct.si-badge-wip  { background: rgba(234,179,8,0.12);  color: #ca8a04; }
.si-badge-direct.si-badge-wip .si-badge-dot  { background: #eab308; }
.si-badge-direct.si-badge-down { background: rgba(239,68,68,0.12);  color: #dc2626; }
.si-badge-direct.si-badge-down .si-badge-dot { background: #ef4444; }

.si-badge-inherited { background: transparent; }
/* Hollow badge dot */
.si-badge-dot-hollow {
  width: 5px;
  height: 5px;
  border-radius: 9999px;
  flex-shrink: 0;
  background: transparent;
  display: inline-block;
  box-sizing: border-box;
  overflow: hidden;
  line-height: 0;
}
.si-badge-inherited.si-badge-wip { border: 1px solid rgba(234,179,8,0.4); color: #ca8a04; }
.si-badge-inherited.si-badge-wip .si-badge-dot-hollow { border: 1px solid #ca8a04; }
.si-badge-inherited.si-badge-down { border: 1px solid rgba(239,68,68,0.4); color: #dc2626; }
.si-badge-inherited.si-badge-down .si-badge-dot-hollow { border: 1px solid #ef4444; }

.si-node-details[open] > .si-node-summary .si-badge-inherited { display: none; }

@keyframes si-pulse { 0%, 100% { opacity: 1; } 61.8% { opacity: 0.2; } }

/* Degraded badge styles */
.si-badge-direct.si-badge-degraded {
  background: rgba(249, 115, 22, 0.12);
  color: #ea580c;
}
.si-badge-direct.si-badge-degraded .si-badge-dot {
  background: #f97316;
}
.si-badge-inherited.si-badge-degraded {
  background: transparent;
  border: 1px solid rgba(249, 115, 22, 0.4);
  color: #ea580c;
}
.si-badge-inherited.si-badge-degraded .si-badge-dot-hollow {
  border: 1px solid #f97316;
}
  
.si-fav {
  margin: 0;
  padding: 0;
}

`

// ── Runtime ───────────────────────────────────────────────────────────────────

SystemsDashboard.afterDOMLoaded = `
(function () {
  var STORAGE_KEY = 'si_ping_cache';
  var masonryTimer = null;
  var isMasonryRunning = false;

  function loadCache() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  }
  function saveCache(cache) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cache)); } catch {}
  }
  async function checkUrl(url) {
    try {
      await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(7000) });
      return true;
    } catch { return false; }
  }

  function runMasonry() {
    if (isMasonryRunning) return;
    var container = document.getElementById('si-masonry');
    if (!container) return;
    var panels = Array.from(container.querySelectorAll('[data-si-panel]'));
    if (panels.length === 0) return;

    isMasonryRunning = true;
    container.querySelectorAll('.si-col').forEach(function (c) { c.remove(); });
    container.classList.add('si-masonry-ready');

    var numCols = container.offsetWidth < 480 ? 1 : 2;
    var cols = [];
    for (var i = 0; i < numCols; i++) {
      var col = document.createElement('div');
      col.className = 'si-col';
      container.appendChild(col);
      cols.push({ el: col, height: 0 });
    }

    panels.forEach(function (panel) {
      var shortest = cols.reduce(function (a, b) { return a.height <= b.height ? a : b; });
      shortest.el.appendChild(panel);
      shortest.height += panel.offsetHeight + 10;
    });

    isMasonryRunning = false;
  }

  function debouncedMasonry() {
    if (masonryTimer) clearTimeout(masonryTimer);
    masonryTimer = setTimeout(runMasonry, 80);
  }

  function initDashboard() {
    if (!document.querySelector('.si-root')) return;

    document.querySelectorAll('img.si-fav').forEach(function (img) {
      img.addEventListener('error', function handler() {
        img.removeEventListener('error', handler);
        var domain = img.dataset.domain;
        if (!domain) { img.style.display = 'none'; return; }
        img.src = 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=32';
        img.addEventListener('error', function () { img.style.display = 'none'; });
      });
    });

    runMasonry();
    window.addEventListener('resize', debouncedMasonry);

    var cache = loadCache();
    document.querySelectorAll('[id^="si-pdot-"]').forEach(async function (el) {
      var url = el.dataset.pingUrl;
      var id = el.id;
      if (!url) { el.className = 'si-pdot si-down'; return; }
      if (cache[id] !== undefined) {
        el.className = 'si-pdot ' + (cache[id] ? 'si-cached' : 'si-down');
      }
      var live = await checkUrl(url);
      cache[id] = live;
      saveCache(cache);
      el.className = 'si-pdot si-' + (live ? 'live' : 'down');
    });
  }

  initDashboard();
  document.addEventListener('nav', initDashboard);
})();
`

export default (() => SystemsDashboard) satisfies QuartzComponentConstructor

