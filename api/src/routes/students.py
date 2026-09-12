from flask import request, jsonify, Blueprint
import os
from dotenv import load_dotenv

from ..db import supabase
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set, cache_delete_pattern

load_dotenv()
students = Blueprint("students", __name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

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


@students.route('/api/courses/<course_id>/students', methods=['GET'])
@optional_auth
def get_students(course_id):
    result = supabase.table('students').select('id, name, email').eq('course_id', course_id).execute()
    return jsonify(result.data), 200


@students.route('/api/courses/<course_id>/students/summary', methods=['GET'])
@optional_auth
def get_students_summary(course_id):
    """Return all students with mastery distributions computed server-side."""
    cache_key = f"students_summary:{course_id}"
    hit = cache_get(cache_key)
    if hit is not None:
        return jsonify(hit), 200

    students_data = supabase.table('students').select('id, name').eq('course_id', course_id).limit(500).execute().data
    if not students_data:
        return jsonify([]), 200

    student_ids = [s['id'] for s in students_data]

    # Batch mastery queries in groups of 50 to stay under Supabase row/URL limits
    by_student = {}
    batch_size = 50
    for i in range(0, len(student_ids), batch_size):
        batch_ids = student_ids[i:i + batch_size]
        rows = supabase.table('student_mastery').select('student_id, confidence').in_('student_id', batch_ids).limit(2000).execute().data
        for m in rows:
            by_student.setdefault(m['student_id'], []).append(m['confidence'])

    result = []
    for s in students_data:
        confidences = by_student.get(s['id'], [])
        dist = {'green': 0, 'lime': 0, 'yellow': 0, 'orange': 0, 'gray': 0}
        for conf in confidences:
            dist[confidence_to_color(conf)] += 1
        result.append({
            'id': s['id'],
            'name': s['name'],
            'masteryDistribution': dist,
        })

    cache_set(cache_key, result, ttl_seconds=10)
    return jsonify(result), 200


@students.route('/api/courses/<course_id>/students', methods=['POST'])
@optional_auth
def create_student(course_id):
    data = request.json

    # Create student
    student = supabase.table('students').insert({
        'name': data['name'],
        'email': data.get('email'),
        'course_id': course_id
    }).execute().data[0]

    # Create mastery rows for all concepts
    concepts = supabase.table('concept_nodes').select('id').eq('course_id', course_id).execute().data

    mastery_rows = [{
        'student_id': student['id'],
        'concept_id': concept['id'],
        'confidence': 0.0
    } for concept in concepts]

    if mastery_rows:
        supabase.table('student_mastery').insert(mastery_rows).execute()

    return jsonify(student), 201


@students.route('/api/students/<student_id>/mastery', methods=['GET'])
@optional_auth
def get_mastery(student_id):
    cache_key = f"mastery:{student_id}"
    hit = cache_get(cache_key)
    if hit is not None:
        return jsonify(hit), 200

    result = supabase.table('student_mastery').select('concept_id, confidence, attempts').eq('student_id',
                                                                                             student_id).execute()

    mastery = result.data
    for m in mastery:
        m['color'] = confidence_to_color(m['confidence'])

    cache_set(cache_key, mastery, ttl_seconds=10)
    return jsonify(mastery), 200


@students.route('/api/students/<student_id>/mastery/<concept_id>', methods=['PUT'])
@optional_auth
def update_mastery(student_id, concept_id):
    data = request.json

    # Get current mastery (fetch confidence and attempts in one query)
    current = supabase.table('student_mastery').select('confidence, attempts').eq('student_id', student_id).eq('concept_id',
                                                                                                     concept_id).execute().data

    if not current:
        return jsonify({'error': 'Mastery record not found'}), 404

    old_confidence = current[0]['confidence']
    old_attempts = current[0]['attempts']
    old_color = confidence_to_color(old_confidence)

    # Poll mastery is the average percentage earned on every graded question
    # for this concept. Attendance and connection status never affect it.
    if 'eval_result' in data:
        questions = supabase.table('poll_questions').select('id').eq('concept_id', concept_id).execute().data
        question_ids = [question['id'] for question in questions]
        responses = []
        if question_ids:
            responses = supabase.table('poll_responses').select('evaluation').eq(
                'student_id', student_id
            ).in_('question_id', question_ids).execute().data

        scores = []
        for response in responses:
            evaluation = response.get('evaluation') or {}
            score = evaluation.get('score')
            if isinstance(score, (int, float)):
                scores.append(max(0.0, min(100.0, float(score))))
            else:
                scores.append({'correct': 100.0, 'partial': 60.0, 'wrong': 10.0}.get(
                    evaluation.get('eval_result'), 0.0
                ))
        new_confidence = sum(scores) / len(scores) / 100.0 if scores else old_confidence
        new_attempts = len(scores)
    elif 'confidence' in data:
        new_confidence = max(0.0, min(1.0, data['confidence']))
        new_attempts = old_attempts
    elif 'delta' in data:
        new_confidence = max(0.0, min(1.0, old_confidence + data['delta']))
        new_attempts = old_attempts
    else:
        return jsonify({'error': 'Must provide confidence, eval_result, or delta'}), 400

    new_color = confidence_to_color(new_confidence)

    # Update (no nested query — reuse attempts from the first read)
    supabase.table('student_mastery').update({
        'confidence': new_confidence,
        'attempts': new_attempts
    }).eq('student_id', student_id).eq('concept_id', concept_id).execute()

    # Invalidate caches affected by mastery change
    cache_delete_pattern(f"mastery:{student_id}")
    cache_delete_pattern(f"graph:*:{student_id}")
    cache_delete_pattern("heatmap:*")
    cache_delete_pattern("students_summary:*")

    return jsonify({
        'concept_id': concept_id,
        'old_color': old_color,
        'new_color': new_color,
        'confidence': new_confidence
    }), 200


@students.route('/api/mastery/attendance-boost', methods=['POST'])
@optional_auth
def attendance_boost():
    data = request.json
    student_ids = data['student_ids']
    concept_ids = data['concept_ids']

    if not student_ids or not concept_ids:
        return jsonify({'updated': 0}), 200

    # Batch read: fetch all relevant mastery rows in one query
    all_mastery = supabase.table('student_mastery').select('id, student_id, concept_id, confidence').in_(
        'student_id', student_ids
    ).in_('concept_id', concept_ids).execute().data

    # Calculate which rows need updating
    to_update = []
    for row in all_mastery:
        old_conf = row['confidence']
        if old_conf < 0.3:
            new_conf = min(old_conf + 0.05, 0.3)
            if new_conf != old_conf:
                to_update.append({'id': row['id'], 'confidence': new_conf})

    # Batch update using upsert
    if to_update:
        supabase.table('student_mastery').upsert(to_update).execute()

        # Invalidate caches for all affected students
        for sid in student_ids:
            cache_delete_pattern(f"mastery:{sid}")
            cache_delete_pattern(f"graph:*:{sid}")
        cache_delete_pattern("heatmap:*")
        cache_delete_pattern("students_summary:*")

    return jsonify({'updated': len(to_update)}), 200
