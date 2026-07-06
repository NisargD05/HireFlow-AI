import { useState } from "react";
import api from "../api/axios";
import FormField from "../components/FormField";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/StatusBadge";

const initialForm = {
  roleName: "",
  department: "",
  location: "",
  experienceRequired: "",
  salaryRange: "",
  skills: "",
  education: "",
  jobType: "",
  numberOfOpenings: "1",
  seniorityLevel: "",
  mandatoryRequirements: ""
};

function CreateJob() {
  const [formData, setFormData] = useState(initialForm);
  const [jobId, setJobId] = useState("");
  const [generatedJD, setGeneratedJD] = useState("");
  const [status, setStatus] = useState("draft");
  const [sources, setSources] = useState([]);
  const [agentSteps, setAgentSteps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value
    });
  };

  const resetFeedback = () => {
    setMessage("");
    setError("");
  };

  const validateForm = () => {
    if (!formData.roleName.trim()) {
      setError("Role name is required");
      return false;
    }

    return true;
  };

  const handleGenerate = async () => {
    resetFeedback();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.post("/jobs/generate-jd", {
        ...formData,
        jobId: jobId || undefined
      });

      setJobId(data.job._id);
      setGeneratedJD(data.job.generatedJD);
      setStatus(data.job.status);
      setSources(data.knowledgeBaseSources || []);
      setAgentSteps(data.agentSteps || []);
      setMessage("AI-generated JD is ready for review and editing.");
    } catch (error) {
      setError(error.response?.data?.message || "Failed to generate JD");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    resetFeedback();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      if (!jobId) {
        const { data } = await api.post("/jobs/create", formData);
        setJobId(data.job._id);
        setStatus(data.job.status);
        setMessage("Draft job saved.");
        return;
      }

      const { data } = await api.put(`/jobs/${jobId}/edit-jd`, {
        generatedJD
      });
      setStatus(data.job.status);
      setMessage("Draft JD changes saved.");
    } catch (error) {
      setError(error.response?.data?.message || "Failed to save draft");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    resetFeedback();

    if (!jobId || !generatedJD.trim()) {
      setError("Generate and review a JD before approval");
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.post(`/jobs/${jobId}/approve`);
      setStatus(data.job.status);
      setMessage("JD approved. This job now appears in Job Listings.");
    } catch (error) {
      setError(error.response?.data?.message || "Failed to approve JD");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="AI job workflow"
        title="Create Job"
        description="Capture role inputs, retrieve company context, generate a polished JD, edit it, and approve it for listings."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <Card className="p-5">
        <div className="mb-5 flex flex-col gap-2 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Role blueprint</h2>
            <p className="text-sm text-slate-500">
              Start with required role details, then add optional context to improve retrieval and generation quality.
            </p>
          </div>
          <StatusBadge status={status} />
        </div>

        <div className="space-y-6">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Required</p>
            <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Role Name"
            name="roleName"
            value={formData.roleName}
            onChange={handleChange}
            required
            placeholder="Senior Backend Engineer"
          />
              <FormField
                label="Number of Openings"
                name="numberOfOpenings"
                type="number"
                value={formData.numberOfOpenings}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Role context</p>
            <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Department"
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="Engineering"
          />
          <FormField
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="Remote, Bengaluru, New York"
          />
          <FormField
            label="Experience Required"
            name="experienceRequired"
            value={formData.experienceRequired}
            onChange={handleChange}
            placeholder="4+ years"
          />
          <FormField
            label="Salary Range"
            name="salaryRange"
            value={formData.salaryRange}
            onChange={handleChange}
            placeholder="$120k - $150k"
          />
          <FormField
            label="Skills"
            name="skills"
            value={formData.skills}
            onChange={handleChange}
            placeholder="Node.js, React, MongoDB"
          />
          <FormField
            label="Education"
            name="education"
            value={formData.education}
            onChange={handleChange}
            placeholder="Bachelor's degree or equivalent"
          />
          <FormField
            label="Job Type"
            name="jobType"
            value={formData.jobType}
            onChange={handleChange}
            placeholder="Full-time"
          />
          <FormField
            label="Seniority Level"
            name="seniorityLevel"
            value={formData.seniorityLevel}
            onChange={handleChange}
            placeholder="Senior"
          />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Hiring constraints</p>
            <div className="grid gap-4">
          <div className="md:col-span-2">
            <FormField
              label="Mandatory Requirements"
              name="mandatoryRequirements"
              value={formData.mandatoryRequirements}
              onChange={handleChange}
              textarea
              placeholder="Must have experience with distributed systems and hiring platform workflows."
            />
          </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-4 mt-6 rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={handleGenerate} disabled={loading} variant="ai" className="flex-1">
            {loading ? "Generating with AI..." : "Generate JD"}
          </Button>
          <Button type="button" onClick={handleSaveDraft} disabled={loading} variant="secondary" className="flex-1">
            Save Draft
          </Button>
          <Button type="button" onClick={handleApprove} disabled={loading || status === "approved"} variant="success" className="flex-1">
            Approve JD
          </Button>
          </div>
        </div>

        {message && <p className="alert-success mt-4">{message}</p>}
        {error && <p className="alert-error mt-4">{error}</p>}
        </Card>

        <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
          <h2 className="font-semibold text-slate-950">AI-generated JD editor</h2>
          <p className="text-sm text-slate-500">
            Review, refine, and approve only when the role reads like your organization.
          </p>
            </div>
            {loading && (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                Thinking
              </span>
            )}
          </div>
        </div>
        <textarea
          value={generatedJD}
          onChange={(event) => setGeneratedJD(event.target.value)}
          rows="18"
          className="min-h-[35rem] w-full resize-y border-0 bg-white px-5 py-5 text-sm leading-7 text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
          placeholder="Generated job description will appear here after the AI workflow runs."
        />
        </Card>
      </div>

      {(agentSteps.length > 0 || sources.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="font-semibold text-slate-950">Agent steps</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {agentSteps.map((step) => (
                <li key={step} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  {step}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold text-slate-950">Knowledge sources</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {sources.map((source, index) => (
                <li key={`${source.sourceFileName}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="font-semibold">{source.sourceFileName}</span>
                  <p className="mt-1 line-clamp-2">{source.chunkText}</p>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}

export default CreateJob;
