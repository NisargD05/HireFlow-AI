function Loader({ label = "Loading..." }) {
  return (
    <div className="surface flex items-center gap-3 p-5 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      {label}
    </div>
  );
}

export default Loader;
