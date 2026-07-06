import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function AppLayout({ children }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const links =
    user?.role === "interviewer"
      ? [
          { to: "/interviewer/pending", label: "Pending Requests" },
          { to: "/interviewer/upcoming", label: "Upcoming Interviews" },
          { to: "/interviewer/feedback-history", label: "Feedback History" }
        ]
      : [{ to: "/dashboard", label: "Overview" }];

  return (
    <div className="app-bg text-slate-900">
      <aside className="shell-sidebar">
        <div className="flex items-center gap-3 px-2">
          <div className="brand-tile">IH</div>
          <div>
            <p className="text-sm font-semibold text-slate-950">Interview Hub</p>
            <p className="text-xs text-slate-500">Focused interview workspace</p>
          </div>
        </div>

        <nav className="mt-8 space-y-1.5">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-item ${isActive ? "nav-item-active" : ""}`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-current/10 text-xs font-bold">
                {link.label.slice(0, 1)}
              </span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute inset-x-4 bottom-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">{user?.name}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{user?.email}</p>
          <button className="btn btn-secondary mt-3 w-full" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-header xl:hidden">
          <div className="flex gap-2 overflow-x-auto">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `mobile-nav-item ${isActive ? "mobile-nav-item-active" : ""}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        </header>
        <main className="workspace">{children}</main>
      </div>
    </div>
  );
}

export default AppLayout;
