from pathlib import Path


def ensure_directory(path: str):
    Path(path).mkdir(parents=True, exist_ok=True)
