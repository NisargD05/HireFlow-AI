function CandidateDetails({ candidate }) {
  if (!candidate) {
    return null;
  }

  const resume = candidate.resumeDocument;
  const sections = resume?.parsedSections || {};
  const normalizeItems = (items = []) =>
    items
      .map((item) => (typeof item === "string" ? item : item?.name || item?.title || item?.description || ""))
      .filter(Boolean);
  const skills = normalizeItems(sections.skills);
  const projects = normalizeItems(sections.projects);

  return (
    <div className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Resume intelligence</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{candidate.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{resume?.originalFileName || "No resume uploaded"}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="chip">{candidate.status}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Skills</p>
          <div className="chip-row">
            {skills.slice(0, 10).map((skill) => (
              <span key={skill} className="chip">{skill}</span>
            ))}
            {skills.length === 0 && <span className="text-sm text-slate-500">No parsed skills yet.</span>}
          </div>
        </section>
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Projects</p>
          <div className="chip-row">
            {projects.slice(0, 6).map((project) => (
              <span key={project} className="chip">{project}</span>
            ))}
            {projects.length === 0 && <span className="text-sm text-slate-500">No parsed projects yet.</span>}
          </div>
        </section>
      </div>

      {candidate.latestEvaluation && (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Ranking explanation</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{candidate.latestEvaluation.rankingReason}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Strengths</p>
              <div className="chip-row">
                {(candidate.latestEvaluation.strengths || []).map((item) => (
                  <span key={item} className="chip">{item}</span>
                ))}
              </div>
            </section>
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weaknesses</p>
              <div className="chip-row">
                {(candidate.latestEvaluation.weaknesses || []).map((item) => (
                  <span key={item} className="chip">{item}</span>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default CandidateDetails;
