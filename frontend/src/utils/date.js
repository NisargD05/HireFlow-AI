export function formatDateTime(value) {
  if (!value) {
    return "Not scheduled";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDate(value) {
  if (!value) {
    return "Date not set";
  }

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function formatTimeRange(startsAt, endsAt) {
  if (!startsAt || !endsAt) {
    return "Slot unavailable";
  }

  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short"
  }).format(new Date(startsAt));

  const start = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(startsAt));

  const end = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(endsAt));

  return `${date}, ${start} - ${end}`;
}

export function formatWorkingHours(workingHours) {
  if (!workingHours?.start || !workingHours?.end) {
    return "Working hours not set";
  }

  return `${workingHours.start} - ${workingHours.end}`;
}
