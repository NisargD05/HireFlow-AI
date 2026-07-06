import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import Card from "../components/ui/Card";
import Loader from "../components/ui/Loader";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/StatusBadge";

function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const { data } = await api.get(`/jobs/${id}`);
        setJob(data.job);
      } catch (error) {
        setError(error.response?.data?.message || "Failed to load job");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  if (loading) {
    return <Loader label="Loading job..." />;
  }

  if (error) {
    return <p className="alert-error">{error}</p>;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Approved role"
        title={job.roleName}
        description={`${job.department || "No department"} - ${job.location || "No location"}`}
        actions={
        <Link
          to="/dashboard/job-listings"
          className="btn btn-secondary"
        >
          Back to Listings
        </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Job Type</p>
          <p className="mt-2 font-semibold">{job.jobType || "-"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Seniority</p>
          <p className="mt-2 font-semibold">{job.seniorityLevel || "-"}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Status</p>
          <div className="mt-2"><StatusBadge status={job.status} /></div>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="font-semibold text-slate-950">Approved job description</h2>
        <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
          {job.approvedJD || job.generatedJD}
        </pre>
      </Card>
    </div>
  );
}

export default JobDetails;
