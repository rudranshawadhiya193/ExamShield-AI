import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
} from "@mediapipe/tasks-vision";

import { recordProctoringEvent } from "./api";

interface ProctoringPanelProps {
  candidateId: string;
  examId: string;
}

type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH";

interface EventItem {
  id: string;
  time: string;
  type: string;
  severity: RiskLevel;
  message: string;
}

const PROCTORING_STORAGE_PREFIX =
  "examshield_proctoring_events_";

function getStorageKey(
  candidateId: string
): string {
  return (
    PROCTORING_STORAGE_PREFIX +
    candidateId
  );
}

function loadStoredEvents(
  candidateId: string
): EventItem[] {
  try {
    const raw =
      localStorage.getItem(
        getStorageKey(candidateId)
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as EventItem[];
  } catch {
    return [];
  }
}

function saveEvents(
  candidateId: string,
  events: EventItem[]
): void {
  try {
    localStorage.setItem(
      getStorageKey(candidateId),
      JSON.stringify(events)
    );
  } catch {
    // Best-effort local evidence persistence.
  }
}

function addStoredEvent(
  candidateId: string,
  type: string,
  severity: RiskLevel,
  message: string
): EventItem {
  const existing =
    loadStoredEvents(
      candidateId
    );

  const item: EventItem = {
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString(),
    type,
    severity,
    message,
  };

  saveEvents(
    candidateId,
    [item, ...existing].slice(
      0,
      50
    )
  );

  return item;
}

function calculateHeadTurn(
  result: FaceLandmarkerResult
): "CENTER" | "LEFT" | "RIGHT" | "UNKNOWN" {
  const landmarks =
    result.faceLandmarks?.[0];

  if (
    !landmarks ||
    landmarks.length < 10
  ) {
    return "UNKNOWN";
  }

  const leftEye =
    landmarks[33];

  const rightEye =
    landmarks[263];

  const nose =
    landmarks[1];

  if (
    !leftEye ||
    !rightEye ||
    !nose
  ) {
    return "UNKNOWN";
  }

  const eyeCenterX =
    (leftEye.x +
      rightEye.x) /
    2;

  const eyeDistance =
    Math.abs(
      rightEye.x -
        leftEye.x
    );

  if (eyeDistance < 0.01) {
    return "UNKNOWN";
  }

  const normalizedOffset =
    (nose.x -
      eyeCenterX) /
    eyeDistance;

  if (
    normalizedOffset <
    -0.20
  ) {
    return "LEFT";
  }

  if (
    normalizedOffset >
    0.20
  ) {
    return "RIGHT";
  }

  return "CENTER";
}

function calculateRisk(
  faceCount: number,
  headTurn: string
): {
  riskLevel: RiskLevel;
  reason: string;
} {
  if (faceCount === 0) {
    return {
      riskLevel: "HIGH",
      reason:
        "No face detected in the camera frame.",
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

export default function ProctoringPanel({
  candidateId,
  examId,
}: ProctoringPanelProps) {
  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const landmarkerRef =
    useRef<FaceLandmarker | null>(
      null
    );

  const streamRef =
    useRef<MediaStream | null>(
      null
    );

  const animationFrameRef =
    useRef<number | null>(
      null
    );

  const startedRef =
    useRef(false);

  const lastEventSignatureRef =
    useRef<string>("");

  const lastEventTimeRef =
    useRef<number>(0);

  const addEvent =
    useCallback(
      (
        type: string,
        severity: RiskLevel,
        message: string
      ) => {
        const signature =
          `${type}:${severity}:${message}`;

        const now =
          Date.now();

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

        const item = addStoredEvent(
          candidateId,
          type,
          severity,
          message
        );

        void recordProctoringEvent({
          event_id: item.id,
          candidate_id: candidateId,
          exam_id: examId,
          event_type: type,
          severity,
          message,
        }).catch(() => {
          // Local evidence remains available if the API is temporarily unavailable.
        });
      },
      [candidateId, examId]
    );

  const detectFrame =
    useCallback(() => {
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
          result.faceLandmarks
            ?.length ?? 0;

        const headTurn =
          calculateHeadTurn(
            result
          );

        const risk =
          calculateRisk(
            faceCount,
            headTurn
          );

        if (
          risk.riskLevel !==
          "LOW"
        ) {
          addEvent(
            "PROCTORING_RISK",
            risk.riskLevel,
            risk.reason
          );
        }
      } catch {
        addEvent(
          "VISION_PROCESSING_ERROR",
          "MEDIUM",
          "Vision processing encountered a camera-frame error."
        );
      }

      animationFrameRef.current =
        requestAnimationFrame(
          detectFrame
        );
    }, [addEvent]);

  const stopMonitoring =
    useCallback(() => {
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
        for (
          const track of
          streamRef.current.getTracks()
        ) {
          track.stop();
        }

        streamRef.current =
          null;
      }

      if (
        landmarkerRef.current
      ) {
        landmarkerRef.current.close();

        landmarkerRef.current =
          null;
      }

      startedRef.current =
        false;
    }, []);

  const startMonitoring =
    useCallback(async () => {
      if (
        startedRef.current
      ) {
        return;
      }

      startedRef.current =
        true;

      try {
        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Camera API is unavailable in this browser context."
          );
        }

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
                facingMode:
                  "user",
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
            "Hidden camera element is unavailable."
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
              runningMode:
                "VIDEO",
              numFaces: 2,
              minFaceDetectionConfidence:
                0.5,
              minFacePresenceConfidence:
                0.5,
              minTrackingConfidence:
                0.5,
            }
          );

        landmarkerRef.current =
          landmarker;

        addEvent(
          "CAMERA_STARTED",
          "LOW",
          `AI proctoring started for ${candidateId} / ${examId}.`
        );

        animationFrameRef.current =
          requestAnimationFrame(
            detectFrame
          );
      } catch (
        cameraError
      ) {
        startedRef.current =
          false;

        if (
          streamRef.current
        ) {
          for (
            const track of
            streamRef.current.getTracks()
          ) {
            track.stop();
          }

          streamRef.current =
            null;
        }

        let message =
          "Camera monitoring could not be initialized.";

        if (
          cameraError instanceof
          DOMException
        ) {
          message =
            `Camera access failed: ${cameraError.name}.`;
        } else if (
          cameraError instanceof
          Error
        ) {
          message =
            cameraError.message;
        }

        addEvent(
          "CAMERA_UNAVAILABLE",
          "HIGH",
          message
        );
      }
    }, [
      addEvent,
      candidateId,
      detectFrame,
      examId,
    ]);

  useEffect(() => {
    /*
     * We intentionally DO NOT call getUserMedia
     * immediately on page load.
     *
     * Instead, wait for the candidate's first
     * interaction so browsers can associate the
     * camera permission request with user intent.
     */

    const startFromInteraction =
      () => {
        void startMonitoring();

        document.removeEventListener(
          "pointerdown",
          startFromInteraction
        );

        document.removeEventListener(
          "keydown",
          startFromInteraction
        );
      };

    document.addEventListener(
      "pointerdown",
      startFromInteraction,
      {
        passive: true,
        once: true,
      }
    );

    document.addEventListener(
      "keydown",
      startFromInteraction,
      {
        passive: true,
        once: true,
      }
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        startFromInteraction
      );

      document.removeEventListener(
        "keydown",
        startFromInteraction
      );

      stopMonitoring();
    };
  }, [
    startMonitoring,
    stopMonitoring,
  ]);

  /*
   * Hidden video:
   * candidate does not see the proctoring
   * dashboard, risk scores, face count, or
   * head-position information.
   */
  return (
    <video
      ref={videoRef}
      muted
      playsInline
      aria-hidden="true"
      tabIndex={-1}
      style={{
        position: "fixed",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
        left: -10,
        top: -10,
      }}
    />
  );
}