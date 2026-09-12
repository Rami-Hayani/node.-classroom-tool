from flask import request, jsonify, Blueprint
from werkzeug.utils import secure_filename
from pptx import Presentation
from PyPDF2 import PdfReader, PdfWriter
from io import BytesIO
import json
import os
import tempfile
import requests
import uuid
from flask import Response

from ..db import supabase
from ..middleware.auth import optional_auth

decks = Blueprint("decks", __name__)


def _extract_slides(file_path):
    presentation = Presentation(file_path)
    extracted = []
    for slide_number, slide in enumerate(presentation.slides, start=1):
        shapes = [shape for shape in slide.shapes if getattr(shape, "has_text_frame", False) and shape.text.strip()]
        shapes.sort(key=lambda shape: (getattr(shape, "top", 0), getattr(shape, "left", 0)))
        blocks = [shape.text.strip() for shape in shapes]
        title = ""
        for shape in shapes:
            if getattr(shape, "is_placeholder", False):
                try:
                    if shape.placeholder_format.type in (1, 3):
                        title = shape.text.strip()
                        break
                except Exception:
                    pass
        if not title and blocks:
            title = blocks[0]
        title = title or f"Slide {slide_number}"
        content_blocks = [block for block in blocks if block != title]
        extracted.append({
            "slide_number": slide_number,
            "title": title,
            "content": "\n".join(content_blocks or blocks),
        })
    return extracted


def _extract_pdf_slides(file_path):
    reader = PdfReader(file_path)
    extracted = []
    for slide_number, page in enumerate(reader.pages, start=1):
        raw_text = (page.extract_text() or "").strip()
        blocks = [line.strip() for line in raw_text.splitlines() if line.strip()]
        title = blocks[0] if blocks else f"Slide {slide_number}"
        extracted.append({
            "slide_number": slide_number,
            "title": title,
            "content": "\n".join(blocks[1:] or blocks),
        })
    return extracted


def _response_text(data):
    output = data.get("output_text")
    if output:
        return output.strip()
    parts = []
    for item in data.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                parts.append(content["text"])
    return "\n".join(parts).strip()


def _map_slides_to_concepts(slides, concepts):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or not concepts or not slides:
        return {}, "OpenAI mapping was not configured; slides were saved without concept mappings."
    prompt = """You are mapping lecture slides to an existing course knowledge graph.
You MUST only return concept IDs from the provided list. Do not invent concepts.
Return zero to three concept IDs per slide, representing concepts directly taught or required.
Return strict JSON only as an array of objects with slide_number and concept_ids.

COURSE CONCEPTS:
""" + json.dumps(concepts, ensure_ascii=False) + "\n\nLECTURE SLIDES:\n" + json.dumps(slides, ensure_ascii=False)
    try:
        response = requests.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"), "input": prompt},
            timeout=90,
        )
        response.raise_for_status()
        text = _response_text(response.json())
        if text.startswith("```"):
            text = text.split("```", 2)[1]
            if text.lstrip().startswith("json"):
                text = text.lstrip()[4:]
        parsed = json.loads(text.strip())
        valid_ids = {concept["id"] for concept in concepts}
        mapping = {}
        for item in parsed if isinstance(parsed, list) else []:
            number = item.get("slide_number")
            if isinstance(number, int):
                mapping[number] = [cid for cid in item.get("concept_ids", []) if cid in valid_ids][:3]
        return mapping, None
    except Exception as error:
        print(f"[decks] Slide mapping failed: {error}")
        return {}, "Slides were parsed, but AI concept mapping was unavailable."


