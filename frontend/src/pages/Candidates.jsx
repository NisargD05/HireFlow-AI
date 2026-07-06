import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import CandidateDetails from "../components/CandidateDetails";
import CandidateRankingCard from "../components/CandidateRankingCard";
import InterviewRequestModal from "../components/InterviewRequestModal";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Loader from "../components/ui/Loader";
import PageHeader from "../components/ui/PageHeader";

const extractApiError = (error, fallback) => {
  const response = error.response?.data;
  if (response?.failures?.length) {
    return response.failures.map((failure) => failure.message).join(" | ");
  }
  return response?.details?.message || response?.message || response?.error || error.message || fallback;
};

const formatSubmissionTime = (value) => {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
};

const getIntakeStatus = (summary) => {
  const webhook = summary?.latestWebhook || summary?.latestWebhookAny;

  if (!webhook) {
    return {
      tone: "neutral",
      title: "Application intake status",
      items: ["No applications received yet"]
    };
  }

  if (webhook.error || webhook.status === "invalid" || webhook.status === "failed") {
    const missingResume = !webhook.resumeDetected || /resume/i.test(webhook.error || "");
    return {
      tone: "warning",
      title: "Application intake status",
      items: [
        `Last submission received: ${formatSubmissionTime(webhook.createdAt)}`,
        missingResume ? "Missing resume upload" : "Invalid application submission",
        webhook.error || "Please ask the candidate to resubmit the application"
      ]
    };
  }

  if (webhook.candidateImported) {
    return {
      tone: "success",
      title: "Application intake status",
      items: [
        `Last submission received: ${formatSubmissionTime(webhook.createdAt)}`,
        "Candidate imported successfully",
        "Resume parsed successfully",
        "Ready for ranking"
      ]
    };
  }

  return {
    tone: "success",
    title: "Application intake status",
    items: [
      `Last submission received: ${formatSubmissionTime(webhook.createdAt)}`,
      "Resume received successfully",
      "Ready to fetch"
    ]
  };
};

