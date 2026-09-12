from dotenv import load_dotenv
from flask import request, jsonify, Blueprint
from ..db import supabase
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set
from ..services.assessment import score_from_evaluation, score_to_color

load_dotenv()
heatmap = Blueprint("heatmap", __name__)


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

    concept_ids = [c['id'] for c in concepts]
    lecture_ids = [l['id'] for l in supabase.table('lectures').select('id').eq('course_id', course_id).execute().data]
    polls = supabase.table('poll_questions').select('id, concept_id').in_('lecture_id', lecture_ids).in_('concept_id', concept_ids).execute().data if lecture_ids else []
    poll_ids = [p['id'] for p in polls]
    poll_concepts = {p['id']: p.get('concept_id') for p in polls}
    responses = supabase.table('poll_responses').select('question_id, student_id, evaluation').in_('question_id', poll_ids).execute().data if poll_ids else []
    scores_by_concept_student = {}
    for response in responses:
        concept_id = poll_concepts.get(response['question_id'])
        score = score_from_evaluation(response.get('evaluation'))
        if concept_id and score is not None:
            scores_by_concept_student.setdefault(concept_id, {}).setdefault(response['student_id'], []).append(score)

    heatmap_data = []
    for concept in concepts:
        concept_id = concept['id']
        score_map = scores_by_concept_student.get(concept_id, {})
        scores = [sum(values) / len(values) for values in score_map.values()]

        # Count colors
        distribution = {"green": 0, "yellow": 0, "orange": 0, "red": 0, "gray": 0}
        for student in students:
            student_scores = score_map.get(student['id'])
            score = sum(student_scores) / len(student_scores) if student_scores else None
            distribution[score_to_color(score)] += 1

        avg_score = sum(scores) / len(scores) if scores else None

        assessed_count = distribution['green'] + distribution['yellow'] + distribution['orange'] + distribution['red']
        mastered_count = distribution['green']
        struggling_count = distribution['red']
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
            "avg_confidence": round(avg_score / 100, 3) if avg_score is not None else 0.0,
            "assessment_average": round(avg_score, 1) if avg_score is not None else None,
            "assessment_count": len(scores),
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
