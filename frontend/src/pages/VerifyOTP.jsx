import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import api from "../api/axios";
import Button from "../components/ui/Button";

function VerifyOTP() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const email =
    location.state?.email ||
    searchParams.get("email") ||
    sessionStorage.getItem("pendingVerificationEmail");

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  useEffect(() => {
    if (!email) {
      navigate("/register");
      return;
    }

    sessionStorage.setItem("pendingVerificationEmail", email);
  }, [email, navigate]);

  // Countdown timer for resend button
  useEffect(() => {
    let interval;
    if (resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    } else if (resendCountdown === 0 && resendDisabled) {
      setResendDisabled(false);
    }
    return () => clearInterval(interval);
  }, [resendCountdown, resendDisabled]);

  const handleOtpChange = (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, 6);
    setOtp(value);
  };

  const handleVerifyOTP = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.post("/auth/verify-otp", {
        email,
        otp
      });

      setSuccess(data.message || "Email verified successfully!");
      setOtp("");
      sessionStorage.removeItem("pendingVerificationEmail");

      setTimeout(() => {
        navigate("/login", { state: { message: "Email verified! Please login with your credentials." } });
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.message || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setSuccess("");

    try {
      setResendLoading(true);
      const { data } = await api.post("/auth/resend-otp", { email });
      setSuccess(data.message || "OTP sent successfully!");
      setResendDisabled(true);
      setResendCountdown(30);
      setOtp("");
    } catch (error) {
      if (error.response?.status === 429) {
        setError(error.response?.data?.message || "Too many requests. Please try again later.");
      } else {
        setError(error.response?.data?.message || "Failed to resend OTP");
      }
    } finally {
      setResendLoading(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <main className="grid min-h-screen bg-slate-950 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="flex items-center justify-center p-5">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl md:p-8">
          <p className="page-kicker">Verify your email</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Verification code</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            We sent a 6-digit code to <span className="font-semibold">{email}</span>. Enter it below to verify your email.
          </p>

          {error && <p className="alert-error mt-5">{error}</p>}
          {success && <p className="alert-success mt-5">{success}</p>}

          <form onSubmit={handleVerifyOTP} className="mt-6">
            <label htmlFor="otp" className="block">
              <span className="field-label">Verification Code</span>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={handleOtpChange}
                placeholder="000000"
                className="field-control text-center text-2xl tracking-[0.5em] font-mono"
                maxLength="6"
                required
              />
              <p className="mt-2 text-xs text-slate-500">Enter the 6-digit code</p>
            </label>

            <Button type="submit" disabled={loading || otp.length !== 6} className="mt-6 w-full">
              {loading ? "Verifying..." : "Verify Email"}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-center text-sm text-slate-600">Didn't receive the code?</p>
            <Button
              type="button"
              variant="secondary"
              disabled={resendDisabled || resendLoading}
              onClick={handleResendOTP}
              className="mt-3 w-full"
            >
              {resendLoading ? "Sending..." : resendDisabled ? `Resend in ${resendCountdown}s` : "Resend Code"}
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            OTP expires in 5 minutes
          </p>
        </div>
      </section>

      <section className="hidden overflow-hidden p-8 text-white lg:block">
        <div className="flex h-full flex-col justify-between rounded-[2rem] border border-white/10 bg-white/10 p-10 shadow-2xl backdrop-blur">
          <div>
            <div className="brand-tile bg-white text-slate-950">AH</div>
            <div className="mt-20 max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300">Secure verification</p>
              <h2 className="mt-4 text-5xl font-semibold tracking-tight">Verify ownership of your email address.</h2>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                We send a verification code to make sure it's really you. This keeps your hiring workspace secure.
              </p>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5">
            <p className="text-sm text-slate-300">Enterprise security</p>
            <p className="mt-2 text-2xl font-semibold">Email verification prevents unauthorized access.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default VerifyOTP;
