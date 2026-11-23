import io
import re
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas
from app.core.config import settings

class NumberedCanvas(canvas.Canvas):
    """Canvas that enables two-pass page numbering ('Page X of Y') and headers/footers."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Don't draw header on cover page (page 1)
        if self._pageNumber > 1:
            self.drawString(54, 842 - 36, f"WriteUp Pro Academic Submission • {settings.INSTITUTION_NAME}")
            self.setStrokeColor(colors.HexColor("#cbd5e1"))
            self.setLineWidth(0.5)
            self.line(54, 842 - 42, 595 - 54, 842 - 42)
        
        # Footer on all pages
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(595 - 54, 32, page_str)
        self.drawString(54, 32, "Verified via WriteUp Pro Integrity Engine • Digital Academic Repository")
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.5)
        self.line(54, 42, 595 - 54, 42)
        self.restoreState()

def generate_academic_pdf(
    doc_data: dict,
    student_profile: dict,
    submission_data: dict,
    evaluation_data: dict = None
) -> bytes:
    """Generates an enterprise-grade academic PDF with institutional cover page, rubrics, and content."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom Styles
    style_inst = ParagraphStyle(
        'InstTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a")
    )
    style_subinst = ParagraphStyle(
        'InstSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=13,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#475569")
    )
    style_heading = ParagraphStyle(
        'DocHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=16,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=14,
        spaceAfter=6
    )
    style_body = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=15,
        alignment=TA_JUSTIFY,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=8
    )
    style_table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#1e293b")
    )
    style_table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0f172a")
    )
    style_code = ParagraphStyle(
        'CodeStyle',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#f8fafc")
    )

    story = []

    # 1. INSTITUTION HEADER
    story.append(Spacer(1, 10))
    story.append(Paragraph(settings.INSTITUTION_NAME.upper(), style_inst))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"DEPARTMENT OF {student_profile.get('branch_code', 'ENGINEERING')} • ACADEMIC YEAR {settings.ACADEMIC_YEAR}", style_subinst))
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#6366f1"), spaceAfter=14))

    # 2. DOCUMENT METADATA TABLE
    doc_type = doc_data.get('doc_type', 'Assignment')
    is_assignment = (doc_type == 'Assignment')
    
    meta_rows = [
        [
            Paragraph(f"<b>Class:</b> {student_profile.get('year_level', 'SE')} - {student_profile.get('division_name', 'Div A')}", style_table_cell),
            Paragraph(f"<b>Subject Code:</b> {doc_data.get('subject_code', '-')}", style_table_cell)
        ],
        [
            Paragraph(f"<b>Subject:</b> {doc_data.get('subject_name', '-')}", style_table_cell),
            Paragraph(f"<b>{doc_type} No:</b> {doc_data.get('doc_number', '-')}", style_table_cell)
        ],
        [
            Paragraph(f"<b>Student Name:</b> {student_profile.get('name', 'Student')}", style_table_cell),
            Paragraph(f"<b>Roll No:</b> {student_profile.get('roll_number', '-')}", style_table_cell)
        ],
        [
            Paragraph(f"<b>Submission Date:</b> {submission_data.get('submission_date', 'Pending')}", style_table_cell),
            Paragraph(f"<b>Submission Code:</b> {submission_data.get('submission_code', 'N/A')}", style_table_cell)
        ]
    ]
    t_meta = Table(meta_rows, colWidths=[240, 240])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 14))

    # 3. RUBRIC EVALUATION MATRIX
    story.append(Paragraph(f"<b>Evaluation Rubric Matrix ({doc_type})</b>", style_heading))
    
    rubric_scores = evaluation_data.get('rubric_scores', {}) if evaluation_data else {}
    marks_awarded = evaluation_data.get('marks_awarded') if evaluation_data else None

    if is_assignment:
        r_rows = [
            [Paragraph("Criteria", style_table_header), Paragraph("Below Exp.", style_table_header), Paragraph("Average", style_table_header), Paragraph("Good", style_table_header), Paragraph("Score", style_table_header)],
            [Paragraph("Knowledge & Understanding (4)", style_table_cell), Paragraph("2", style_table_cell), Paragraph("3", style_table_cell), Paragraph("4", style_table_cell), Paragraph(str(rubric_scores.get('knowledge', '-')), style_table_header)],
            [Paragraph("Content & Neatness (3)", style_table_cell), Paragraph("1", style_table_cell), Paragraph("2", style_table_cell), Paragraph("3", style_table_cell), Paragraph(str(rubric_scores.get('content', '-')), style_table_header)],
            [Paragraph("Punctuality (3)", style_table_cell), Paragraph("1", style_table_cell), Paragraph("2", style_table_cell), Paragraph("3", style_table_cell), Paragraph(str(rubric_scores.get('punctuality', '-')), style_table_header)],
            [Paragraph("<b>TOTAL SCORE (10)</b>", style_table_header), Paragraph("", style_table_cell), Paragraph("", style_table_cell), Paragraph("", style_table_cell), Paragraph(f"<b>{marks_awarded if marks_awarded is not None else '-'}</b>", style_table_header)]
        ]
    else:
        r_rows = [
            [Paragraph("Criteria", style_table_header), Paragraph("Below Exp.", style_table_header), Paragraph("Average", style_table_header), Paragraph("Good", style_table_header), Paragraph("Score", style_table_header)],
            [Paragraph("Knowledge & Theory (4)", style_table_cell), Paragraph("2", style_table_cell), Paragraph("3", style_table_cell), Paragraph("4", style_table_cell), Paragraph(str(rubric_scores.get('knowledge', '-')), style_table_header)],
            [Paragraph("Performance & Implementation (5)", style_table_cell), Paragraph("2", style_table_cell), Paragraph("3", style_table_cell), Paragraph("5", style_table_cell), Paragraph(str(rubric_scores.get('performance', '-')), style_table_header)],
            [Paragraph("Content & Observations (3)", style_table_cell), Paragraph("1", style_table_cell), Paragraph("2", style_table_cell), Paragraph("3", style_table_cell), Paragraph(str(rubric_scores.get('content', '-')), style_table_header)],
            [Paragraph("Punctuality & Timeliness (3)", style_table_cell), Paragraph("1", style_table_cell), Paragraph("2", style_table_cell), Paragraph("3", style_table_cell), Paragraph(str(rubric_scores.get('punctuality', '-')), style_table_header)],
            [Paragraph("<b>TOTAL SCORE (15)</b>", style_table_header), Paragraph("", style_table_cell), Paragraph("", style_table_cell), Paragraph("", style_table_cell), Paragraph(f"<b>{marks_awarded if marks_awarded is not None else '-'}</b>", style_table_header)]
        ]

    t_rubric = Table(r_rows, colWidths=[180, 75, 75, 75, 75])
    t_rubric.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#cbd5e1")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('ALIGN', (1,0), (-1,-1), 'CENTER'),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(t_rubric)
    story.append(Spacer(1, 14))

    # 4. FACULTY DIGITAL APPROVAL STAMP
    if evaluation_data and evaluation_data.get('digital_signature_code'):
        sign_info = [
            [
                Paragraph("<b>FACULTY DIGITAL APPROVAL RECORD</b>", style_table_header),
                Paragraph("<b>STATUS: VERIFIED & EVALUATED</b>", style_table_header)
            ],
            [
                Paragraph(f"Evaluator: {evaluation_data.get('faculty_name', 'Faculty')}<br/>Timestamp: {evaluation_data.get('evaluated_at', '-')}<br/>Remarks: {evaluation_data.get('remarks', 'Approved')}", style_table_cell),
                Paragraph(f"Digital Stamp Verification Hash:<br/><b>{evaluation_data.get('digital_signature_code')}</b><br/>Integrity Audited via WriteUp Pro Core", style_table_cell)
            ]
        ]
        t_sign = Table(sign_info, colWidths=[240, 240])
        t_sign.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#86efac")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#bbf7d0")),
            ('PADDING', (0,0), (-1,-1), 7),
        ]))
        story.append(t_sign)
    else:
        pending_box = [
            [Paragraph("Faculty Signature: _______________________", style_table_cell), Paragraph("Date: _______________________", style_table_cell)]
        ]
        t_pending = Table(pending_box, colWidths=[240, 240])
        t_pending.setStyle(TableStyle([
            ('PADDING', (0,0), (-1,-1), 10),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1"))
        ]))
        story.append(t_pending)

    # 5. PAGE BREAK TO DOCUMENT CONTENT
    story.append(PageBreak())

    # 6. DOCUMENT TITLE & BODY CONTENT
    story.append(Paragraph(doc_data.get('title', 'Document Content'), style_heading))
    story.append(Spacer(1, 6))

    # Parse basic HTML tags into reportlab paragraphs
    raw_content = doc_data.get('content_html', '')
    
    # Extract code blocks first
    code_blocks = re.findall(r'<pre[^>]*><code[^>]*>(.*?)</code></pre>', raw_content, flags=re.DOTALL)
    cleaned_content = re.sub(r'<pre[^>]*><code[^>]*>.*?</code></pre>', '{{CODE_BLOCK_PLACEHOLDER}}', raw_content, flags=re.DOTALL)
    
    # Split by headings and paragraphs
    chunks = re.split(r'(</?(?:h[1-6]|p|table|div)[^>]*>)', cleaned_content)
    current_text = ""
    code_index = 0

    for chunk in chunks:
        if not chunk:
            continue
        if chunk.startswith('<h') or chunk.startswith('<H'):
            clean_h = re.sub(r'<[^>]+>', '', chunk).strip()
            if clean_h:
                story.append(Paragraph(clean_h, style_heading))
        elif '{{CODE_BLOCK_PLACEHOLDER}}' in chunk:
            if code_index < len(code_blocks):
                code_text = code_blocks[code_index].replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
                code_table = Table([[Paragraph(code_text.replace('\n', '<br/>'), style_code)]], colWidths=[480])
                code_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0f172a")),
                    ('PADDING', (0,0), (-1,-1), 8),
                    ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#334155")),
                ]))
                story.append(code_table)
                story.append(Spacer(1, 8))
                code_index += 1
        else:
            clean_p = re.sub(r'<[^>]+>', '', chunk).strip()
            # Replace basic HTML entities
            clean_p = clean_p.replace('&nbsp;', ' ').replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&')
            if clean_p and len(clean_p) > 2:
                story.append(Paragraph(clean_p, style_body))

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
