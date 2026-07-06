import { useEffect, useState } from "react";
import api from "../../api/axios";
import InterviewRequestCard from "../../components/interviews/InterviewRequestCard";
import EmptyState from "../../components/ui/EmptyState";
import Loader from "../../components/ui/Loader";

function InterviewRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const { data } = await api.get("/interview-requests/recruiter");
        setRequests(data.interviewRequests || []);
      } catch (error) {
        setError(error.response?.data?.message || "Unable to load interview requests");
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, []);

  return (
    <div className="space-y-4">
      {error && <p className="alert-error">{error}</p>}
      {loading ? (
        <Loader label="Loading requests..." />
      ) : requests.length === 0 ? (
        <EmptyState title="No interview requests pending" description="Shortlist a candidate and request an interview when you are ready for interviewer scheduling." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.map((request) => (
            <InterviewRequestCard key={request._id} request={request} recruiterView />
          ))}
        </div>
      )}
    </div>
  );
}

export default InterviewRequests;
