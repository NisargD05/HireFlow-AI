import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch() {}

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
          <section className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <p className="page-kicker text-red-600">Workspace error</p>
            <h1 className="mt-2 text-xl font-semibold text-slate-950">Something failed while rendering this page.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              The app stayed alive instead of showing a blank screen. Refresh the page or sign in again.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-xl bg-red-50 p-3 text-xs text-red-700">
              {this.state.error.message}
            </pre>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
