import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Eye,
  Flag,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Video,
} from "lucide-react";

import {
  getCandidateAnomalySummary,
  type AnomalyEvent,
  type CandidateAnomalyResponse,
} from "./api";

import {
  isLocalDemoSession,
} from "./auth";

import {
  getRiskClass,
  getRiskDescription,
  getRiskLabel,
} from "./riskUtils";

import "./ai-review.css";

interface AIReviewPanelProps {
  candidateId: string;
}

type ProctoringRisk =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

interface ProctoringEvent {
  id: string;
  time: string;
  type: string;
  severity: ProctoringRisk;
  message: string;
}

const DEMO_BEHAVIOUR_DATA: CandidateAnomalyResponse = {
  status: "success",
  candidate_id: "CANDIDATE-001",
  summary: {
    total_events: 5,
    average_risk_score: 27.4,
    maximum_risk_score: 65,
    review_required_events: 0,
    high_risk_events: 1,
    risk_level_distribution: {
      NORMAL: 2,
      LOW: 1,
      MEDIUM: 1,
      HIGH: 1,
    },
  },
  recent_events: [
    {
      event_id: "DEMO-BEHAVIOR-Q5",
      question_id: "Q5",
      risk_score: 65,
      risk_level: "HIGH",
      flags: [
        "HIGH_FOCUS_CHANGE_COUNT",
        "FAST_RESPONSE",
      ],
      answer_time_ms: 4200,
      answer_changes: 0,
      focus_changes: 4,
      offline_duration_ms: 0,
      navigation_count: 2,
      created_at: "2026-10-02T06:45:00.000Z",
    },
    {
      event_id: "DEMO-BEHAVIOR-Q4",
      question_id: "Q4",
      risk_score: 45,
      risk_level: "MEDIUM",
      flags: [
        "FOCUS_CHANGE_DETECTED",
      ],
      answer_time_ms: 7800,
      answer_changes: 0,
      focus_changes: 1,
      offline_duration_ms: 0,
      navigation_count: 1,
      created_at: "2026-10-02T06:44:00.000Z",
    },
    {
      event_id: "DEMO-BEHAVIOR-Q3",
      question_id: "Q3",
      risk_score: 25,
      risk_level: "LOW",
      flags: [
        "VERY_FAST_RESPONSE",
      ],
      answer_time_ms: 2400,
      answer_changes: 0,
      focus_changes: 0,
      offline_duration_ms: 0,
      navigation_count: 0,
      created_at: "2026-10-02T06:43:00.000Z",
    },
    {
      event_id: "DEMO-BEHAVIOR-Q2",
      question_id: "Q2",
      risk_score: 0,
      risk_level: "NORMAL",
      flags: [
        "NO_UNUSUAL_SIGNAL_DETECTED",
      ],
      answer_time_ms: 12400,
      answer_changes: 0,
      focus_changes: 0,
      offline_duration_ms: 0,
      navigation_count: 0,
      created_at: "2026-10-02T06:42:00.000Z",
    },
    {
      event_id: "DEMO-BEHAVIOR-Q1",
      question_id: "Q1",
      risk_score: 0,
      risk_level: "NORMAL",
      flags: [
        "NO_UNUSUAL_SIGNAL_DETECTED",
      ],
      answer_time_ms: 18200,
      answer_changes: 0,
      focus_changes: 0,
      offline_duration_ms: 0,
      navigation_count: 0,
      created_at: "2026-10-02T06:41:00.000Z",
    },
  ],
  policy_note:
    "Risk signals are intended for human review and should not be treated as an automatic cheating verdict.",
  timestamp: "2026-10-02T06:45:00.000Z",
};

const PROCTORING_STORAGE_PREFIX =
  "examshield_proctoring_events_";

function getProctoringStorageKey(
  candidateId: string
): string {
  return (
    PROCTORING_STORAGE_PREFIX +
    candidateId
  );
}

