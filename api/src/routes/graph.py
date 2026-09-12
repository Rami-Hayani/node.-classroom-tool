from flask import request, jsonify, Blueprint
from ..db import supabase
from ..services.create_kg import calculate_importance
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set
from ..services.assessment import score_from_evaluation, score_to_color

graph = Blueprint("graph", __name__)


@graph.route('/api/courses/<course_id>/graph', methods=['GET'])
@optional_auth
def get_graph(course_id):
    student_id = request.args.get('student_id')

    # Check Redis cache
    cache_key = f"graph:{course_id}:{student_id or 'none'}"
    hit = cache_get(cache_key)
    if hit is not None:
        return jsonify(hit), 200

    nodes = supabase.table('concept_nodes').select('*').eq('course_id', course_id).execute().data
    nodes.sort(key=lambda node: (node.get('y') is None, node.get('y', 0)))
    # concept_nodes are inserted in syllabus order; retain that order explicitly
    # for the vertical graph layout.
    for index, node in enumerate(nodes):
        node['syllabus_order'] = node.get('y') if node.get('y') is not None else index
    edges = supabase.table('concept_edges').select('*').eq('course_id', course_id).execute().data

    # Build graph for importance calculation
    node_map = {n['id']: n['label'] for n in nodes}
    graph_data = {
        'nodes': {n['label']: n.get('description', '') for n in nodes},
        'edges': [(node_map[e['source_id']], node_map[e['target_id']])
                  for e in edges
                  if e['source_id'] in node_map and e['target_id'] in node_map]
    }

    # Calculate importance from graph structure
    importance = calculate_importance(graph_data)

    # Add importance to response
    for node in nodes:
        node['importance'] = importance.get(node['label'], 0.5)

    # Add mastery if student_id provided
    if student_id:
        lecture_ids = [l['id'] for l in supabase.table('lectures').select('id').eq('course_id', course_id).execute().data]
        poll_ids = supabase.table('poll_questions').select('id, concept_id').in_(
            'lecture_id', lecture_ids
        ).execute().data if lecture_ids else []
        responses = supabase.table('poll_responses').select('question_id, evaluation').eq(
            'student_id', student_id
        ).in_('question_id', [p['id'] for p in poll_ids]).execute().data if poll_ids else []
        concept_scores = {}
        poll_concepts = {p['id']: p.get('concept_id') for p in poll_ids}
        for response in responses:
            concept_id = poll_concepts.get(response['question_id'])
            score = score_from_evaluation(response.get('evaluation'))
            if concept_id and score is not None:
                concept_scores.setdefault(concept_id, []).append(score)

        for node in nodes:
            node['importance'] = importance.get(node['label'], 0.5)
            scores = concept_scores.get(node['id'], [])
            average = sum(scores) / len(scores) if scores else None
            node['assessment_average'] = round(average, 1) if average is not None else None
            node['assessment_count'] = len(scores)
            node['confidence'] = (average / 100) if average is not None else 0.0
            node['color'] = score_to_color(average)

    result = {'nodes': nodes, 'edges': edges}
    # Cache with student mastery for 10s, without for 60s (structure changes rarely)
    cache_set(cache_key, result, ttl_seconds=10 if student_id else 60)
    return jsonify(result), 200


@graph.route('/api/courses/<course_id>/concepts/<concept_id>/students', methods=['GET'])
@optional_auth
def get_concept_students(course_id, concept_id):
    """Return teacher-only class distribution evidence for one concept."""
    concept = supabase.table('concept_nodes').select('id, label, description, category').eq(
        'id', concept_id
    ).eq('course_id', course_id).execute().data
    if not concept:
        return jsonify({'error': 'Concept not found'}), 404

    students = supabase.table('students').select('id, name, email').eq('course_id', course_id).execute().data
    mastery = supabase.table('student_mastery').select('student_id, confidence').eq(
        'concept_id', concept_id
    ).execute().data
    mastery_map = {row['student_id']: row.get('confidence') or 0.0 for row in mastery}

    def color(confidence):
        if confidence == 0.0:
            return 'gray'
        if confidence < 0.4:
            return 'red'
        if confidence < 0.7:
            return 'yellow'
        return 'green'

    return jsonify({
        'concept_id': concept_id,
        'concept': concept[0],
        'students': [
            {
                'id': student['id'],
                'name': student.get('name') or student.get('email') or 'Student',
                'confidence': mastery_map.get(student['id'], 0.0),
                'color': color(mastery_map.get(student['id'], 0.0)),
            }
            for student in students
        ],
    }), 200
