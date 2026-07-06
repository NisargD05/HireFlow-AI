from __future__ import annotations

from typing import Any, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from app.shared.llm.gemini_client import get_llm
from app.shared.llm.invoker import is_quota_or_rate_limit_error, model_candidates
from app.shared.rag.retriever import retrieve_chunks
from app.shared.schemas.retrieval import RetrievalRequest

def _as_results(response, limit: int) -> List[Dict[str, Any]]:
    return [
        {
            "sourceFileName": result.sourceFileName,
            "chunkText": result.chunkText or "",
            "score": result.score,
        }
        for result in response.results[:limit]
    ]

def _search_chroma(query: str, limit: int = 5) -> Dict[str, Any]:
    clean_query = (query or "").strip()
    safe_limit = max(1, min(int(limit or 5), 8))
    if not clean_query:
        return {"query": "", "results": []}

    response = retrieve_chunks(RetrievalRequest(query=clean_query, limit=safe_limit))
    return {"query": response.query, "results": _as_results(response, safe_limit)}

@tool
def chroma_retrieval_tool(query: str, limit: int = 5) -> Dict[str, Any]:
    """Search the Chroma company knowledge base for a semantic hiring query."""

    return _search_chroma(query, limit)

@tool
def jd_context_search_tool(
    role_name: str,
    department: str = "",
    skills: str = "",
    mandatory_requirements: str = "",
    seniority_level: str = "",
    limit: int = 6,
) -> Dict[str, Any]:
    """Retrieve company knowledge needed to draft a job description."""

    query = " ".join(
        value
        for value in [
            role_name,
            department,
            skills,
            seniority_level,
            mandatory_requirements,
            "job description responsibilities qualifications hiring standards",
        ]
        if value
    )
    return _search_chroma(query, limit)

@tool
def candidate_support_search_tool(
    candidate_name: str = "",
    role_name: str = "",
    resume_summary: str = "",
    required_skills: str = "",
    mandatory_requirements: str = "",
    limit: int = 5,
) -> Dict[str, Any]:
    """Retrieve company hiring guidance that supports candidate ranking."""

    query = " ".join(
        value
        for value in [
            role_name,
            required_skills,
            mandatory_requirements,
            resume_summary[:500],
            candidate_name,
            "candidate evaluation ranking rubric hiring standards",
        ]
        if value
    )
    return _search_chroma(query, limit)

@tool
def interview_support_search_tool(
    role_name: str = "",
    skills: str = "",
    focus_areas: str = "",
    ranking_gaps: str = "",
    mandatory_requirements: str = "",
    limit: int = 5,
) -> Dict[str, Any]:
    """Retrieve company guidance for interview packet generation."""

    query = " ".join(
        value
        for value in [
            role_name,
            skills,
            mandatory_requirements,
            focus_areas,
            ranking_gaps,
            "interview questions evaluation checklist technical screen",
        ]
        if value
    )
    return _search_chroma(query, limit)

def _tool_args_for(tool_name: str, inputs: Dict[str, Any]) -> Dict[str, Any]:
    if tool_name == "chroma_retrieval_tool":
        return {"query": inputs.get("query", ""), "limit": inputs.get("limit", 5)}
    if tool_name == "jd_context_search_tool":
        return {
            "role_name": inputs.get("role_name", ""),
            "department": inputs.get("department", ""),
            "skills": inputs.get("skills", ""),
            "mandatory_requirements": inputs.get("mandatory_requirements", ""),
            "seniority_level": inputs.get("seniority_level", ""),
            "limit": inputs.get("limit", 6),
        }
    if tool_name == "candidate_support_search_tool":
        return {
            "candidate_name": inputs.get("candidate_name", ""),
            "role_name": inputs.get("role_name", ""),
            "resume_summary": inputs.get("resume_summary", ""),
            "required_skills": inputs.get("required_skills", ""),
            "mandatory_requirements": inputs.get("mandatory_requirements", ""),
            "limit": inputs.get("limit", 5),
        }
    if tool_name == "interview_support_search_tool":
        return {
            "role_name": inputs.get("role_name", ""),
            "skills": inputs.get("skills", ""),
            "focus_areas": inputs.get("focus_areas", ""),
            "ranking_gaps": inputs.get("ranking_gaps", ""),
            "mandatory_requirements": inputs.get("mandatory_requirements", ""),
            "limit": inputs.get("limit", 5),
        }
    return {}

def _invoke_tool(tool_by_name, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
    selected_tool = tool_by_name[tool_name]
    output = selected_tool.invoke(args)
    return {"tool": tool_name, "args": args, "output": output}

def _fallback_calls(fallback_tool_names: List[str], inputs: Dict[str, Any], tool_by_name) -> List[Dict[str, Any]]:
    calls = []
    for tool_name in fallback_tool_names:
        if tool_name in tool_by_name:
            calls.append(_invoke_tool(tool_by_name, tool_name, _tool_args_for(tool_name, inputs)))
    return calls

def run_tool_calling_step(
    *,
    task: str,
    inputs: Dict[str, Any],
    tools: List[Any],
    fallback_tool_names: List[str],
) -> List[Dict[str, Any]]:
    tool_by_name = {candidate.name: candidate for candidate in tools}
    for model_name in model_candidates():
        try:
            tool_llm = get_llm(temperature=0, model_name=model_name).bind_tools(tools)
            response = tool_llm.invoke(
                [
                    SystemMessage(
                        content=(
                            "You are a hiring workflow tool router. Decide which available tools are needed. "
                            "Call only tools that provide useful external or knowledge-base context."
                        )
                    ),
                    HumanMessage(content=f"Task: {task}\nInputs: {inputs}"),
                ]
            )
            tool_calls = getattr(response, "tool_calls", []) or []
            if not tool_calls:
                return _fallback_calls(fallback_tool_names, inputs, tool_by_name)

            calls = []
            for tool_call in tool_calls:
                tool_name = tool_call.get("name")
                if tool_name in tool_by_name:
                    calls.append(_invoke_tool(tool_by_name, tool_name, tool_call.get("args") or {}))
            return calls or _fallback_calls(fallback_tool_names, inputs, tool_by_name)
        except Exception as error:
            if is_quota_or_rate_limit_error(error):
                continue
            return _fallback_calls(fallback_tool_names, inputs, tool_by_name)

    return _fallback_calls(fallback_tool_names, inputs, tool_by_name)