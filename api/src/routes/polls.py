from flask import request, jsonify, Blueprint

from ..db import supabase
from ..middleware.auth import optional_auth

polls = Blueprint("polls", __name__)


# --- P1 CRUD endpoints ---

@polls.route('/api/lectures/<lecture_id>/polls', methods=['POST'])
@optional_auth
def create_poll_for_lecture(lecture_id):
    data = request.json
    result = supabase.table('poll_questions').insert({
        'lecture_id': lecture_id,
        'concept_id': data.get('concept_id'),
        'question': data['question'],
        'expected_answer': data.get('expected_answer'),
        'status': data.get('status', 'draft')
    }).execute()

    return jsonify(result.data[0]), 201


@polls.route('/api/lectures/<lecture_id>/polls', methods=['GET'])
@optional_auth
def get_lecture_polls(lecture_id):
    result = supabase.table('poll_questions').select('*').eq('lecture_id', lecture_id).execute()
    return jsonify(result.data), 200


@polls.route('/api/polls/<poll_id>', methods=['PUT'])
@optional_auth
def update_poll(poll_id):
    data = request.json
    result = supabase.table('poll_questions').update(data).eq('id', poll_id).execute()

    if not result.data:
        return jsonify({'error': 'Poll not found'}), 404

    return jsonify(result.data[0]), 200


# --- P3 endpoints ---

@polls.route('/api/polls', methods=['POST'])
@optional_auth
def create_poll():
    data = request.json
    result = supabase.table('poll_questions').insert({
        'lecture_id': data['lecture_id'],
        'concept_id': data.get('concept_id'),
        'question': data['question'],
        'expected_answer': data.get('expected_answer'),
        'status': data.get('status', 'draft'),
    }).execute()

    if not result.data:
        return jsonify({'error': 'Failed to create poll'}), 500
    return jsonify(result.data[0]), 201


@polls.route('/api/polls/<poll_id>', methods=['GET'])
@optional_auth
def get_poll(poll_id):
    result = supabase.table('poll_questions').select(
        'id, question, expected_answer, concept_id, lecture_id, status'
    ).eq('id', poll_id).execute()

    if not result.data:
        return jsonify({'error': 'Poll not found'}), 404
    return jsonify(result.data[0]), 200


