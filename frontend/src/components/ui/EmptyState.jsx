function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">
        AI
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default EmptyState;
