
import { Capacitor } from "@capacitor/core";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL =
  (configuredApiBaseUrl || "/api").replace(/\/$/, "");

export async function apiRequest(endpoint, options = {}) {
  if (Capacitor.isNativePlatform() && !configuredApiBaseUrl) {
    throw new Error("Configure VITE_API_BASE_URL and rebuild the Android app to connect to the backend.");
  }

  const token = localStorage.getItem("plantGuardianToken");
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (!isFormData && options.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("plantGuardianToken");
      localStorage.removeItem("plantGuardianUser");
      window.dispatchEvent(new Event("plantguardian:unauthorized"));
    }

    throw new Error(data?.message || "Something went wrong.");
  }

  return data;
}

