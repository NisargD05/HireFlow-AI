def chunk_text(text: str, chunk_size: int = 1200):
    normalized = " ".join((text or "").split())
    return [normalized[index : index + chunk_size] for index in range(0, len(normalized), chunk_size)]
