"""
Payslip PDF Generator using ReportLab.
Produces professional, single-page A4 payslips matching STIFLINK MANAGEMENT (OPC) PVT. LTD branding.
"""

import os
import re
import json
import hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Register Unicode TrueType fonts from Windows if available
FONT_NORMAL = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'

for font_name, font_file in [('SegoeUI', 'segoeui.ttf'), ('Calibri', 'calibri.ttf'), ('Arial', 'arial.ttf')]:
    win_dir = os.environ.get('WINDIR', 'C:\\Windows')
    font_path = os.path.join(win_dir, 'Fonts', font_file)
    bold_file = font_file.replace('.ttf', 'bd.ttf') if font_file != 'segoeui.ttf' else 'segoeuib.ttf'
    bold_path = os.path.join(win_dir, 'Fonts', bold_file)
    if os.path.exists(font_path):
        try:
            pdfmetrics.registerFont(TTFont(font_name, font_path))
            if os.path.exists(bold_path):
                pdfmetrics.registerFont(TTFont(f"{font_name}-Bold", bold_path))
                FONT_NORMAL = font_name
                FONT_BOLD = f"{font_name}-Bold"
            else:
                FONT_NORMAL = font_name
                FONT_BOLD = font_name
            break
        except Exception:
            pass

COMPANY_NAME = "STIFLINK MANAGEMENT (OPC) PVT. LTD"
COMPANY_ADDRESS = "OFFICE NO. 301 FIFTH FLOOR, ADHARHSILA COMPLEX, GANDHI MAIDAN, PATNA, BIHAR 800001."

def compute_record_hash(rec):
    """
    Computes a deterministic MD5 hash of the payroll record data.
    Used to detect if any field has changed before regenerating existing PDF.
    """
    keys = [
        "employeeId", "employeeName", "designation", "month",
        "totalDays", "presentDays", "casualLeaveDays", "absentDays", "sundays", "paidDays",
        "monthlySalary", "grossSalary",
        "advanceDeducted", "totalDeductions", "netSalary", "remarks",
        "bankName", "bankAccountNo", "bankIfscCode", "panTaxNo", "joinDate", "leaveDate"
    ]
    norm = {}
    for k in keys:
        val = rec.get(k)
        if isinstance(val, float):
            norm[k] = round(val, 2)
        elif val is None:
            norm[k] = ""
        else:
            norm[k] = str(val).strip()
    serialized = json.dumps(norm, sort_keys=True)
    return hashlib.md5(serialized.encode('utf-8')).hexdigest()

def is_attendance_green(rec):
    """
    Checks if attendance status is green (complete):
    present + casual + absent + sundays == totalDays.
    """
    tot = float(rec.get("totalDays", 30.0) or 30.0)
    p = float(rec.get("presentDays", 0.0) or 0.0)
    c = float(rec.get("casualLeaveDays", 0.0) or 0.0)
    a = float(rec.get("absentDays", 0.0) or 0.0)
    s = float(rec.get("sundays", 0.0) or 0.0)
    return abs((p + c + a + s) - tot) < 0.01

