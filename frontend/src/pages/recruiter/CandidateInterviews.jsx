import { useEffect, useState } from "react";
import api from "../../api/axios";
import InterviewCard from "../../components/interviews/InterviewCard";
import EmptyState from "../../components/ui/EmptyState";
import Loader from "../../components/ui/Loader";

function CandidateInterviews() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadInterviews = async () => {
      try {
        const { data } = await api.get("/interviews/recruiter");
        setInterviews(data.interviews || []);
      } catch (error) {
        setError(error.response?.data?.message || "Unable to load recruiter interviews");
      } finally {
        setLoading(false);
      }
    };

    loadInterviews();
  }, []);

  return (
    <div className="space-y-4">
      {error && <p className="alert-error">{error}</p>}
      {loading ? (
        <Loader label="Loading interviews..." />
      ) : interviews.length === 0 ? (
        <EmptyState title="No scheduled interviews yet" description="Confirmed interviews will appear here after an interviewer selects a slot." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {interviews.map((interview) => (
            <InterviewCard key={interview._id} interview={interview} recruiterView />
          ))}
        </div>
      )}
    </div>
  );
}

export default CandidateInterviews;