function Candidates() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [shortlistedCandidates, setShortlistedCandidates] = useState([]);
  const [applicationSummary, setApplicationSummary] = useState(null);
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [interviewRequestCandidate, setInterviewRequestCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fetchingResumes, setFetchingResumes] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate._id === selectedCandidateId),
    [candidates, selectedCandidateId]
  );

  const selectedJob = useMemo(
    () => jobs.find((job) => job._id === selectedJobId),
    [jobs, selectedJobId]
  );

  const pendingResumeCount = applicationSummary?.pendingCount ?? 0;
  const pendingResumeText = pendingResumeCount > 0
    ? `${pendingResumeCount} resume${pendingResumeCount === 1 ? "" : "s"} available to fetch`
    : "No resumes uploaded yet";
  const intakeStatus = getIntakeStatus(applicationSummary);

  const fetchCandidates = async (jobId = selectedJobId) => {
    if (!jobId) {
      setCandidates([]);
      return [];
    }

    const { data } = await api.get("/candidates", {
      params: { jobId, sort: "score" }
    });
    const nextCandidates = data.candidates || [];
    setCandidates(nextCandidates);
    return nextCandidates;
  };

  const fetchShortlistedCandidates = async (jobId = selectedJobId) => {
    if (!jobId) {
      setShortlistedCandidates([]);
      return [];
    }

    const { data } = await api.get("/candidates/shortlisted", {
      params: { jobId }
    });
    const nextShortlisted = data.candidates || [];
    setShortlistedCandidates(nextShortlisted);
    return nextShortlisted;
  };

  const fetchApplicationSummary = async (jobId = selectedJobId) => {
    if (!jobId) {
      setApplicationSummary(null);
      return null;
    }

    const { data } = await api.get("/external-applications/summary", {
      params: { jobId }
    });
    setApplicationSummary(data);
    return data;
  };

  const refreshCandidateWorkspace = async (jobId = selectedJobId, preferredCandidateId = "") => {
    const [nextCandidates, nextShortlisted] = await Promise.all([
      fetchCandidates(jobId),
      fetchShortlistedCandidates(jobId)
    ]);

    const preferredExists = preferredCandidateId && nextCandidates.some((candidate) => candidate._id === preferredCandidateId);
    const currentExists = selectedCandidateId && nextCandidates.some((candidate) => candidate._id === selectedCandidateId);
    const nextSelectedId = preferredExists
      ? preferredCandidateId
      : currentExists
        ? selectedCandidateId
        : nextShortlisted[0]?._id || nextCandidates[0]?._id || "";

    setSelectedCandidateId(nextSelectedId);
    return { candidates: nextCandidates, shortlistedCandidates: nextShortlisted };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/jobs");
        setJobs(data.jobs || []);
        const firstJobId = data.jobs?.[0]?._id || "";
        setSelectedJobId(firstJobId);
        if (firstJobId) {
          const [candidateResponse, shortlistResponse, summaryResponse] = await Promise.all([
            api.get("/candidates", { params: { jobId: firstJobId, sort: "score" } }),
            api.get("/candidates/shortlisted", { params: { jobId: firstJobId } }),
            api.get("/external-applications/summary", { params: { jobId: firstJobId } })
          ]);
          const nextCandidates = candidateResponse.data.candidates || [];
          const nextShortlisted = shortlistResponse.data.candidates || [];
          setCandidates(nextCandidates);
          setShortlistedCandidates(nextShortlisted);
          setApplicationSummary(summaryResponse.data);
          setSelectedCandidateId(nextShortlisted[0]?._id || nextCandidates[0]?._id || "");
        }
      } catch (error) {
        setError(error.response?.data?.message || "Failed to load candidate workspace");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredCandidates = useMemo(() => {
    return candidates.filter((candidate) => {
      const haystack = [
        candidate.name,
        candidate.email,
        candidate.phone,
        candidate.currentCompany,
        candidate.latestEvaluation?.recommendation,
        candidate.rankingStatus
      ]
        .join(" ")
        .toLowerCase();
      const score = candidate.latestEvaluation?.score ?? -1;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "shortlisted" ? candidate.isShortlisted : candidate.status === statusFilter);
      return haystack.includes(query.toLowerCase()) && (!minScore || score >= Number(minScore)) && matchesStatus;
    });
  }, [candidates, minScore, query, statusFilter]);

  const filteredShortlistedCandidates = useMemo(() => {
    return shortlistedCandidates.filter((candidate) => {
      const haystack = [
        candidate.name,
        candidate.email,
        candidate.phone,
        candidate.currentCompany,
        candidate.job?.roleName,
        candidate.latestEvaluation?.recommendation,
        candidate.rankingStatus,
        candidate.status
      ]
        .join(" ")
        .toLowerCase();
      const score = candidate.latestEvaluation?.score ?? -1;
      return haystack.includes(query.toLowerCase()) && (!minScore || score >= Number(minScore));
    });
  }, [minScore, query, shortlistedCandidates]);

  const handleJobChange = async (event) => {
    const jobId = event.target.value;
    setSelectedJobId(jobId);
    setSelectedCandidateId("");
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const [nextCandidates, nextShortlisted] = await Promise.all([
        fetchCandidates(jobId),
        fetchShortlistedCandidates(jobId),
        fetchApplicationSummary(jobId)
      ]);
      setSelectedCandidateId(nextShortlisted[0]?._id || nextCandidates[0]?._id || "");
    } catch (error) {
      setError(error.response?.data?.message || "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyApplicationLink = async () => {
    setError("");
    setSuccess("");
    try {
      await navigator.clipboard.writeText(applicationSummary?.applicationLink || "");
      setSuccess("Application link copied.");
    } catch (error) {
      setError("Unable to copy application link");
    }
  };

  const handleFetchResumes = async () => {
    setFetchingResumes(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/external-applications/fetch-resumes", { jobId: selectedJobId });
      if (data.importedCount === 0 && data.failedCount === 0 && data.duplicateCount === 0) {
        setSuccess(data.message || "No resumes available to fetch");
      } else {
        const failureText = data.failedCount ? `, ${data.failedCount} failed` : "";
        const duplicateText = data.duplicateCount ? `, ${data.duplicateCount} duplicate` : "";
        setSuccess(`Fetched ${data.importedCount} resume${data.importedCount === 1 ? "" : "s"}${duplicateText}${failureText}.`);
      }
      if (data.failures?.length) {
        setError(data.failures.map((failure) => failure.message).join(" | "));
      }
      await Promise.all([
        refreshCandidateWorkspace(selectedJobId),
        fetchApplicationSummary(selectedJobId)
      ]);
    } catch (error) {
      setError(error.response?.data?.message || "Failed to fetch resumes");
    } finally {
      setFetchingResumes(false);
    }
  };

  const handleRank = async (candidateId) => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post(`/candidates/${candidateId}/rank`);
      setSuccess("Candidate ranking completed.");
      await refreshCandidateWorkspace(selectedJobId, candidateId);
    } catch (error) {
      const message = extractApiError(error, "Failed to rank candidate");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleRankAll = async () => {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { data } = await api.post("/candidates/rank-all", { jobId: selectedJobId });
      if (data.failedCount) {
        const failureText = (data.failures || []).map((failure) => failure.message).join(" | ");
        setError(`Ranking completed with ${data.failedCount} failure(s): ${failureText || "No failure detail returned"}`);
      }
      if (data.rankedCount > 0) {
        setSuccess(`Ranked ${data.rankedCount} candidates${data.failedCount ? `, ${data.failedCount} failed` : ""}.`);
      } else if (data.failedCount > 0) {
        setSuccess("");
      } else {
        setSuccess("No candidates with parsed resumes were available to rank.");
      }
      await refreshCandidateWorkspace(selectedJobId);
    } catch (error) {
      const message = extractApiError(error, "Failed to rank candidates");
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleShortlist = async (candidateId, status) => {
    setBusy(true);
    setError("");
    try {
      await api.put(`/candidates/${candidateId}/shortlist`, { status });
      setSelectedCandidateId(status === "rejected" ? "" : candidateId);
      await refreshCandidateWorkspace(selectedJobId, status === "rejected" ? "" : candidateId);
    } catch (error) {
      setError(error.response?.data?.message || "Failed to update candidate");
    } finally {
      setBusy(false);
    }
  };

  const openInterviewRequest = (candidate) => {
    setSelectedCandidateId(candidate._id);
    setInterviewRequestCandidate(candidate);
  };

  const closeInterviewRequest = () => {
    setInterviewRequestCandidate(null);
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="AI talent intelligence"
        title="Candidates"
        description="Share the external application link, fetch submitted resumes on demand, and review automatically ranked candidates."
      />

      {error && <p className="alert-error">{error}</p>}
      {success && <p className="alert-success">{success}</p>}

      <div className="toolbar">
        <select value={selectedJobId} onChange={handleJobChange} className="md:max-w-md" disabled={busy}>
          <option value="">Select approved JD</option>
          {jobs.map((job) => (
            <option key={job._id} value={job._id}>{job.roleName} - {job.department || "General"}</option>
          ))}
        </select>
        <input type="search" placeholder="Search candidates, company, recommendation" value={query} onChange={(event) => setQuery(event.target.value)} />
        <input type="number" min="0" max="100" placeholder="Min score" value={minScore} onChange={(event) => setMinScore(event.target.value)} className="md:max-w-32" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="md:max-w-44">
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="assigned">Assigned</option>
          <option value="interview_scheduled">Interview scheduled</option>
          <option value="review">Review</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <Button variant="ai" onClick={handleRankAll} disabled={busy || !selectedJobId || candidates.length === 0}>
          Rank Candidates
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="p-5">
          <h2 className="font-semibold text-slate-950">Application intake</h2>
          <p className="mt-1 text-sm text-slate-500">
            Share the generated public apply link on LinkedIn. One reusable Tally form routes every applicant to the selected job.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <p className="field-label">Selected role</p>
              <p className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-950">
                {selectedJob?.roleName || "Select an approved JD"}
              </p>
            </div>

            <div>
              <p className="field-label">Generated Public Apply Link</p>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {applicationSummary?.applicationLink ? (
                  <p className="break-all text-sm text-slate-700">{applicationSummary.applicationLink}</p>
                ) : (
                  <p className="text-sm text-slate-500">Approve a JD to generate an external application link.</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="field-label">Fetch queue</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{applicationSummary?.pendingCount ?? 0}</p>
                <p className="mt-1 text-xs text-slate-500">{pendingResumeText}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="field-label">Last fetched</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">
                  {applicationSummary?.lastFetchedAt ? new Date(applicationSummary.lastFetchedAt).toLocaleString() : "Never"}
                </p>
              </div>
            </div>

            <div>
              <p className="field-label">Webhook URL</p>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="break-all text-sm text-slate-700">
                  {applicationSummary?.webhookUrl || "Configure WEBHOOK_PUBLIC_BASE_URL to show a full webhook URL."}
                </p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Configure this once in Tally. Job mapping now comes from hidden form fields, not webhook query params.
              </p>
            </div>

            <div className={`rounded-xl border p-3 ${
              intakeStatus.tone === "warning"
                ? "border-amber-200 bg-amber-50"
                : intakeStatus.tone === "success"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-slate-200 bg-slate-50"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <p className="field-label">{intakeStatus.title}</p>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {intakeStatus.items.map((item) => (
                  <p key={item}>{intakeStatus.tone === "warning" ? "Warning: " : "Done: "}{item}</p>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={handleCopyApplicationLink} disabled={!applicationSummary?.applicationLink || fetchingResumes}>
                Copy Link
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(applicationSummary.applicationLink, "_blank", "noopener,noreferrer")}
                disabled={!applicationSummary?.applicationLink || fetchingResumes}
              >
                Open Form
              </Button>
              <Button variant="ai" onClick={handleFetchResumes} disabled={!selectedJobId || fetchingResumes}>
                {fetchingResumes ? "Fetching resumes..." : "Fetch Resumes"}
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                Webhooks store submissions as pending. Fetching downloads resumes, parses them, creates candidates, and runs AI ranking.
              </p>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Shortlisted candidates</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredShortlistedCandidates.length} shortlisted profiles for this role.
                </p>
              </div>
              <span className="chip">{shortlistedCandidates.length} total</span>
            </div>

            {loading ? (
              <div className="mt-5"><Loader label="Loading shortlist..." /></div>
            ) : filteredShortlistedCandidates.length === 0 ? (
              <div className="mt-5">
                <EmptyState title="No shortlisted candidates yet" description="Shortlist ranked applicants who should move into interview consideration for this role." />
              </div>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredShortlistedCandidates.map((candidate) => (
                  <div
                    key={candidate._id}
                    className="cursor-pointer"
                    onClick={() => setSelectedCandidateId(candidate._id)}
                  >
                    <CandidateRankingCard
                      candidate={candidate}
                      onRank={handleRank}
                      onShortlist={handleShortlist}
                      onRequestInterview={openInterviewRequest}
                      busy={busy}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-slate-950">Ranked candidates</h2>
                <p className="mt-1 text-sm text-slate-500">{filteredCandidates.length} profiles in view.</p>
              </div>
              {busy && <Loader label="AI workflow running..." />}
            </div>

            {loading ? (
              <div className="mt-5"><Loader label="Loading candidates..." /></div>
            ) : filteredCandidates.length === 0 ? (
              <div className="mt-5">
                <EmptyState title="No applications received for this role yet" description="Share the generated application link on LinkedIn or fetch submitted resumes to start ranking candidates." />
              </div>
            ) : (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredCandidates.map((candidate) => (
                  <div
                    key={candidate._id}
                    className="cursor-pointer"
                    onClick={() => setSelectedCandidateId(candidate._id)}
                  >
                    <CandidateRankingCard
                      candidate={candidate}
                      onRank={handleRank}
                      onShortlist={handleShortlist}
                      busy={busy}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <CandidateDetails
            candidate={selectedCandidate}
          />
        </div>
      </div>

      <InterviewRequestModal
        candidate={interviewRequestCandidate}
        onClose={closeInterviewRequest}
        onInterviewRequested={async (candidateId) => {
          setSuccess("Interview request sent to interviewer.");
          await refreshCandidateWorkspace(selectedJobId, candidateId);
        }}
      />
    </div>
  );
}

export default Candidates;
