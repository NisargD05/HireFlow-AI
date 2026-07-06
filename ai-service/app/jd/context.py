def build_retrieval_query(job_details) -> str:
    return " ".join(
        value
        for value in [
            job_details.roleName,
            job_details.department,
            job_details.skills,
            job_details.seniorityLevel,
            job_details.mandatoryRequirements,
        ]
        if value
    )


def format_context(context_items) -> str:
    return "\n\n".join(
        item.get("chunkText", item.get("text", str(item))) if isinstance(item, dict) else str(item)
        for item in (context_items or [])
        if item
    )
