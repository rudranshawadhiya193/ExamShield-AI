import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  getCandidateFairness,
  type CandidateFairnessResponse,
} from "./api";

import "./trust-panels.css";


interface FairnessPanelProps {
  candidateId: string;
}


function formatDuration(
  durationMs: number
): string {
  const totalSeconds =
    Math.floor(durationMs / 1000);

  const minutes =
    Math.floor(
      totalSeconds / 60
    );

  const seconds =
    totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}


function FairnessPanel({
  candidateId,
}: FairnessPanelProps) {
  const [data, setData] =
    useState<CandidateFairnessResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);


  const loadData =
    useCallback(async () => {
      try {
        setError(null);

        const result =
          await getCandidateFairness(
            candidateId
          );

        setData(result);
      } catch (err) {
        console.error(err);

        setError(
          "Unable to load fairness analysis."
        );
      } finally {
        setLoading(false);
      }
    }, [candidateId]);


  useEffect(() => {
    loadData();

    const interval =
      setInterval(
        loadData,
        5000
      );

    return () =>
      clearInterval(interval);
  }, [loadData]);


  if (loading) {
    return (
      <section className="trust-panel">
        <div className="trust-loading">
          <RefreshCw
            size={20}
            className="spin"
          />

          <span>
            Loading fairness analysis...
          </span>
        </div>
      </section>
    );
  }


  if (error) {
    return (
      <section className="trust-panel">
        <div className="trust-error">
          <AlertTriangle size={20} />

          <span>
            {error}
          </span>

          <button
            className="trust-button"
            onClick={loadData}
          >
            Retry
          </button>
        </div>
      </section>
    );
  }


  if (!data) {
    return null;
  }


  return (
    <section className="trust-panel">

      <div className="trust-header">

        <div>
          <p className="eyebrow">
            FAIRNESS & DISRUPTION
          </p>

          <h3>
            Candidate Impact Assessment
          </h3>

          <p className="trust-subtitle">
            Technical disruption evidence and
            decision-support for authorized
            examination personnel.
          </p>
        </div>


        <div className="trust-candidate-chip">
          <Users size={15} />

          <span>
            {data.candidate_id}
          </span>
        </div>

      </div>


      <div className="trust-metrics">

        <div className="trust-metric">
          <Clock3 size={20} />

          <span>
            Avg Impact
          </span>

          <strong>
            {data.summary.average_impact_score}
          </strong>
        </div>


        <div className="trust-metric">
          <AlertTriangle size={20} />

          <span>
            Max Impact
          </span>

          <strong>
            {data.summary.maximum_impact_score}
          </strong>
        </div>


        <div className="trust-metric">
          <FileWarning size={20} />

          <span>
            Disruptions
          </span>

          <strong>
            {data.summary.total_disruptions}
          </strong>
        </div>


        <div className="trust-metric trust-success">
          <CheckCircle2 size={20} />

          <span>
            Recovered Responses
          </span>

          <strong>
            {data.summary.total_recovered_responses}
          </strong>
        </div>

      </div>


      <div className="fairness-events">

        <div className="trust-section-title">
          <ShieldCheck size={18} />

          <span>
            Disruption Evidence
          </span>
        </div>


        {data.recent_disruptions.length ===
        0 ? (

          <div className="trust-empty">
            <CheckCircle2 size={22} />

            <span>
              No disruption events recorded
              for this candidate.
            </span>
          </div>

        ) : (

          data.recent_disruptions.map(
            (event) => (
              <div
                className="fairness-event"
                key={event.disruption_id}
              >

                <div className="fairness-event-main">

                  <div className="fairness-event-title">

                    <strong>
                      {event.disruption_id}
                    </strong>

                    <span>
                      {event.disruption_type}
                    </span>

                  </div>


                  <div className="fairness-details">

                    <span>
                      Duration:
                      {" "}
                      {formatDuration(
                        event.duration_ms
                      )}
                    </span>

                    <span>
                      Affected questions:
                      {" "}
                      {event.affected_questions}
                    </span>

                    <span>
                      Pending responses:
                      {" "}
                      {event.pending_responses}
                    </span>

                    <span>
                      Recovered:
                      {" "}
                      {event.recovered_responses}
                    </span>

                  </div>


                  <div className="evidence-list">

                    {event.evidence.map(
                      (item) => (
                        <span
                          key={item}
                          className="evidence-chip"
                        >
                          {item}
                        </span>
                      )
                    )}

                  </div>

                </div>


                <div className="fairness-impact">

                  <span
                    className={`impact-badge impact-${event.impact_level.toLowerCase()}`}
                  >
                    {event.impact_level}
                  </span>

                  <strong>
                    {event.impact_score}
                  </strong>

                  <small>
                    Impact score
                  </small>

                </div>

              </div>
            )
          )
        )}

      </div>


      {data.recent_disruptions.length >
        0 && (

        <div className="fairness-recommendation">

          <div className="trust-section-title">
            <ShieldCheck size={18} />

            <span>
              Decision Support
            </span>
          </div>


          <div className="recommendation-box">

            <AlertTriangle size={22} />

            <div>

              <strong>
                {
                  data.recent_disruptions[0]
                    .recommendation
                }
              </strong>

              <p>
                This is a structured
                recommendation for authorized
                review. It does not automatically
                change exam results, grant time,
                or trigger a re-examination.
              </p>

            </div>

          </div>

        </div>
      )}


      <div className="trust-policy">
        <ShieldCheck size={15} />

        <span>
          Final fairness decisions must be made
          by authorized examination personnel
          using examination rules and available
          evidence.
        </span>
      </div>

    </section>
  );
}


export default FairnessPanel;