const toneMap = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  awaiting_interviewer_slot: "bg-blue-50 text-blue-700 ring-blue-200",
  scheduled: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200",
  feedback_submitted: "bg-violet-50 text-violet-700 ring-violet-200",
  accepted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  selected: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  next_round: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200"
};

function InterviewStatusBadge({ status }) {
  const label = String(status || "pending").replace(/_/g, " ");
  const tone = toneMap[status] || toneMap.pending;

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${tone}`}>
      {label}
    </span>
  );
}

export default InterviewStatusBadge;
