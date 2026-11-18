# Digital Engineering Tool Radar

An interactive teaching tool that shows Digital and Systems Engineering students which open-source tools
are rising on GitHub, what they are for, how mature they are, and where they fit in the systems
engineering lifecycle.

- **Tool explorer**: search and filter tools by capability area, V-model lifecycle phase, discipline,
  career role and maturity (software TRL); each tool has a plain-English summary, maturity rationale and
  student project ideas.
- **Trends dashboard**: monthly growth of new tools, where attention is flowing, and breakdowns by
  discipline, systems engineering phase and digital engineering capability with time heatmaps and
  keyword clouds.

Data: GitHub / GitLab APIs (targeted crawl of digital-engineering topics), classified with an LLM against
a lecturer-defined taxonomy. Classifications are AI-generated and are being reviewed; star counts are a
popularity signal, not a quality guarantee.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # static site in dist/
```

The data files in `public/data/` are produced by the separate crawler/classifier pipeline. Every push to
`main` rebuilds and redeploys the site through GitHub Actions (`.github/workflows/deploy.yml`).
