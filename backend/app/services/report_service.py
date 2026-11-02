import io
import logging
from datetime import datetime
from typing import Optional, List
import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from sqlalchemy.orm import Session
from backend.app.models.invoice import Invoice
from backend.app.schemas.report import ReportFilterParams

logger = logging.getLogger(__name__)

def generate_excel_expense_report(
    db: Session,
    filters: ReportFilterParams
) -> bytes:
    """
    Generates a professional multi-sheet Excel (.xlsx) expense report.
    - Sheet 1: Executive Summary & KPIs
    - Sheet 2: Detailed Invoice Register
    """
    query = db.query(Invoice)

    if filters.approved_only:
        query = query.filter(Invoice.status == "APPROVED")

    if filters.vendor_name:
        query = query.filter(Invoice.vendor_name.ilike(f"%{filters.vendor_name}%"))

    # Execute query
    invoices: List[Invoice] = query.order_by(Invoice.created_at.desc()).all()

    # Filter by date if present
    filtered_invoices = []
    for inv in invoices:
        inv_date = inv.invoice_date or ""
        if filters.start_date and inv_date and inv_date < filters.start_date:
            continue
        if filters.end_date and inv_date and inv_date > filters.end_date:
            continue
        filtered_invoices.append(inv)

    # Prepare DataFrame rows
    records = []
    for inv in filtered_invoices:
        records.append({
            "Invoice ID": inv.id,
            "Vendor Name": inv.vendor_name or "Unknown",
            "Invoice Number": inv.invoice_number or "N/A",
            "Invoice Date": inv.invoice_date or "",
            "Due Date": inv.due_date or "",
            "Customer / Client": inv.customer_name or "",
            "Subtotal": inv.subtotal if inv.subtotal is not None else 0.0,
            "Tax Amount": inv.tax_amount if inv.tax_amount is not None else 0.0,
            "Total Amount": inv.total_amount if inv.total_amount is not None else 0.0,
            "Currency": inv.currency or "USD",
            "Status": inv.status,
            "Manually Corrected": "Yes" if inv.is_corrected else "No",
            "Created Date": inv.created_at.strftime("%Y-%m-%d %H:%M") if inv.created_at else "",
            "Approved Date": inv.approved_at.strftime("%Y-%m-%d %H:%M") if inv.approved_at else ""
        })

    df = pd.DataFrame(records)

    # Create openpyxl workbook
    wb = openpyxl.Workbook()
    
    # ----------------------------------------------------
    # Sheet 1: Executive Summary
    # ----------------------------------------------------
    ws_summary = wb.active
    ws_summary.title = "Executive Summary"
    ws_summary.views.sheetView[0].showGridLines = True

    header_font = Font(name="Calibri", size=14, bold=True, color="1E3A8A")
    title_cell = ws_summary.cell(row=2, column=2, value="AI Expense & Invoice Processing Summary Report")
    title_cell.font = header_font

    gen_time_cell = ws_summary.cell(row=3, column=2, value=f"Generated On: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
    gen_time_cell.font = Font(name="Calibri", size=10, italic=True, color="6B7280")

    # Filters applied display
    filter_desc = []
    if filters.approved_only:
        filter_desc.append("Approved Invoices Only")
    else:
        filter_desc.append("All Statuses")
    if filters.vendor_name:
        filter_desc.append(f"Vendor: {filters.vendor_name}")
    if filters.start_date:
        filter_desc.append(f"From: {filters.start_date}")
    if filters.end_date:
        filter_desc.append(f"To: {filters.end_date}")

    ws_summary.cell(row=4, column=2, value=f"Filters Applied: {', '.join(filter_desc)}").font = Font(size=10, color="374151")

    # KPI Summary Cards
    total_invoices_count = len(df)
    total_expenditure = df["Total Amount"].sum() if not df.empty else 0.0
    total_tax = df["Tax Amount"].sum() if not df.empty else 0.0
    total_subtotal = df["Subtotal"].sum() if not df.empty else 0.0

    kpi_headers = ["Metric", "Value"]
    kpi_data = [
        ("Total Invoices Count", total_invoices_count),
        ("Total Net Subtotal", f"${total_subtotal:,.2f}"),
        ("Total Tax Captured", f"${total_tax:,.2f}"),
        ("Total Gross Expenditure", f"${total_expenditure:,.2f}")
    ]

    # KPI Table Header
    kpi_header_fill = PatternFill(start_color="1E3A8A", end_color="1E3A8A", fill_type="solid")
    kpi_header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    
    ws_summary.cell(row=6, column=2, value="Metric").fill = kpi_header_fill
    ws_summary.cell(row=6, column=2).font = kpi_header_font
    ws_summary.cell(row=6, column=3, value="Value").fill = kpi_header_fill
    ws_summary.cell(row=6, column=3).font = kpi_header_font

    row_idx = 7
    for metric, val in kpi_data:
        c1 = ws_summary.cell(row=row_idx, column=2, value=metric)
        c2 = ws_summary.cell(row=row_idx, column=3, value=val)
        c1.font = Font(bold=True)
        c2.alignment = Alignment(horizontal="right")
        row_idx += 1

    # Vendor Breakdown Table on Summary Sheet
    if not df.empty:
        ws_summary.cell(row=row_idx + 2, column=2, value="Vendor Expenditure Breakdown").font = Font(size=12, bold=True, color="1E3A8A")
        v_headers = ["Vendor Name", "Invoice Count", "Total Amount ($)", "% of Total"]
        
        v_row = row_idx + 3
        for col_idx, h in enumerate(v_headers, start=2):
            cell = ws_summary.cell(row=v_row, column=col_idx, value=h)
            cell.fill = PatternFill(start_color="3B82F6", end_color="3B82F6", fill_type="solid")
            cell.font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")

        vendor_grouped = df.groupby("Vendor Name").agg(
            count=("Invoice ID", "count"),
            amount=("Total Amount", "sum")
        ).reset_index().sort_values(by="amount", ascending=False)

        v_data_row = v_row + 1
        for _, r in vendor_grouped.iterrows():
            pct = (r["amount"] / total_expenditure * 100) if total_expenditure > 0 else 0
            ws_summary.cell(row=v_data_row, column=2, value=r["Vendor Name"])
            ws_summary.cell(row=v_data_row, column=3, value=r["count"]).alignment = Alignment(horizontal="center")
            ws_summary.cell(row=v_data_row, column=4, value=f"${r['amount']:,.2f}").alignment = Alignment(horizontal="right")
            ws_summary.cell(row=v_data_row, column=5, value=f"{pct:.1f}%").alignment = Alignment(horizontal="right")
            v_data_row += 1

    ws_summary.column_dimensions["B"].width = 32
    ws_summary.column_dimensions["C"].width = 24
    ws_summary.column_dimensions["D"].width = 22
    ws_summary.column_dimensions["E"].width = 16

    # ----------------------------------------------------
    # Sheet 2: Detailed Invoice Register
    # ----------------------------------------------------
    ws_detail = wb.create_sheet(title="Detailed Invoices")
    ws_detail.views.sheetView[0].showGridLines = True

    detail_header_fill = PatternFill(start_color="0F172A", end_color="0F172A", fill_type="solid")
    detail_header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )

    columns = list(df.columns) if not df.empty else [
        "Invoice ID", "Vendor Name", "Invoice Number", "Invoice Date", "Due Date",
        "Customer / Client", "Subtotal", "Tax Amount", "Total Amount", "Currency",
        "Status", "Manually Corrected", "Created Date", "Approved Date"
    ]

    for col_idx, col_name in enumerate(columns, start=1):
        cell = ws_detail.cell(row=1, column=col_idx, value=col_name)
        cell.fill = detail_header_fill
        cell.font = detail_header_font
        cell.alignment = Alignment(horizontal="center", vertical="center")

    if not df.empty:
        for r_idx, row in df.iterrows():
            current_row = r_idx + 2
            for c_idx, col_name in enumerate(columns, start=1):
                val = row[col_name]
                c = ws_detail.cell(row=current_row, column=c_idx, value=val)
                c.border = thin_border
                
                # Format money columns
                if col_name in ("Subtotal", "Tax Amount", "Total Amount"):
                    c.number_format = "$#,##0.00"
                    c.alignment = Alignment(horizontal="right")
                elif col_name in ("Invoice ID", "Status", "Currency", "Manually Corrected"):
                    c.alignment = Alignment(horizontal="center")
                    if col_name == "Status":
                        if val == "APPROVED":
                            c.fill = PatternFill(start_color="DCFCE7", fill_type="solid")
                            c.font = Font(color="166534", bold=True)
                        elif val == "FLAGGED":
                            c.fill = PatternFill(start_color="FEF3C7", fill_type="solid")
                            c.font = Font(color="92400E", bold=True)
                        elif val == "REJECTED":
                            c.fill = PatternFill(start_color="FEE2E2", fill_type="solid")
                            c.font = Font(color="991B1B", bold=True)

    # Auto-adjust column widths
    for col in ws_detail.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws_detail.column_dimensions[col_letter].width = max(max_len + 4, 12)

    output = io.BytesIO()
    wb.save(output)
    return output.getvalue()

