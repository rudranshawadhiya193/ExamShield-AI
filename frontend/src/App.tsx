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
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CloudUpload,
  Cpu,
  Database,
  HardDrive,
  LockKeyhole,
  
  RotateCcw,
  Server,
  ShieldCheck,
  UserRound,
  Wifi,
  WifiOff,
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

import {
  getAccessToken,
} from "./auth";

import {
  buildOfflineResponse,
  loadResponseQueue,
  removeQueuedResponse,
  upsertQueuedResponse,
  type OfflineResponse,
} from "./examStorage";

import AIReviewPanel from "./AIReviewPanel";
import FairnessPanel from "./FairnessPanel";
import AuditPanel from "./AuditPanel";
import TrustReportPanel from "./TrustReportPanel";
import PredictionPanel from "./PredictionPanel";


const questions = [
  {
    id: "Q1",
    text: "Which layer is primarily responsible for reliable end-to-end delivery?",
    options: [
      "Application Layer",
      "Transport Layer",
      "Physical Layer",
      "Presentation Layer",
    ],
  },
  {
    id: "Q2",
    text: "Which database property means that a transaction is all-or-nothing?",
    options: [
      "Consistency",
      "Isolation",
      "Atomicity",
      "Durability",
    ],
  },
  {
    id: "Q3",
    text: "What does SHA-256 provide in a tamper-evident system?",
    options: [
      "Compression",
      "Integrity fingerprint",
      "Network routing",
      "User authentication",
    ],
  },
  {
    id: "Q4",
    text: "What helps an application continue collecting data during temporary connectivity loss?",
    options: [
      "Offline local buffer",
      "CSS",
      "DNS only",
      "Static HTML",
    ],
  },
  {
    id: "Q5",
    text: "When AI flags unusual exam behavior, what should happen before disciplinary action?",
    options: [
      "Automatic punishment",
      "Human review and audit",
      "Delete the evidence",
      "Hide the decision",
    ],
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
    <div
      style={{
        marginBottom: "18px",
      }}
    >
      <div className="health-row">
        <div className="health-label">
          {icon}

          <span>
            {label}
          </span>
        </div>

        <strong>
          {value.toFixed(1)}%
        </strong>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{
            width: `${Math.min(
              value,
              100
            )}%`,
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
    useState<IncidentSummaryResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [resolvingId, setResolvingId] =
    useState<number | null>(null);

  const [lastUpdated, setLastUpdated] =
    useState<string | null>(null);


  const loadDashboard =
    useCallback(async () => {
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

        setHealth(
          healthData
        );

        setIncidents(
          incidentsData.incidents
        );

        setSummary(
          summaryData
        );

        setLastUpdated(
          new Date().toLocaleTimeString()
        );
      } catch (error) {
        console.error(error);

        setError(
          "Unable to connect to ExamShield backend."
        );
      } finally {
        setLoading(false);
      }
    }, []);


  useEffect(() => {
    loadDashboard();

    const interval =
      setInterval(
        loadDashboard,
        5000
      );

    return () =>
      clearInterval(interval);
  }, [loadDashboard]);


  const resolve = async (
    incidentId: number
  ) => {
    try {
      setResolvingId(
        incidentId
      );

      await resolveIncident(
        incidentId
      );

      await loadDashboard();
    } catch (error) {
      console.error(error);

      setError(
        "Could not resolve incident."
      );
    } finally {
      setResolvingId(
        null
      );
    }
  };


  const chartData =
    useMemo(() => {
      if (!summary) {
        return [];
      }

      return [
        {
          name: "Critical",
          count:
            summary.summary
              .critical_incidents,
        },
        {
          name: "High",
          count:
            summary.summary
              .high_incidents,
        },
        {
          name: "Warning",
          count:
            summary.summary
              .warning_incidents,
        },
        {
          name: "Low",
          count:
            summary.summary
              .low_incidents,
        },
      ];
    }, [summary]);


  const severityClass = (
    severity: string
  ) => {
    const value =
      severity.toUpperCase();

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

        <h1>
          ExamShield AI
        </h1>

        <p>
          Loading operations center...
        </p>
      </div>
    );
  }


  return (
    <div>

      {error && (
        <div className="error-banner">
          <XCircle size={20} />

          <span>
            {error}
          </span>
        </div>
      )}


      <section className="hero-panel">

        <div>
          <p className="eyebrow">
            EXAM OPERATIONS CENTER
          </p>

          <h2>
            Monitor exam health.
            <br />
            Detect incidents before
            they spread.
          </h2>

          <p className="hero-description">
            ExamShield continuously monitors
            infrastructure health, tracks
            incidents, analyzes candidate
            behaviour, and preserves examination
            evidence.
          </p>
        </div>


        <div
          className={`overall-health ${
            health?.status === "warning"
              ? "health-warning"
              : health?.status === "critical"
              ? "health-critical"
              : "health-healthy"
          }`}
        >
          <Activity size={28} />

          <div>
            <span>
              System Health
            </span>

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
            <span>
              Total Incidents
            </span>

            <strong>
              {summary?.summary
                .total_incidents ?? 0}
            </strong>
          </div>
        </div>


        <div className="metric-card">
          <div className="metric-icon warning-icon">
            <AlertCircle size={22} />
          </div>

          <div>
            <span>
              Open Incidents
            </span>

            <strong>
              {summary?.summary
                .open_incidents ?? 0}
            </strong>
          </div>
        </div>


        <div className="metric-card">
          <div className="metric-icon success-icon">
            <CheckCircle2 size={22} />
          </div>

          <div>
            <span>
              Resolved
            </span>

            <strong>
              {summary?.summary
                .resolved_incidents ?? 0}
            </strong>
          </div>
        </div>


        <div className="metric-card">
          <div className="metric-icon danger-icon">
            <CircleAlert size={22} />
          </div>

          <div>
            <span>
              Critical
            </span>

            <strong>
              {summary?.summary
                .critical_incidents ?? 0}
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

              <h3>
                Live System Health
              </h3>
            </div>

            <Server size={23} />

          </div>


          <HealthBar
            icon={<Cpu size={18} />}
            label="CPU Usage"
            value={
              health?.system
                .cpu_percent ?? 0
            }
          />


          <HealthBar
            icon={<Activity size={18} />}
            label="Memory Usage"
            value={
              health?.system
                .memory_percent ?? 0
            }
          />


          <HealthBar
            icon={
              <HardDrive size={18} />
            }
            label="Disk Usage"
            value={
              health?.system
                .disk_percent ?? 0
            }
          />


          <div className="health-footer">
            <Wifi size={17} />

            <span>
              Monitoring interval:
              5 seconds
            </span>
          </div>

        </div>


        <div className="panel chart-panel">

          <div className="panel-heading">

            <div>
              <p className="eyebrow">
                RISK DISTRIBUTION
              </p>

              <h3>
                Incidents by Severity
              </h3>
            </div>

            <CircleAlert size={23} />

          </div>


          <div className="chart-container">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >

              <BarChart
                data={chartData}
              >

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
                  radius={[
                    7,
                    7,
                    0,
                    0,
                  ]}
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

      </section>


      <AIReviewPanel
        candidateId="CANDIDATE-001"
      />


      <FairnessPanel
        candidateId="CANDIDATE-001"
      />


      <AuditPanel />


      <TrustReportPanel />


      <PredictionPanel />


      <section className="panel incidents-panel">

        <div className="panel-heading">

          <div>
            <p className="eyebrow">
              INCIDENT MANAGEMENT
            </p>

            <h3>
              Recent Incidents
            </h3>
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

              {incidents.map(
                (incident) => (
                  <tr
                    key={incident.id}
                  >

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
                        className={`status-pill ${
                          incident.status ===
                          "OPEN"
                            ? "status-open"
                            : "status-resolved"
                        }`}
                      >
                        {incident.status}
                      </span>
                    </td>


                    <td>

                      {incident.status ===
                      "OPEN" ? (

                        <button
                          className="resolve-button"
                          disabled={
                            resolvingId ===
                            incident.id
                          }
                          onClick={() =>
                            resolve(
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
                          <CheckCircle2
                            size={15}
                          />

                          Resolved
                        </span>

                      )}

                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>

      </section>


      <div className="dashboard-footer">

        <div>
          <ShieldCheck size={17} />

          <span>
            Prevention → Detection →
            Response → Recovery → Trust
          </span>
        </div>

        <span>
          Last updated:
          {" "}
          {lastUpdated ??
            "Not available"}
        </span>

      </div>

    </div>
  );
}


function CandidateExam() {
  const examId =
    "EXAM-DEMO-2026";

  const candidateId =
    "CANDIDATE-001";

  const [questionIndex, setQuestionIndex] =
    useState(0);

  const [answers, setAnswers] =
    useState<Record<string, string>>({});

  const [offline, setOffline] =
    useState(false);

  const [queue, setQueue] =
    useState<OfflineResponse[]>(
      () => loadResponseQueue()
    );

  const [message, setMessage] =
    useState(
      "Exam session ready."
    );

  const [syncing, setSyncing] =
    useState(false);

  const question =
    questions[questionIndex];


  const syncResponse =
    async (
      response: OfflineResponse
    ) => {
      const token =
        getAccessToken();

      if (!token) {
        throw new Error(
          "Secure session token is unavailable"
        );
      }

      const result =
        await fetch(
          "/backend/exam/responses/sync",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              "Authorization":
                `Bearer ${token}`,
            },
            body: JSON.stringify(
              response
            ),
          }
        );

      if (!result.ok) {
        const detail =
          await result.text();

        throw new Error(
          detail ||
            "Response synchronization failed"
        );
      }
    };


  const answerQuestion =
    async (answer: string) => {

      setAnswers(
        (previous) => ({
          ...previous,
          [question.id]:
            answer,
        })
      );


      try {

        const response =
          await buildOfflineResponse(
            examId,
            candidateId,
            question.id,
            answer
          );


        const updatedQueue =
          upsertQueuedResponse(
            response
          );

        setQueue(
          updatedQueue
        );


        if (offline) {

          setMessage(
            "Network unavailable. Response encrypted and stored locally."
          );

          return;
        }


        await syncResponse(
          response
        );


        const cleanedQueue =
          removeQueuedResponse(
            response.response_id
          );

        setQueue(
          cleanedQueue
        );


        setMessage(
          "Response synchronized successfully."
        );

      } catch (error) {

        console.error(
          error
        );

        setMessage(
          "Response safely queued for synchronization."
        );
      }
    };


  const syncAll =
    async () => {

      const pending =
        loadResponseQueue();


      if (pending.length === 0) {

        setMessage(
          "No pending responses."
        );

        return;
      }


      setSyncing(
        true
      );


      let successful =
        0;

      let remaining =
        [...pending];


      for (
        const response of pending
      ) {

        try {

          await syncResponse(
            response
          );

          remaining =
            removeQueuedResponse(
              response.response_id
            );

          successful++;

        } catch (error) {

          console.error(
            error
          );
        }
      }


      setQueue(
        remaining
      );

      setSyncing(
        false
      );


      setMessage(
        `${successful} response(s) synchronized successfully.`
      );
    };


  const reconnect =
    async () => {

      setOffline(
        false
      );

      setMessage(
        "Connection restored. Synchronizing..."
      );

      await syncAll();
    };


  const reset =
    () => {

      setQuestionIndex(
        0
      );

      setAnswers({});

      setOffline(
        false
      );

      setMessage(
        "Exam demo reset."
      );
    };


  return (
    <div>

      <section
        className="hero-panel"
        style={{
          marginBottom:
            "18px",
        }}
      >

        <div>

          <p className="eyebrow">
            CANDIDATE EXAM SIMULATOR
          </p>

          <h2>
            Resilient Examination Mode
          </h2>

          <p className="hero-description">
            Candidate answers remain
            protected during temporary
            connectivity failure and
            synchronize after reconnection.
          </p>

        </div>


        <div
          className={`overall-health ${
            offline
              ? "health-critical"
              : "health-healthy"
          }`}
        >

          {offline ? (
            <WifiOff size={28} />
          ) : (
            <Wifi size={28} />
          )}

          <div>

            <span>
              Connection
            </span>

            <strong>
              {offline
                ? "OFFLINE"
                : "CONNECTED"}
            </strong>

          </div>

        </div>

      </section>


      <section
        style={{
          display:
            "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) 330px",
          gap:
            "18px",
        }}
      >

        <div
          className="panel"
          style={{
            padding:
              "25px",
          }}
        >

          <p className="eyebrow">
            QUESTION{" "}
            {questionIndex + 1}{" "}
            OF{" "}
            {questions.length}
          </p>


          <h3
            style={{
              fontSize:
                "24px",
              lineHeight:
                "1.4",
              marginTop:
                "5px",
            }}
          >
            {question.text}
          </h3>


          <div
            style={{
              display:
                "grid",
              gap:
                "12px",
              marginTop:
                "24px",
            }}
          >

            {question.options.map(
              (option) => {

                const selected =
                  answers[
                    question.id
                  ] === option;


                return (
                  <button
                    key={
                      option
                    }
                    onClick={() =>
                      answerQuestion(
                        option
                      )
                    }
                    style={{
                      padding:
                        "16px",
                      textAlign:
                        "left",
                      borderRadius:
                        "12px",
                      border:
                        selected
                          ? "2px solid #38bdf8"
                          : "1px solid rgba(255,255,255,0.10)",
                      background:
                        selected
                          ? "rgba(56,189,248,0.12)"
                          : "rgba(255,255,255,0.035)",
                      color:
                        "#e5edf7",
                      fontWeight:
                        650,
                    }}
                  >
                    {selected
                      ? "✓ "
                      : ""}
                    {option}
                  </button>
                );
              }
            )}

          </div>


          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              marginTop:
                "25px",
            }}
          >

            <button
              className="refresh-button"
              disabled={
                questionIndex ===
                0
              }
              onClick={() =>
                setQuestionIndex(
                  (value) =>
                    Math.max(
                      value - 1,
                      0
                    )
                )
              }
            >
              <ArrowLeft
                size={17}
              />

              Previous
            </button>


            <button
              className="refresh-button"
              disabled={
                questionIndex ===
                questions.length -
                  1
              }
              onClick={() =>
                setQuestionIndex(
                  (value) =>
                    Math.min(
                      value + 1,
                      questions.length -
                        1
                    )
                )
              }
            >
              Next

              <ArrowRight
                size={17}
              />
            </button>

          </div>

        </div>


        <div
          className="panel"
          style={{
            padding:
              "22px",
          }}
        >

          <p className="eyebrow">
            RESILIENCE CONTROL
          </p>

          <h3>
            Network Recovery
          </h3>


          {!offline ? (

            <button
              onClick={() =>
                setOffline(
                  true
                )
              }
              style={{
                width:
                  "100%",
                padding:
                  "15px",
                marginTop:
                  "12px",
                borderRadius:
                  "11px",
                border:
                  "1px solid rgba(248,113,113,0.35)",
                background:
                  "rgba(127,29,29,0.20)",
                color:
                  "#ffc4cb",
                fontWeight:
                  750,
              }}
            >
              <WifiOff
                size={17}
              />
              {" "}
              SIMULATE NETWORK FAILURE
            </button>

          ) : (

            <button
              onClick={
                reconnect
              }
              disabled={
                syncing
              }
              style={{
                width:
                  "100%",
                padding:
                  "15px",
                marginTop:
                  "12px",
                borderRadius:
                  "11px",
                border:
                  "1px solid rgba(52,211,153,0.35)",
                background:
                  "rgba(52,211,153,0.12)",
                color:
                  "#a5f5d8",
                fontWeight:
                  750,
              }}
            >
              <CloudUpload
                size={17}
              />
              {" "}
              {syncing
                ? "SYNCING..."
                : "RECONNECT & SYNC"}
            </button>

          )}


          <div
            style={{
              marginTop:
                "18px",
              padding:
                "15px",
              borderRadius:
                "11px",
              background:
                "rgba(255,255,255,0.035)",
            }}
          >

            <div
              style={{
                color:
                  "#8fa4bd",
                fontSize:
                  "12px",
              }}
            >
              Pending responses
            </div>

            <strong
              style={{
                display:
                  "block",
                fontSize:
                  "28px",
                marginTop:
                  "5px",
              }}
            >
              {queue.length}
            </strong>

          </div>


          <div
            style={{
              marginTop:
                "15px",
              padding:
                "14px",
              borderRadius:
                "11px",
              background:
                "rgba(255,255,255,0.035)",
              color:
                "#c5d4e5",
              fontSize:
                "13px",
              lineHeight:
                "1.6",
            }}
          >

            <strong>
              Event status
            </strong>

            <br />

            {message}

          </div>


          <div
            style={{
              display:
                "flex",
              gap:
                "8px",
              marginTop:
                "15px",
            }}
          >

            <button
              className="refresh-button"
              disabled={
                queue.length ===
                  0 ||
                syncing
              }
              onClick={
                syncAll
              }
              style={{
                flex:
                  1,
                justifyContent:
                  "center",
              }}
            >
              <CloudUpload
                size={16}
              />

              Sync
            </button>


            <button
              className="refresh-button"
              onClick={
                reset
              }
              style={{
                flex:
                  1,
                justifyContent:
                  "center",
              }}
            >
              <RotateCcw
                size={16}
              />

              Reset
            </button>

          </div>


          <div
            style={{
              marginTop:
                "15px",
              color:
                "#8196ae",
              fontSize:
                "11px",
              lineHeight:
                "1.7",
            }}
          >
            <LockKeyhole
              size={14}
            />
            {" "}
            AES-GCM encrypted local buffer

            <br />

            SHA-256 response integrity

            <br />

            Candidate:
            {" "}
            {candidateId}
          </div>

        </div>

      </section>

    </div>
  );
}


function App() {
  const [view, setView] =
    useState<
      "dashboard" | "candidate"
    >("dashboard");


  return (
    <div className="app-shell">

      <header className="topbar">

        <div className="brand-section">

          <div className="brand-icon">
            <ShieldCheck
              size={30}
            />
          </div>

          <div>

            <h1>
              ExamShield AI
            </h1>

            <p>
              Resilient Online Examination
              Ecosystem
            </p>

          </div>

        </div>


        <div className="topbar-actions">

          <button
            className="refresh-button"
            onClick={() =>
              setView(
                "dashboard"
              )
            }
          >
            <Server
              size={16}
            />

            Operations Dashboard
          </button>


          <button
            className="refresh-button"
            onClick={() =>
              setView(
                "candidate"
              )
            }
          >
            <UserRound
              size={16}
            />

            Candidate Exam
          </button>

        </div>

      </header>


      <main className="dashboard">

        {view ===
        "dashboard" ? (

          <OperationsDashboard />

        ) : (

          <CandidateExam />

        )}

      </main>

    </div>
  );
}


export default App;