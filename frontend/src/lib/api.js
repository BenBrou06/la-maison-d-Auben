import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

// Attach admin token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auben_admin_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Public endpoints
export const getSettings = () => api.get("/settings").then((r) => r.data);
export const getCategories = () => api.get("/categories").then((r) => r.data);
export const getProducts = (params) => api.get("/products", { params }).then((r) => r.data);
export const getProduct = (slug) => api.get(`/products/${slug}`).then((r) => r.data);
export const getArticles = (params) => api.get("/articles", { params }).then((r) => r.data);
export const getArticle = (slug) => api.get(`/articles/${slug}`).then((r) => r.data);
export const getFaq = () => api.get("/faq").then((r) => r.data);
export const subscribeNewsletter = (payload) => api.post("/newsletter", payload).then((r) => r.data);
export const sendContact = (payload) => api.post("/contact", payload).then((r) => r.data);

// Payments
export const createCheckout = (payload) => api.post("/payments/checkout", payload).then((r) => r.data);
export const getPaymentStatus = (sid) => api.get(`/payments/status/${sid}`).then((r) => r.data);
export const getOrderBySession = (sid) => api.get(`/orders/by-session/${sid}`).then((r) => r.data);
export const getDownloadInfo = (token) => api.get(`/download-info/${token}`).then((r) => r.data);

// Media url helper
export const mediaUrl = (path) => (path ? `${API}/media/${path}` : "");

// Admin
export const adminLogin = (payload) => api.post("/admin/login", payload).then((r) => r.data);
export const adminMe = () => api.get("/admin/me").then((r) => r.data);
export const adminOrders = () => api.get("/admin/orders").then((r) => r.data);
export const adminNewsletter = () => api.get("/admin/newsletter").then((r) => r.data);
export const adminMessages = () => api.get("/admin/messages").then((r) => r.data);
export const adminSaveProduct = (slug, payload) =>
  (slug ? api.put(`/admin/products/${slug}`, payload) : api.post("/admin/products", payload)).then((r) => r.data);
export const adminUploadProductFile = (slug, formData) =>
  api.post(`/admin/products/${slug}/file`, formData).then((r) => r.data);
