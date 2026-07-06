import { useEffect, useState } from "react";
import api from "../../api/axios";
import InterviewRequestCard from "../../components/interviews/InterviewRequestCard";
import ScheduleInterviewModal from "../../components/interviews/ScheduleInterviewModal";
import EmptyState from "../../components/ui/EmptyState";
import Loader from "../../components/ui/Loader";
import PageHeader from "../../components/ui/PageHeader";

function PendingRequests() {
  const [requests, setRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [scheduledInterview, setScheduledInterview] = useState(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/interview-requests/interviewer");
      setRequests(data.interviewRequests || []);
    } catch (error) {
      setError(error.response?.data?.message || "Unable to load interview requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const scheduleRequest = async (slot) => {
    setBusy(true);
    setError("");
    setNotice("");
    setScheduledInterview(null);
    try {
      const { data } = await api.post(`/interview-requests/${selectedRequest._id}/accept`, slot);
      setNotice(data.message);
      if (data.emailDelivery && !data.emailDelivery.success) {
        setNotice("Meeting link created. Email delivery needs attention.");
      }
      setScheduledInterview(data.interview || null);
      setSelectedRequest(null);
      await loadRequests();
    } catch (error) {
      const response = error.response?.data;
      setError(response?.message || "Unable to schedule interview");
      setScheduledInterview(response?.interview || null);
      await loadRequests();
    } finally {
      setBusy(false);
    }
  };

  const rejectRequest = async (request) => {
    setBusy(true);
      setError("");
      setNotice("");
      setScheduledInterview(null);
    try {
      await api.post(`/interview-requests/${request._id}/reject`, { reason: "Rejected by interviewer" });
      await loadRequests();
    } catch (error) {
      setError(error.response?.data?.message || "Unable to reject request");
    } finally {
      setBusy(false);
    }
  };

  const resendEmail = async (request) => {
    setBusy(true);
    setError("");
    setNotice("");
    setScheduledInterview(null);
    try {
      const { data } = await api.post(`/interview-requests/${request._id}/resend-email`);
      setNotice(data.message || "Interview emails resent successfully");
      setScheduledInterview(data.interview || null);
      await loadRequests();
    } catch (error) {
      const response = error.response?.data;
      setError(response?.message || "Unable to resend interview emails");
      setScheduledInterview(response?.interview || null);
      await loadRequests();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Interviewer workflow"
        title="Pending Requests"
        description="Review assigned candidates and confirm the interview slot."
      />

      {error && <p className="alert-error">{error}</p>}
      {notice && <p className="alert-success">{notice}</p>}
      {scheduledInterview?.meetingLink && (
        <div className={`rounded-xl border p-4 text-sm ${
          scheduledInterview.emailStatus?.error
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900"
        }`}>
          <p className="font-semibold">Meeting link created</p>
          {scheduledInterview.emailStatus?.error && (
            <div className="mt-1">
              <p>Email status: interviewer {scheduledInterview.emailStatus.interviewer}, candidate {scheduledInterview.emailStatus.candidate}</p>
              <p className="mt-1 text-xs leading-5">{scheduledInterview.emailStatus.error}</p>
            </div>
          )}
          <a className="mt-2 inline-flex font-semibold underline" href={scheduledInterview.meetingLink} target="_blank" rel="noreferrer">
            {scheduledInterview.meetingLink}
          </a>
        </div>
      )}

      {loading ? (
        <Loader label="Loading requests..." />
      ) : requests.length === 0 ? (
        <EmptyState title="No pending interview requests" description="New recruiter-assigned interviews will appear here when your scheduling input is needed." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.map((request) => (
            <InterviewRequestCard
              key={request._id}
              request={request}
              onSchedule={setSelectedRequest}
              onReject={rejectRequest}
              onResendEmail={resendEmail}
            />
          ))}
        </div>
      )}

      <ScheduleInterviewModal
        request={selectedRequest}
        busy={busy}
        onClose={() => setSelectedRequest(null)}
        onConfirm={scheduleRequest}
      />
    </div>
  );
}

export default PendingRequests;