@decks.route('/api/courses/<course_id>/decks', methods=['POST'])
@optional_auth
def upload_deck(course_id):
    if "file" not in request.files:
        return jsonify({"error": "A PowerPoint file is required in the 'file' field."}), 400
    uploaded = request.files["file"]
    filename = secure_filename(uploaded.filename or "")
    if not filename:
        return jsonify({"error": "No file selected."}), 400
    extension = os.path.splitext(filename)[1].lower()
    if extension not in (".pptx", ".pdf"):
        return jsonify({"error": "Only .pptx or .pdf lecture slide files are supported."}), 400

    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pptx") as temporary:
            uploaded.save(temporary.name)
            temporary_path = temporary.name
        slides = _extract_slides(temporary_path) if extension == ".pptx" else _extract_pdf_slides(temporary_path)
        concepts = supabase.table("concept_nodes").select("id, label, description").eq("course_id", course_id).execute().data
        mapping, warning = _map_slides_to_concepts(slides, concepts)
        storage_path = f"{course_id}/{uuid.uuid4()}{extension}"
        storage_warning = None
        with open(temporary_path, "rb") as source:
            original_bytes = source.read()
        try:
            supabase.storage.from_("lecture-decks").upload(storage_path, original_bytes, {
                "content-type": "application/pdf" if extension == ".pdf" else "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "upsert": "true",
            })
        except Exception as storage_error:
            print(f"[decks] Original file storage failed: {storage_error}")
            storage_warning = "Slides were parsed, but the original file could not be stored for page viewing."
        deck = supabase.table("lecture_decks").insert({
            "course_id": course_id,
            "filename": filename,
            "storage_path": storage_path,
            "file_type": extension.lstrip("."),
        }).execute().data[0]
        slide_rows = [{**slide, "deck_id": deck["id"], "concept_ids": mapping.get(slide["slide_number"], [])} for slide in slides]
        inserted_slides = supabase.table("lecture_slides").insert(slide_rows).execute().data if slide_rows else []
        warnings = [message for message in (warning, storage_warning) if message]
        deck["file_url"] = f"/api/decks/{deck['id']}/file" if not storage_warning else None
        return jsonify({"deck": deck, "slides": inserted_slides, "warning": " ".join(warnings) or None}), 201
    except Exception as error:
        print(f"[decks] Upload failed: {error}")
        return jsonify({"error": f"Could not process PowerPoint: {str(error)}"}), 500
    finally:
        if temporary_path and os.path.exists(temporary_path):
            os.remove(temporary_path)


@decks.route('/api/courses/<course_id>/decks', methods=['GET'])
@optional_auth
def list_decks(course_id):
    result = supabase.table("lecture_decks").select("id, course_id, filename, created_at, file_type, storage_path").eq(
        "course_id", course_id
    ).order("created_at", desc=True).execute()
    for deck in result.data:
        deck["file_url"] = f"/api/decks/{deck['id']}/file" if deck.get("storage_path") else None
    return jsonify({"decks": result.data}), 200


@decks.route('/api/decks/<deck_id>/file', methods=['GET'])
@optional_auth
def get_deck_file(deck_id):
    rows = supabase.table("lecture_decks").select("storage_path, file_type").eq("id", deck_id).execute().data
    if not rows or not rows[0].get("storage_path"):
        return jsonify({"error": "Original lecture file is not available."}), 404
    try:
        content = supabase.storage.from_("lecture-decks").download(rows[0]["storage_path"])
        mimetype = "application/pdf" if rows[0].get("file_type") == "pdf" else "application/octet-stream"
        page_value = request.args.get("page")
        if mimetype == "application/pdf" and page_value:
            try:
                page_number = int(page_value)
                reader = PdfReader(BytesIO(content))
                if page_number < 1 or page_number > len(reader.pages):
                    return jsonify({"error": "Requested slide is out of range."}), 400
                writer = PdfWriter()
                writer.add_page(reader.pages[page_number - 1])
                single_page = BytesIO()
                writer.write(single_page)
                content = single_page.getvalue()
            except (TypeError, ValueError, IndexError) as error:
                return jsonify({"error": f"Could not render requested slide: {error}"}), 400
        return Response(content, mimetype=mimetype, headers={"Content-Disposition": "inline"})
    except Exception as error:
        return jsonify({"error": f"Could not load lecture file: {str(error)}"}), 404


@decks.route('/api/decks/<deck_id>/slides', methods=['GET'])
@optional_auth
def get_deck_slides(deck_id):
    result = supabase.table("lecture_slides").select(
        "id, deck_id, slide_number, title, content, concept_ids"
    ).eq("deck_id", deck_id).order("slide_number").execute()
    return jsonify({"deck_id": deck_id, "slides": result.data}), 200
