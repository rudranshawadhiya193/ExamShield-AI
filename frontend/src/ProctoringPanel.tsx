import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

interface ProctoringPanelProps {
  candidateId: string;
  examId: string;
}

type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

interface ProctoringState {
  faceCount: number;
  headTurn: "CENTER" | "LEFT" | "RIGHT" | "UNKNOWN";
  cameraActive: boolean;
  riskLevel: RiskLevel;
  reason: string;
}

interface EventItem {
  id: string;
  time: string;
  type: string;
  severity: RiskLevel;
  message: string;
}

function calculateHeadTurn(
  result: FaceLandmarkerResult
): "CENTER" | "LEFT" | "RIGHT" | "UNKNOWN" {
  const landmarks = result.faceLandmarks?.[0];

  if (!landmarks || landmarks.length < 10) {
    return "UNKNOWN";
  }

  /*
   * Approximate yaw proxy:
   * compare nose position with the horizontal
   * center of the eye landmarks.
   *
   * This is intentionally a risk signal, not
   * a biometric identity decision.
   */

  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];

  if (!leftEye || !rightEye || !nose) {
    return "UNKNOWN";
  }

  const eyeCenterX =
    (leftEye.x + rightEye.x) / 2;

  const eyeDistance =
    Math.abs(rightEye.x - leftEye.x);

  if (eyeDistance < 0.01) {
    return "UNKNOWN";
  }

  const normalizedOffset =
    (nose.x - eyeCenterX) /
    eyeDistance;

  if (normalizedOffset < -0.20) {
    return "LEFT";
  }

  if (normalizedOffset > 0.20) {
    return "RIGHT";
  }

  return "CENTER";
}

function calculateRisk(
  faceCount: number,
  headTurn: string,
  cameraActive: boolean
): {
  riskLevel: RiskLevel;
  reason: string;
} {
  if (!cameraActive) {
    return {
      riskLevel: "HIGH",
      reason: "Camera is unavailable.",
    };
  }

  if (faceCount === 0) {
    return {
      riskLevel: "HIGH",
      reason: "No face detected in the camera frame.",
    };
  }

  if (faceCount > 1) {
    return {
      riskLevel: "HIGH",
      reason:
        "Multiple faces detected; human review recommended.",
    };
  }

  if (
    headTurn === "LEFT" ||
    headTurn === "RIGHT"
  ) {
    return {
      riskLevel: "MEDIUM",
      reason:
        `Head orientation indicates a significant ${headTurn.toLowerCase()} turn.`,
    };
  }

  return {
    riskLevel: "LOW",
    reason:
      "Single face detected and head orientation is within the expected range.",
  };
}

function formatTime(): string {
  return new Date().toLocaleTimeString();
}

