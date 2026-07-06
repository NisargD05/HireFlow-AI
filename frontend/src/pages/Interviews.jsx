import { useState } from "react";
import PageHeader from "../components/ui/PageHeader";
import CandidateInterviews from "./recruiter/CandidateInterviews";
import InterviewRequests from "./recruiter/InterviewRequests";

function Interviews() {
  const [tab, setTab] = useState("requests");

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Interview operations"
        title="Interviews"
        description="Create interviewer-owned scheduling requests, track confirmed interviews, and review feedback."
      />

      <div className="toolbar max-w-fit">
        <button
          type="button"
          className={`mobile-nav-item ${tab === "requests" ? "mobile-nav-item-active" : ""}`}
          onClick={() => setTab("requests")}
        >
          Requests
        </button>
        <button
          type="button"
          className={`mobile-nav-item ${tab === "interviews" ? "mobile-nav-item-active" : ""}`}
          onClick={() => setTab("interviews")}
        >
          Scheduled & Feedback
        </button>
      </div>

      {tab === "requests" ? <InterviewRequests /> : <CandidateInterviews />}
    </div>
  );
}

export default Interviews;
