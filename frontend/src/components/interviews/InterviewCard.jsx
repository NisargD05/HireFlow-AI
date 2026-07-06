import { Link } from "react-router-dom";
import { formatTimeRange } from "../../utils/date";
import Button from "../ui/Button";
import Card from "../ui/Card";
import InterviewStatusBadge from "./InterviewStatusBadge";

function InterviewCard({ interview, recruiterView = false }) {
  const candidate = interview.candidateId;
  const job = interview.jobId;
  const meetingLink = interview.meetingLink;
  const feedback = interview.interviewerFeedback || interview.feedbackId;

  return (
    <Card className="surface-hover p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{job?.roleName}</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{candidate?.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{interview.roundType}</p>
        </div>
        <InterviewStatusBadge status={interview.status} />
      </div>

      <div className="date-strip">
        <span>Scheduled time</span>
        <strong>{formatTimeRange(interview.scheduledAt, interview.endTime)}</strong>
      </div>

      {recruiterView && feedback && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-950">Recommendation: {feedback.recommendation}</p>
          <p className="mt-2 leading-6 text-slate-600">
            {feedback.finalNotes || feedback.notes || "Structured feedback submitted."}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!recruiterView && (
          <a href={meetingLink} target="_blank" rel="noreferrer">
            <Button variant="success">Join Meeting</Button>
          </a>
        )}
        {recruiterView && (
          <Link to={`/dashboard/interviews/${interview._id}/review`}>
            <Button variant={feedback ? "ai" : "secondary"}>Review Candidate</Button>
          </Link>
        )}
        {!recruiterView && (
          <>
            <Link to={`/interviewer/interviews/${interview._id}`}>
              <Button variant="secondary">Details</Button>
            </Link>
            {!interview.feedbackId && (
              <Link to={`/interviewer/interviews/${interview._id}/feedback`}>
                <Button variant="ai">Submit Feedback</Button>
              </Link>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default InterviewCard;
