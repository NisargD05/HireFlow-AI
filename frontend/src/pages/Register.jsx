import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios";
import Button from "../components/ui/Button";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "admin"
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      setLoading(true);
      const { data } = await api.post("/auth/signup", formData);
      const verificationEmail = data.email || formData.email.trim().toLowerCase();

      sessionStorage.setItem("pendingVerificationEmail", verificationEmail);
      navigate(`/verify-otp?email=${encodeURIComponent(verificationEmail)}`, {
        state: { email: verificationEmail }
      });
    } catch (error) {
      const response = error.response?.data;

      if (response?.needsVerification && response.email) {
        sessionStorage.setItem("pendingVerificationEmail", response.email);
        navigate(`/verify-otp?email=${encodeURIComponent(response.email)}`, {
          state: { email: response.email }
        });
        return;
      }

      setError(response?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="flex items-center justify-center p-5">
        <form className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8" onSubmit={handleSubmit}>
          <p className="page-kicker">Create workspace access</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Start with the right role</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Admins manage hiring operations. Interviewers get a focused candidate workspace.</p>

          {error && <p className="alert-error mt-5">{error}</p>}

          <div className="mt-6 grid gap-4">
            <label className="block" htmlFor="name">
              <span className="field-label">Name</span>
              <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} className="field-control" required />
            </label>

            <label className="block" htmlFor="email">
              <span className="field-label">Email</span>
              <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} className="field-control" required />
            </label>

            <label className="block" htmlFor="password">
              <span className="field-label">Password</span>
              <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} minLength="6" className="field-control" required />
            </label>

            <fieldset>
              <legend className="field-label">Role</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {["admin", "interviewer"].map((role) => (
                  <label
                    key={role}
                    className={`cursor-pointer rounded-2xl border p-3 text-sm transition ${
                      formData.role === role
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <input className="sr-only" type="radio" name="role" value={role} checked={formData.role === role} onChange={handleChange} />
                    <span className="font-semibold capitalize">{role}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <Button type="submit" disabled={loading} className="mt-6 w-full">
            {loading ? "Creating account..." : "Create account"}
          </Button>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account? <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/login">Sign in</Link>
          </p>
        </form>
      </section>

      <section className="hidden overflow-hidden p-8 text-white lg:block">
        <div className="flex h-full flex-col justify-between rounded-[2rem] border border-white/10 bg-white/10 p-10 shadow-2xl backdrop-blur">
          <div>
            <div className="brand-tile bg-white text-slate-950">AH</div>
            <div className="mt-20 max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">Built for hiring teams</p>
              <h2 className="mt-4 text-5xl font-semibold tracking-tight">One platform for knowledge, JDs, approvals, and interviews.</h2>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-slate-300">Enterprise-ready flow</p>
            <p className="mt-2 text-2xl font-semibold">Admin to interviewer, without clutter.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Register;
