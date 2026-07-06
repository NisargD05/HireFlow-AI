import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";

function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      if (user?.role !== "admin") {
        setLoading(false);
        return;
      }

      try {
        const [jobsResponse, documentsResponse] = await Promise.all([
          api.get("/jobs"),
          api.get("/knowledge-base")
        ]);
        setJobs(jobsResponse.data.jobs || []);
        setDocuments(documentsResponse.data.documents || []);
      } catch {
        setJobs([]);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user?.role]);

  if (user?.role === "interviewer") {
    return <Navigate to="/interviewer/pending" replace />;
  }

  const stats = [
    { label: "Approved jobs", value: jobs.length, detail: "Visible in listings" },
    { label: "Knowledge PDFs", value: documents.length, detail: "Company context files" },
    {
      label: "Indexed documents",
      value: documents.filter((document) => document.status === "indexed").length,
      detail: "Ready for RAG"
    }
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Hiring operations"
        title={`Welcome, ${user?.name}`}
        description="Create roles, prepare company knowledge, review candidates, and manage interviews."
        actions={
          <>
            <Link to="/dashboard/create-job">
              <Button variant="ai">Create JD</Button>
            </Link>
            <Link to="/dashboard/knowledge-base">
              <Button variant="secondary">Upload PDF</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="surface-hover p-5">
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {loading ? "-" : stat.value}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              {stat.detail}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-semibold text-slate-950">Recent approved roles</h2>
          </div>
          {jobs.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No approved roles yet. Create and approve a JD before opening candidate intake.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {jobs.slice(0, 5).map((job) => (
                <Link key={job._id} to={`/dashboard/jobs/${job._id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50">
                  <div>
                    <p className="font-medium text-slate-950">{job.roleName}</p>
                    <p className="mt-1 text-sm text-slate-500">{job.department || "No department"} - {job.location || "Location TBD"}</p>
                  </div>
                  <span className="status-badge status-approved">{job.status}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-slate-950">Quick actions</h2>
          <div className="mt-4 grid gap-3">
            <Link className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/50" to="/dashboard/knowledge-base">
              <p className="font-medium text-slate-950">Index company context</p>
              <p className="mt-1 text-sm text-slate-500">Upload PDFs so generated JDs can use organization-specific language.</p>
            </Link>
            <Link className="rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/50" to="/dashboard/create-job">
              <p className="font-medium text-slate-950">Generate a new JD</p>
              <p className="mt-1 text-sm text-slate-500">Move from role inputs to editable AI draft and approval.</p>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
