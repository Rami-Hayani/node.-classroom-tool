"""Helpers for turning graded poll responses into concept assessment scores."""


def score_from_evaluation(evaluation):
    """Return a 0-100 score, or None when the response was not graded."""
    if not isinstance(evaluation, dict):
        return None
    score = evaluation.get("score", evaluation.get("percentage"))
    if isinstance(score, (int, float)):
        return max(0.0, min(100.0, float(score)))
    # Preserve compatibility with responses created before numeric scoring.
    return {"correct": 100.0, "partial": 50.0, "wrong": 0.0, "incorrect": 0.0}.get(
        evaluation.get("eval_result")
    )


def score_to_color(score):
    if score is None:
        return "gray"
    if score > 75:
        return "green"
    if score >= 50:
        return "yellow"
    if score >= 25:
        return "orange"
    return "red"
