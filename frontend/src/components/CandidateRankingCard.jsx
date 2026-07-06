import Button from "./ui/Button";

const scoreTone = (score) => {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (score >= 60) return "bg-blue-50 text-blue-700 ring-blue-200";
  if (score >= 40) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-red-50 text-red-700 ring-red-200";
};

function CandidateRankingCard({ candidate, onRank, onShortlist, onRequestInterview, busy }) {
  const evaluation = candidate.latestEvaluation;
  const score = evaluation?.score;
  const matches = evaluation?.matchesWithJD || [];
  const missing = evaluation?.missingWithJD || [];
  const missingLinks = evaluation?.missingLinks || [];
  const strengths = evaluation?.strengths || [];
  const weaknesses = evaluation?.weaknesses || [];
  const hasEvaluation = Boolean(evaluation);
  const isFinalized = ["accepted", "rejected"].includes(candidate.status) && !candidate.isShortlisted;
  const statusTone =
    candidate.status === "accepted" || candidate.status === "shortlisted"
      ? "status-scheduled"
      : candidate.status === "rejected"
        ? "status-failed"
        : "status-generated";

  return (
    <article className="candidate-card">
      <div className="card-topline">
        <span>{candidate.job?.roleName || "Selected role"}</span>
        <div className="flex flex-wrap justify-end gap-2">
          {candidate.isShortlisted && candidate.status !== "shortlisted" && (
            <span className="status-badge status-scheduled">shortlisted</span>
          )}
          <span className={`status-badge ${statusTone}`}>
            {candidate.status}
          </span>
          <span className={`status-badge ${candidate.rankingStatus === "failed" ? "status-failed" : "status-generated"}`}>
            {candidate.rankingStatus}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="mt-0">{candidate.name}</h2>
          <p>{candidate.email} - {candidate.phone}</p>
          <p>{candidate.currentCompany || "Company not provided"}</p>
        </div>
        <span className={`inline-flex h-14 min-w-14 items-center justify-center rounded-2xl px-3 text-lg font-bold ring-1 ${scoreTone(score || 0)}`}>
          {score ?? "--"}
        </span>
      </div>

      <div className="score-row">
        <span>Recommendation</span>
        <strong className="text-base">{evaluation?.recommendation || "Awaiting ranking"}</strong>
        <p className="mt-2">{evaluation?.rankingReason || candidate.rankingError || "Upload a resume and rank this candidate against the approved JD."}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matches</p>
          <div className="chip-row">
            {(matches.length ? matches : [hasEvaluation ? "No JD matches returned" : "Not ranked"]).slice(0, 4).map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing</p>
          <div className="chip-row">
            {(missing.length ? missing : [hasEvaluation ? "No missing items returned" : "Not ranked"]).slice(0, 4).map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
          </div>
        </div>
      </div>

      {hasEvaluation && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Strengths</p>
            <div className="chip-row">
              {(strengths.length ? strengths : ["No strengths returned"]).slice(0, 3).map((item) => (
                <span key={item} className="chip">{item}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weaknesses</p>
            <div className="chip-row">
              {(weaknesses.length ? weaknesses : ["No weaknesses returned"]).slice(0, 3).map((item) => (
                <span key={item} className="chip">{item}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasEvaluation && missingLinks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Missing links</p>
          <div className="chip-row">
            {missingLinks.slice(0, 3).map((item) => (
              <span key={item} className="chip">{item}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="ai" onClick={(event) => { event.stopPropagation(); onRank(candidate._id); }} disabled={busy || !candidate.resumeDocument} className="px-3 py-2 text-xs">
          Rank
        </Button>
        <Button variant="success" onClick={(event) => { event.stopPropagation(); onShortlist(candidate._id, "shortlisted"); }} disabled={busy || candidate.isShortlisted || isFinalized} className="px-3 py-2 text-xs">
          {candidate.isShortlisted ? "Shortlisted" : "Shortlist"}
        </Button>
        {candidate.isShortlisted && candidate.status === "shortlisted" && onRequestInterview && (
          <Button variant="ai" onClick={(event) => { event.stopPropagation(); onRequestInterview(candidate); }} disabled={busy} className="px-3 py-2 text-xs">
            Request Interview
          </Button>
        )}
        <Button variant="danger" onClick={(event) => { event.stopPropagation(); onShortlist(candidate._id, "rejected"); }} disabled={busy || isFinalized} className="px-3 py-2 text-xs">
          Reject
        </Button>
      </div>
    </article>
  );
}

export default CandidateRankingCard;
