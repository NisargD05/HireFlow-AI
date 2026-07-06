import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/axios";
import InterviewStatusBadge from "../../components/interviews/InterviewStatusBadge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Loader from "../../components/ui/Loader";
import { formatTimeRange } from "../../utils/date";

function InterviewDetails() {
  const { interviewId } = useParams();
  const [interview, setInterview] = useState(null);
  const [packet, setPacket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [packetLoading, setPacketLoading] = useState(false);
  const [error, setError] = useState("");
  const [packetError, setPacketError] = useState("");

  useEffect(() => {
    const loadInterview = async () => {
      try {
        const { data } = await api.get(`/interviews/${interviewId}`);
        setInterview(data.interview);
        try {
          const packetResponse = await api.get(`/interview-agent/${interviewId}`);
          setPacket(packetResponse.data.packet);
        } catch (packetError) {
          if (packetError.response?.status !== 404) {
            setPacketError(packetError.response?.data?.message || "Unable to load AI interview brief");
          }
        }
      } catch (error) {
        setError(error.response?.data?.message || "Unable to load interview");
      } finally {
        setLoading(false);
      }
    };

    loadInterview();
  }, [interviewId]);

  const generatePacket = async (force = false) => {
    if (!interview?.candidateId?._id) {
      return;
    }

    setPacketLoading(true);
    setPacketError("");
    try {
      const { data } = force
        ? await api.post(`/interview-agent/regenerate/${interview._id}`)
        : await api.post(`/interview-agent/generate/${interview.candidateId._id}`, {
            interviewId: interview._id
          });
      setPacket(data.packet);
    } catch (error) {
      setPacketError(error.response?.data?.message || "Unable to generate AI interview brief");
    } finally {
      setPacketLoading(false);
    }
  };

  if (loading) {
    return <Loader label="Loading interview kit..." />;
  }

  if (error || !interview) {
    return <p className="alert-error">{error || "Interview not found"}</p>;
  }

  const candidate = interview.candidateId;
  const evaluation = candidate?.latestEvaluation;
  const resume = candidate?.resumeDocument;
  const meetingLink = interview.meetingLink;

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <Link className="text-link" to="/interviewer/upcoming">Back to upcoming</Link>
          <p className="page-kicker">{interview.jobId?.roleName}</p>
          <h1 className="page-title">{candidate?.name}</h1>
          <p className="page-copy">{formatTimeRange(interview.scheduledAt, interview.endTime)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <InterviewStatusBadge status={interview.status} />
          <a href={meetingLink} target="_blank" rel="noreferrer">
            <Button variant="success">Join Meeting</Button>
          </a>
          {!interview.feedbackId && (
            <Link to={`/interviewer/interviews/${interview._id}/feedback`}>
              <Button variant="ai">Submit Feedback</Button>
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-950">AI ranking summary</h2>
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-3xl font-semibold text-slate-950">{evaluation?.score ?? 0}%</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{evaluation?.rankingReason || "No AI ranking summary available."}</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Strengths</p>
              <div className="chip-row">
                {(evaluation?.strengths || []).map((item) => <span key={item} className="chip">{item}</span>)}
              </div>
            </section>
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weaknesses</p>
              <div className="chip-row">
                {(evaluation?.weaknesses || []).map((item) => <span key={item} className="chip">{item}</span>)}
              </div>
            </section>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-950">Interview context</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div><dt className="text-slate-500">Round</dt><dd className="font-medium text-slate-950">{interview.roundType}</dd></div>
            <div><dt className="text-slate-500">Recruiter notes</dt><dd className="font-medium text-slate-950">{interview.requestId?.notes || "No notes provided."}</dd></div>
            <div><dt className="text-slate-500">Matched JD skills</dt><dd className="font-medium text-slate-950">{(evaluation?.matchesWithJD || []).join(", ") || "Not available"}</dd></div>
            <div><dt className="text-slate-500">Missing requirements</dt><dd className="font-medium text-slate-950">{(evaluation?.missingWithJD || []).join(", ") || "Not available"}</dd></div>
          </dl>
        </Card>
      </div>

      <Card className="p-5">
        <div className="panel-heading">
          <div>
            <h2 className="font-semibold text-slate-950">AI Interview Brief</h2>
            <p className="mt-1 text-sm text-slate-500">
              Contextual questions grounded in the resume, JD, ranking gaps, and hiring knowledge.
            </p>
          </div>
          <Button variant="ai" onClick={() => generatePacket(Boolean(packet))} disabled={packetLoading}>
            {packetLoading ? "Generating..." : packet ? "Regenerate Brief" : "Generate Brief"}
          </Button>
        </div>

        {packetError && <p className="mt-4 alert-error">{packetError}</p>}

        {!packet && !packetLoading ? (
          <div className="mt-4">
            <p className="text-sm leading-6 text-slate-600">
              Generate an interviewer-ready packet after the candidate has a parsed resume and AI ranking.
            </p>
          </div>
        ) : packetLoading ? (
          <div className="mt-4"><Loader label="Generating AI interview brief..." /></div>
        ) : (
          <div className="mt-5 space-y-5">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Focus Areas</p>
              <div className="chip-row">
                {(packet.focusAreas || []).map((item) => <span key={item} className="chip">{item}</span>)}
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <QuestionSection title="Technical Questions" items={packet.technicalQuestions} />
              <QuestionSection title="System Design" items={packet.systemDesignQuestions} />
              <QuestionSection title="Behavioral" items={packet.behavioralQuestions} />
              <QuestionSection title="Weakness Probes" items={packet.weaknessProbes} />
              <QuestionSection title="Follow-ups" items={packet.followUpQuestions} />
              <ListSection title="Evaluation Checklist" items={packet.evaluationChecklist} />
            </div>

            <ListSection title="Interviewer Notes" items={packet.interviewerNotes} />
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="panel-heading">
          <div>
            <h2 className="font-semibold text-slate-950">Resume</h2>
            <p className="mt-1 text-sm text-slate-500">{resume?.originalFileName || "No resume file"}</p>
          </div>
        </div>
        <div className="mt-4 max-h-[460px] overflow-auto rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
          {resume?.resumeText || "Resume text is not available."}
        </div>
      </Card>
    </div>
  );
}

function QuestionSection({ title, items = [] }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No questions generated yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
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

function ListSection({ title, items = [] }) {
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No notes generated yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
          {items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}
        </ul>
      )}
    </section>
  );
}

export default InterviewDetails;
