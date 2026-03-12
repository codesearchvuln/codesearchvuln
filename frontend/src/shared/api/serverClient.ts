import axios from "axios";

// API base URL - points to /api/v1 on the backend
const viteEnv =
	typeof import.meta !== "undefined" &&
	typeof import.meta.env === "object" &&
	import.meta.env !== null
		? import.meta.env
		: undefined;
const baseURL =
	(typeof viteEnv?.VITE_API_BASE_URL === "string" &&
		viteEnv.VITE_API_BASE_URL.trim()) ||
	"/api/v1";

export const apiClient = axios.create({
    baseURL,
    headers: {
        "Content-Type": "application/json",
    },
    maxRedirects: 5,
});
