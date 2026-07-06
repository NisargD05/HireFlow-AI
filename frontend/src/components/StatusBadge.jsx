function StatusBadge({ status }) {
  const label = status?.replaceAll("_", " ") || "unknown";

  return <span className={`status-badge status-${status || "unknown"}`}>{label}</span>;
}

export default StatusBadge;
