import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "../api/axios";
import Button from "./ui/Button";

const initialRequest = {
  interviewerEmail: "",
  roundType: "Technical Round",
  duration: 60,
  startDate: "",
  endDate: "",
  notes: ""
};

const getTodayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function InterviewRequestModal({ candidate, onClose, onInterviewRequested }) {
  const [requestForm, setRequestForm] = useState(initialRequest);
  const [requestError, setRequestError] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);

  useEffect(() => {
    setRequestForm(initialRequest);
    setRequestError("");
  }, [candidate?._id, candidate?.name]);

  if (!candidate) {
    return null;
  }

  const score = candidate.latestEvaluation?.score ?? "--";
  const role = candidate.job?.roleName || "Selected role";
  const today = getTodayInputValue();

  const updateRequestForm = (event) => {
    setRequestForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setRequestError("");
  };

  const closeModal = () => {
    setRequestForm(initialRequest);
    setRequestError("");
    onClose();
  };

  const submitInterviewRequest = async (event) => {
    event.preventDefault();
    setRequestBusy(true);
    setRequestError("");

    try {
      if (requestForm.startDate < today || requestForm.endDate < today) {
        setRequestError("Interview date cannot be in the past.");
        return;
      }

      if (requestForm.startDate > requestForm.endDate) {
        setRequestError("Preferred interview date range is invalid.");
        return;
      }

      await api.post("/interview-requests", {
        candidateId: candidate._id,
        interviewerEmail: requestForm.interviewerEmail,
        roundType: requestForm.roundType,
        duration: Number(requestForm.duration),
        preferredWindow: {
          startDate: requestForm.startDate,
          endDate: requestForm.endDate
        },
        notes: requestForm.notes
      });
      onInterviewRequested?.(candidate._id);
      closeModal();
    } catch (error) {
      setRequestError(error.response?.data?.message || "Unable to create interview request");
    } finally {
      setRequestBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
      <form className="my-6 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl" onSubmit={submitInterviewRequest}>
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="eyebrow">Interview request</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">{candidate.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{candidate.email}</p>
          </div>
          <span className="chip">{candidate.status}</span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="field-label">Role</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{role}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="field-label">Score</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{score}</p>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="field-label">Shortlist</p>
            <p className="mt-1 text-sm font-semibold text-slate-950">{candidate.isShortlisted ? "Shortlisted" : "Not shortlisted"}</p>
          </div>
        </div>

        {requestError && <p className="alert-error mt-4">{requestError}</p>}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label>
            <span className="field-label">Interviewer email</span>
            <input className="field-control" name="interviewerEmail" type="email" value={requestForm.interviewerEmail} onChange={updateRequestForm} required />
          </label>
          <label>
            <span className="field-label">Round type</span>
            <select className="field-control" name="roundType" value={requestForm.roundType} onChange={updateRequestForm}>
              <option>HR Round</option>
              <option>Technical Round</option>
              <option>System Design Round</option>
              <option>Managerial Round</option>
              <option>Final Round</option>
            </select>
          </label>
          <label>
            <span className="field-label">Duration</span>
            <select className="field-control" name="duration" value={requestForm.duration} onChange={updateRequestForm}>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">Start date</span>
              <input className="field-control" name="startDate" type="date" min={today} value={requestForm.startDate} onChange={updateRequestForm} required />
            </label>
            <label>
              <span className="field-label">End date</span>
              <input className="field-control" name="endDate" type="date" min={requestForm.startDate || today} value={requestForm.endDate} onChange={updateRequestForm} required />
            </label>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="field-label">Recruiter notes</span>
          <textarea className="field-control min-h-24" name="notes" value={requestForm.notes} onChange={updateRequestForm} />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={closeModal} disabled={requestBusy}>Cancel</Button>
          <Button variant="success" type="submit" disabled={requestBusy}>
            {requestBusy ? "Sending..." : "Send Request"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default InterviewRequestModal;
