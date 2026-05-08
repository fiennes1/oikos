import axios from "axios";
import { useAuthStore } from "../store/auth.js";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const t = useAuthStore.getState().access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const orig = error.config;
    if (error.response?.status === 401 && !orig._retry && useAuthStore.getState().refresh) {
      orig._retry = true;
      try {
        refreshing =
          refreshing ||
          axios.post("/api/auth/token/refresh/", { refresh: useAuthStore.getState().refresh });
        const { data } = await refreshing;
        refreshing = null;
        useAuthStore.getState().setTokens(data.access, useAuthStore.getState().refresh);
        orig.headers.Authorization = `Bearer ${data.access}`;
        return api(orig);
      } catch {
        refreshing = null;
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
