import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Button from "../components/ui/Button";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // Display success message from OTP verification
  useEffect(() => {
    if (location.state?.message) {
      setSuccess(location.state.message);
    }
  }, [location.state]);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setUnverifiedEmail("");

    try {
      setLoading(true);
      const loggedInUser = await login(formData);
      navigate(loggedInUser.role === "interviewer" ? "/interviewer/pending" : "/dashboard");
    } catch (error) {
      const message = error.response?.data?.message || "Login failed";
      setError(message);

      if (error.response?.status === 403 && message.toLowerCase().includes("verify")) {
        setUnverifiedEmail(formData.email.trim().toLowerCase());
      }
    } finally {
      setLoading(false);
    }
  };

  const goToVerification = () => {
    if (!unverifiedEmail) {
      return;
    }

    sessionStorage.setItem("pendingVerificationEmail", unverifiedEmail);
    navigate(`/verify-otp?email=${encodeURIComponent(unverifiedEmail)}`, {
      state: { email: unverifiedEmail }
    });
  };

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden overflow-hidden p-8 text-white lg:block">
        <div className="flex h-full flex-col justify-between rounded-[2rem] border border-white/10 bg-white/10 p-10 shadow-2xl backdrop-blur">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-bold text-slate-950">
                AH
              </div>
              <div>
                <p className="font-semibold">AI Hiring</p>
                <p className="text-sm text-slate-300">Enterprise hiring intelligence</p>
              </div>
            </div>
            <div className="mt-20 max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-300">Operational AI for talent teams</p>
              <h1 className="mt-4 text-5xl font-semibold tracking-tight">
                Turn company knowledge into faster, cleaner hiring workflows.
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Manage knowledge, generate role-aware JDs, approve listings, and keep interviewers focused in one polished workspace.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {["RAG-ready JD generation", "Role-based access", "Human review workflow"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center p-5">
        <form className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8" onSubmit={handleSubmit}>
          <p className="page-kicker">Welcome back</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Sign in to your workspace</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Use your admin or interviewer account to continue.</p>

          {success && <p className="alert-success mt-5">{success}</p>}
          {error && <p className="alert-error mt-5">{error}</p>}

          <div className="mt-6 space-y-4">
            <label className="block" htmlFor="email">
              <span className="field-label">Email</span>
              <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="field-control" required />
            </label>

            <label className="block" htmlFor="password">
              <span className="field-label">Password</span>
              <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} className="field-control" required />
            </label>
          </div>

          <Button type="submit" variant="primary" disabled={loading} className="mt-6 w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>

          {unverifiedEmail && (
            <Button type="button" variant="secondary" onClick={goToVerification} className="mt-3 w-full">
              Verify email
            </Button>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Need an account? <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/register">Create one</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

export default Login;
