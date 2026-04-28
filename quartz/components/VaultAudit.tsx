// quartz/components/VaultAudit.tsx
import vaultAudit from "../../quartz/static/data/vault-audit.json"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface AuditEntry { [key: string]: number }
interface AuditData {
  generated: string
  vault: AuditEntry
  groups: Record<string, AuditEntry>
  entries: Record<string, AuditEntry>
}

const data = vaultAudit as AuditData

const VaultAudit: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  if (fileData.slug !== "synergetics-verification") return <></>

  const properties = Object.entries(data.vault)
    .map(([name, value]) => ({ name, pct: Math.round(value) }))
    .sort((a, b) => b.pct - a.pct)

  const vaultAvg = properties.length === 0 ? 0 : properties.reduce((sum, p) => sum + p.pct, 0) / properties.length
  const vaultPct = Math.round(vaultAvg)

  const getStatusColor = (pct: number) => {
    if (pct >= 90) return "var(--secondary)"
    if (pct >= 50) return "var(--tertiary)"
    return "var(--gray)"
  }

  return (
    <div class="audit-container">
      <style>{`
        .audit-container {
          margin: 2rem 0;
          padding: 1.5rem;
          border: 1px solid var(--lightgray);
          border-radius: 8px;
          background-color: var(--light);
        }

        .audit-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .audit-title-group h3 {
          margin: 0;
          font-size: 1.2rem;
        }

        .audit-meta {
          font-size: 0.75rem;
          color: var(--gray);
          font-family: var(--codeFont);
        }

        .audit-badge {
          padding: 0.4rem 0.8rem;
          border-radius: 6px;
          background: var(--highlight);
          color: var(--secondary);
          font-weight: 700;
          font-family: var(--codeFont);
        }

        .audit-grid {
          display: grid;
          gap: 1.2rem;
        }

        .audit-item {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .audit-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          font-family: var(--codeFont);
        }

        .audit-name { color: var(--dark); font-weight: 500; }
        .audit-value { color: var(--gray); }

        .progress-track {
          height: 6px;
          width: 100%;
          background: var(--lightgray);
          border-radius: 10px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          border-radius: 10px;
          transition: width 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>

      <div class="audit-header">
        <div class="audit-title-group">
          <h3>Vault Integrity</h3>
          <span class="audit-meta">Analyzed on {data.generated}</span>
        </div>
        <div class="audit-badge">{vaultPct}% Complete</div>
      </div>

      <div class="audit-grid">
        {properties.map(({ name, pct }) => (
          <div class="audit-item" key={name}>
            <div class="audit-label-row">
              <span class="audit-name">{name}</span>
              <span class="audit-value">{pct}%</span>
            </div>
            <div class="progress-track">
              <div 
                class="progress-fill" 
                style={{ 
                  width: `${pct}%`, 
                  backgroundColor: getStatusColor(pct) 
                }} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default (() => VaultAudit) satisfies QuartzComponentConstructor