@polls.route('/api/polls/<poll_id>/status', methods=['PUT'])
@optional_auth
def update_poll_status(poll_id):
    try:
        data = request.json
        if not data or 'status' not in data:
            return jsonify({'error': 'status field required'}), 400

        result = supabase.table('poll_questions').update({
            'status': data['status']
        }).eq('id', poll_id).execute()

        if not result.data:
            return jsonify({'error': 'Poll not found'}), 404

        # Fetch the updated poll to return all fields
        poll = supabase.table('poll_questions').select('id, status, question, concept_id').eq('id', poll_id).single().execute()
        return jsonify(poll.data), 200
    except Exception as e:
        print(f"[update_poll_status] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500


@polls.route('/api/polls/<poll_id>/responses', methods=['POST'])
@optional_auth
def create_poll_response(poll_id):
    try:
        data = request.json
        print(f"[create_poll_response] Storing response for poll {poll_id}, student {data.get('student_id')}")

        result = supabase.table('poll_responses').insert({
            'question_id': poll_id,
            'student_id': data['student_id'],
            'answer': data['answer'],
            'evaluation': data.get('evaluation'),
        }).execute()

        if not result.data:
            print(f"[create_poll_response] ERROR: Supabase insert returned no data")
            return jsonify({'error': 'Failed to create response'}), 500

        print(f"[create_poll_response] SUCCESS: Response stored with id {result.data[0].get('id')}")
        return jsonify(result.data[0]), 201
    except Exception as e:
        print(f"[create_poll_response] EXCEPTION: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to create response', 'details': str(e)}), 500


@polls.route('/api/polls/<poll_id>/responses', methods=['GET'])
@optional_auth
def get_poll_responses(poll_id):
    try:
        print(f"[get_poll_responses] Fetching responses for poll {poll_id}")
        result = supabase.table('poll_responses').select(
            'id, question_id, student_id, answer, evaluation, answered_at'
        ).eq('question_id', poll_id).execute()

        student_ids = [row.get('student_id') for row in result.data if row.get('student_id')]
        names = {}
        if student_ids:
            students = supabase.table('students').select('id, name, email').in_('id', student_ids).execute().data
            names = {row['id']: row.get('name') or row.get('email') or 'Student' for row in students}
        for row in result.data:
            row['student_name'] = names.get(row.get('student_id'), 'Student')

        print(f"[get_poll_responses] Found {len(result.data)} responses")
        return jsonify(result.data), 200
    except Exception as e:
        print(f"[get_poll_responses] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to fetch responses', 'details': str(e)}), 500


def _score_from_evaluation(evaluation):
    evaluation = evaluation or {}
    score = evaluation.get('score')
    if isinstance(score, (int, float)):
        return max(0.0, min(100.0, float(score)))
    return {'correct': 100.0, 'partial': 60.0, 'wrong': 10.0}.get(evaluation.get('eval_result'), 0.0)


@polls.route('/api/courses/<course_id>/concepts/<concept_id>/latest-question', methods=['GET'])
@optional_auth
def get_latest_concept_question(course_id, concept_id):
    """Return the latest teacher question for a concept and its graded evidence."""
    lectures = supabase.table('lecture_sessions').select('id').eq('course_id', course_id).execute().data
    lecture_ids = [row['id'] for row in lectures]
    if not lecture_ids:
        return jsonify({'question': None, 'responses': []}), 200

    questions = supabase.table('poll_questions').select(
        'id, question, expected_answer, concept_id, lecture_id, status, generated_at'
    ).eq('concept_id', concept_id).in_('lecture_id', lecture_ids).execute().data
    if not questions:
        return jsonify({'question': None, 'responses': []}), 200
    question = sorted(questions, key=lambda row: row.get('generated_at') or '', reverse=True)[0]

    responses = supabase.table('poll_responses').select(
        'id, student_id, answer, evaluation, answered_at'
    ).eq('question_id', question['id']).execute().data
    student_ids = [row['student_id'] for row in responses if row.get('student_id')]
    names = {}
    if student_ids:
        students = supabase.table('students').select('id, name').in_('id', student_ids).execute().data
        names = {row['id']: row.get('name') or 'Student' for row in students}
    for row in responses:
        row['student_name'] = names.get(row.get('student_id'), 'Student')
        row['score'] = _score_from_evaluation(row.get('evaluation'))
    return jsonify({'question': question, 'responses': responses}), 200


@polls.route('/api/polls/<poll_id>/diagnostic', methods=['GET'])
@optional_auth
def get_poll_diagnostic(poll_id):
    """Find weak direct prerequisites among students who struggled on a poll."""
    poll_rows = supabase.table('poll_questions').select('id, concept_id, lecture_id').eq('id', poll_id).execute().data
    if not poll_rows or not poll_rows[0].get('concept_id'):
        return jsonify({'concept_id': None, 'responders': 0, 'struggling_responders': 0, 'root_cause': None}), 200

    poll = poll_rows[0]
    responses = supabase.table('poll_responses').select('student_id, evaluation').eq('question_id', poll_id).execute().data
    struggling = [
        row['student_id'] for row in responses
        if (row.get('evaluation') or {}).get('eval_result') in ('wrong', 'partial', 'incorrect')
    ]
    if not struggling:
        return jsonify({'concept_id': poll['concept_id'], 'responders': len(responses), 'struggling_responders': 0, 'root_cause': None}), 200

    edges = supabase.table('concept_edges').select('source_id, target_id').eq(
        'target_id', poll['concept_id']
    ).execute().data
    prerequisite_ids = [edge['source_id'] for edge in edges]
    if not prerequisite_ids:
        return jsonify({'concept_id': poll['concept_id'], 'responders': len(responses), 'struggling_responders': len(struggling), 'root_cause': None}), 200

    concepts = supabase.table('concept_nodes').select('id, label').in_('id', prerequisite_ids).execute().data
    best = None
    for prerequisite in concepts:
        mastery = supabase.table('student_mastery').select('student_id, confidence').eq(
            'concept_id', prerequisite['id']
        ).in_('student_id', struggling).execute().data
        weak_overlap = sum(1 for row in mastery if (row.get('confidence') or 0.0) < 0.5)
        candidate = {
            'concept_id': prerequisite['id'],
            'label': prerequisite['label'],
            'weak_overlap': weak_overlap,
            'struggling_responders': len(struggling),
            'ratio': round(weak_overlap / len(struggling), 2) if struggling else 0,
        }
        if weak_overlap and (best is None or candidate['ratio'] > best['ratio']):
            best = candidate

    if best and best['ratio'] < 0.5:
        best = None
    return jsonify({
        'concept_id': poll['concept_id'],
        'responders': len(responses),
        'struggling_responders': len(struggling),
        'root_cause': best,
    }), 200
