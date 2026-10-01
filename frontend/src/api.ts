import axios from "axios";


const TOKEN_KEY =
  "examshield_access_token";

const DEPLOYED_BACKEND_URL =
  "https://examshield-ai-7fvx.onrender.com";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith("github.io")
      ? DEPLOYED_BACKEND_URL
      : "/backend"
  );


const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});


api.interceptors.request.use(
  (config) => {

    const token =
      localStorage.getItem(
        TOKEN_KEY
      );

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return config;
  }
);


/* =======================================================
   INCIDENTS
   ======================================================= */

export interface Incident {
  id: number;
  type: string;
  severity: string;
  message: string;
  status: string;
  created_at: string | null;
  resolved_at: string | null;
}


export interface IncidentSummary {
  total_incidents: number;
  open_incidents: number;
  resolved_incidents: number;
  critical_incidents: number;
  high_incidents: number;
  warning_incidents: number;
  low_incidents: number;
  open_critical_incidents: number;
}


export interface IncidentSummaryResponse {
  status: string;
  summary: IncidentSummary;
  severity_breakdown: Record<string, number>;
  type_breakdown: Record<string, number>;
  timestamp: string;
}


export interface IncidentsResponse {
  status: string;
  total_incidents: number;
  incidents: Incident[];
  timestamp: string;
}


export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;

  system: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };

  incidents: Array<{
    id: number;
    type: string;
    severity: string;
    message: string;
    status: string;
    action: string;
  }>;
}


/* =======================================================
   ANOMALY / AI REVIEW
   ======================================================= */

export interface AnomalyEvent {
  event_id: string;
  question_id: string;
  risk_score: number;
  risk_level: string;
  flags: string[];
  answer_time_ms: number;
  answer_changes: number;
  focus_changes: number;
  offline_duration_ms: number;
  navigation_count: number;
  created_at: string;
}


export interface CandidateAnomalySummary {
  total_events: number;
  average_risk_score: number;
  maximum_risk_score: number;
  review_required_events: number;
  high_risk_events: number;
  risk_level_distribution: Record<
    string,
    number
  >;
}


export interface CandidateAnomalyResponse {
  status: string;
  candidate_id: string;
  summary: CandidateAnomalySummary;
  recent_events: AnomalyEvent[];
  policy_note: string;
  timestamp: string;
}


/* =======================================================
   FAIRNESS
   ======================================================= */

export interface FairnessEvent {
  disruption_id: string;
  incident_id: number | null;
  disruption_type: string;
  duration_ms: number;
  affected_questions: number;
  pending_responses: number;
  recovered_responses: number;
  impact_score: number;
  impact_level: string;
  recommendation: string;
  evidence: string[];
  created_at: string;
}


export interface FairnessSummary {
  total_disruptions: number;
  average_impact_score: number;
  maximum_impact_score: number;
  severe_disruptions: number;
  high_impact_disruptions: number;
  total_affected_questions: number;
  total_recovered_responses: number;
}


export interface CandidateFairnessResponse {
  status: string;
  candidate_id: string;
  summary: FairnessSummary;
  recent_disruptions: FairnessEvent[];
  policy_note: string;
  timestamp: string;
}


/* =======================================================
   AUDIT
   ======================================================= */

export interface AuditEvent {
  id: number;
  event_type: string;
  actor: string;
  entity_type: string;
  entity_id: string;
  payload: string;
  previous_hash: string;
  event_hash: string;
  created_at: string | null;
}


export interface AuditEventsResponse {
  status: string;
  total_events: number;
  events: AuditEvent[];
  timestamp: string;
}


export interface AuditVerification {
  valid: boolean;
  total_events: number;
  message: string;
  latest_hash?: string;
  failed_event_id?: number;
}


export interface AuditVerificationResponse {
  status: string;
  audit_verification: AuditVerification;
  timestamp: string;
}


/* =======================================================
   AI FAILURE PREDICTION
   ======================================================= */

export interface PredictionRequest {
  mode:
    | "LIVE"
    | "SIMULATED";

  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
  db_latency_ms?: number;
  open_incidents?: number;
}


export interface PredictionMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  db_latency_ms: number;
  open_incidents: number;
}


export interface PredictionTrend {
  cpu_slope: number;
  memory_slope: number;
  latency_slope: number;
  samples_considered: number;
}


export interface PredictionModelInfo {
  type: string;
  version: string;
  forecast_window_minutes: number;
  method: string;
  dataset_type: string;
}


export interface PredictionResponse {
  status: string;
  forecast_window_minutes: number;
  failure_probability: number;
  risk_level: string;
  factors: string[];
  current_metrics: PredictionMetrics;
  trend: PredictionTrend;
  model: PredictionModelInfo;
  source: string;
  timestamp: string;
}


export interface PredictionHistoryItem {
  id: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  db_latency_ms: number;
  open_incidents: number;
  cpu_slope: number;
  memory_slope: number;
  latency_slope: number;
  failure_probability: number;
  risk_level: string;
  factors: string[];
  source: string;
  created_at: string;
}


export interface PredictionHistoryResponse {
  status: string;
  total: number;
  records: PredictionHistoryItem[];
}


/* =======================================================
   AI PROCTORING EVIDENCE
   ======================================================= */

