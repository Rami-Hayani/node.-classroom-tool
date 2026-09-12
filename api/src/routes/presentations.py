"""Presentation helpers: extract readable slide text from PowerPoint files."""

from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
import io
import re
import zipfile
import xml.etree.ElementTree as ET

presentations = Blueprint("presentations", __name__)


@presentations.route('/api/presentations/extract', methods=['POST'])
def extract_presentation():
    if 'file' not in request.files:
        return jsonify({'error': 'No PowerPoint file provided'}), 400
    file = request.files['file']
    filename = secure_filename(file.filename or '')
    if not filename.lower().endswith('.pptx'):
        return jsonify({'error': 'Please upload a .pptx PowerPoint file'}), 400

    try:
        with zipfile.ZipFile(io.BytesIO(file.read())) as archive:
            slide_names = [
                name for name in archive.namelist()
                if re.fullmatch(r'ppt/slides/slide\d+\.xml', name)
            ]
            slide_names.sort(key=lambda name: int(re.search(r'\d+', name).group()))
            slides = []
            ns = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
            for index, name in enumerate(slide_names):
                root = ET.fromstring(archive.read(name))
                texts = [node.text.strip() for node in root.findall('.//a:t', ns) if node.text and node.text.strip()]
                title = texts[0] if texts else f'Slide {index + 1}'
                slides.append({'index': index, 'title': title, 'text': ' '.join(texts)})
            if not slides:
                return jsonify({'error': 'No readable slides found in this PowerPoint'}), 422
            return jsonify({'filename': filename, 'slides': slides}), 200
    except (zipfile.BadZipFile, ET.ParseError, ValueError) as error:
        return jsonify({'error': f'Could not read PowerPoint: {error}'}), 422
