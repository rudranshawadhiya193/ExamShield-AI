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
} from "lucide-react";

import {
  getCandidateAnomalySummary,
  type AnomalyEvent,
  type CandidateAnomalyResponse,
} from "./api";

import {
  getRiskClass,
  getRiskDescription,
  getRiskLabel,
} from "./riskUtils";

import "./ai-review.css";


interface AIReviewPanelProps {
  candidateId: string;
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
    useState<string | null>(null);

  const loadReviewData =
    useCallback(async () => {
      try {
        setError(null);

        const result =
          await getCandidateAnomalySummary(
            candidateId
          );

        setData(result);
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load AI review data."
        );
      } finally {
        setLoading(false);
      }
    }, [candidateId]);


  useEffect(() => {
    loadReviewData();

    const interval =
      setInterval(
        loadReviewData,
        5000
      );

    return () =>
      clearInterval(interval);
  }, [loadReviewData]);


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
          <AlertTriangle size={20} />

          <span>
            {error}
          </span>

          <button
            className="ai-refresh-button"
            onClick={loadReviewData}
          >
            Retry
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
          <UserRound size={15} />

          <span>
            {data.candidate_id}
          </span>
        </div>

      </div>


      <div className="ai-metrics">

        <div className="ai-metric">
          <div className="ai-metric-icon">
            <BrainCircuit size={20} />
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
            <Clock3 size={20} />
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
            <ShieldAlert size={20} />
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
            <Eye size={20} />
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
            <BrainCircuit size={18} />

            <span>
              Risk Distribution
            </span>
          </div>


          <div className="ai-distribution">

            {distributionData.length === 0 && (
              <div className="ai-empty-small">
                No behaviour events analysed yet.
              </div>
            )}


            {distributionData.map(
              ([level, count]) => (
                <div
                  className="ai-distribution-row"
                  key={level}
                >

                  <div className="ai-distribution-label">
                    <span
                      className={`ai-risk-dot ${getRiskClass(
                        level
                      )}`}
                    />

                    <span>
                      {getRiskLabel(level)}
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
            <Flag size={18} />

            <span>
              Human Review Queue
            </span>
          </div>


          <div
            className={`ai-review-banner ${
              data.summary.review_required_events >
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
            <ShieldAlert size={15} />

            <span>
              AI signals are decision-support
              indicators, not an automatic
              cheating verdict.
            </span>
          </div>

        </div>

      </div>


      <div className="ai-events-card">

        <div className="ai-events-header">
          <div>
            <div className="ai-section-title">
              <Flag size={18} />

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
            onClick={loadReviewData}
          >
            <RefreshCw size={15} />
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
                key={event.event_id}
              >

                <div className="ai-event-main">

                  <div className="ai-event-title">
                    <strong>
                      {event.event_id}
                    </strong>

                    <span>
                      Question {event.question_id}
                    </span>
                  </div>


                  <div className="ai-event-flags">

                    {event.flags.map(
                      (flag) => (
                        <span
                          className="ai-flag"
                          key={flag}
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
        <ShieldAlert size={15} />

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