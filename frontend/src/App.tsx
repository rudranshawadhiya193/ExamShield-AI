import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  CircleAlert,
  Cpu,
  Database,
  HardDrive,
  Server,
  ShieldCheck,
  Wifi,
  XCircle,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  getHealth,
  getIncidentSummary,
  getIncidents,
  resolveIncident,
  type HealthResponse,
  type Incident,
  type IncidentSummaryResponse,
} from "./api";

import AIReviewPanel from "./AIReviewPanel";
import ProctoringEvidencePanel from "./ProctoringEvidencePanel";
import FairnessPanel from "./FairnessPanel";
import AuditPanel from "./AuditPanel";
import TrustReportPanel from "./TrustReportPanel";
import PredictionPanel from "./PredictionPanel";

const DEMO_HEALTH: HealthResponse = {
  status: "healthy",
  service: "ExamShield AI Demo Mode",
  timestamp: new Date().toISOString(),
  system: {
    cpu_percent: 32.4,
    memory_percent: 48.7,
    disk_percent: 61.2,
  },
  incidents: [],
};

const DEMO_SUMMARY: IncidentSummaryResponse = {
  status: "success",
  summary: {
    total_incidents: 1,
    open_incidents: 0,
    resolved_incidents: 1,
    critical_incidents: 0,
    high_incidents: 0,
    warning_incidents: 1,
    low_incidents: 0,
    open_critical_incidents: 0,
  },
  severity_breakdown: {
    WARNING: 1,
  },
  type_breakdown: {
    DEMO_NETWORK_RECOVERY: 1,
  },
  timestamp: new Date().toISOString(),
};

const DEMO_INCIDENTS: Incident[] = [
  {
    id: 1,
    type: "DEMO_NETWORK_RECOVERY",
    severity: "WARNING",
    message:
      "Demo environment is using resilient local monitoring while the backend reconnects.",
    status: "RESOLVED",
    created_at: new Date().toISOString(),
    resolved_at: new Date().toISOString(),
  },
];