function loadProctoringEvents(
  candidateId: string
): ProctoringEvent[] {
  try {
    const raw =
      localStorage.getItem(
        getProctoringStorageKey(
          candidateId
        )
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as ProctoringEvent[];
  } catch {
    return [];
  }
}

function getLatestRisk(
  events: ProctoringEvent[]
): ProctoringRisk {
  const riskEvent =
    events.find(
      (event) =>
        event.type ===
        "PROCTORING_RISK"
    );

  return (
    riskEvent?.severity ??
    "LOW"
  );
}

function getRiskText(
  risk: ProctoringRisk
): string {
  if (risk === "HIGH") {
    return "Human review recommended";
  }

  if (risk === "MEDIUM") {
    return "Attention signal observed";
  }

  return "No elevated proctoring signal";
}

function AIReviewPanel({
  candidateId,
}: AIReviewPanelProps) {
  const [data, setData] =
    useState<CandidateAnomalyResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [
    proctoringEvents,
    setProctoringEvents,
  ] = useState<ProctoringEvent[]>(
    () =>
      loadProctoringEvents(
        candidateId
      )
  );

  const loadReviewData =
    useCallback(
      async () => {
        try {
          setError(null);

          if (isLocalDemoSession()) {
            setData(DEMO_BEHAVIOUR_DATA);
            return;
          }

          const result =
            await getCandidateAnomalySummary(
              candidateId
            );

          /*
           * A fresh demo backend can legitimately have zero
           * behaviour events. Keep the analysis card useful
           * while making the fallback visible to the reviewer.
           */
          if (
            result.summary.total_events === 0 &&
            result.recent_events.length === 0
          ) {
            setData({
              ...DEMO_BEHAVIOUR_DATA,
              candidate_id:
                result.candidate_id || "CANDIDATE-001",
              timestamp:
                result.timestamp,
            });
            return;
          }

          setData(result);
        } catch (err) {
          console.error(err);

          if (isLocalDemoSession()) {
            setData(DEMO_BEHAVIOUR_DATA);
            setError(null);
            return;
          }

          setError(
            "Unable to load AI review data."
          );
        } finally {
          setLoading(false);
        }
      },
      [candidateId]
    );

  const refreshProctoring =
    useCallback(
      () => {
        setProctoringEvents(
          loadProctoringEvents(
            candidateId
          )
        );
      },
      [candidateId]
    );

  useEffect(() => {
    loadReviewData();

    const interval =
      setInterval(
        loadReviewData,
        5000
      );

    return () =>
      clearInterval(
        interval
      );
  }, [loadReviewData]);

  useEffect(() => {
    refreshProctoring();

    const interval =
      setInterval(
        refreshProctoring,
        2000
      );

    const handleStorage =
      (event: StorageEvent) => {
        if (
          event.key ===
          getProctoringStorageKey(
            candidateId
          )
        ) {
          refreshProctoring();
        }
      };

    window.addEventListener(
      "storage",
      handleStorage
    );

    return () => {
      clearInterval(
        interval
      );

      window.removeEventListener(
        "storage",
        handleStorage
      );
    };
  }, [
    candidateId,
    refreshProctoring,
  ]);

  const distributionData =
    useMemo(() => {
      if (!data) {
        return [];
      }

      return Object.entries(
        data.summary
          .risk_level_distribution
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );
    }, [data]);

  const proctoringRisk =
    getLatestRisk(
      proctoringEvents
    );

  const showingDemoBehaviour =
    data?.recent_events.some(
      (event) =>
        event.event_id.startsWith(
          "DEMO-BEHAVIOR-"
        )
    ) ?? false;

  if (loading) {
    return (
      <section className="ai-panel">
        <div className="ai-loading">
          <RefreshCw
            size={22}
            className="spin"
          />

          <span>
            Loading AI behaviour analysis...
          </span>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="ai-panel">
        <div className="ai-error">
          <AlertTriangle
            size={20}
          />

          <span>
            {error}
          </span>

          <button
            className="ai-refresh-button"
            onClick={
              loadReviewData
            }
          >
            Retry
          </button>
        </div>

        <div
          style={{
            marginTop:
              12,
            padding:
              12,
            borderRadius:
              10,
            background:
              "#f8fafc",
            border:
              "1px solid #e2e8f0",
          }}
        >
          <strong
            style={{
              display:
                "block",
              fontSize:
                12,
              color:
                "#334155",
              marginBottom:
                8,
            }}
          >
            Camera Proctoring Evidence
          </strong>

          <button
            className="ai-refresh-button"
            onClick={
              refreshProctoring
            }
          >
            <Video size={15} />
            Refresh Proctoring
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="ai-panel">
        <div className="ai-empty">
          No behaviour analysis available.
        </div>
      </section>
    );
  }

  return (
    <section className="ai-panel">

      <div className="ai-panel-header">

        <div>
          <p className="eyebrow">
            AI ASSISTED REVIEW
          </p>

          <h3>
            Candidate Behaviour Analysis
          </h3>

          <p className="ai-subtitle">
            Explainable behaviour signals for
            authorized human review.
          </p>
        </div>

        <div className="ai-candidate-chip">
          <UserRound
            size={15}
          />

          <span>
            {data.candidate_id}
          </span>
        </div>

      </div>

      {showingDemoBehaviour && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            color: "#1e40af",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          <strong>Demo behaviour baseline:</strong>{" "}
          No live behaviour events are available yet,
          so the dashboard is showing a documented
          sample for the review workflow. Live backend
          events replace this sample automatically.
        </div>
      )}

      <div className="ai-metrics">

        <div className="ai-metric">
          <div className="ai-metric-icon">
            <BrainCircuit
              size={20}
            />
          </div>

          <span>
            Events Analysed
          </span>

          <strong>
            {data.summary.total_events}
          </strong>
        </div>

        <div className="ai-metric">
          <div className="ai-metric-icon">
            <Clock3
              size={20}
            />
          </div>

          <span>
            Average Risk
          </span>

          <strong>
            {data.summary.average_risk_score}
          </strong>
        </div>

        <div className="ai-metric">
          <div className="ai-metric-icon ai-danger">
            <ShieldAlert
              size={20}
            />
          </div>

          <span>
            Maximum Risk
          </span>

          <strong>
            {data.summary.maximum_risk_score}
          </strong>
        </div>

        <div className="ai-metric">
          <div className="ai-metric-icon ai-review-icon">
            <Eye
              size={20}
            />
          </div>

          <span>
            Review Queue
          </span>

          <strong>
            {data.summary.review_required_events}
          </strong>
        </div>

      </div>

      <div className="ai-content-grid">

        <div className="ai-summary-card">

          <div className="ai-section-title">
            <BrainCircuit
              size={18}
            />

            <span>
              Risk Distribution
            </span>
          </div>

          <div className="ai-distribution">

            {distributionData.length ===
              0 && (
              <div className="ai-empty-small">
                No behaviour events analysed yet.
              </div>
            )}

            {distributionData.map(
              ([level, count]) => (
                <div
                  className="ai-distribution-row"
                  key={
                    level
                  }
                >

                  <div className="ai-distribution-label">

                    <span
                      className={`ai-risk-dot ${getRiskClass(
                        level
                      )}`}
                    />

                    <span>
                      {getRiskLabel(
                        level
                      )}
                    </span>

                  </div>

                  <strong>
                    {count}
                  </strong>

                </div>
              )
            )}

          </div>

        </div>

        <div className="ai-review-summary">

          <div className="ai-section-title">
            <Flag
              size={18}
            />

            <span>
              Human Review Queue
            </span>
          </div>

          <div
            className={`ai-review-banner ${
              data.summary
                .review_required_events >
              0
                ? "has-review"
                : "no-review"
            }`}
          >

            {data.summary
              .review_required_events >
            0 ? (
              <>
                <AlertTriangle
                  size={25}
                />

                <div>

                  <strong>
                    {
                      data.summary
                        .review_required_events
                    }{" "}
                    event(s) require review
                  </strong>

                  <p>
                    Review the underlying
                    signals and examination
                    context before taking any
                    action.
                  </p>

                </div>
              </>
            ) : (
              <>
                <CheckCircle2
                  size={25}
                />

                <div>

                  <strong>
                    No events currently require
                    review
                  </strong>

                  <p>
                    No review-level signal is
                    currently recorded.
                  </p>

                </div>
              </>
            )}

          </div>

          <div className="ai-policy-note">
            <ShieldAlert
              size={15}
            />

            <span>
              AI signals are decision-support
              indicators, not an automatic
              cheating verdict.
            </span>
          </div>

        </div>

      </div>

      <div
        style={{
          marginTop:
            18,
          padding:
            16,
          borderRadius:
            14,
          border:
            "1px solid #dbe3ec",
          background:
            "#ffffff",
        }}
      >

        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: 12,
            flexWrap:
              "wrap",
            marginBottom:
              12,
          }}
        >

          <div>

            <div className="ai-section-title">
              <Video
                size={18}
              />

              <span>
                AI Camera Proctoring Review
              </span>
            </div>

            <p
              style={{
                margin:
                  "5px 0 0",
                fontSize:
                  11,
                color:
                  "#64748b",
              }}
            >
              Last observed browser-side vision
              signals for this candidate.
            </p>

          </div>

          <button
            className="ai-refresh-button"
            onClick={
              refreshProctoring
            }
          >
            <RefreshCw
              size={15}
            />

            Refresh
          </button>

        </div>

        <div
          style={{
            display:
              "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: 10,
          }}
        >

          <div
            style={{
              padding:
                12,
              borderRadius:
                10,
              background:
                "#f8fafc",
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize:
                  10,
                color:
                  "#64748b",
              }}
            >
              Latest Risk
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  4,
                fontSize:
                  20,
                color:
                  proctoringRisk ===
                  "HIGH"
                    ? "#b91c1c"
                    : proctoringRisk ===
                        "MEDIUM"
                      ? "#a16207"
                      : "#047857",
              }}
            >
              {proctoringRisk}
            </strong>
          </div>

          <div
            style={{
              padding:
                12,
              borderRadius:
                10,
              background:
                "#f8fafc",
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize:
                  10,
                color:
                  "#64748b",
              }}
            >
              Signals Recorded
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  4,
                fontSize:
                  20,
                color:
                  "#0f172a",
              }}
            >
              {
                proctoringEvents.length
              }
            </strong>
          </div>

          <div
            style={{
              padding:
                12,
              borderRadius:
                10,
              background:
                "#f8fafc",
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize:
                  10,
                color:
                  "#64748b",
              }}
            >
              Review Status
            </div>

            <strong
              style={{
                display:
                  "block",
                marginTop:
                  4,
                fontSize:
                  13,
                color:
                  proctoringRisk ===
                  "HIGH"
                    ? "#b91c1c"
                    : proctoringRisk ===
                        "MEDIUM"
                      ? "#a16207"
                      : "#047857",
              }}
            >
              {
                getRiskText(
                  proctoringRisk
                )
              }
            </strong>
          </div>

        </div>

        <div
          style={{
            marginTop:
              12,
            display:
              "grid",
            gap: 7,
          }}
        >

          {proctoringEvents
            .slice(0, 6)
            .map(
              (event) => (
                <div
                  key={
                    event.id
                  }
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "70px 145px 1fr",
                    gap: 8,
                    alignItems:
                      "center",
                    padding:
                      "7px 0",
                    borderBottom:
                      "1px solid #e2e8f0",
                    fontSize:
                      11,
                  }}
                >

                  <span
                    style={{
                      color:
                        "#64748b",
                    }}
                  >
                    {event.time}
                  </span>

                  <strong
                    style={{
                      color:
                        event.severity ===
                        "HIGH"
                          ? "#b91c1c"
                          : event.severity ===
                              "MEDIUM"
                            ? "#a16207"
                            : "#047857",
                    }}
                  >
                    {event.type}
                  </strong>

                  <span
                    style={{
                      color:
                        "#475569",
                    }}
                  >
                    {event.message}
                  </span>

                </div>
              )
            )
          }

          {proctoringEvents.length ===
            0 && (
            <div
              style={{
                padding:
                  10,
                borderRadius:
                  8,
                background:
                  "#f8fafc",
                color:
                  "#64748b",
                fontSize:
                  11,
              }}
            >
              No camera proctoring evidence has
              been recorded for this candidate yet.
            </div>
          )}

        </div>

        <div
          style={{
            marginTop:
              10,
            fontSize:
              10,
            lineHeight:
              1.5,
            color:
              "#64748b",
          }}
        >
          Camera footage is not stored or uploaded
          by this MVP. The dashboard displays
          locally persisted computer-vision signals
          for human review.
        </div>

      </div>

      <div className="ai-events-card">

        <div className="ai-events-header">

          <div>

            <div className="ai-section-title">
              <Flag
                size={18}
              />

              <span>
                Recent Behaviour Events
              </span>
            </div>

            <p>
              Latest analysed candidate activity
            </p>

          </div>

          <button
            className="ai-refresh-button"
            onClick={
              loadReviewData
            }
          >
            <RefreshCw
              size={15}
            />

            Refresh
          </button>

        </div>

        <div className="ai-event-list">

          {data.recent_events.map(
            (
              event: AnomalyEvent
            ) => (
              <div
                className="ai-event-row"
                key={
                  event.event_id
                }
              >

                <div className="ai-event-main">

                  <div className="ai-event-title">

                    <strong>
                      {event.event_id}
                    </strong>

                    <span>
                      Question{" "}
                      {event.question_id}
                    </span>

                  </div>

                  <div className="ai-event-flags">

                    {event.flags.map(
                      (flag) => (
                        <span
                          className="ai-flag"
                          key={
                            flag
                          }
                        >
                          {flag}
                        </span>
                      )
                    )}

                  </div>

                  <div className="ai-event-details">
                    Answer time:
                    {" "}
                    {event.answer_time_ms}
                    {" ms"}
                    {" • "}
                    Answer changes:
                    {" "}
                    {event.answer_changes}
                    {" • "}
                    Focus changes:
                    {" "}
                    {event.focus_changes}
                    {" • "}
                    Navigation:
                    {" "}
                    {event.navigation_count}
                  </div>

                </div>

                <div className="ai-event-risk">

                  <span
                    className={`ai-risk-badge ${getRiskClass(
                      event.risk_level
                    )}`}
                  >
                    {getRiskLabel(
                      event.risk_level
                    )}
                  </span>

                  <strong>
                    {event.risk_score}
                  </strong>

                  <small>
                    {getRiskDescription(
                      event.risk_level
                    )}
                  </small>

                </div>

              </div>
            )
          )}

          {data.recent_events.length ===
            0 && (
            <div className="ai-empty-small">
              No recent behaviour events.
            </div>
          )}

        </div>

      </div>

      <div className="ai-footer-note">

        <ShieldAlert
          size={15}
        />

        <span>
          Policy: behaviour risk signals should
          be interpreted together with examination
          context and reviewed by authorized
          personnel.
        </span>

      </div>

    </section>
  );
}

export default AIReviewPanel;