from dotenv import load_dotenv
from flask import request, jsonify, Blueprint
from ..db import supabase
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set

load_dotenv()
heatmap = Blueprint("heatmap", __name__)


def _response_score(evaluation):
    evaluation = evaluation or {}
    score = evaluation.get('score')
    if isinstance(score, (int, float)):
        return max(0.0, min(100.0, float(score)))
    return {'correct': 100.0, 'partial': 60.0, 'wrong': 10.0}.get(
        evaluation.get('eval_result'), 0.0
    )


def confidence_to_color(confidence):
    if confidence == 0.0:
        return "gray"
    elif confidence < 0.25:
        return "red"
    elif confidence < 0.5:
        return "orange"
    elif confidence < 0.75:
        return "yellow"
    else:
        return "green"


@heatmap.route('/api/courses/<course_id>/heatmap', methods=['GET'])
@optional_auth
def get_heatmap(course_id):
    # Check Redis cache
    cache_key = f"heatmap:{course_id}"
    hit = cache_get(cache_key)
    if hit is not None:
        return jsonify(hit), 200

    # Get all concepts for the course
    concepts = supabase.table('concept_nodes').select('id, label, category').eq('course_id', course_id).execute().data

    # Get all students in the course. Missing mastery rows are treated as
    # unassessed rather than silently disappearing from the distribution.
    students = supabase.table('students').select('id').eq('course_id', course_id).execute().data
    total_students = len(students)

    if not concepts:
        return jsonify({"concepts": [], "total_students": total_students}), 200

    # Compute concept mastery from graded poll evidence. This intentionally
    # ignores legacy attendance/exposure values in student_mastery.
    concept_ids = [c['id'] for c in concepts]
    questions = supabase.table('poll_questions').select('id, concept_id').in_('concept_id', concept_ids).execute().data
    question_concepts = {question['id']: question['concept_id'] for question in questions}
    all_responses = supabase.table('poll_responses').select('question_id, student_id, evaluation').in_(
        'question_id', list(question_concepts)
    ).limit(10000).execute().data if question_concepts else []

    # Average each student's graded responses for each concept.
    scores_by_concept_student = {}
    for response in all_responses:
        concept_id = question_concepts.get(response['question_id'])
        if concept_id:
            key = (concept_id, response['student_id'])
            scores_by_concept_student.setdefault(key, []).append(_response_score(response.get('evaluation')))

    heatmap_data = []
    for concept in concepts:
        concept_id = concept['id']
        confidence_map = {}
        for (cid, student_id), scores in scores_by_concept_student.items():
            if cid == concept_id:
                confidence_map[student_id] = sum(scores) / len(scores) / 100.0
        confidences = [confidence_map.get(student['id'], 0.0) for student in students]

        # Count colors
        distribution = {"green": 0, "yellow": 0, "orange": 0, "red": 0, "gray": 0}
        total_confidence = 0
        for conf in confidences:
            distribution[confidence_to_color(conf)] += 1
            total_confidence += conf

        assessed_count = distribution['green'] + distribution['yellow'] + distribution['orange'] + distribution['red']
        # Class average is based on students with at least one graded
        # response for this concept; unassessed students remain gray and do
        # not pull the concept percentage toward zero.
        avg_confidence = total_confidence / assessed_count if assessed_count else 0.0
        mastered_count = distribution['green']
        struggling_count = distribution['red'] + distribution['orange']
        split_class = (
            assessed_count >= 6
            and struggling_count >= 3
            and mastered_count >= 3
            and struggling_count / assessed_count >= 0.25
            and mastered_count / assessed_count >= 0.25
        )

        heatmap_data.append({
            "id": concept_id,
            "label": concept['label'],
            "category": concept.get('category', ''),
            "distribution": distribution,
            "avg_confidence": round(avg_confidence, 2),
            "struggling_count": struggling_count,
            "mastered_count": mastered_count,
            "assessed_count": assessed_count,
            "split_class": split_class,
        })

    result = {
        "concepts": heatmap_data,
        "total_students": total_students
    }
    cache_set(cache_key, result, ttl_seconds=5)
    return jsonify(result), 200
