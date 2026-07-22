import re
from fpdf import FPDF

SRC = "docs/RentZilla-Full-Features-and-Services.md"
OUT = "docs/RentZilla-Full-Features-and-Services.pdf"

ORANGE = (255, 122, 24)
DARK = (40, 40, 40)
GREY = (100, 100, 100)
LIGHT = (250, 244, 238)


def clean(s):
    s = s.replace("**", "").replace("`", "")
    s = re.sub(r"\*(.+?)\*", r"\1", s)
    s = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", s)
    # replace chars outside latin-1
    repl = {"—": "-", "–": "-", "→": "->", "·": "-", "…": "...",
            "①": "(1)", "②": "(2)", "③": "(3)", "④": "(4)", "⑤": "(5)", "⑥": "(6)",
            "“": '"', "”": '"', "‘": "'", "’": "'"}
    for k, v in repl.items():
        s = s.replace(k, v)
    return s.encode("latin-1", "replace").decode("latin-1")


class PDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GREY)
        self.cell(0, 6, "RentZilla - Full Features, Dependencies & Services", align="R")
        self.ln(8)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*GREY)
        self.cell(0, 6, f"Page {self.page_no()}", align="C")


pdf = PDF(format="A4")
pdf.set_auto_page_break(auto=True, margin=16)
pdf.set_margins(16, 14, 16)
pdf.add_page()

lines = open(SRC).read().split("\n")
i = 0
first_h1 = True
while i < len(lines):
    line = lines[i].rstrip()

    if line.startswith("# "):
        pdf.set_fill_color(*ORANGE)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 18)
        pdf.multi_cell(0, 12, clean(line[2:]), fill=True)
        pdf.ln(3)
        first_h1 = False
    elif line.startswith("## "):
        pdf.ln(2)
        pdf.set_text_color(*ORANGE)
        pdf.set_font("Helvetica", "B", 14)
        pdf.multi_cell(0, 8, clean(line[3:]))
        pdf.set_draw_color(*ORANGE)
        pdf.set_line_width(0.4)
        y = pdf.get_y()
        pdf.line(16, y, 194, y)
        pdf.ln(3)
    elif line.startswith("### "):
        pdf.ln(1)
        pdf.set_text_color(*DARK)
        pdf.set_font("Helvetica", "B", 11.5)
        pdf.multi_cell(0, 7, clean(line[4:]))
        pdf.ln(1)
    elif line.startswith("|"):
        # collect table
        tbl = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
            if not set("".join(row)) <= set("-: "):
                tbl.append([clean(c) for c in row])
            i += 1
        i -= 1
        ncols = max(len(r) for r in tbl)
        widths = [178 / ncols] * ncols
        if ncols == 3:
            widths = [45, 88, 45]
        elif ncols == 2:
            widths = [55, 123]
        pdf.set_font("Helvetica", "", 9)
        for ridx, row in enumerate(tbl):
            row = row + [""] * (ncols - len(row))
            if ridx == 0:
                pdf.set_font("Helvetica", "B", 9)
                pdf.set_fill_color(*ORANGE)
                pdf.set_text_color(255, 255, 255)
            else:
                pdf.set_font("Helvetica", "", 9)
                pdf.set_fill_color(*(LIGHT if ridx % 2 else (255, 255, 255)))
                pdf.set_text_color(*DARK)
            # compute row height
            hts = []
            for c, w in zip(row, widths):
                n = len(pdf.multi_cell(w, 5, c, dry_run=True, output="LINES"))
                hts.append(n * 5)
            h = max(hts) + 2
            if pdf.get_y() + h > 281:
                pdf.add_page()
            x0, y0 = pdf.get_x(), pdf.get_y()
            for c, w in zip(row, widths):
                x = pdf.get_x()
                pdf.multi_cell(w, 5, c, fill=True, new_x="RIGHT", new_y="TOP", max_line_height=5)
                pdf.set_xy(x + w, y0)
            pdf.set_xy(x0, y0 + h - 2)
            pdf.ln(2)
        pdf.ln(2)
    elif line.startswith("- "):
        pdf.set_text_color(*DARK)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_x(20)
        pdf.multi_cell(174, 5.5, chr(149) + " " + clean(line[2:]))
    elif re.match(r"^\d+\. ", line):
        pdf.set_text_color(*DARK)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_x(20)
        pdf.multi_cell(174, 5.5, clean(line))
    elif line.strip() == "---":
        pdf.ln(2)
    elif line.startswith("*") and line.endswith("*") and not line.startswith("**"):
        pdf.set_text_color(*GREY)
        pdf.set_font("Helvetica", "I", 10.5)
        pdf.multi_cell(0, 6, clean(line.strip("*")))
        pdf.ln(1)
    elif line.strip():
        pdf.set_text_color(*DARK)
        bold_lead = re.match(r"^\*\*(.+?):\*\*(.*)$", line) or re.match(r"^\*\*(.+?)\*\*(.*)$", line)
        if bold_lead:
            pdf.set_font("Helvetica", "B", 10)
            pdf.write(5.5, clean(bold_lead.group(1)) + ("" if bold_lead.group(0).find(":**") < 0 else ":"))
            pdf.set_font("Helvetica", "", 10)
            pdf.write(5.5, clean(bold_lead.group(2)))
            pdf.ln(6.5)
        else:
            pdf.set_font("Helvetica", "", 10)
            pdf.multi_cell(0, 5.5, clean(line))
        pdf.ln(0.5)
    i += 1

pdf.output(OUT)
print("Wrote", OUT)
