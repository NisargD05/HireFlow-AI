import { useState } from "react";
import Button from "../ui/Button";

const initialForm = {
  technicalRatings: {
    problemSolving: 7,
    backendFundamentals: 7,
    systemDesign: 7,
    databases: 7,
    debugging: 7,
    communication: 7,
    productionReadiness: 7
  },
  strengths: "",
  concerns: "",
  observations: "",
  finalNotes: "",
  recommendation: "Hire"
};

const ratingFields = [
  ["problemSolving", "Problem Solving"],
  ["backendFundamentals", "Backend Fundamentals"],
  ["systemDesign", "System Design"],
  ["databases", "Database Knowledge"],
  ["debugging", "Debugging Ability"],
  ["communication", "Communication"],
  ["productionReadiness", "Production Readiness"]
];

function FeedbackForm({ onSubmit, busy }) {
  const [form, setForm] = useState(initialForm);

  const update = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const updateRating = (event) => {
    const value = Number(event.target.value);
    setForm((current) => ({
      ...current,
      technicalRatings: {
        ...current.technicalRatings,
        [event.target.name]: value
      }
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      <div>
        <p className="page-kicker">Structured evaluation</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">Interviewer recommendation</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          This recommendation supports recruiter review. It is not the final hiring decision.
        </p>
      </div>

      <section className="surface p-5">
        <div className="panel-heading">
          <div>
            <p className="page-kicker">Section 1</p>
            <h3 className="mt-2 font-semibold text-slate-950">Technical Evaluation</h3>
          </div>
          <span className="chip">1-10 ratings</span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
        {ratingFields.map(([name, label]) => (
          <label key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <span className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
              {label}
              <strong className="rounded-full bg-white px-2.5 py-1 text-slate-950 ring-1 ring-slate-200">
                {form.technicalRatings[name]}/10
              </strong>
            </span>
            <input
              className="mt-4 w-full accent-blue-600"
              name={name}
              type="range"
              min="1"
              max="10"
              value={form.technicalRatings[name]}
              onChange={updateRating}
              required
            />
          </label>
        ))}
        </div>
      </section>

      <section className="surface p-5">
        <p className="page-kicker">Section 2</p>
        <h3 className="mt-2 font-semibold text-slate-950">Written Feedback</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label>
            <span className="field-label">Strengths</span>
            <textarea className="field-control min-h-32" name="strengths" value={form.strengths} onChange={update} required />
          </label>
          <label>
            <span className="field-label">Concerns</span>
            <textarea className="field-control min-h-32" name="concerns" value={form.concerns} onChange={update} required />
          </label>
          <label>
            <span className="field-label">Key Observations</span>
            <textarea className="field-control min-h-32" name="observations" value={form.observations} onChange={update} required />
          </label>
          <label>
            <span className="field-label">Final Notes</span>
            <textarea className="field-control min-h-32" name="finalNotes" value={form.finalNotes} onChange={update} required />
          </label>
        </div>
      </section>

      <section className="surface p-5">
        <p className="page-kicker">Section 3</p>
        <label className="mt-2 block">
          <span className="field-label">Interview Outcome</span>
          <select className="field-control" name="recommendation" value={form.recommendation} onChange={update} required>
            <option value="Strong Hire">Strong Hire</option>
            <option value="Hire">Hire</option>
            <option value="Borderline">Borderline</option>
            <option value="Reject">Reject</option>
          </select>
        </label>
      </section>

      <Button type="submit" variant="success" disabled={busy}>
        {busy ? "Submitting..." : "Submit Feedback"}
      </Button>
    </form>
  );
}

export default FeedbackForm;