def number_to_words(n):
    """Converts a number to Indian currency words format."""
    n = int(round(n))
    if n <= 0:
        return "Zero Rupees Only"
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
            "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]
    def two_digits(num):
        if num < 20: return ones[num]
        return tens[num // 10] + (" " + ones[num % 10] if num % 10 > 0 else "")
    def three_digits(num):
        h = num // 100
        rem = num % 100
        res = ""
        if h > 0: res += ones[h] + " Hundred"
        if rem > 0: res += (" and " if res else "") + two_digits(rem)
        return res

    parts = []
    cr = n // 10000000
    n %= 10000000
    if cr > 0: parts.append(two_digits(cr) + " Crore")
    la = n // 100000
    n %= 100000
    if la > 0: parts.append(two_digits(la) + " Lakh")
    th = n // 1000
    n %= 1000
    if th > 0: parts.append(two_digits(th) + " Thousand")
    if n > 0: parts.append(three_digits(n))

    return " ".join(parts).strip() + " Rupees Only"

def generate_payslip_pdf(rec, output_path):
    """
    Generates a beautiful, single-page A4 PDF payslip.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # 15mm margins for clean A4 fit
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=28,
        bottomMargin=28
    )

    styles = getSampleStyleSheet()

    # Color Palette matching UI
    PRIMARY_COLOR = colors.HexColor("#1e3a8a")     # Deep corporate blue
    SECONDARY_COLOR = colors.HexColor("#3b82f6")   # Accent blue
    BG_LIGHT = colors.HexColor("#f8fafc")          # Slate 50
    BG_HEADER = colors.HexColor("#f1f5f9")         # Slate 100
    TEXT_DARK = colors.HexColor("#0f172a")         # Slate 900
    TEXT_MUTED = colors.HexColor("#475569")        # Slate 600
    BORDER_COLOR = colors.HexColor("#cbd5e1")      # Slate 300
    GREEN_ACCENT = colors.HexColor("#16a34a")      # Green 600
    RED_ACCENT = colors.HexColor("#dc2626")        # Red 600

    # Custom Paragraph Styles
    title_style = ParagraphStyle(
        'CompanyTitle',
        fontName=FONT_BOLD,
        fontSize=15,
        leading=18,
        textColor=PRIMARY_COLOR,
        alignment=1
    )
    subtitle_style = ParagraphStyle(
        'CompanySubtitle',
        fontName=FONT_NORMAL,
        fontSize=8.5,
        leading=11,
        textColor=TEXT_MUTED,
        alignment=1
    )
    slip_month_style = ParagraphStyle(
        'SlipMonth',
        fontName=FONT_BOLD,
        fontSize=11,
        leading=14,
        textColor=PRIMARY_COLOR,
        alignment=1
    )
    section_hdr_style = ParagraphStyle(
        'SectionHdr',
        fontName=FONT_BOLD,
        fontSize=9.5,
        leading=12,
        textColor=PRIMARY_COLOR
    )
    tbl_label_style = ParagraphStyle(
        'TblLabel',
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        textColor=TEXT_MUTED
    )
    tbl_val_style = ParagraphStyle(
        'TblVal',
        fontName=FONT_NORMAL,
        fontSize=8.5,
        leading=11,
        textColor=TEXT_DARK
    )
    tbl_val_bold = ParagraphStyle(
        'TblValBold',
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        textColor=TEXT_DARK
    )

    story = []

    # 1. Company Header
    story.append(Paragraph(COMPANY_NAME, title_style))
    story.append(Spacer(1, 2))
    story.append(Paragraph(COMPANY_ADDRESS, subtitle_style))
    story.append(Spacer(1, 6))

    month_display = rec.get("month", "").upper()
    story.append(Paragraph(f"PAYSLIP FOR THE MONTH OF {month_display}", slip_month_style))
    story.append(Spacer(1, 10))

    # 2. Employee & Bank Meta Grid (4 columns)
    emp_id = rec.get("employeeId", "")
    emp_name = rec.get("employeeName", "")
    desig = rec.get("designation", "Staff")
    monthly_sal = float(rec.get("monthlySalary", 0.0) or 0.0)
    bank_name = rec.get("bankName") or "State Bank of India"
    bank_acc = rec.get("bankAccountNo") or "—"
    bank_ifsc = rec.get("bankIfscCode") or "—"
    pan_no = rec.get("panTaxNo") or "—"
    doj = rec.get("joinDate") or "2024-04-01"

    meta_data = [
        [
            Paragraph("Employee ID:", tbl_label_style),
            Paragraph(f"<b>{emp_id}</b>", tbl_val_bold),
            Paragraph("Bank Name:", tbl_label_style),
            Paragraph(bank_name, tbl_val_style)
        ],
        [
            Paragraph("Employee Name:", tbl_label_style),
            Paragraph(f"<b>{emp_name}</b>", tbl_val_bold),
            Paragraph("Bank A/C No:", tbl_label_style),
            Paragraph(bank_acc, tbl_val_style)
        ],
        [
            Paragraph("Designation:", tbl_label_style),
            Paragraph(desig, tbl_val_style),
            Paragraph("Bank IFSC:", tbl_label_style),
            Paragraph(bank_ifsc, tbl_val_style)
        ],
        [
            Paragraph("Monthly Salary:", tbl_label_style),
            Paragraph(f"₹{monthly_sal:,.2f}", tbl_val_style),
            Paragraph("PAN Number:", tbl_label_style),
            Paragraph(pan_no, tbl_val_style)
        ],
        [
            Paragraph("Date of Joining:", tbl_label_style),
            Paragraph(doj, tbl_val_style),
            Paragraph("Payment Mode:", tbl_label_style),
            Paragraph("Bank Transfer", tbl_val_style)
        ]
    ]

    # Printable width: 595.27 - 72 = 523.27 pt
    # Col widths: 110, 150, 100, 163 = 523
    meta_table = Table(meta_data, colWidths=[105, 155, 95, 168])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # 3. Monthly Attendance Summary Box
    tot_days = float(rec.get("totalDays", 30.0) or 30.0)
    present_days = float(rec.get("presentDays", 0.0) or 0.0)
    casual_days = float(rec.get("casualLeaveDays", 0.0) or 0.0)
    absent_days = float(rec.get("absentDays", 0.0) or 0.0)
    sundays = float(rec.get("sundays", 4.0) or 4.0)
    paid_days = float(rec.get("paidDays", 0.0) or 0.0)

    att_hdr = [
        Paragraph("<b>Total Days</b>", ParagraphStyle('C', parent=tbl_label_style, alignment=1)),
        Paragraph("<b>Present Days</b>", ParagraphStyle('C', parent=tbl_label_style, alignment=1)),
        Paragraph("<b>Casual Leave</b>", ParagraphStyle('C', parent=tbl_label_style, alignment=1)),
        Paragraph("<b>Absent Days</b>", ParagraphStyle('C', parent=tbl_label_style, alignment=1)),
        Paragraph("<b>Sundays</b>", ParagraphStyle('C', parent=tbl_label_style, alignment=1)),
        Paragraph("<b>Payable Days</b>", ParagraphStyle('C', parent=tbl_label_style, alignment=1, textColor=PRIMARY_COLOR)),
    ]

    def fmt_days(d):
        return f"{int(d) if d.is_integer() else d} days"

    att_val = [
        Paragraph(fmt_days(tot_days), ParagraphStyle('C', parent=tbl_val_bold, alignment=1)),
        Paragraph(fmt_days(present_days), ParagraphStyle('C', parent=tbl_val_bold, alignment=1, textColor=GREEN_ACCENT)),
        Paragraph(fmt_days(casual_days), ParagraphStyle('C', parent=tbl_val_bold, alignment=1)),
        Paragraph(fmt_days(absent_days), ParagraphStyle('C', parent=tbl_val_bold, alignment=1, textColor=RED_ACCENT if absent_days > 0 else TEXT_MUTED)),
        Paragraph(fmt_days(sundays), ParagraphStyle('C', parent=tbl_val_bold, alignment=1)),
        Paragraph(fmt_days(paid_days), ParagraphStyle('C', parent=tbl_val_bold, alignment=1, textColor=PRIMARY_COLOR, fontSize=9.5)),
    ]

    att_table = Table(
        [
            [Paragraph("<b>MONTHLY ATTENDANCE SUMMARY</b>", ParagraphStyle('ATitle', fontName=FONT_BOLD, fontSize=8.5, textColor=PRIMARY_COLOR, alignment=1)) for _ in range(6)],
            att_hdr,
            att_val
        ],
        colWidths=[87, 87, 87, 87, 87, 88]
    )
    att_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (5, 0)),
        ('BACKGROUND', (0, 0), (5, 0), BG_HEADER),
        ('BACKGROUND', (0, 1), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
        ('LINEBELOW', (0, 0), (5, 0), 0.75, BORDER_COLOR),
        ('LINEBELOW', (0, 1), (5, 1), 0.5, BORDER_COLOR),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(att_table)
    story.append(Spacer(1, 10))

    # 4. Salary Computation Table (Simple: Gross Salary -> Advance Deduction -> Net Salary)
    monthly_sal = float(rec.get("monthlySalary", 0.0) or 0.0)
    gross_sal = float(rec.get("grossSalary", 0.0) or 0.0)
    if gross_sal <= 0.0 and tot_days > 0:
        gross_sal = round((paid_days / tot_days) * monthly_sal, 2)
    advance = float(rec.get("advanceDeducted", 0.0) or 0.0)
    tot_deduct = advance
    net_sal = max(0.0, float(rec.get("netSalary", 0.0) or (gross_sal - tot_deduct)))

    align_r = ParagraphStyle('R', parent=tbl_val_style, alignment=2)
    align_r_danger = ParagraphStyle('RD', parent=tbl_val_bold, alignment=2, textColor=RED_ACCENT)
    align_r_primary = ParagraphStyle('RP', parent=tbl_val_bold, alignment=2, textColor=PRIMARY_COLOR, fontSize=10)

    words = number_to_words(net_sal)

    salary_data = [
        [
            Paragraph("<b>SALARY COMPUTATION</b>", ParagraphStyle('SC', fontName=FONT_BOLD, fontSize=8.5, textColor=PRIMARY_COLOR, alignment=0)),
            ""
        ],
        [
            Paragraph("Gross Salary", tbl_label_style),
            Paragraph(f"<b>₹{gross_sal:,.2f}</b>", align_r_primary)
        ],
        [
            Paragraph("Advance Deduction", tbl_label_style),
            Paragraph(f"<b>-₹{advance:,.2f}</b>" if advance > 0 else "<b>₹0.00</b>", align_r_danger if advance > 0 else align_r)
        ],
        [
            Paragraph("<b>NET SALARY PAYABLE:</b><br/><i><font size=7.5 color='#475569'>" + words + "</font></i>", tbl_val_style),
            Paragraph(f"<b>₹{net_sal:,.2f}</b>", ParagraphStyle('NA', fontName=FONT_BOLD, fontSize=13, textColor=PRIMARY_COLOR, alignment=2))
        ]
    ]

    salary_table = Table(salary_data, colWidths=[355, 168])
    salary_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (1, 0), BG_HEADER),
        ('BACKGROUND', (0, 1), (-1, 2), BG_LIGHT),
        ('BACKGROUND', (0, 3), (-1, 3), colors.HexColor("#e0f2fe")),
        ('BOX', (0, 0), (-1, -1), 0.75, BORDER_COLOR),
        ('LINEBELOW', (0, 0), (-1, 0), 0.75, BORDER_COLOR),
        ('LINEBELOW', (0, 1), (-1, 1), 0.5, colors.HexColor("#e2e8f0")),
        ('LINEBELOW', (0, 2), (-1, 2), 0.75, colors.HexColor("#0284c7")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(salary_table)
    story.append(Spacer(1, 12))

    # 6. Remarks (if any)
    remarks = (rec.get("remarks") or "").strip()
    if remarks:
        rem_p = Paragraph(f"<b>Remarks / Notes:</b> {remarks}", ParagraphStyle('Rem', fontName=FONT_NORMAL, fontSize=8, textColor=TEXT_MUTED))
        rem_table = Table([[rem_p]], colWidths=[523])
        rem_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
            ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(rem_table)
        story.append(Spacer(1, 15))
    else:
        story.append(Spacer(1, 15))

    # 7. Signatures Area
    sig_data = [
        [
            Paragraph(f"For <b>{COMPANY_NAME}</b><br/><br/><br/><br/><b>Authorized Signatory / Accountant</b>", tbl_val_style),
            Paragraph("Employee Signature<br/><br/><br/><br/>_________________________________", ParagraphStyle('ES', parent=tbl_val_style, alignment=2))
        ]
    ]
    sig_table = Table(sig_data, colWidths=[261, 262])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(sig_table)

    # Build Document
    doc.build(story)
    return output_path

