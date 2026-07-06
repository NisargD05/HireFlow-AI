FORBIDDEN_SECTION_PREFIXES = (
    "company-specific context used",
    "knowledge base context",
    "retrieved context",
    "source documents",
    "sources used",
    "rag metadata",
)

REQUIRED_JD_SECTIONS = [
    "Role Summary",
    "Responsibilities",
    "Required Qualifications",
    "Preferred Qualifications",
    "Job Details",
    "Mandatory Requirements",
]


def parse_jd_output(raw_text: str) -> str:
    return (raw_text or "").strip()


def remove_internal_context(job_description: str) -> str:
    cleaned = []
    skipping = False

    for line in job_description.splitlines():
        stripped = line.strip()
        heading_text = stripped.lstrip("#").strip().rstrip(":").lower()
        is_heading = stripped.startswith("#") or stripped.endswith(":")

        if any(heading_text.startswith(prefix) for prefix in FORBIDDEN_SECTION_PREFIXES):
            skipping = True
            continue

        if skipping and is_heading:
            skipping = False

        if skipping:
            continue

        cleaned.append(line)

    return "\n".join(cleaned).strip()


def find_missing_sections(job_description: str) -> list[str]:
    draft = job_description or ""
    return [section for section in REQUIRED_JD_SECTIONS if section.lower() not in draft.lower()]


def review_job_description(job_description: str) -> str:
    job_description = remove_internal_context(job_description)
    missing_sections = find_missing_sections(job_description)

    if not missing_sections:
        return job_description

    missing_text = "\n".join(f"## {section}\n- To be refined by recruiter." for section in missing_sections)
    return f"{job_description.rstrip()}\n\n{missing_text}\n"
