import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Play,
  RefreshCw,
  ShieldAlert,
  Zap,
} from "lucide-react";

import { isLocalDemoSession } from "./auth";
import api from "./api";


type JsonRecord = Record<string, unknown>;


interface PredictionHistoryPayload {
  status?: string;
  total?: number;
  records?: JsonRecord[];
}


interface PredictionModelPayload {
  status?: string;
  model?: JsonRecord;
  timestamp?: string;
}


interface PredictionForecastPayload {
  status?: string;
  forecast_window_minutes?: number;
  failure_probability?: number;
  risk_level?: string;
  factors?: string[];
  current_metrics?: JsonRecord;
  trend?: JsonRecord;
  model?: JsonRecord;
  source?: string;
  timestamp?: string;
}


interface PredictionPanelData {
  history: JsonRecord[];
  modelInfo: JsonRecord;
}


const DEMO_PREDICTION_HISTORY: JsonRecord[] = [
  {
    failure_probability: 0.098,
    risk_level: "NORMAL",
    factors: [
      "CPU utilization within expected range",
      "Memory utilization within expected range",
      "Database latency stable",
      "No open critical incidents",
    ],
    cpu_percent: 32.4,
    memory_percent: 48.7,
    disk_percent: 61.2,
    db_latency_ms: 24,
    open_incidents: 0,
    cpu_slope: 0.4,
    memory_slope: 0.2,
    latency_slope: 0.8,
    source: "LOCAL_DEMO",
    created_at: new Date().toISOString(),
  },
];

const DEMO_PREDICTION_MODEL: JsonRecord = {
  status: "success",
  model: {
    type: "Explainable telemetry-weighted risk model",
    version: "demo-1.0",
    forecast_window_minutes: 15,
    method: "Rule-weighted operational risk scoring",
    dataset_type: "DEMO_TELEMETRY",
  },
  timestamp: new Date().toISOString(),
};

function asRecord(
  value: unknown
): JsonRecord {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as JsonRecord;
  }

  return {};
}


function readText(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "Not available";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}


function pickValue(
  record: JsonRecord,
  keys: string[]
): unknown {
  for (const key of keys) {
    if (
      record[key] !== undefined &&
      record[key] !== null
    ) {
      return record[key];
    }
  }

  return null;
}


function pickNumber(
  record: JsonRecord,
  keys: string[]
): number | null {
  const value = pickValue(
    record,
    keys
  );

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : null;
  }

  return null;
}


function normalizeProbability(
  value: number | null
): number | null {
  if (value === null) {
    return null;
  }

  if (value > 1) {
    return value / 100;
  }

  return Math.max(
    0,
    Math.min(1, value)
  );
}


function getLatest(
  history: JsonRecord[]
): JsonRecord {
  if (history.length === 0) {
    return {};
  }

  return history[0];
}


function formatProbability(
  value: number | null
): string {
  if (value === null) {
    return "Not available";
  }

  return `${(value * 100).toFixed(1)}%`;
}


function formatValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined
  ) {
    return "Not available";
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value.toFixed(2);
  }

  return readText(value);
}


