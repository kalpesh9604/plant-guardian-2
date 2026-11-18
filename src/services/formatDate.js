export function formatDateTime(value, format = "local") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  if (format === "utc") {
    return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }

  return date.toLocaleString();
}

export function formatDate(value, format = "local") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return format === "utc"
    ? `${date.toISOString().slice(0, 10)} UTC`
    : date.toLocaleDateString();
}
