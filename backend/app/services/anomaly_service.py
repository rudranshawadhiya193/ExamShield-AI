from typing import Dict, List, Tuple


def calculate_behavior_risk(
    answer_time_ms: int,
    answer_changes: int,
    focus_changes: int,
    offline_duration_ms: int,
    navigation_count: int
) -> Tuple[float, str, List[str]]:
    """
    Explainable AI-assisted behavior risk scoring.

    This function does not determine cheating.
    It identifies unusual technical/behavioral
    signals for human review.
    """

    score = 0.0
    flags: List[str] = []

    # Extremely fast answer pattern
    if 0 < answer_time_ms < 3000:
        score += 25
        flags.append(
            "VERY_FAST_RESPONSE"
        )

    elif 0 < answer_time_ms < 5000:
        score += 15
        flags.append(
            "FAST_RESPONSE"
        )

    # Repeated answer changes
    if answer_changes >= 6:
        score += 30
        flags.append(
            "EXCESSIVE_ANSWER_CHANGES"
        )

    elif answer_changes >= 4:
        score += 20
        flags.append(
            "HIGH_ANSWER_CHANGE_COUNT"
        )

    elif answer_changes >= 2:
        score += 10
        flags.append(
            "MULTIPLE_ANSWER_CHANGES"
        )

    # Browser/window focus changes
    if focus_changes >= 6:
        score += 30
        flags.append(
            "EXCESSIVE_FOCUS_CHANGES"
        )

    elif focus_changes >= 3:
        score += 20
        flags.append(
            "HIGH_FOCUS_CHANGE_COUNT"
        )

    elif focus_changes >= 1:
        score += 5
        flags.append(
            "FOCUS_CHANGE_DETECTED"
        )

    # Temporary connectivity disruption
    if offline_duration_ms >= 120000:
        score += 15
        flags.append(
            "EXTENDED_OFFLINE_PERIOD"
        )

    elif offline_duration_ms >= 60000:
        score += 10
        flags.append(
            "OFFLINE_PERIOD_DETECTED"
        )

    # Unusual navigation activity
    if navigation_count >= 15:
        score += 15
        flags.append(
            "HIGH_NAVIGATION_ACTIVITY"
        )

    elif navigation_count >= 8:
        score += 10
        flags.append(
            "ELEVATED_NAVIGATION_ACTIVITY"
        )

    # Keep score inside 0-100.
    score = min(score, 100.0)

    if score >= 80:
        risk_level = "REVIEW_REQUIRED"

    elif score >= 60:
        risk_level = "HIGH"

    elif score >= 40:
        risk_level = "MEDIUM"

    elif score >= 25:
        risk_level = "LOW"

    else:
        risk_level = "NORMAL"

    if not flags:
        flags.append(
            "NO_UNUSUAL_SIGNAL_DETECTED"
        )

    return (
        score,
        risk_level,
        flags
    )


def build_candidate_summary(
    events: List
) -> Dict:
    if not events:
        return {
            "total_events": 0,
            "average_risk_score": 0,
            "maximum_risk_score": 0,
            "review_required_events": 0,
            "high_risk_events": 0,
            "risk_level_distribution": {},
        }

    scores = [
        float(event.risk_score)
        for event in events
    ]

    review_required = sum(
        1
        for event in events
        if event.risk_level
        == "REVIEW_REQUIRED"
    )

    high_risk = sum(
        1
        for event in events
        if event.risk_level
        in {"HIGH", "REVIEW_REQUIRED"}
    )

    distribution: Dict[str, int] = {}

    for event in events:
        distribution[event.risk_level] = (
            distribution.get(
                event.risk_level,
                0
            ) + 1
        )

    return {
        "total_events": len(events),
        "average_risk_score": round(
            sum(scores) / len(scores),
            2
        ),
        "maximum_risk_score": max(scores),
        "review_required_events": (
            review_required
        ),
        "high_risk_events": high_risk,
        "risk_level_distribution": distribution,
    }