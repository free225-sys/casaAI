import { api } from "./apiClient";
import type {
  CertificationDecisionInput,
  CertificationDetail,
  CertificationEligibility,
  CertificationListItem,
  CertificationRequest,
  CertificationRequestInput,
  CertificationRequestStatus,
  CourseCertificate,
  CourseCertificateEligibility,
  Page,
} from "../types/api";

export const certificationService = {
  list: () => api.get<CertificationListItem[]>("/api/certifications"),
  get: (id: string) => api.get<CertificationDetail>(`/api/certifications/${id}`),
  getMyEligibility: (id: string) =>
    api.get<CertificationEligibility>(`/api/me/certifications/${id}/eligibility`, true),

  getCourseCertificateEligibility: (courseId: string) =>
    api.get<CourseCertificateEligibility>(`/api/courses/${courseId}/certificate/eligibility`, true),
  listMyCourseCertificates: () => api.get<CourseCertificate[]>("/api/me/course-certificates", true),

  // --- Demandes de certification officielle (Lot 3) : décision CASA explicite, jamais automatique --------
  submitRequest: (data: CertificationRequestInput) => api.post<CertificationRequest>("/api/me/certification-requests", data, true),
  listMyRequests: (params: { limit?: number; offset?: number } = {}) =>
    api.get<Page<CertificationRequest>>(`/api/me/certification-requests?limit=${params.limit ?? 100}&offset=${params.offset ?? 0}`, true),
  getMyRequest: (id: string) => api.get<CertificationRequest>(`/api/me/certification-requests/${id}`, true),
  adminListRequests: (params: { state?: CertificationRequestStatus; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.state) q.set("state", params.state);
    q.set("limit", String(params.limit ?? 20));
    q.set("offset", String(params.offset ?? 0));
    return api.get<Page<CertificationRequest>>(`/api/admin/certification-requests?${q.toString()}`, true);
  },
  adminGetRequest: (id: string) => api.get<CertificationRequest>(`/api/admin/certification-requests/${id}`, true),
  decideRequest: (id: string, data: CertificationDecisionInput) =>
    api.post<CertificationRequest>(`/api/admin/certification-requests/${id}/decision`, data, true),
};
