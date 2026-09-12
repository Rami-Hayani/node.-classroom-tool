from flask import request, jsonify, Blueprint
from ..db import supabase
from ..services.create_kg import calculate_importance
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set

graph = Blueprint("graph", __name__)


def confidence_to_color(confidence):
    if confidence == 0.0:
        return "gray"
    elif confidence < 0.4:
        return "red"
    elif confidence < 0.7:
        return "yellow"
    else:
        return "green"


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
        mastery = supabase.table('student_mastery').select('concept_id, confidence').eq('student_id',
                                                                                        student_id).execute().data
        mastery_map = {m['concept_id']: m['confidence'] for m in mastery}

        for node in nodes:
            node['importance'] = importance.get(node['label'], 0.5)
            conf = mastery_map.get(node['id'], 0.0)
            node['confidence'] = conf
            node['color'] = confidence_to_color(conf)

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
