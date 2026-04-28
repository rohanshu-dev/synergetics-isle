/**
 * vault-audit.js
 * 
 * Scans the Quartz content directory, reads YAML frontmatter from every
 * markdown file belonging to a configured group, computes checkbox
 * completion percentages for known boolean properties, and writes a
 * JSON report to static/vault-audit.json.
 * 
 * Dependencies: Node.js built-ins + gray-matter (no other packages).
 * 
 * Usage (add to package.json scripts):
 *   "prebuild": "node scripts/vault-audit.js"
 */

const fs = require('fs');
const path = require('path');
const grayMatter = require('gray-matter');

// ------------------------------------------------------------------
// CONFIGURATION – easily editable
// ------------------------------------------------------------------
const CONFIG = {
  contentDir: "content",
  outputFile: "quartz/static/data/vault-audit.json",
  booleanProps: [
    "m-replication", "m-headings", "m-emDash", "m-italics",
    "m-images", "m-links", "m-equations", "m-links-2",
    "structure", "m-proofread"
  ],
  exclusions: [],
  groups: {
    "Front Matter": [
      "Copyright", "Dedication", "Acknowledgment", "Table of Contents",
      "A Note on Collaboration", "Preface", "Moral of the Work",
      "Author's Note on the Rationale for Repetition in This Work",
      "Explicit - A note to the reader", "Introduction - The Wellspring of Reality",
      "Humans In Universe", "Scenarios"
    ],
    "Main Chapters": [
      "100.00 Synergy", "200.00 Synergetics", "300.00 Universe",
      "400.00 System", "500.00 Conceptuality", "600.00 Structure",
      "700.00 Tensegrity", "800.00 Operational Mathematics",
      "900.00 Modelability", "1000.00 Omnitopology",
      "1100.00 Constant Zenith Projection", "1200.00 Numerology"
    ],
    "Back Matter": [
      "Afterpiece", "32 Color Plates", "Evolution of Synergetics",
      "Book Index", "Extras"
    ]
  }
};

// ------------------------------------------------------------------
// Helper: collect all .md files recursively from a directory
// ------------------------------------------------------------------
function findMarkdownFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ------------------------------------------------------------------
// Helper: scan a single entry (file or directory of .md files)
//         returns { fileCount, trueCounts } or null if nothing found
// ------------------------------------------------------------------
function scanEntry(entryName) {
  const basePath = path.join(CONFIG.contentDir, entryName);
  const filePath = basePath + '.md';
  const dirPath  = basePath;

  let mdFiles = [];

  // Check for a single file first, then a directory.
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    mdFiles = [filePath];
  } else if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    mdFiles = findMarkdownFiles(dirPath);
  }

  // Nothing to scan for this entry
  if (mdFiles.length === 0) {
    return null;
  }

  const trueCounts = {};
  CONFIG.booleanProps.forEach(prop => { trueCounts[prop] = 0; });

  for (const file of mdFiles) {
    let data = {};
    try {
      const parsed = grayMatter.read(file);
      data = parsed.data;               // YAML frontmatter as an object
    } catch (err) {
      console.warn(`  Warning: Could not parse frontmatter in ${file} (${err.message})`);
      continue;
    }

    for (const prop of CONFIG.booleanProps) {
      if (data[prop] === true) {
        trueCounts[prop]++;
      }
    }
  }

  return { fileCount: mdFiles.length, trueCounts };
}

// ------------------------------------------------------------------
// Helper: compute percentages, rounding to one decimal place
// ------------------------------------------------------------------
function computePercentages(trueCounts, fileCount) {
  const percentages = {};
  if (fileCount === 0) {
    CONFIG.booleanProps.forEach(prop => { percentages[prop] = 0; });
  } else {
    CONFIG.booleanProps.forEach(prop => {
      const pct = (trueCounts[prop] / fileCount) * 100;
      percentages[prop] = Math.round(pct * 10) / 10;
    });
  }
  return percentages;
}

// ------------------------------------------------------------------
// Main audit routine
// ------------------------------------------------------------------
function audit() {
  // Global accumulators
  let vaultFileCount = 0;
  const vaultTrueCounts = {};
  CONFIG.booleanProps.forEach(prop => { vaultTrueCounts[prop] = 0; });

  const groupsResult = {};
  const entriesResult = {};

  for (const [groupName, entryNames] of Object.entries(CONFIG.groups)) {
    let groupFileCount = 0;
    const groupTrueCounts = {};
    CONFIG.booleanProps.forEach(prop => { groupTrueCounts[prop] = 0; });

    for (const entryName of entryNames) {
      if (CONFIG.exclusions.includes(entryName)) continue;

      const scan = scanEntry(entryName);
      if (!scan || scan.fileCount === 0) {
        console.warn(`No markdown files found for entry: "${entryName}" – skipping.`);
        continue;
      }

      // Per‑entry percentages
      entriesResult[entryName] = computePercentages(scan.trueCounts, scan.fileCount);

      // Aggregate into group totals
      groupFileCount += scan.fileCount;
      for (const prop of CONFIG.booleanProps) {
        groupTrueCounts[prop] += scan.trueCounts[prop];
      }

      // Aggregate into vault totals
      vaultFileCount += scan.fileCount;
      for (const prop of CONFIG.booleanProps) {
        vaultTrueCounts[prop] += scan.trueCounts[prop];
      }
    }

    // Per‑group percentages
    groupsResult[groupName] = computePercentages(groupTrueCounts, groupFileCount);
  }

  // Vault‑wide percentages
  const vaultPercentages = computePercentages(vaultTrueCounts, vaultFileCount);

  // Build report object exactly as specified
  const report = {
    generated: new Date().toISOString(),
    vault: vaultPercentages,
    groups: groupsResult,
    entries: entriesResult
  };

  // Ensure output directory exists
  const outputDir = path.dirname(CONFIG.outputFile);
  fs.mkdirSync(outputDir, { recursive: true });

  // Write JSON report
  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(report, null, 2), 'utf8');

  // Print summary
  const entryCount = Object.keys(entriesResult).length;
  console.log(
    `Vault audit complete. Scanned ${vaultFileCount} markdown ` +
    `file${vaultFileCount !== 1 ? 's' : ''} across ${entryCount} ` +
    `entr${entryCount !== 1 ? 'ies' : 'y'}.`
  );
  console.log(`Timestamp: ${report.generated}`);
  console.log(`Report written to ${CONFIG.outputFile}`);
}

// ------------------------------------------------------------------
// Run
// ------------------------------------------------------------------
audit();