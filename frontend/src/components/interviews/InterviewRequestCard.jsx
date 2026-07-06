import { Link } from "react-router-dom";
import { formatDate } from "../../utils/date";
import Button from "../ui/Button";
import Card from "../ui/Card";
import InterviewStatusBadge from "./InterviewStatusBadge";

function InterviewRequestCard({ request, onSchedule, onReject, onResendEmail, recruiterView = false }) {
  const candidate = request.candidateId;
  const job = request.jobId;
  const emailStatus = request.emailStatus?.error
    ? request.emailStatus
    : request.interviewId?.emailStatus || request.emailStatus;
  const emailFailed = request.status === "email_failed" || Boolean(emailStatus?.error);
  const canSchedule = ["pending", "awaiting_interviewer_slot"].includes(request.status);
  const isScheduled = ["scheduled", "email_sent"].includes(request.status);

  return (
    <Card className="surface-hover p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{job?.roleName || "Role not set"}</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{candidate?.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{candidate?.email}</p>
        </div>
        <InterviewStatusBadge status={request.status} />
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Round</span>
          <p className="mt-1 font-medium text-slate-950">{request.roundType}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duration</span>
          <p className="mt-1 font-medium text-slate-950">{request.duration} minutes</p>
        </div>
      </div>

      <div className="date-strip">
        <span>Preferred window</span>
        <strong>{formatDate(request.preferredWindow?.startDate)} to {formatDate(request.preferredWindow?.endDate)}</strong>
      </div>

      {isScheduled && !emailStatus?.error && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Meeting created and invite workflow completed for this request.
        </p>
      )}

      {request.notes && (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
          {request.notes}
        </p>
      )}

      {emailStatus?.error && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Email delivery needs attention</p>
          <p className="mt-1">
            Interviewer: {emailStatus.interviewer}; Candidate: {emailStatus.candidate}
          </p>
          <p className="mt-1 text-xs leading-5">{emailStatus.error}</p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!recruiterView && (
          <>
            {canSchedule && (
              <>
                <Button variant="success" onClick={() => onSchedule(request)}>
                  Accept & Schedule
                </Button>
                <Button variant="danger" onClick={() => onReject(request)}>
                  Reject Request
                </Button>
              </>
            )}
            {emailFailed && onResendEmail && (
              <Button variant="ai" onClick={() => onResendEmail(request)}>
                Resend Email
              </Button>
            )}
          </>
        )}
        {request.interviewId && (
          <Link to={recruiterView ? `/dashboard/interviews/${request.interviewId._id || request.interviewId}/review` : `/interviewer/interviews/${request.interviewId._id || request.interviewId}`}>
            <Button variant="secondary">Open Interview</Button>
          </Link>
        )}
      </div>
    </Card>
  );
}

export default InterviewRequestCard;
