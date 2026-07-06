import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/axios";
import InterviewStatusBadge from "../../components/interviews/InterviewStatusBadge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";

const ratingLabels = {
  problemSolving: "Problem Solving",
  backendFundamentals: "Backend Fundamentals",
  systemDesign: "System Design",
  databases: "Database Knowledge",
  debugging: "Debugging Ability",
  communication: "Communication",
  productionReadiness: "Production Readiness"
};

function InterviewReview() {
  const { interviewId } = useParams();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadReview = async () => {
    try {
      const { data } = await api.get(`/interviews/${interviewId}/review`);
      setReview(data.review);
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load interview review");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReview();
  }, [interviewId]);

  const decide = async (decision) => {
    setBusy(decision);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(`/interviews/${interviewId}/${decision}`);
      setNotice(data.message);
      await loadReview();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to record final decision");
    } finally {
      setBusy("");
    }
  };

  const canDecide = useMemo(() => {
    const interview = review?.interview;
    return Boolean(
      interview &&
        interview.status === "feedback_submitted" &&
        review.interviewerFeedback &&
        (!review.recruiterDecision || review.recruiterDecision === "pending")
    );
  }, [review]);

  if (loading) {
    return <Loader label="Loading recruiter review..." />;
  }

  if (!review) {
    return <p className="alert-error">{error || "Interview review not found"}</p>;
  }

  const { interview, candidate, job, aiEvaluation, interviewBrief, interviewerFeedback } = review;
  const resume = candidate?.resumeDocument;
  const decision = review.recruiterDecision || "pending";

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <Link className="text-link" to="/dashboard/interviews">Back to interviews</Link>
          <p className="page-kicker">Final hiring review</p>
          <h1 className="page-title">{candidate?.name || "Candidate Review"}</h1>
          <p className="page-copy">
            Review AI ranking, the interview brief, and interviewer feedback before making the final human decision.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InterviewStatusBadge status={decision} />
          <InterviewStatusBadge status={interview.status} />
        </div>
      </header>

      {error && <p className="alert-error">{error}</p>}
      {notice && <p className="alert-success">{notice}</p>}

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.2fr_0.95fr]">
        <Card className="p-5">
          <SectionTitle kicker="Candidate" title="Profile" />
          <dl className="mt-5 space-y-3 text-sm">
            <InfoRow label="Name" value={candidate?.name} />
            <InfoRow label="Email" value={candidate?.email} />
            <InfoRow label="Role" value={job?.roleName} />
            <InfoRow label="Resume" value={resume?.originalFileName || "No resume file"} />
          </dl>

          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI ranking score</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{aiEvaluation?.score ?? 0}%</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {aiEvaluation?.rankingReason || "No ranking explanation available."}
            </p>
          </div>

          <ListBlock title="Skills" items={candidate?.skills || aiEvaluation?.matchesWithJD || []} />
          <ListBlock title="Projects" items={candidate?.resume?.projects || resume?.parsedSections?.projects || []} />
          <ListBlock title="AI Strengths" items={aiEvaluation?.strengths || []} />
          <ListBlock title="AI Weaknesses" items={aiEvaluation?.weaknesses || []} />
        </Card>

        <Card className="p-5">
          <SectionTitle kicker="AI interview brief" title="Interview Signal" />
          {!interviewBrief ? (
            <p className="mt-5 text-sm leading-6 text-slate-600">No interview brief has been generated yet.</p>
          ) : (
            <div className="mt-5 space-y-5">
              <ListBlock title="Focus Areas" items={interviewBrief.focusAreas || []} />
              <QuestionBlock title="Technical Questions" items={interviewBrief.technicalQuestions || []} />
              <QuestionBlock title="System Design Questions" items={interviewBrief.systemDesignQuestions || []} />
              <ListBlock title="Interviewer Guidance" items={interviewBrief.interviewerNotes || interviewBrief.evaluationChecklist || []} />
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle kicker="Interviewer" title="Feedback" />
          {!interviewerFeedback ? (
            <p className="mt-5 text-sm leading-6 text-slate-600">Feedback has not been submitted yet.</p>
          ) : (
            <div className="mt-5 space-y-5">
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommendation</p>
                <p className="mt-2 text-xl font-semibold text-slate-950">{interviewerFeedback.recommendation}</p>
              </div>
              <div className="space-y-3">
                {Object.entries(ratingLabels).map(([key, label]) => (
                  <RatingBar key={key} label={label} value={interviewerFeedback.technicalRatings?.[key] || 0} />
                ))}
              </div>
              <TextBlock title="Strengths" value={interviewerFeedback.strengths} />
              <TextBlock title="Concerns" value={interviewerFeedback.concerns} />
              <TextBlock title="Key Observations" value={interviewerFeedback.observations} />
              <TextBlock title="Final Notes" value={interviewerFeedback.finalNotes} />
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="page-kicker">Final recruiter actions</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">Human hiring decision</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Decision buttons unlock only after structured feedback is submitted. Once accepted or rejected, the decision is locked.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="success" disabled={!canDecide || Boolean(busy)} onClick={() => decide("accept")}>
              {busy === "accept" ? "Accepting..." : "Accept Candidate"}
            </Button>
            <Button variant="danger" disabled={!canDecide || Boolean(busy)} onClick={() => decide("reject")}>
              {busy === "reject" ? "Rejecting..." : "Reject Candidate"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SectionTitle({ kicker, title }) {
  return (
    <div>
      <p className="page-kicker">{kicker}</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-950">{title}</h2>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-950">{value || "Not available"}</dd>
    </div>
  );
}

function ListBlock({ title, items = [] }) {
  const values = items
    .map((item) => (typeof item === "string" ? item : item?.name || item?.title || item?.description || JSON.stringify(item)))
    .filter(Boolean);

  return (
    <section className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {values.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Not available.</p>
      ) : (
        <div className="chip-row">
          {values.map((item, index) => (
            <span key={`${title}-${index}`} className="chip">{item}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function QuestionBlock({ title, items = [] }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No questions available.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {items.map((item, index) => (
            <article key={`${title}-${index}`} className="text-sm leading-6">
              <p className="font-medium text-slate-950">{item.question}</p>
              {item.whyAsk && <p className="mt-1 text-slate-600">Why: {item.whyAsk}</p>}
              {item.strongSignal && <p className="mt-1 text-slate-600">Strong signal: {item.strongSignal}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RatingBar({ label, value }) {
  const width = `${Math.max(0, Math.min(10, Number(value))) * 10}%`;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <strong className="text-slate-950">{value}/10</strong>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-blue-600" style={{ width }} />
      </div>
    </div>
  );
}

function TextBlock({ title, value }) {
  return (
    <section className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value || "Not provided."}</p>
    </section>
  );
}

export default InterviewReview;
