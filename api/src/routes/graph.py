from flask import request, jsonify, Blueprint
from ..db import supabase
from ..services.create_kg import calculate_importance
from ..middleware.auth import optional_auth
from ..cache import cache_get, cache_set

graph = Blueprint("graph", __name__)


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


@graph.route('/api/courses/<course_id>/graph', methods=['GET'])
@optional_auth
def get_graph(course_id):
    student_id = request.args.get('student_id')

    # Student graph responses can use the short-lived cache. Professor class
    # mastery must stay live as poll responses arrive, so it always recomputes.
    cache_key = f"graph:{course_id}:{student_id or 'none'}"
    if student_id:
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
    for syllabus_order, node in enumerate(nodes):
        node['importance'] = importance.get(node['label'], 0.5)
        node['syllabus_order'] = syllabus_order

    # Add mastery if student_id provided
    if student_id:
        course_concept_ids = [node['id'] for node in nodes]
        questions = supabase.table('poll_questions').select('id, concept_id').in_('concept_id', course_concept_ids).execute().data if course_concept_ids else []
        question_concepts = {question['id']: question['concept_id'] for question in questions}
        responses = supabase.table('poll_responses').select('question_id, evaluation').eq(
            'student_id', student_id
        ).in_('question_id', list(question_concepts)).execute().data if question_concepts else []
        scores_by_concept = {}
        for response in responses:
            concept_id = question_concepts.get(response['question_id'])
            if concept_id:
                scores_by_concept.setdefault(concept_id, []).append(_response_score(response.get('evaluation')))
        mastery_map = {concept_id: sum(scores) / len(scores) / 100.0 for concept_id, scores in scores_by_concept.items()}

        for node in nodes:
            node['importance'] = importance.get(node['label'], 0.5)
            conf = mastery_map.get(node['id'], 0.0)
            node['confidence'] = conf
            node['color'] = confidence_to_color(conf)
    else:
        # Professor node map: calculate one class-average confidence per node
        # from teacher-created poll responses. This keeps the node map
        # independent from student_mastery and from the heatmap endpoint.
        course_concept_ids = [node['id'] for node in nodes]
        questions = supabase.table('poll_questions').select('id, concept_id').in_(
            'concept_id', course_concept_ids
        ).execute().data if course_concept_ids else []
        question_concepts = {question['id']: question['concept_id'] for question in questions}
        responses = supabase.table('poll_responses').select(
            'question_id, evaluation'
        ).in_('question_id', list(question_concepts)).execute().data if question_concepts else []
        scores_by_concept = {}
        for response in responses:
            concept_id = question_concepts.get(response['question_id'])
            if concept_id:
                scores_by_concept.setdefault(concept_id, []).append(
                    _response_score(response.get('evaluation'))
                )

        for node in nodes:
            scores = scores_by_concept.get(node['id'], [])
            avg_confidence = sum(scores) / len(scores) / 100.0 if scores else 0.0
            node['avgConfidence'] = avg_confidence
            node['confidence'] = avg_confidence
            node['color'] = confidence_to_color(avg_confidence)

    result = {'nodes': nodes, 'edges': edges}
    # Cache with student mastery for 10s, without for 60s (structure changes rarely)
    if student_id:
        cache_set(cache_key, result, ttl_seconds=10)
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
        if confidence < 0.25:
            return 'red'
        if confidence < 0.5:
            return 'orange'
        if confidence < 0.75:
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
