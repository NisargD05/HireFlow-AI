import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import Card from "../components/ui/Card";
import EmptyState from "../components/ui/EmptyState";
import Loader from "../components/ui/Loader";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/StatusBadge";

function JobListings() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const { data } = await api.get("/jobs");
        setJobs(data.jobs);
      } catch (error) {
        setError(error.response?.data?.message || "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) =>
      [
        job.roleName,
        job.department,
        job.location,
        job.jobType,
        job.seniorityLevel,
        job.status
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
    );
  }, [jobs, query]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Published roles"
        title="Job Listings"
        description="Approved roles ready for candidate intake and review."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Approved jobs</h2>
            <p className="mt-1 text-sm text-slate-500">{jobs.length} roles ready for candidates.</p>
          </div>
          <input
            type="search"
            placeholder="Search role, department, status"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field-control mt-0 md:max-w-sm"
          />
        </div>

        {error && <p className="alert-error m-5">{error}</p>}

        {loading ? (
          <div className="p-5"><Loader label="Loading approved jobs..." /></div>
        ) : jobs.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No approved jobs yet" description="Create and approve a job description before collecting applications for a role." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Location</th>
                  <th className="px-5 py-3">Job Type</th>
                  <th className="px-5 py-3">Seniority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job._id}>
                    <td className="font-medium text-slate-900">
                      <div>
                        <p>{job.roleName}</p>
                        <p className="mt-1 text-xs font-normal text-slate-400">
                          Created by {job.createdBy?.name || "Recruiter"}
                        </p>
                      </div>
                    </td>
                    <td>{job.department || "-"}</td>
                    <td>{job.location || "-"}</td>
                    <td>{job.jobType ? <span className="chip">{job.jobType}</span> : "-"}</td>
                    <td>
                      {job.seniorityLevel || "-"}
                    </td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td>
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Link
                          to={`/dashboard/jobs/${job._id}`}
                          className="btn btn-secondary px-3 py-1.5 text-xs"
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default JobListings;
