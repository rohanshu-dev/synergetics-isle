
```dataview
TABLE length(rows) as count
FLATTEN file.frontmatter as fm
GROUP BY fm.key
SORT count ASC
```
