import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import FeedbackForm from "../../components/interviews/FeedbackForm";
import PageHeader from "../../components/ui/PageHeader";

function SubmitFeedback() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadInterview = async () => {
      try {
        const { data } = await api.get(`/interviews/${interviewId}`);
        setInterview(data.interview);
      } catch (error) {
        setError(error.response?.data?.message || "Unable to load interview");
      }
    };

    loadInterview();
  }, [interviewId]);

  const submitFeedback = async (payload) => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/interviews/${interviewId}/feedback`, payload);
      navigate("/interviewer/feedback-history");
    } catch (error) {
      setError(error.response?.data?.message || "Unable to submit feedback");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Feedback workflow"
        title={interview ? `Feedback for ${interview.candidateId?.name}` : "Submit Feedback"}
        description="Ratings and recommendations are visible to the recruiter after submission."
      />
      {error && <p className="alert-error">{error}</p>}
      {interview?.feedbackId ? (
        <p className="alert-success">Feedback has already been submitted for this interview.</p>
      ) : (
        <FeedbackForm busy={busy} onSubmit={submitFeedback} />
      )}
    </div>
  );
}

export default SubmitFeedback;
