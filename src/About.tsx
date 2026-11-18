import type { Meta } from "./types";

export const AUTHOR_NAME = "Dr. Haowen Xu";
export const AUTHOR_URL = "https://haowenxu-phd.github.io/homepage/";

export default function About({ meta }: { meta: Meta }) {
  return (
    <article className="about">
      <section className="about-card author">
        <h2>Author &amp; developer</h2>
        <p>
          The Digital Engineering Tool Radar was designed and developed by{" "}
          <a href={AUTHOR_URL} target="_blank" rel="noreferrer">
            <strong>{AUTHOR_NAME}</strong>
          </a>{" "}
          as a teaching tool for Digital Engineering and Systems Engineering education.
        </p>
        <a className="about-button" href={AUTHOR_URL} target="_blank" rel="noreferrer">
          Visit {AUTHOR_NAME}'s homepage ↗
        </a>
      </section>

      <section className="about-card">
        <h2>Why this exists</h2>
        <p>
          New open-source engineering tools (digital twins, MBSE, simulation, real-time 3D, robotics, on-device AI) appear
          every week. Students rarely see which of them matter for their discipline and future job, or how mature they are.
          This radar tracks those tools, explains what each one does in plain language, and places it in the systems
          engineering lifecycle so that it can be connected to course learning outcomes and student projects.
        </p>
      </section>

      <section className="about-card">
        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Targeted crawl.</strong> GitHub and GitLab are searched for tools in {Object.keys(meta.domains).length}{" "}
            digital-engineering domains, covering tools created in the last 12 months plus established, actively maintained
            ones. Star counts are refreshed daily.
          </li>
          <li>
            <strong>Relevance filter.</strong> Broad seeds (e.g. AI agents) are kept only when the tool mentions an
            engineering application.
          </li>
          <li>
            <strong>AI classification.</strong> A language model reads each tool's README and metadata and maps it to a
            lecturer-defined taxonomy: capability area, V-model lifecycle phase, discipline, career role, a software
            maturity level (adapted from NASA TRL), teaching use and project ideas.
          </li>
          <li>
            <strong>Trends.</strong> The dashboard shows how fast new tools appear and where attention is growing.
          </li>
        </ol>
      </section>

      <section className="about-card">
        <h2>Please read with care</h2>
        <ul>
          <li>Classifications and maturity ratings are AI-generated and are being reviewed; treat them as a starting point.</li>
          <li>Stars measure popularity, not quality or safety. Check the licence and maintenance before adopting a tool.</li>
          <li>
            Recent months are undercounted, because new tools need time to reach the 20-star threshold used by the crawl.
          </li>
        </ul>
        <p className="muted small">
          {meta.count.toLocaleString()} tools tracked · {meta.classified.toLocaleString()} AI-classified · data updated{" "}
          {meta.generated_at.slice(0, 10)}
        </p>
      </section>
    </article>
  );
}
