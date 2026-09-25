"""
apps/reports/services.py — Native PDF, DOCX, and CSV generator for HVRA Assessment Reports.
Complies with Section 4.7 & 4.8 of the HVRA Concept Note.
"""
import io
import csv
from datetime import datetime
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


def set_cell_background(cell, fill_hex):
    """Set background color for a Word table cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex.replace("#", "")}"/>')
    tcPr.append(shd)


def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set padding for a Word table cell in twentieths of a point (dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)


def generate_assessment_docx(assessment, report_data: dict) -> io.BytesIO:
    """
    Generate professional 10-chapter Word (.docx) assessment report.
    """
    doc = Document()

    # Page setup - 0.75 in margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    meta = report_data.get("metadata", {})
    summary = report_data.get("classification_summary", {})
    findings = report_data.get("findings", {})
    methodology = report_data.get("methodology", [])
    block_results = report_data.get("block_results", [])
    recommendations = report_data.get("recommendations", [])

    # Document Header / Banner
    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_org = p_header.add_run("HAZARD, VULNERABILITY & RISK ASSESSMENT TOOL (HVRA)\nSTATE DISASTER MANAGEMENT FRAMEWORK")
    r_org.font.size = Pt(8.5)
    r_org.font.color.rgb = RGBColor(100, 116, 139)
    r_org.bold = True

    # Main Title
    p_title = doc.add_paragraph()
    r_title = p_title.add_run(meta.get("name", "Hazard Assessment Report"))
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    # Subtitle
    p_sub = doc.add_paragraph()
    r_sub = p_sub.add_run(f"Comprehensive Administrative Block-Level {meta.get('module_label', 'Hazard Assessment')} Evaluation")
    r_sub.font.size = Pt(13)
    r_sub.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph() # spacer

    # Metadata Card Table
    t_meta = doc.add_table(rows=4, cols=2)
    t_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_rows = [
        ("Administrative Scope:", f"{meta.get('state', 'Kerala')} → {meta.get('district', 'District')} ({meta.get('level', 'BLOCK')} Level)"),
        ("Hazard Assessed:", f"{meta.get('hazard_type', 'FLOOD')}"),
        ("Date Generated:", datetime.now().strftime("%B %d, %Y, %H:%M:%S")),
        ("Validation Status:", f"{meta.get('status', 'COMPLETED')} (Deterministic Spatial Engine)"),
    ]
    for idx, (label, val) in enumerate(meta_rows):
        r = t_meta.rows[idx]
        c0 = r.cells[0]
        c1 = r.cells[1]
        c0.width = Inches(2.2)
        c1.width = Inches(4.5)
        set_cell_background(c0, "F8FAFC")
        set_cell_background(c1, "FFFFFF")
        p0 = c0.paragraphs[0].add_run(label)
        p0.font.bold = True
        p0.font.size = Pt(9.5)
        p0.font.color.rgb = RGBColor(71, 85, 105)
        p1 = c1.paragraphs[0].add_run(val)
        p1.font.size = Pt(9.5)
        p1.font.color.rgb = RGBColor(15, 23, 42)

    doc.add_paragraph()

    # Helper for chapter headings
    def add_chapter(num: int, title: str):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(f"{num}. {title}")
        r.font.size = Pt(13)
        r.font.bold = True
        r.font.color.rgb = RGBColor(30, 41, 59)
        return p

    # Chapter 1
    add_chapter(1, "Executive Summary & Objectives")
    p1 = doc.add_paragraph(
        f"This document presents the detailed spatial {meta.get('module_label', 'hazard assessment').lower()} for {meta.get('district')} district, "
        f"{meta.get('state')}. Utilizing multi-criteria geospatial overlays and historical records, the study calculates "
        f"an empirical score on a 0–10 scale across all constituent administrative blocks. "
        f"The primary objective is to equip district disaster management authorities with actionable evidence for mitigation."
    )
    p1.style.font.size = Pt(10)

    # Chapter 2
    add_chapter(2, "Administrative Profile & Assessment Extent")
    p2 = doc.add_paragraph(
        f"The study area encompasses {len(block_results)} administrative blocks in {meta.get('district')} district. "
        f"Each unit was evaluated on its boundary geometries, total area, and localized susceptibility."
    )
    p2.style.font.size = Pt(10)

    # Chapter 3
    add_chapter(3, "Methodology & Weightage Configuration")
    p3 = doc.add_paragraph(
        "The scoring engine applies min-max normalization and weighted summation across the following selected indicators:"
    )
    p3.style.font.size = Pt(10)
    for m in methodology:
        p_m = doc.add_paragraph(style='List Bullet')
        r_m = p_m.add_run(f"{m.get('indicator')}: Weight = {m.get('weight')} (0–10 Scale)")
        r_m.font.size = Pt(9.5)

    # Chapter 4
    add_chapter(4, "Classification Summary")
    cl_labels = report_data.get("class_labels", {
        "HH": "High", "MH": "Medium", "LH": "Low", "NH": "None",
    })
    t_sum = doc.add_table(rows=2, cols=4)
    t_sum.alignment = WD_TABLE_ALIGNMENT.CENTER
    classes = [
        ("HH", summary.get("HH", 0), "EF4444", "FEF2F2"),
        ("MH", summary.get("MH", 0), "F97316", "FFF7ED"),
        ("LH", summary.get("LH", 0), "EAB308", "FEFCE8"),
        ("NH", summary.get("NH", 0), "22C55E", "F0FDF4"),
    ]
    for c_idx, (c_code, count, fg_color, bg_color) in enumerate(classes):
        cell_top = t_sum.cell(0, c_idx)
        cell_bot = t_sum.cell(1, c_idx)
        set_cell_background(cell_top, bg_color)
        set_cell_background(cell_bot, bg_color)
        
        p_top = cell_top.paragraphs[0]
        p_top.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_top = p_top.add_run(str(count))
        r_top.font.size = Pt(18)
        r_top.font.bold = True
        r_top.font.color.rgb = RGBColor.from_string(fg_color)
        
        p_bot = cell_bot.paragraphs[0]
        p_bot.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_bot = p_bot.add_run(cl_labels.get(c_code, c_code))
        r_bot.font.size = Pt(8.5)
        r_bot.font.bold = True
        r_bot.font.color.rgb = RGBColor(71, 85, 105)

    doc.add_paragraph()

    # Chapter 5 — Climate Context (HVRA §4.9)
    add_chapter(5, "Climate Context & Regional Drivers")
    climate_entries = report_data.get("climate_context", [])
    if not climate_entries:
        p_cc = doc.add_paragraph("No curated climate context entries available for this extent (prototype).")
        p_cc.style.font.size = Pt(9.5)
    for entry in climate_entries:
        p_cc_title = doc.add_paragraph()
        r_cc_title = p_cc_title.add_run(entry.get("title", "Climate Context"))
        r_cc_title.font.bold = True
        r_cc_title.font.size = Pt(10)
        p_cc_text = doc.add_paragraph(entry.get("statement", ""))
        p_cc_text.style.font.size = Pt(9.5)
        src = entry.get("source", "")
        if src:
            vintage_note = f" ({entry.get('vintage')})" if entry.get('vintage') else ""
            p_cc_src = doc.add_paragraph(f"Source: {src}{vintage_note}")
            p_cc_src.style.font.size = Pt(8.5)
            p_cc_src.style.font.italic = True

    # Chapter 6
    add_chapter(6, "Block-Level Assessment Results")
    is_hazard = meta.get("module_type", "HAZARD") == "HAZARD"

    def _hazard_area_pct(b):
        meta_v = b.get("metadata") or {}
        return meta_v.get("flood_prone_percentage", meta_v.get("hazard_prone_percentage", 0.0))

    p5 = doc.add_paragraph("Table of comprehensive block results sorted by composite score:")
    p5.style.font.size = Pt(9.5)

    if is_hazard:
        headers = ["Block Unit", "Hazard Area %", "Historical Events", "Score (0-10)", "Class"]
        n_cols = 5
    else:
        headers = ["Block Unit", "Score (0-10)", "Class"]
        n_cols = 3

    t_res = doc.add_table(rows=1 + len(block_results), cols=n_cols)
    t_res.alignment = WD_TABLE_ALIGNMENT.CENTER
    for h_idx, h_text in enumerate(headers):
        cell = t_res.cell(0, h_idx)
        set_cell_background(cell, "1E293B")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if h_idx >= 1 else WD_ALIGN_PARAGRAPH.LEFT
        r = p.add_run(h_text)
        r.font.bold = True
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    for row_idx, b in enumerate(block_results, start=1):
        bg = "FFFFFF" if row_idx % 1 == 1 else "F8FAFC"

        if is_hazard:
            c_name = t_res.cell(row_idx, 0)
            c_fp = t_res.cell(row_idx, 1)
            c_ev = t_res.cell(row_idx, 2)
            c_sc = t_res.cell(row_idx, 3)
            c_cl = t_res.cell(row_idx, 4)

            for c in [c_name, c_fp, c_ev, c_sc, c_cl]:
                set_cell_background(c, bg)

            c_name.paragraphs[0].add_run(b.get("unit_name", "")).font.size = Pt(8.5)

            p_fp = c_fp.paragraphs[0]
            p_fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_fp.add_run(f"{_hazard_area_pct(b):.1f}%").font.size = Pt(8.5)

            p_ev = c_ev.paragraphs[0]
            p_ev.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p_ev.add_run(str(b.get('event_count', 0))).font.size = Pt(8.5)

            c_sc_score = c_sc
            c_cl_cls = c_cl
        else:
            c_name = t_res.cell(row_idx, 0)
            c_sc = t_res.cell(row_idx, 1)
            c_cl = t_res.cell(row_idx, 2)
            for c in [c_name, c_sc, c_cl]:
                set_cell_background(c, bg)
            c_name.paragraphs[0].add_run(b.get("unit_name", "")).font.size = Pt(8.5)
            c_sc_score = c_sc
            c_cl_cls = c_cl

        p_sc = c_sc_score.paragraphs[0]
        p_sc.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_sc = p_sc.add_run(f"{b.get('composite_score', 0.0):.2f}")
        r_sc.font.bold = True
        r_sc.font.size = Pt(8.5)

        cls_code = b.get("classification", "NH")
        p_cl = c_cl_cls.paragraphs[0]
        p_cl.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_cl = p_cl.add_run(cls_code)
        r_cl.font.bold = True
        r_cl.font.size = Pt(8.5)
        if cls_code == "HH":
            r_cl.font.color.rgb = RGBColor(239, 68, 68)
        elif cls_code == "MH":
            r_cl.font.color.rgb = RGBColor(249, 115, 22)
        elif cls_code == "LH":
            r_cl.font.color.rgb = RGBColor(234, 179, 8)
        else:
            r_cl.font.color.rgb = RGBColor(34, 197, 94)

    doc.add_paragraph()

    # Chapter 7
    add_chapter(7, "Priority Findings & Critical Areas")
    hh_blocks = findings.get("hh_blocks", [])
    max_b = findings.get("max_score_block", "N/A")
    max_s = findings.get("max_score", 0.0)
    priority_label = cl_labels.get("HH", "Highest Priority")
    p6_1 = doc.add_paragraph(style='List Bullet')
    p6_1.add_run(f"{priority_label} Units: ").bold = True
    p6_1.add_run(f"{len(hh_blocks)} block(s) identified in the highest band ({', '.join(hh_blocks) if hh_blocks else 'None'}).")
    
    p6_2 = doc.add_paragraph(style='List Bullet')
    p6_2.add_run(f"Peak Exposure: ").bold = True
    p6_2.add_run(f"Maximum calculated score is {max_s:.2f}, recorded in {max_b}.")

    # Chapter 8
    add_chapter(8, "Recommended Mitigation & Preparedness Interventions")
    for rec in recommendations:
        p_rec = doc.add_paragraph(style='List Bullet')
        p_rec.add_run(rec).font.size = Pt(9.5)

    # Chapter 9
    add_chapter(9, "Annexures & Data Provenance Notice")
    p_ann = doc.add_paragraph(
        "Disclaimer: This report was compiled by the Automated HVRA Platform. All data, scores, and classifications "
        "are computed for decision support and risk awareness. Official actions should cross-reference on-site ground truth."
    )
    p_ann.style.font.size = Pt(8.5)
    p_ann.style.font.italic = True

    bio = io.BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def generate_assessment_pdf(assessment, report_data: dict) -> io.BytesIO:
    """
    Generate publication-grade PDF assessment report using ReportLab.
    """
    bio = io.BytesIO()
    doc = SimpleDocTemplate(
        bio,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        spaceAfter=12,
    )
    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#1E293B'),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6,
    )
    table_cell_style = ParagraphStyle(
        'Cell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#1E293B'),
    )
    table_header_style = ParagraphStyle(
        'HCell',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )

    meta = report_data.get("metadata", {})
    summary = report_data.get("classification_summary", {})
    findings = report_data.get("findings", {})
    methodology = report_data.get("methodology", [])
    block_results = report_data.get("block_results", [])
    recommendations = report_data.get("recommendations", [])

    elements = []

    # Header banner
    elements.append(Paragraph("<b>HAZARD, VULNERABILITY & RISK ASSESSMENT TOOL (HVRA)</b>", subtitle_style))
    elements.append(Paragraph(meta.get("name", "Assessment Report"), title_style))
    elements.append(Paragraph(
        f"Administrative Scope: <b>{meta.get('state', 'Kerala')} → {meta.get('district', 'District')}</b> | "
        f"Module: <b>{meta.get('module_label', meta.get('hazard_type', 'Hazard'))}</b> | Date: {datetime.now().strftime('%d %b %Y')}",
        subtitle_style
    ))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceAfter=10))

    # Executive Summary
    elements.append(Paragraph("1. Executive Summary & Administrative Scope", h2_style))
    elements.append(Paragraph(
        f"This report outlines the spatial {meta.get('module_label', 'hazard assessment').lower()} for {meta.get('district')} district across {len(block_results)} administrative blocks. "
        f"Deterministic geospatial indicators were computed and classified into 4 tiers.",
        body_style
    ))

    # Summary Cards Table
    cl_labels = report_data.get("class_labels", {
        "HH": "High", "MH": "Medium", "LH": "Low", "NH": "None",
    })
    summary_data = [
        [
            Paragraph(f"<b>{cl_labels.get('HH', 'High')}</b>", table_cell_style),
            Paragraph(f"<b>{cl_labels.get('MH', 'Medium')}</b>", table_cell_style),
            Paragraph(f"<b>{cl_labels.get('LH', 'Low')}</b>", table_cell_style),
            Paragraph(f"<b>{cl_labels.get('NH', 'None')}</b>", table_cell_style),
        ],
        [
            Paragraph(f"<font size='14' color='#EF4444'><b>{summary.get('HH', 0)}</b></font>", table_cell_style),
            Paragraph(f"<font size='14' color='#F97316'><b>{summary.get('MH', 0)}</b></font>", table_cell_style),
            Paragraph(f"<font size='14' color='#EAB308'><b>{summary.get('LH', 0)}</b></font>", table_cell_style),
            Paragraph(f"<font size='14' color='#22C55E'><b>{summary.get('NH', 0)}</b></font>", table_cell_style),
        ]
    ]
    t_summary = Table(summary_data, colWidths=[130, 130, 130, 130])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,1), colors.HexColor('#FEF2F2')),
        ('BACKGROUND', (1,0), (1,1), colors.HexColor('#FFF7ED')),
        ('BACKGROUND', (2,0), (2,1), colors.HexColor('#FEFCE8')),
        ('BACKGROUND', (3,0), (3,1), colors.HexColor('#F0FDF4')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t_summary)
    elements.append(Spacer(1, 8))

    # Climate Context (HVRA §4.9)
    climate_entries = report_data.get("climate_context", [])
    if climate_entries:
        elements.append(Paragraph("2. Climate Context & Regional Drivers", h2_style))
        for entry in climate_entries:
            elements.append(Paragraph(
                f"<b>{entry.get('title', 'Climate Context')}:</b> {entry.get('statement', '')}",
                body_style,
            ))
            src = entry.get("source", "")
            if src:
                vintage = f" ({entry.get('vintage')})" if entry.get("vintage") else ""
                elements.append(Paragraph(f"<i>Source: {src}{vintage}</i>", body_style))
        elements.append(Spacer(1, 6))

    # Methodology & Weights
    elements.append(Paragraph("3. Indicators & Weightage Methodology", h2_style))
    m_lines = ", ".join([f"<b>{m.get('indicator')}</b> (w={m.get('weight')})" for m in methodology])
    elements.append(Paragraph(f"Active Indicator Weights: {m_lines}", body_style))

    # Block Results Table
    elements.append(Paragraph("4. Block-Level Assessment Results", h2_style))
    is_hazard = meta.get("module_type", "HAZARD") == "HAZARD"

    def _hazard_area_pct(b):
        meta_v = b.get("metadata") or {}
        return meta_v.get("flood_prone_percentage", meta_v.get("hazard_prone_percentage", 0.0))
    if is_hazard:
        res_data = [
            [
                Paragraph("Block Name", table_header_style),
                Paragraph("Hazard Area %", table_header_style),
                Paragraph("Hist. Events", table_header_style),
                Paragraph("Score (0-10)", table_header_style),
                Paragraph("Class", table_header_style),
            ]
        ]
    else:
        res_data = [
            [
                Paragraph("Block Name", table_header_style),
                Paragraph("Score (0-10)", table_header_style),
                Paragraph("Class", table_header_style),
            ]
        ]
    for b in block_results:
        cls_code = b.get("classification", "NH")
        cls_color = "#EF4444" if cls_code == "HH" else ("#F97316" if cls_code == "MH" else ("#EAB308" if cls_code == "LH" else "#22C55E"))
        row = [
            Paragraph(b.get("unit_name", ""), table_cell_style),
            Paragraph(f"<b>{b.get('composite_score', 0.0):.2f}</b>", table_cell_style),
            Paragraph(f"<font color='{cls_color}'><b>{cls_code}</b></font>", table_cell_style),
        ]
        if is_hazard:
            row.insert(1, Paragraph(f"{_hazard_area_pct(b):.1f}%", table_cell_style))
            row.insert(2, Paragraph(str(b.get('event_count', 0)), table_cell_style))
        res_data.append(row)

    t_res = Table(res_data, colWidths=[170, 90, 85, 90, 85] if is_hazard else [280, 90, 90])
    t_res.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1E293B')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(t_res)
    elements.append(Spacer(1, 8))

    # Findings & Recommendations
    elements.append(Paragraph("5. Strategic Recommendations & Priority Actions", h2_style))
    hh_blocks = findings.get("hh_blocks", [])
    if hh_blocks:
        elements.append(Paragraph(f"• <b>Priority Focus:</b> Highest-band classification in <b>{', '.join(hh_blocks)}</b> requires immediate attention.", body_style))
    for rec in recommendations:
        elements.append(Paragraph(f"• {rec}", body_style))

    # Disclaimer
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "<i>Disclaimer: Generated automatically by HVRA prototype decision support system. Verify with local administrative ground surveys.</i>",
        body_style
    ))

    doc.build(elements)
    bio.seek(0)
    return bio


def generate_assessment_csv(assessment, report_data: dict) -> str:
    """Generate CSV string of assessment block results."""
    out = io.StringIO()
    writer = csv.writer(out)
    meta = report_data.get("metadata", {})
    dist = meta.get("district", "Unknown")
    module_type = meta.get("module_type", "HAZARD")

    if module_type == "HAZARD":
        writer.writerow([
            "District", "Block Name", "Hazard Type", "Hazard Prone Percentage",
            "Historical Event Count", "Event Frequency (events/yr)", "Composite Score (0-10)", "Classification"
        ])
        hz = meta.get("hazard_type", "FLOOD")
        for b in report_data.get("block_results", []):
            writer.writerow([
                dist,
                b.get("unit_name", ""),
                hz,
                f"{b.get('flood_prone_percentage', 0.0):.2f}",
                b.get("event_count", 0),
                f"{b.get('event_frequency', 0.0):.4f}",
                f"{b.get('composite_score', 0.0):.4f}",
                b.get("classification", "NH")
            ])
    else:
        writer.writerow([
            "District", "Block Name", "Module", "Composite Score (0-10)", "Classification"
        ])
        for b in report_data.get("block_results", []):
            writer.writerow([
                dist,
                b.get("unit_name", ""),
                module_type,
                f"{b.get('composite_score', 0.0):.4f}",
                b.get("classification", "NH")
            ])
    return out.getvalue()


RISK_CLASS_FG = {
    "VERY_HIGH": "7F1D1D",
    "HIGH": "EF4444",
    "MODERATE": "F59E0B",
    "LOW": "22C55E",
}
RISK_CLASS_BG = {
    "VERY_HIGH": "FEE2E2",
    "HIGH": "FEF2F2",
    "MODERATE": "FEFCE8",
    "LOW": "F0FDF4",
}
RISK_CLASS_ORDER = ["VERY_HIGH", "HIGH", "MODERATE", "LOW"]


def generate_risk_report_docx(risk, report_data: dict) -> io.BytesIO:
    """
    Generate a professional Word (.docx) Composite Risk Assessment report
    (Module 4 — Risk = H × V × E).
    """
    doc = Document()
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)

    meta = report_data.get("metadata", {})
    summary = report_data.get("classification_summary", {})
    findings = report_data.get("findings", {})
    block_results = report_data.get("block_results", [])
    recommendations = report_data.get("recommendations", [])
    weights = meta.get("weights", {})
    inputs = meta.get("inputs", {})

    # Header banner
    p_header = doc.add_paragraph()
    p_header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_org = p_header.add_run("HAZARD, VULNERABILITY & RISK ASSESSMENT TOOL (HVRA)\nSTATE DISASTER MANAGEMENT FRAMEWORK")
    r_org.font.size = Pt(8.5)
    r_org.font.color.rgb = RGBColor(100, 116, 139)
    r_org.bold = True

    p_title = doc.add_paragraph()
    r_title = p_title.add_run(meta.get("name", "Composite Risk Assessment Report"))
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    p_sub = doc.add_paragraph()
    r_sub = p_sub.add_run("Composite Risk Assessment — Risk = H × V × E (Weighted Multiplicative Model)")
    r_sub.font.size = Pt(12)
    r_sub.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph()

    # Metadata card
    t_meta = doc.add_table(rows=5, cols=2)
    t_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    formula_label = "Multiplicative (R = H × V × E)" if meta.get("formula") != "ADDITIVE" else "Weighted Sum"
    meta_rows = [
        ("Administrative Scope:", f"{meta.get('state', 'Kerala')} → {meta.get('district', 'District')} ({meta.get('level', 'BLOCK')} Level)"),
        ("Formula:", formula_label),
        ("Module Weights:", f"H={weights.get('hazard', 1.0)} × V={weights.get('vulnerability', 1.0)} × E={weights.get('exposure', 1.0)}"),
        ("Date Generated:", datetime.now().strftime("%B %d, %Y, %H:%M:%S")),
        ("Validation Status:", f"{meta.get('status', 'COMPLETED')} (Risk Engine)"),
    ]
    for idx, (label, val) in enumerate(meta_rows):
        r = t_meta.rows[idx]
        c0, c1 = r.cells
        c0.width = Inches(2.2)
        c1.width = Inches(4.5)
        set_cell_background(c0, "F8FAFC")
        set_cell_background(c1, "FFFFFF")
        p0 = c0.paragraphs[0].add_run(label)
        p0.font.bold = True
        p0.font.size = Pt(9.5)
        p0.font.color.rgb = RGBColor(71, 85, 105)
        p1 = c1.paragraphs[0].add_run(val)
        p1.font.size = Pt(9.5)
        p1.font.color.rgb = RGBColor(15, 23, 42)

    # Input module table
    doc.add_paragraph()
    t_in = doc.add_table(rows=4, cols=3)
    t_in.alignment = WD_TABLE_ALIGNMENT.CENTER
    in_headers = ["Module", "Assessment", "Status"]
    for h_idx, h_text in enumerate(in_headers):
        cell = t_in.cell(0, h_idx)
        set_cell_background(cell, "1E293B")
        p = cell.paragraphs[0]
        r = p.add_run(h_text)
        r.font.bold = True
        r.font.size = Pt(9)
        r.font.color.rgb = RGBColor(255, 255, 255)
    in_specs = [
        ("Hazard (H)", inputs.get("hazard_assessment")),
        ("Vulnerability (V)", inputs.get("vulnerability_assessment")),
        ("Exposure (E)", inputs.get("exposure_assessment")),
    ]
    for r_idx, (label, name) in enumerate(in_specs, start=1):
        c0 = t_in.cell(r_idx, 0)
        c1 = t_in.cell(r_idx, 1)
        c2 = t_in.cell(r_idx, 2)
        bg = "FFFFFF" if r_idx % 2 == 1 else "F8FAFC"
        for c in (c0, c1, c2):
            set_cell_background(c, bg)
        c0.paragraphs[0].add_run(label).font.size = Pt(9)
        c1.paragraphs[0].add_run(name or "— (Not provided)").font.size = Pt(9)
        c2.paragraphs[0].add_run("Completed" if name else "SKIPPED").font.size = Pt(9)

    def add_chapter(num: int, title: str):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(f"{num}. {title}")
        r.font.size = Pt(13)
        r.font.bold = True
        r.font.color.rgb = RGBColor(30, 41, 59)
        return p

    # Chapter 1
    add_chapter(1, "Executive Summary")
    p1 = doc.add_paragraph(
        f"This report presents the composite risk profile for {meta.get('district')} district, {meta.get('state')}, "
        f"combining Hazard (H), Vulnerability (V) and Exposure (E) module scores into a single risk score on a 0–10 scale "
        f"using the {formula_label.lower()} model. {len(block_results)} administrative blocks were evaluated."
    )
    p1.style.font.size = Pt(10)

    # Chapter 2
    add_chapter(2, "Risk Classification Summary")
    t_sum = doc.add_table(rows=2, cols=4)
    t_sum.alignment = WD_TABLE_ALIGNMENT.CENTER
    for c_idx, cls in enumerate(RISK_CLASS_ORDER):
        cell_top = t_sum.cell(0, c_idx)
        cell_bot = t_sum.cell(1, c_idx)
        set_cell_background(cell_top, RISK_CLASS_BG[cls])
        set_cell_background(cell_bot, RISK_CLASS_BG[cls])
        p_top = cell_top.paragraphs[0]
        p_top.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_top = p_top.add_run(str(summary.get(cls, 0)))
        r_top.font.size = Pt(18)
        r_top.font.bold = True
        r_top.font.color.rgb = RGBColor.from_string(RISK_CLASS_FG[cls])
        p_bot = cell_bot.paragraphs[0]
        p_bot.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_bot = p_bot.add_run(report_data.get("risk_class_labels", {}).get(cls, cls.replace("_", " ")))
        r_bot.font.size = Pt(8.5)
        r_bot.font.bold = True
        r_bot.font.color.rgb = RGBColor(71, 85, 105)

    doc.add_paragraph()

    # Chapter 3 — Climate Context (HVRA §4.9)
    add_chapter(3, "Climate Context & Regional Drivers")
    climate_entries = report_data.get("climate_context", [])
    if not climate_entries:
        p_cc = doc.add_paragraph("No curated climate context entries available for this extent (prototype).")
        p_cc.style.font.size = Pt(9.5)
    for entry in climate_entries:
        p_cc_title = doc.add_paragraph()
        r_cc_title = p_cc_title.add_run(entry.get("title", "Climate Context"))
        r_cc_title.font.bold = True
        r_cc_title.font.size = Pt(10)
        p_cc_text = doc.add_paragraph(entry.get("statement", ""))
        p_cc_text.style.font.size = Pt(9.5)
        src = entry.get("source", "")
        if src:
            vintage_note = f" ({entry.get('vintage')})" if entry.get('vintage') else ""
            p_cc_src = doc.add_paragraph(f"Source: {src}{vintage_note}")
            p_cc_src.style.font.size = Pt(8.5)
            p_cc_src.style.font.italic = True

    # Chapter 4
    add_chapter(4, "Unit-Level Risk Results")
    p5 = doc.add_paragraph("Block-level results sorted by composite risk score:")
    p5.style.font.size = Pt(9.5)
    t_res = doc.add_table(rows=1 + len(block_results), cols=6)
    t_res.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = ["Block Unit", "Hazard", "Vulnerability", "Exposure", "Risk (0-10)", "Class"]
    for h_idx, h_text in enumerate(headers):
        cell = t_res.cell(0, h_idx)
        set_cell_background(cell, "1E293B")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(h_text)
        r.font.bold = True
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    for row_idx, b in enumerate(block_results, start=1):
        bg = "FFFFFF" if row_idx % 2 == 1 else "F8FAFC"
        cells = [t_res.cell(row_idx, col) for col in range(6)]
        for c in cells:
            set_cell_background(c, bg)
        cells[0].paragraphs[0].add_run(b.get("unit_name", "")).font.size = Pt(8.5)
        for col, key in [(1, "hazard_score"), (2, "vulnerability_score"), (3, "exposure_score")]:
            val = b.get(key)
            p = cells[col].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
            p.add_run(f"{val:.2f}" if val is not None else "—").font.size = Pt(8.5)
        p_sc = cells[4].paragraphs[0]
        p_sc.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r_sc = p_sc.add_run(f"{b.get('risk_score', 0.0):.2f}")
        r_sc.font.bold = True
        r_sc.font.size = Pt(8.5)
        cls_code = b.get("risk_class", "LOW")
        p_cl = cells[5].paragraphs[0]
        p_cl.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_cl = p_cl.add_run(cls_code.replace("_", " "))
        r_cl.font.bold = True
        r_cl.font.size = Pt(8.5)
        r_cl.font.color.rgb = RGBColor.from_string(RISK_CLASS_FG.get(cls_code, "94A3B8"))

    doc.add_paragraph()

    # Chapter 5
    add_chapter(5, "Priority Findings & Strategic Actions")
    very_high = findings.get("very_high_units", [])
    p6_1 = doc.add_paragraph(style='List Bullet')
    p6_1.add_run("Very High Risk Units: ").bold = True
    p6_1.add_run(f"{len(very_high)} block(s) identified ({', '.join(very_high) if very_high else 'None'}).")
    for rec in recommendations:
        p_rec = doc.add_paragraph(style='List Bullet')
        p_rec.add_run(rec).font.size = Pt(9.5)

    # Chapter 6
    add_chapter(6, "Annexures & Data Provenance Notice")
    p_ann = doc.add_paragraph(
        "Disclaimer: This report was compiled automatically by the HVRA prototype platform. All scores and classes are "
        "computed for decision support. Hazard, Vulnerability and Exposure inputs are based on prototype DEMO DATA and "
        "should be replaced with validated survey data before official use."
    )
    p_ann.style.font.size = Pt(8.5)
    p_ann.style.font.italic = True

    bio = io.BytesIO()
    doc.save(bio)
    bio.seek(0)
    return bio


def generate_risk_report_pdf(risk, report_data: dict) -> io.BytesIO:
    """
    Generate a publication-grade PDF Composite Risk Assessment report.
    """
    bio = io.BytesIO()
    doc = SimpleDocTemplate(
        bio,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'],
        fontName='Helvetica-Bold', fontSize=18, leading=22,
        textColor=colors.HexColor('#0F172A'), spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'DocSub', parent=styles['Normal'],
        fontName='Helvetica', fontSize=10, leading=14,
        textColor=colors.HexColor('#475569'), spaceAfter=12,
    )
    h2_style = ParagraphStyle(
        'H2', parent=styles['Heading2'],
        fontName='Helvetica-Bold', fontSize=12, leading=16,
        textColor=colors.HexColor('#1E293B'), spaceBefore=10, spaceAfter=6,
    )
    body_style = ParagraphStyle(
        'Body', parent=styles['Normal'],
        fontName='Helvetica', fontSize=9, leading=13,
        textColor=colors.HexColor('#334155'), spaceAfter=6,
    )
    table_cell_style = ParagraphStyle(
        'Cell', parent=styles['Normal'],
        fontName='Helvetica', fontSize=8, leading=10,
        textColor=colors.HexColor('#1E293B'),
    )
    table_header_style = ParagraphStyle(
        'HCell', parent=styles['Normal'],
        fontName='Helvetica-Bold', fontSize=8, leading=10,
        textColor=colors.white,
    )

    meta = report_data.get("metadata", {})
    summary = report_data.get("classification_summary", {})
    findings = report_data.get("findings", {})
    block_results = report_data.get("block_results", [])
    recommendations = report_data.get("recommendations", [])
    weights = meta.get("weights", {})
    inputs = meta.get("inputs", {})
    formula_label = "Multiplicative (R = H × V × E)" if meta.get("formula") != "ADDITIVE" else "Weighted Sum"
    risk_labels = report_data.get("risk_class_labels", {})

    elements = []
    elements.append(Paragraph("<b>HAZARD, VULNERABILITY & RISK ASSESSMENT TOOL (HVRA)</b>", subtitle_style))
    elements.append(Paragraph(meta.get("name", "Composite Risk Assessment Report"), title_style))
    elements.append(Paragraph(
        f"Administrative Scope: <b>{meta.get('state', 'Kerala')} → {meta.get('district', 'District')}</b> | "
        f"Formula: <b>{formula_label}</b> | Date: {datetime.now().strftime('%d %b %Y')}",
        subtitle_style
    ))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceAfter=10))

    elements.append(Paragraph("1. Executive Summary", h2_style))
    elements.append(Paragraph(
        f"This report presents the composite risk profile for {meta.get('district')} district, {meta.get('state')}, "
        f"combining Hazard (H), Vulnerability (V) and Exposure (E) module scores ({len(block_results)} blocks). "
        f"Weights — H={weights.get('hazard', 1.0)}, V={weights.get('vulnerability', 1.0)}, E={weights.get('exposure', 1.0)}.",
        body_style
    ))

    # Climate Context (HVRA §4.9)
    climate_entries = report_data.get("climate_context", [])
    if climate_entries:
        elements.append(Paragraph("2. Climate Context & Regional Drivers", h2_style))
        for entry in climate_entries:
            elements.append(Paragraph(
                f"<b>{entry.get('title', 'Climate Context')}:</b> {entry.get('statement', '')}",
                body_style,
            ))
            src = entry.get("source", "")
            if src:
                vintage = f" ({entry.get('vintage')})" if entry.get("vintage") else ""
                elements.append(Paragraph(f"<i>Source: {src}{vintage}</i>", body_style))
        elements.append(Spacer(1, 6))

    # Input modules
    elements.append(Paragraph("3. Input Module Assessments", h2_style))
    for label, name in [
        ("Hazard (H)", inputs.get("hazard_assessment")),
        ("Vulnerability (V)", inputs.get("vulnerability_assessment")),
        ("Exposure (E)", inputs.get("exposure_assessment")),
    ]:
        elements.append(Paragraph(f"• <b>{label}:</b> {name or 'Not provided (component skipped)'}", body_style))

    # Summary cards
    elements.append(Paragraph("4. Risk Classification Summary", h2_style))
    summary_data = [
        [Paragraph(f"<b>{risk_labels.get(c, c.replace('_', ' '))}</b>", table_cell_style) for c in RISK_CLASS_ORDER],
        [Paragraph(f"<font size='14' color='#{RISK_CLASS_FG[c]}'><b>{summary.get(c, 0)}</b></font>", table_cell_style) for c in RISK_CLASS_ORDER],
    ]
    t_summary = Table(summary_data, colWidths=[130, 130, 130, 130])
    t_summary.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 1), colors.HexColor('#FEE2E2')),
        ('BACKGROUND', (1, 0), (1, 1), colors.HexColor('#FEF2F2')),
        ('BACKGROUND', (2, 0), (2, 1), colors.HexColor('#FEFCE8')),
        ('BACKGROUND', (3, 0), (3, 1), colors.HexColor('#F0FDF4')),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_summary)
    elements.append(Spacer(1, 8))

    # Block results
    elements.append(Paragraph("5. Unit-Level Risk Results", h2_style))
    res_data = [[
        Paragraph("Block Name", table_header_style),
        Paragraph("Hazard", table_header_style),
        Paragraph("Vulnerability", table_header_style),
        Paragraph("Exposure", table_header_style),
        Paragraph("Risk (0-10)", table_header_style),
        Paragraph("Class", table_header_style),
    ]]
    for b in block_results:
        cls_code = b.get("risk_class", "LOW")
        row = [
            Paragraph(b.get("unit_name", ""), table_cell_style),
            Paragraph(f"{b.get('hazard_score', 0):.2f}" if b.get("hazard_score") is not None else "—", table_cell_style),
            Paragraph(f"{b.get('vulnerability_score', 0):.2f}" if b.get("vulnerability_score") is not None else "—", table_cell_style),
            Paragraph(f"{b.get('exposure_score', 0):.2f}" if b.get("exposure_score") is not None else "—", table_cell_style),
            Paragraph(f"<b>{b.get('risk_score', 0.0):.2f}</b>", table_cell_style),
            Paragraph(f"<font color='#{RISK_CLASS_FG.get(cls_code, '94A3B8')}'><b>{cls_code.replace('_', ' ')}</b></font>", table_cell_style),
        ]
        res_data.append(row)

    t_res = Table(res_data, colWidths=[130, 70, 85, 70, 85, 110])
    t_res.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8FAFC')]),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    elements.append(t_res)
    elements.append(Spacer(1, 8))

    # Findings & recommendations
    elements.append(Paragraph("6. Strategic Recommendations & Priority Actions", h2_style))
    very_high = findings.get("very_high_units", [])
    if very_high:
        elements.append(Paragraph(f"• <b>Priority Focus:</b> Very High Risk in <b>{', '.join(very_high)}</b> requires immediate attention.", body_style))
    for rec in recommendations:
        elements.append(Paragraph(f"• {rec}", body_style))

    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "<i>Disclaimer: Generated automatically by HVRA prototype decision support system. Inputs are DEMO DATA; verify with validated surveys before official use.</i>",
        body_style
    ))

    doc.build(elements)
    bio.seek(0)
    return bio