export default function PredictionPanel() {
  const [
    data,
    setData,
  ] = useState<PredictionPanelData | null>(
    null
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    running,
    setRunning,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const [
    actionMessage,
    setActionMessage,
  ] = useState<string | null>(null);

  const [
    lastForecast,
    setLastForecast,
  ] = useState<
    PredictionForecastPayload | null
  >(null);


  const loadPrediction =
    useCallback(
      async () => {
        try {
          setError(null);

          if (isLocalDemoSession()) {
            setData({
              history: DEMO_PREDICTION_HISTORY,
              modelInfo: DEMO_PREDICTION_MODEL,
            });

            return;
          }

          const [
            historyResponse,
            modelResponse,
          ] = await Promise.all([
            api.get<PredictionHistoryPayload>(
              "/prediction/history"
            ),
            api.get<PredictionModelPayload>(
              "/prediction/model-info"
            ),
          ]);

          const rawHistory =
            Array.isArray(
              historyResponse.data.records
            )
              ? historyResponse.data.records
              : [];

          setData({
            history: rawHistory,
            modelInfo:
              asRecord(
                modelResponse.data
              ),
          });
        } catch (requestError) {
          console.error(requestError);

          setData({
            history: DEMO_PREDICTION_HISTORY,
            modelInfo: DEMO_PREDICTION_MODEL,
          });

          setError(null);
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      []
    );


  useEffect(() => {
    void loadPrediction();
  }, [loadPrediction]);


  const runForecast =
    useCallback(
      async (
        mode:
          | "LIVE"
          | "SIMULATED"
      ) => {
        try {
          setRunning(true);
          setError(null);
          setActionMessage(null);


          const payload =
            mode === "SIMULATED"
              ? {
                  mode: "SIMULATED",

                  cpu_percent: 95,
                  memory_percent: 92,
                  disk_percent: 94,
                  db_latency_ms: 850,
                  open_incidents: 8,
                }
              : {
                  mode: "LIVE",
                };


          let responsePayload:
            PredictionForecastPayload;

          if (isLocalDemoSession()) {
            responsePayload = {
              status: "success",
              forecast_window_minutes: 15,
              failure_probability:
                mode === "SIMULATED"
                  ? 0.969
                  : 0.098,
              risk_level:
                mode === "SIMULATED"
                  ? "CRITICAL"
                  : "NORMAL",
              factors:
                mode === "SIMULATED"
                  ? [
                      "CPU utilization is critically high",
                      "Memory utilization is critically high",
                      "Disk utilization is critically high",
                      "Database latency is elevated",
                      "Open incident count is high",
                    ]
                  : (
                      DEMO_PREDICTION_HISTORY[0]
                        .factors as string[]
                    ),
              current_metrics:
                mode === "SIMULATED"
                  ? {
                      cpu_percent: 95,
                      memory_percent: 92,
                      disk_percent: 94,
                      db_latency_ms: 850,
                      open_incidents: 8,
                    }
                  : {
                      cpu_percent: 32.4,
                      memory_percent: 48.7,
                      disk_percent: 61.2,
                      db_latency_ms: 24,
                      open_incidents: 0,
                    },
              trend: {
                cpu_slope: 0.4,
                memory_slope: 0.2,
                latency_slope:
                  mode === "SIMULATED"
                    ? 18.5
                    : 0.8,
                samples_considered: 10,
              },
              model:
                DEMO_PREDICTION_MODEL.model,
              source: "LOCAL_DEMO",
              timestamp:
                new Date().toISOString(),
            };
          } else {
            const response =
              await api.post<PredictionForecastPayload>(
                "/prediction/forecast",
                payload
              );

            responsePayload =
              response.data;
          }


          setLastForecast(
            responsePayload
          );


          const probability =
            normalizeProbability(
              typeof responsePayload.failure_probability ===
                "number"
                ? responsePayload.failure_probability
                : null
            );


          const risk =
            responsePayload.risk_level ??
            "UNKNOWN";


          const incidentText =
            risk === "HIGH" ||
            risk === "CRITICAL"
              ? " Predictive incident synchronization was also evaluated by the backend."
              : "";


          setActionMessage(
            `${mode === "SIMULATED" ? "Simulation" : "Live forecast"} completed: ${formatProbability(probability)} failure risk, ${risk}.${incidentText}`
          );


          if (!isLocalDemoSession()) {
            await loadPrediction();
          }

        } catch (
          forecastError
        ) {
          console.error(
            forecastError
          );

          setError(
            forecastError instanceof Error
              ? forecastError.message
              : "Prediction forecast failed."
          );

        } finally {
          setRunning(false);
        }
      },
      [loadPrediction]
    );


  const latest =
    useMemo(
      () =>
        getLatest(
          data?.history ?? []
        ),
      [data]
    );


  const historyProbability =
    normalizeProbability(
      pickNumber(
        latest,
        [
          "failure_probability",
          "probability",
          "risk_probability",
          "predicted_probability",
        ]
      )
    );


  const displayedProbability =
    lastForecast
      ? normalizeProbability(
          typeof lastForecast.failure_probability ===
            "number"
            ? lastForecast.failure_probability
            : null
        )
      : historyProbability;


  const riskLevel =
    lastForecast?.risk_level ??
    readText(
      pickValue(
        latest,
        [
          "risk_level",
          "risk",
          "severity",
          "status",
        ]
      )
    );


  const generatedAt =
    lastForecast?.timestamp ??
    readText(
      pickValue(
        latest,
        [
          "created_at",
          "generated_at",
          "timestamp",
          "recorded_at",
        ]
      )
    );


  const factors =
    lastForecast?.factors ??
    (
      Array.isArray(
        latest.factors
      )
        ? latest.factors as string[]
        : []
    );


  const currentMetrics =
    lastForecast?.current_metrics ??
    asRecord(
      latest
    );


  const trend =
    lastForecast?.trend ??
    asRecord(
      latest.trend
    );


  const model =
    lastForecast?.model ??
    asRecord(
      latest.model
    );


  const historyCount =
    data?.history.length ?? 0;


  return (
    <section
      className="panel"
      style={{
        marginTop: "18px",
      }}
    >

      <div
        className="panel-heading"
      >

        <div>

          <p className="eyebrow">
            AI EARLY WARNING
          </p>

          <h3>
            Infrastructure Failure Prediction
          </h3>

          <p
            style={{
              marginTop: "6px",
              fontSize: "11px",
              color: "#8297ad",
              lineHeight: 1.5,
            }}
          >
            Execute a live telemetry forecast
            or run a controlled high-load
            simulation.
          </p>

        </div>


        <button
          className="refresh-button"
          type="button"
          disabled={
            loading ||
            refreshing ||
            running
          }
          onClick={() => {
            setRefreshing(true);
            void loadPrediction();
          }}
        >
          <RefreshCw
            size={15}
          />

          {refreshing
            ? "Refreshing..."
            : "Refresh Evidence"}
        </button>

      </div>


      {error && (
        <div
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "10px",
            border:
              "1px solid rgba(248,113,113,0.28)",
            background:
              "rgba(248,113,113,0.08)",
            color: "#fecaca",
            fontSize: "12px",
            lineHeight: 1.5,
          }}
        >
          <strong>
            Prediction error:
          </strong>{" "}
          {error}
        </div>
      )}


      {actionMessage && (
        <div
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            borderRadius: "10px",
            border:
              "1px solid rgba(56,189,248,0.22)",
            background:
              "rgba(56,189,248,0.07)",
            color: "#c7e7fb",
            fontSize: "12px",
            lineHeight: 1.5,
          }}
        >
          {actionMessage}
        </div>
      )}


      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2, minmax(0, 1fr))",
          gap: "12px",
          marginBottom: "18px",
        }}
      >

        <button
          type="button"
          disabled={
            loading ||
            running
          }
          onClick={() =>
            void runForecast(
              "LIVE"
            )
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "9px",
            padding: "13px 16px",
            borderRadius: "10px",
            border:
              "1px solid rgba(56,189,248,0.30)",
            background:
              "rgba(56,189,248,0.10)",
            color: "#d8f2ff",
            fontWeight: 750,
            cursor:
              running
                ? "not-allowed"
                : "pointer",
          }}
        >
          <Play
            size={16}
          />

          {running
            ? "Running..."
            : "Run Live Prediction"}
        </button>


        <button
          type="button"
          disabled={
            loading ||
            running
          }
          onClick={() =>
            void runForecast(
              "SIMULATED"
            )
          }
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "9px",
            padding: "13px 16px",
            borderRadius: "10px",
            border:
              "1px solid rgba(251,191,36,0.30)",
            background:
              "rgba(251,191,36,0.08)",
            color: "#fdecc2",
            fontWeight: 750,
            cursor:
              running
                ? "not-allowed"
                : "pointer",
          }}
        >
          <Zap
            size={16}
          />

          {running
            ? "Running..."
            : "Simulate Failure Risk"}
        </button>

      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: "12px",
        }}
      >

        <div
          style={{
            padding: "16px",
            borderRadius: "11px",
            background:
              "rgba(255,255,255,0.028)",
            border:
              "1px solid rgba(255,255,255,0.07)",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              color: "#8196ae",
              fontSize: "10px",
              fontWeight: 750,
              textTransform:
                "uppercase",
            }}
          >
            <BrainCircuit
              size={15}
            />
            Failure Probability
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "24px",
              color: "#e5edf7",
            }}
          >
            {formatProbability(
              displayedProbability
            )}
          </strong>

        </div>


        <div
          style={{
            padding: "16px",
            borderRadius: "11px",
            background:
              "rgba(255,255,255,0.028)",
            border:
              "1px solid rgba(255,255,255,0.07)",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              color: "#8196ae",
              fontSize: "10px",
              fontWeight: 750,
              textTransform:
                "uppercase",
            }}
          >
            <ShieldAlert
              size={15}
            />
            Risk Level
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "22px",
              color: "#e5edf7",
            }}
          >
            {riskLevel}
          </strong>

        </div>


        <div
          style={{
            padding: "16px",
            borderRadius: "11px",
            background:
              "rgba(255,255,255,0.028)",
            border:
              "1px solid rgba(255,255,255,0.07)",
          }}
        >

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              color: "#8196ae",
              fontSize: "10px",
              fontWeight: 750,
              textTransform:
                "uppercase",
            }}
          >
            <Activity
              size={15}
            />
            Prediction Runs
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "24px",
              color: "#e5edf7",
            }}
          >
            {historyCount}
          </strong>

        </div>


        <div
          style={{
            padding: "16px",
            borderRadius: "11px",
            background:
              "rgba(255,255,255,0.028)",
            border:
              "1px solid rgba(255,255,255,0.07)",
          }}
        >

          <div
            style={{
              color: "#8196ae",
              fontSize: "10px",
              fontWeight: 750,
              textTransform:
                "uppercase",
            }}
          >
            Source
          </div>

          <strong
            style={{
              display: "block",
              marginTop: "10px",
              fontSize: "18px",
              color: "#e5edf7",
            }}
          >
            {lastForecast?.source ??
              readText(
                latest.source
              )}
          </strong>

        </div>

      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.2fr) minmax(0, 0.8fr)",
          gap: "14px",
          marginTop: "14px",
        }}
      >

        <div
          style={{
            padding: "18px",
            borderRadius: "12px",
            background:
              "rgba(255,255,255,0.028)",
            border:
              "1px solid rgba(255,255,255,0.08)",
          }}
        >

          <div
            style={{
              color: "#b9d7ef",
              fontSize: "12px",
              fontWeight: 750,
            }}
          >
            Risk drivers
          </div>


          <div
            style={{
              marginTop: "12px",
              display: "grid",
              gap: "8px",
            }}
          >

            {factors.length > 0 ? (
              factors.slice(0, 6).map(
                (
                  factor,
                  index
                ) => (
                  <div
                    key={`${factor}-${index}`}
                    style={{
                      padding:
                        "10px 12px",
                      borderRadius:
                        "8px",
                      background:
                        "rgba(255,255,255,0.025)",
                      border:
                        "1px solid rgba(255,255,255,0.06)",
                      color:
                        "#c9d6e3",
                      fontSize:
                        "11px",
                      lineHeight:
                        1.45,
                    }}
                  >
                    {factor}
                  </div>
                )
              )
            ) : (
              <div
                style={{
                  color:
                    "#8196ae",
                  fontSize:
                    "11px",
                }}
              >
                No prediction factors
                are available yet.
              </div>
            )}

          </div>

        </div>


        <div
          style={{
            padding: "18px",
            borderRadius: "12px",
            background:
              "rgba(255,255,255,0.028)",
            border:
              "1px solid rgba(255,255,255,0.08)",
          }}
        >

          <div
            style={{
              color: "#b9d7ef",
              fontSize: "12px",
              fontWeight: 750,
            }}
          >
            Current telemetry
          </div>


          <div
            style={{
              marginTop: "12px",
              display: "grid",
              gap: "8px",
            }}
          >
            {[
              [
                "CPU",
                currentMetrics.cpu_percent,
              ],

              [
                "Memory",
                currentMetrics.memory_percent,
              ],

              [
                "Disk",
                currentMetrics.disk_percent,
              ],

              [
                "DB latency",
                currentMetrics.db_latency_ms,
              ],

              [
                "Open incidents",
                currentMetrics.open_incidents,
              ],
            ].map(
              ([
                label,
                value,
              ]) => (
                <div
                  key={String(label)}
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap:
                      "12px",
                    paddingBottom:
                      "7px",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.06)",
                    fontSize:
                      "11px",
                  }}
                >
                  <span
                    style={{
                      color:
                        "#8196ae",
                    }}
                  >
                    {String(label)}
                  </span>

                  <strong
                    style={{
                      color:
                        "#d6e3ef",
                    }}
                  >
                    {formatValue(
                      value
                    )}
                  </strong>
                </div>
              )
            )}
          </div>

        </div>

      </div>


      <div
        style={{
          marginTop: "14px",
          padding: "18px",
          borderRadius: "12px",
          background:
            "rgba(255,255,255,0.028)",
          border:
            "1px solid rgba(255,255,255,0.08)",
        }}
      >

        <div
          style={{
            color: "#b9d7ef",
            fontSize: "12px",
            fontWeight: 750,
          }}
        >
          Prediction evidence
        </div>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "12px",
            marginTop: "13px",
          }}
        >

          <div>
            <span
              style={{
                display: "block",
                color: "#8196ae",
                fontSize: "10px",
              }}
            >
              Forecast window
            </span>

            <strong
              style={{
                display: "block",
                marginTop: "5px",
                color: "#d6e3ef",
                fontSize: "12px",
              }}
            >
{readText(
  lastForecast?.forecast_window_minutes ??
    model.forecast_window_minutes ??
    null
)}
{" "}
minutes
            </strong>
          </div>


          <div>
            <span
              style={{
                display: "block",
                color: "#8196ae",
                fontSize: "10px",
              }}
            >
              Generated
            </span>

            <strong
              style={{
                display: "block",
                marginTop: "5px",
                color: "#d6e3ef",
                fontSize: "12px",
                wordBreak:
                  "break-word",
              }}
            >
              {generatedAt}
            </strong>
          </div>


          <div>
            <span
              style={{
                display: "block",
                color: "#8196ae",
                fontSize: "10px",
              }}
            >
              Trend
            </span>

            <strong
              style={{
                display: "block",
                marginTop: "5px",
                color: "#d6e3ef",
                fontSize: "12px",
              }}
            >
              {Object.keys(
                trend
              ).length > 0
                ? readText(trend)
                : "Not available"}
            </strong>
          </div>

        </div>

      </div>


      <div
        style={{
          marginTop: "14px",
          padding: "18px",
          borderRadius: "12px",
          background:
            "rgba(255,255,255,0.028)",
          border:
            "1px solid rgba(255,255,255,0.08)",
        }}
      >

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#b9d7ef",
            fontSize: "12px",
            fontWeight: 750,
          }}
        >
          <Activity
            size={16}
          />
          Model information
        </div>


        <div
          style={{
            marginTop: "13px",
            display: "grid",
            gap: "9px",
          }}
        >

          {Object.entries(
            data?.modelInfo ?? {}
          )
            .filter(
              (
                [, value]
              ) =>
                value !== null &&
                value !== undefined &&
                typeof value !== "object"
            )
            .slice(0, 8)
            .map(
              ([
                key,
                value,
              ]) => (
                <div
                  key={key}
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap:
                      "12px",
                    paddingBottom:
                      "8px",
                    borderBottom:
                      "1px solid rgba(255,255,255,0.06)",
                    fontSize:
                      "11px",
                  }}
                >
                  <span
                    style={{
                      color:
                        "#8196ae",
                    }}
                  >
                    {key.replaceAll(
                      "_",
                      " "
                    )}
                  </span>

                  <strong
                    style={{
                      color:
                        "#d6e3ef",
                      textAlign:
                        "right",
                    }}
                  >
                    {readText(
                      value
                    )}
                  </strong>
                </div>
              )
            )}

        </div>


        <div
          style={{
            marginTop: "14px",
            padding:
              "11px 12px",
            borderRadius: "9px",
            background:
              "rgba(248,113,113,0.07)",
            color: "#9cafc2",
            fontSize: "10px",
            lineHeight: 1.6,
          }}
        >
          <ShieldAlert
            size={14}
            style={{
              verticalAlign:
                "middle",
              marginRight: "6px",
            }}
          />

          Prototype warning:
          this panel surfaces the
          backend telemetry-weighted
          prediction evidence. It is
          not a trained or
          production-calibrated ML
          probability model.
        </div>

      </div>

    </section>
  );
}