import { useState } from "react";
import { formatDate } from "../../utils/date";
import Button from "../ui/Button";

const timeSlots = Array.from({ length: 13 }, (_, index) => {
  const hour = index + 8;
  return `${String(hour).padStart(2, "0")}:00`;
});

const formatSlotLabel = (slot) => {
  const [hourText] = slot.split(":");
  const hour = Number(hourText);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${period}`;
};

const getTodayInputValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentTimeInputValue = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const isTimeInWindow = (value) => timeSlots.includes(value);

function ScheduleInterviewModal({ request, onClose, onConfirm, busy }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [validationError, setValidationError] = useState("");

  if (!request) {
    return null;
  }

  const today = getTodayInputValue();
  const nowTime = getCurrentTimeInputValue();

  const validate = () => {
    if (date && date < today) {
      return "Interview date cannot be in the past.";
    }

    if (date === today && time && time <= nowTime) {
      return "Interview time must be in the future.";
    }

    if (time && !isTimeInWindow(time)) {
      return "Interview timing must be between 8:00 AM and 8:00 PM.";
    }

    return "";
  };

  const updateDate = (event) => {
    setDate(event.target.value);
    setValidationError("");
  };

  const updateTime = (event) => {
    setTime(event.target.value);
    setValidationError("");
  };

  const submit = (event) => {
    event.preventDefault();
    const error = validate();

    if (error) {
      setValidationError(error);
      return;
    }

    onConfirm({ date, startTime: time });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <form className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onSubmit={submit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="page-kicker">Confirm interview slot</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">{request.candidateId?.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{request.roundType} - {request.duration} minutes</p>
          </div>
          <button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-950" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="date-strip">
          <span>Recruiter preferred range</span>
          <strong>{formatDate(request.preferredWindow?.startDate)} to {formatDate(request.preferredWindow?.endDate)}</strong>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label>
            <span className="field-label">Date</span>
            <input className="field-control" type="date" min={today} value={date} onChange={updateDate} required />
          </label>
          <label>
            <span className="field-label">Start time</span>
            <select className="field-control" value={time} onChange={updateTime} required>
              <option value="">Select time</option>
              {timeSlots.map((slot) => (
                <option key={slot} value={slot} disabled={date === today && slot <= nowTime}>{formatSlotLabel(slot)}</option>
              ))}
            </select>
          </label>
        </div>
        {validationError && <p className="alert-error mt-4">{validationError}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" type="submit" disabled={busy || !date || !time || Boolean(validate())}>
            {busy ? "Scheduling..." : "Create Meeting Link"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ScheduleInterviewModal;