export interface ProctoringEvent {
  id: string;
  candidate_id: string;
  exam_id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  time: string | null;
}

export interface ProctoringEvidenceResponse {
  status: string;
  candidate_id: string;
  total: number;
  events: ProctoringEvent[];
  timestamp: string;
}


/* =======================================================
   POST-EXAM TRUST REPORT
   ======================================================= */

export interface TrustReportResponse {
  status: string;
  report_type: string;
  generated_at: string;

  scope: {
    exam_id: string | null;
    candidate_id: string | null;
    note: string;
  };

  operational_summary: {
    total_incidents: number;
    open_incidents: number;
    resolved_incidents: number;
    critical_incidents: number;
    high_incidents: number;
    predictive_failure_incidents: number;
    operational_status: string;
  };

  prediction_summary: {
    predictions_evaluated: number;
    maximum_failure_probability: number;
    critical_predictions: number;
    high_predictions: number;
    watch_predictions: number;

    latest_prediction: {
      failure_probability: number;
      risk_level: string;
      source: string;
      created_at: string | null;
    } | null;
  };

  anomaly_summary: {
    events_evaluated: number;
    average_risk_score: number;
    maximum_risk_score: number;
    review_required_events: number;
    high_risk_events: number;
    policy: string;
  };

  fairness_summary: {
    disruptions_evaluated: number;
    average_impact_score: number;
    maximum_impact_score: number;
    severe_disruptions: number;
    high_impact_disruptions: number;
    total_affected_questions: number;
    total_recovered_responses: number;
    policy: string;
  };

  response_integrity: {
    total_responses: number;
    verified_responses: number;
    failed_responses: number;
    integrity_status: string;
    failed_response_ids: string[];
  };

  audit_integrity: {
    total_audit_events: number;
    chain_valid: boolean;
    verification_message: string;
    latest_hash?: string;
    failed_event_id?: number;
  };

  overall_trust_status: string;
}


/* =======================================================
   API FUNCTIONS
   ======================================================= */

export async function getHealth(): Promise<HealthResponse> {
  const response =
    await api.get<HealthResponse>(
      "/health/"
    );

  return response.data;
}


export async function getIncidents(): Promise<IncidentsResponse> {
  const response =
    await api.get<IncidentsResponse>(
      "/incidents/"
    );

  return response.data;
}


export async function getIncidentSummary(): Promise<IncidentSummaryResponse> {
  const response =
    await api.get<IncidentSummaryResponse>(
      "/incidents/summary"
    );

  return response.data;
}


export async function resolveIncident(
  incidentId: number
): Promise<unknown> {

  const response =
    await api.patch(
      `/incidents/${incidentId}/resolve`
    );

  return response.data;
}


export async function getCandidateAnomalySummary(
  candidateId: string
): Promise<CandidateAnomalyResponse> {

  const response =
    await api.get<CandidateAnomalyResponse>(
      `/anomaly/candidate/${candidateId}`
    );

  return response.data;
}


export async function getCandidateFairness(
  candidateId: string
): Promise<CandidateFairnessResponse> {

  const response =
    await api.get<CandidateFairnessResponse>(
      `/fairness/candidate/${candidateId}`
    );

  return response.data;
}


export async function getAuditEvents(): Promise<AuditEventsResponse> {

  const response =
    await api.get<AuditEventsResponse>(
      "/audit/events"
    );

  return response.data;
}


export async function verifyAuditChain(): Promise<AuditVerificationResponse> {

  const response =
    await api.get<AuditVerificationResponse>(
      "/audit/verify"
    );

  return response.data;
}


/* =======================================================
   AI FAILURE PREDICTION FUNCTIONS
   ======================================================= */

export async function getFailurePrediction(
  request: PredictionRequest
): Promise<PredictionResponse> {

  const response =
    await api.post<PredictionResponse>(
      "/prediction/forecast",
      request
    );

  return response.data;
}


export async function getPredictionHistory(): Promise<PredictionHistoryResponse> {

  const response =
    await api.get<PredictionHistoryResponse>(
      "/prediction/history"
    );

  return response.data;
}


export async function getPredictionModelInfo(): Promise<unknown> {

  const response =
    await api.get(
      "/prediction/model-info"
    );

  return response.data;
}


/* =======================================================
   TRUST REPORT FUNCTION
   ======================================================= */

export async function getTrustReport(
  examId?: string,
  candidateId?: string
): Promise<TrustReportResponse> {

  const params: Record<
    string,
    string
  > = {};

  if (examId) {
    params.exam_id =
      examId;
  }

  if (candidateId) {
    params.candidate_id =
      candidateId;
  }

  const response =
    await api.get<TrustReportResponse>(
      "/reports/trust",
      {
        params,
      }
    );

  return response.data;
}

export default api;



export async function recordProctoringEvent(
  event: {
    event_id: string;
    candidate_id: string;
    exam_id: string;
    event_type: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    message: string;
  }
): Promise<ProctoringEvent> {
  const response = await api.post<{
    status: string;
    event: ProctoringEvent;
  }>("/proctoring/events", event);

  return response.data.event;
}


export async function getProctoringEvidence(
  candidateId: string
): Promise<ProctoringEvidenceResponse> {
  const response =
    await api.get<ProctoringEvidenceResponse>(
      `/proctoring/events/${candidateId}`
    );

  return response.data;
}