function HealthBar({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="health-row">
        <div className="health-label">
          {icon}
          <span>{label}</span>
        </div>
        <strong>{value.toFixed(1)}%</strong>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${Math.min(value, 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

function OperationsDashboard() {
  const [health, setHealth] =
    useState<HealthResponse | null>(null);

  const [incidents, setIncidents] =
    useState<Incident[]>([]);

  const [summary, setSummary] =
    useState<IncidentSummaryResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [resolvingId, setResolvingId] =
    useState<number | null>(null);

  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);

  const [backendAvailable, setBackendAvailable] =
    useState(true);

  const loadDashboard = useCallback(
    async () => {
      try {
        setError(null);

        const [
          healthData,
          incidentsData,
          summaryData,
        ] = await Promise.all([
          getHealth(),
          getIncidents(),
          getIncidentSummary(),
        ]);

        setHealth(healthData);
        setIncidents(incidentsData.incidents);
        setSummary(summaryData);
        setBackendAvailable(true);
        setLastUpdated(
          new Date().toLocaleTimeString()
        );
      } catch (requestError) {
        console.error(requestError);
        setBackendAvailable(false);
        setHealth(DEMO_HEALTH);
        setIncidents(DEMO_INCIDENTS);
        setSummary(DEMO_SUMMARY);
        setLastUpdated(
          new Date().toLocaleTimeString()
        );
        setError(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadDashboard();

    const interval = setInterval(() => {
      void loadDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  const resolve = async (
    incidentId: number
  ) => {
    try {
      setResolvingId(incidentId);
      await resolveIncident(incidentId);
      await loadDashboard();
    } catch (requestError) {
      console.error(requestError);
      setError(
        "Could not resolve the selected incident."
      );
    } finally {
      setResolvingId(null);
    }
  };

  const chartData = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        name: "Critical",
        count:
          summary.summary.critical_incidents,
      },
      {
        name: "High",
        count:
          summary.summary.high_incidents,
      },
      {
        name: "Warning",
        count:
          summary.summary.warning_incidents,
      },
      {
        name: "Low",
        count:
          summary.summary.low_incidents,
      },
    ];
  }, [summary]);

  const severityClass = (
    severity: string
  ) => {
    const value = severity.toUpperCase();

    if (value === "CRITICAL") {
      return "badge badge-critical";
    }

    if (value === "HIGH") {
      return "badge badge-high";
    }

    if (value === "WARNING") {
      return "badge badge-warning";
    }

    return "badge badge-low";
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <ShieldCheck size={44} />
        <h1>ExamShield AI</h1>
        <p>
          Loading administrator control center...
        </p>
      </div>
    );
  }

  return (
    <main className="dashboard">
      {error && (
        <div className="error-banner">
          <XCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!backendAvailable && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 10,
            border:
              "1px solid rgba(251,191,36,0.28)",
            background:
              "rgba(251,191,36,0.08)",
            color: "#f6d27d",
            fontSize: 12,
          }}
        >
          DEMO RESILIENCE MODE — hosted backend is
          currently unreachable. Local authentication,
          exam flow and camera evidence remain
          available for the prototype.
        </div>
      )}

      <section className="hero-panel">
        <div>
          <p className="eyebrow">
            ADMINISTRATOR CONTROL CENTER
          </p>

          <h2>
            Monitor exam health.
            <br />
            Detect incidents before they spread.
          </h2>

          <p className="hero-description">
            One administrator view for infrastructure
            health, incidents, AI behaviour review,
            camera-proctoring evidence, fairness,
            prediction, audit integrity, and trust
            reporting.
          </p>
        </div>

        <div
          className={
            "overall-health " +
            (
              health?.status === "warning"
                ? "health-warning"
                : health?.status === "critical"
                  ? "health-critical"
                  : "health-healthy"
            )
          }
        >
          <Activity size={28} />

          <div>
            <span>System Health</span>
            <strong>
              {health?.status?.toUpperCase() ??
                "UNKNOWN"}
            </strong>
          </div>
        </div>
      </section>

      <section className="metric-grid">
        <div className="metric-card">
          <div className="metric-icon">
            <Database size={22} />
          </div>

          <div>
            <span>Total Incidents</span>
            <strong>
              {summary?.summary.total_incidents ??
                0}
            </strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon warning-icon">
            <AlertCircle size={22} />
          </div>

          <div>
            <span>Open Incidents</span>
            <strong>
              {summary?.summary.open_incidents ??
                0}
            </strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon success-icon">
            <CheckCircle2 size={22} />
          </div>

          <div>
            <span>Resolved</span>
            <strong>
              {summary?.summary.resolved_incidents ??
                0}
            </strong>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon danger-icon">
            <CircleAlert size={22} />
          </div>

          <div>
            <span>Critical</span>
            <strong>
              {summary?.summary.critical_incidents ??
                0}
            </strong>
          </div>
        </div>
      </section>

      <section className="content-grid">
        <div className="panel health-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                INFRASTRUCTURE
              </p>
              <h3>Live System Health</h3>
            </div>
            <Server size={23} />
          </div>

          <HealthBar
            icon={<Cpu size={18} />}
            label="CPU Usage"
            value={
              health?.system.cpu_percent ?? 0
            }
          />

          <HealthBar
            icon={<Activity size={18} />}
            label="Memory Usage"
            value={
              health?.system.memory_percent ?? 0
            }
          />

          <HealthBar
            icon={<HardDrive size={18} />}
            label="Disk Usage"
            value={
              health?.system.disk_percent ?? 0
            }
          />

          <div className="health-footer">
            <Wifi size={17} />
            <span>
              Monitoring interval: 5 seconds
            </span>
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">
                RISK DISTRIBUTION
              </p>
              <h3>Incidents by Severity</h3>
            </div>
            <CircleAlert size={23} />
          </div>

          <div className="chart-container">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                />

                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip />

                <Bar
                  dataKey="count"
                  radius={[7, 7, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <ProctoringEvidencePanel
        candidateId="CANDIDATE-001"
      />

      <AIReviewPanel
        candidateId="CANDIDATE-001"
      />

      <FairnessPanel
        candidateId="CANDIDATE-001"
      />

      <PredictionPanel />

      <AuditPanel />

      <TrustReportPanel />

      <section className="panel incidents-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">
              INCIDENT MANAGEMENT
            </p>
            <h3>Recent Incidents</h3>
          </div>

          <div className="incident-count">
            {incidents.length} records
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td className="incident-id">
                    #{incident.id}
                  </td>

                  <td>
                    <span className="incident-type">
                      {incident.type}
                    </span>
                  </td>

                  <td>
                    <span
                      className={severityClass(
                        incident.severity
                      )}
                    >
                      {incident.severity}
                    </span>
                  </td>

                  <td className="message-cell">
                    {incident.message}
                  </td>

                  <td>
                    <span
                      className={
                        "status-pill " +
                        (
                          incident.status ===
                          "OPEN"
                            ? "status-open"
                            : "status-resolved"
                        )
                      }
                    >
                      {incident.status}
                    </span>
                  </td>

                  <td>
                    {incident.status === "OPEN" ? (
                      <button
                        className="resolve-button"
                        disabled={
                          resolvingId ===
                          incident.id
                        }
                        onClick={() =>
                          void resolve(
                            incident.id
                          )
                        }
                      >
                        {resolvingId ===
                        incident.id
                          ? "Resolving..."
                          : "Resolve"}
                      </button>
                    ) : (
                      <span className="resolved-label">
                        <CheckCircle2 size={15} />
                        Resolved
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {incidents.length === 0 && (
            <div className="empty-state">
              <CheckCircle2 size={18} />
              No incidents recorded yet.
            </div>
          )}
        </div>
      </section>

      <div className="dashboard-footer">
        <div>
          <ShieldCheck size={17} />
          <span>
            Prevention → Detection → Response →
            Recovery → Trust
          </span>
        </div>

        <span>
          Last updated:{" "}
          {lastUpdated ?? "Not available"}
        </span>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-section">
          <div className="brand-icon">
            <ShieldCheck size={30} />
          </div>

          <div>
            <h1>ExamShield AI</h1>
            <p>
              Resilient Online Examination Ecosystem
            </p>
          </div>
        </div>

        <div className="topbar-actions">
          <div className="live-indicator">
            <span className="live-dot" />
            ADMIN LIVE MONITOR
          </div>
        </div>
      </header>

      <OperationsDashboard />
    </div>
  );
}
