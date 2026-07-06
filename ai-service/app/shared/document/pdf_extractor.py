from pypdf import PdfReader


def _extract_with_pdfplumber(file_path: str) -> str:
    import pdfplumber

    text_parts = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            text_parts.append(page.extract_text() or "")
    return "\n".join(text_parts)


def _extract_with_pypdf(file_path: str) -> str:
    reader = PdfReader(file_path)
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_pdf_text(file_path: str) -> str:
    try:
        text = _extract_with_pdfplumber(file_path)
        if text.strip():
            return text
    except Exception:
        pass

    try:
        text = _extract_with_pypdf(file_path)
        if text.strip():
            return text
    except Exception:
        raise

    raise ValueError("No extractable text found in PDF")