export default function ProctoringPanel({
  candidateId,
  examId,
}: ProctoringPanelProps) {
  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const landmarkerRef =
    useRef<FaceLandmarker | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  const lastEventSignatureRef =
    useRef<string>("");

  const lastEventTimeRef =
    useRef<number>(0);

  const [loading, setLoading] =
    useState(false);

  const [running, setRunning] =
    useState(false);

  const [error, setError] =
    useState("");

  const [state, setState] =
    useState<ProctoringState>({
      faceCount: 0,
      headTurn: "UNKNOWN",
      cameraActive: false,
      riskLevel: "LOW",
      reason:
        "Camera monitoring has not started.",
    });

  const [events, setEvents] =
    useState<EventItem[]>([]);

  const addEvent = useCallback(
    (
      type: string,
      severity: RiskLevel,
      message: string
    ) => {
      const signature =
        `${type}:${severity}:${message}`;

      const now = Date.now();

      /*
       * Prevent the same warning from filling
       * the event list on every video frame.
       */
      if (
        signature ===
          lastEventSignatureRef.current &&
        now -
          lastEventTimeRef.current <
          5000
      ) {
        return;
      }

      lastEventSignatureRef.current =
        signature;

      lastEventTimeRef.current =
        now;

      const item: EventItem = {
        id: crypto.randomUUID(),
        time: formatTime(),
        type,
        severity,
        message,
      };

      setEvents((previous) => [
        item,
        ...previous,
      ].slice(0, 8));
    },
    []
  );

  const detectFrame = useCallback(
    () => {
      const video =
        videoRef.current;

      const landmarker =
        landmarkerRef.current;

      if (
        !video ||
        !landmarker ||
        video.readyState <
          HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        animationFrameRef.current =
          requestAnimationFrame(
            detectFrame
          );

        return;
      }

      try {
        const result =
          landmarker.detectForVideo(
            video,
            performance.now()
          );

        const faceCount =
          result.faceLandmarks?.length ?? 0;

        const headTurn =
          calculateHeadTurn(result);

        const risk =
          calculateRisk(
            faceCount,
            headTurn,
            true
          );

        setState({
          faceCount,
          headTurn,
          cameraActive: true,
          riskLevel: risk.riskLevel,
          reason: risk.reason,
        });

        if (risk.riskLevel !== "LOW") {
          addEvent(
            "PROCTORING_RISK",
            risk.riskLevel,
            risk.reason
          );
        }
      } catch {
        setError(
          "Vision processing failed for the current camera frame."
        );
      }

      animationFrameRef.current =
        requestAnimationFrame(
          detectFrame
        );
    },
    [addEvent]
  );

  const stopCamera = useCallback(
    () => {
      if (
        animationFrameRef.current !==
        null
      ) {
        cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current =
          null;
      }

      if (streamRef.current) {
        for (const track of
          streamRef.current.getTracks()) {
          track.stop();
        }

        streamRef.current = null;
      }

      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }

      setRunning(false);

      setState((previous) => ({
        ...previous,
        cameraActive: false,
        reason:
          "Camera monitoring stopped.",
      }));
    },
    []
  );

  const startCamera = useCallback(
    async () => {
      if (running || loading) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: {
                width: {
                  ideal: 640,
                },
                height: {
                  ideal: 480,
                },
                facingMode: "user",
              },
              audio: false,
            }
          );

        streamRef.current =
          stream;

        const video =
          videoRef.current;

        if (!video) {
          throw new Error(
            "Camera preview element is unavailable."
          );
        }

        video.srcObject =
          stream;

        await video.play();

        const vision =
          await FilesetResolver.forVisionTasks(
            "/wasm"
          );

        const landmarker =
          await FaceLandmarker.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath:
                  "/models/face_landmarker.task",
              },
              runningMode: "VIDEO",
              numFaces: 2,
              minFaceDetectionConfidence: 0.5,
              minFacePresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            }
          );

        landmarkerRef.current =
          landmarker;

        setRunning(true);

        setState({
          faceCount: 0,
          headTurn: "UNKNOWN",
          cameraActive: true,
          riskLevel: "LOW",
          reason:
            "Camera active. Initializing vision monitoring...",
        });

        addEvent(
          "CAMERA_STARTED",
          "LOW",
          `Proctoring started for ${candidateId} / ${examId}.`
        );

        animationFrameRef.current =
          requestAnimationFrame(
            detectFrame
          );
      } catch (cameraError) {
        stopCamera();

        if (
          cameraError instanceof
          DOMException
        ) {
          if (
            cameraError.name ===
            "NotAllowedError"
          ) {
            setError(
              "Camera permission was denied. Allow camera access and start again."
            );
          } else if (
            cameraError.name ===
            "NotFoundError"
          ) {
            setError(
              "No camera device was found."
            );
          } else {
            setError(
              `Camera error: ${cameraError.name}`
            );
          }
        } else {
          setError(
            "Unable to initialize the AI proctoring engine."
          );
        }

        setState({
          faceCount: 0,
          headTurn: "UNKNOWN",
          cameraActive: false,
          riskLevel: "HIGH",
          reason:
            "Camera monitoring could not be initialized.",
        });
      } finally {
        setLoading(false);
      }
    },
    [
      addEvent,
      candidateId,
      detectFrame,
      examId,
      loading,
      running,
      stopCamera,
    ]
  );

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const riskLabel =
    state.riskLevel === "LOW"
      ? "LOW"
      : state.riskLevel ===
          "MEDIUM"
        ? "MEDIUM"
        : "HIGH";

  const riskBackground =
    state.riskLevel === "LOW"
      ? "#ecfdf5"
      : state.riskLevel ===
          "MEDIUM"
        ? "#fffbeb"
        : "#fef2f2";

  const riskBorder =
    state.riskLevel === "LOW"
      ? "#a7f3d0"
      : state.riskLevel ===
          "MEDIUM"
        ? "#fde68a"
        : "#fecaca";

  return (
    <section
      style={{
        marginTop: 18,
        padding: 18,
        borderRadius: 16,
        border:
          "1px solid #dbe3ec",
        background: "#ffffff",
        boxShadow:
          "0 8px 28px rgba(15, 23, 42, 0.07)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              color: "#0f172a",
            }}
          >
            AI Proctoring Risk Monitor
          </h2>

          <p
            style={{
              margin:
                "6px 0 0",
              fontSize: 12,
              color: "#64748b",
            }}
          >
            On-device camera signals for
            examination integrity review.
          </p>
        </div>

        <span
          style={{
            padding:
              "6px 10px",
            borderRadius: 999,
            background:
              state.cameraActive
                ? "#dcfce7"
                : "#f1f5f9",
            color:
              state.cameraActive
                ? "#166534"
                : "#475569",
            fontWeight: 700,
            fontSize: 11,
          }}
        >
          {state.cameraActive
            ? "● CAMERA ACTIVE"
            : "○ CAMERA INACTIVE"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(280px, 1.2fr) minmax(250px, 1fr)",
          gap: 16,
        }}
      >
        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            background:
              "#0f172a",
            minHeight: 250,
            position: "relative",
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: "100%",
              height: 300,
              objectFit: "cover",
              display: "block",
              transform:
                "scaleX(-1)",
            }}
          />

          {!running && (
            <div
              style={{
                position:
                  "absolute",
                inset: 0,
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                color: "#cbd5e1",
                fontSize: 13,
                padding: 20,
                textAlign: "center",
              }}
            >
              Camera preview will appear here.
            </div>
          )}
        </div>

        <div>
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              border:
                `1px solid ${riskBorder}`,
              background:
                riskBackground,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                Current Risk
              </span>

              <strong
                style={{
                  fontSize: 20,
                  color:
                    state.riskLevel ===
                    "HIGH"
                      ? "#b91c1c"
                      : state.riskLevel ===
                          "MEDIUM"
                        ? "#a16207"
                        : "#047857",
                }}
              >
                {riskLabel}
              </strong>
            </div>

            <p
              style={{
                margin:
                  "8px 0 0",
                fontSize: 12,
                lineHeight: 1.5,
                color: "#475569",
              }}
            >
              {state.reason}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: 10,
            }}
          >
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background:
                  "#f8fafc",
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                Faces
              </div>
              <strong
                style={{
                  fontSize: 20,
                  color: "#0f172a",
                }}
              >
                {state.faceCount}
              </strong>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background:
                  "#f8fafc",
                border:
                  "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#64748b",
                }}
              >
                Head Position
              </div>
              <strong
                style={{
                  fontSize: 13,
                  color: "#0f172a",
                }}
              >
                {state.headTurn}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 12,
            }}
          >
            {!running ? (
              <button
                type="button"
                onClick={() =>
                  void startCamera()
                }
                disabled={loading}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 10,
                  padding:
                    "11px 12px",
                  background:
                    "#0f172a",
                  color: "#ffffff",
                  fontWeight: 700,
                  cursor:
                    loading
                      ? "wait"
                      : "pointer",
                }}
              >
                {loading
                  ? "STARTING..."
                  : "START AI MONITORING"}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                style={{
                  flex: 1,
                  border:
                    "1px solid #fecaca",
                  borderRadius: 10,
                  padding:
                    "11px 12px",
                  background:
                    "#fff1f2",
                  color:
                    "#be123c",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                STOP MONITORING
              </button>
            )}
          </div>

          {error && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 8,
                background:
                  "#fef2f2",
                border:
                  "1px solid #fecaca",
                color:
                  "#991b1b",
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          borderRadius: 10,
          background: "#f8fafc",
          border:
            "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#334155",
            marginBottom: 8,
          }}
        >
          Recent Proctoring Signals
        </div>

        {events.length === 0 ? (
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
            }}
          >
            No proctoring events yet.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 7,
            }}
          >
            {events.map(
              (event) => (
                <div
                  key={event.id}
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "70px 150px 1fr",
                    gap: 8,
                    alignItems:
                      "center",
                    fontSize: 11,
                    padding:
                      "7px 0",
                    borderBottom:
                      "1px solid #e2e8f0",
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
            )}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 10,
          lineHeight: 1.5,
          color: "#64748b",
        }}
      >
        Privacy note: this MVP uses the camera
        only for live computer-vision signals.
        It does not record or upload the video.
        Risk signals are for human review and
        should not be treated as an automatic
        cheating verdict.
      </div>
    </section>
  );
}