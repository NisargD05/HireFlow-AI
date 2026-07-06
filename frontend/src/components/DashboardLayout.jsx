import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const iconMap = {
  Dashboard: "D",
  "Knowledge Base": "K",
  "Create Job": "C",
  "Job Listings": "J",
  Candidates: "P",
  Interviews: "I",
  "Pending Requests": "P",
  "Upcoming Interviews": "U",
  "Feedback History": "F"
};

function DashboardLayout() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const navItems =
    user?.role === "interviewer"
      ? [
          { label: "Pending Requests", to: "/interviewer/pending" },
          { label: "Upcoming Interviews", to: "/interviewer/upcoming" },
          { label: "Feedback History", to: "/interviewer/feedback-history" }
        ]
      : [
          { label: "Dashboard", to: "/dashboard", end: true, roles: ["admin"] },
          { label: "Knowledge Base", to: "/dashboard/knowledge-base", roles: ["admin"] },
          { label: "Create Job", to: "/dashboard/create-job", roles: ["admin"] },
          { label: "Job Listings", to: "/dashboard/job-listings", roles: ["admin"] },
          { label: "Candidates", to: "/dashboard/candidates", roles: ["admin"] },
          { label: "Interviews", to: "/dashboard/interviews", roles: ["admin"] }
        ];
  const visibleNavItems = navItems.filter((item) => {
    if (!item.roles) {
      return true;
    }

    return item.roles.includes(user?.role);
  });

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const roleLabel = user?.role === "interviewer" ? "Interview workspace" : "Hiring operations";

  return (
    <div className="app-bg text-slate-900">
      <aside className="shell-sidebar">
        <div className="flex items-center gap-3 px-2">
          <div className="brand-tile">AH</div>
          <div>
            <p className="text-sm font-semibold text-slate-950">AI Hiring</p>
            <p className="text-xs text-slate-500">{roleLabel}</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1.5">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `nav-item ${isActive ? "nav-item-active" : ""}`
              }
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-current/10 text-xs font-bold">
                {iconMap[item.label]}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-4 bottom-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">{user?.name}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{user?.email}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-600 ring-1 ring-slate-200">
              {user?.role}
            </span>
            <button type="button" onClick={handleLogout} className="text-xs font-semibold text-slate-500 hover:text-slate-950">
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</p>
              <h2 className="mt-1 text-lg font-semibold">
                {user?.name}{" "}
                <span className="text-sm font-normal capitalize text-slate-500">
                  ({user?.role})
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex max-w-full gap-2 overflow-x-auto xl:hidden">
                {visibleNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `mobile-nav-item ${isActive ? "mobile-nav-item-active" : ""}`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;
