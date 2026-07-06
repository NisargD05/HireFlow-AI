import json
from typing import Any, Dict, Optional, TypedDict

from langgraph.graph import END, StateGraph

from app.ranking.context import build_candidate_context, build_candidate_kb_query
from app.ranking.parser import parse_and_validate_ranking
from app.ranking.prompts import build_candidate_ranking_payload
from app.ranking.schemas import CandidateRankingRequest
from app.ranking.chains import build_ranking_chain, build_ranking_retry_chain
from app.shared.base.graph import increment_retry, should_retry
from app.shared.llm.invoker import invoke_chain_with_model_fallback
from app.shared.tools.hiring_tools import candidate_support_search_tool, chroma_retrieval_tool, run_tool_calling_step


class CandidateRankingState(TypedDict):
    payload: CandidateRankingRequest
    retrieval_query: str
    retrieved_docs: list
    tool_results: list
    formatted_context: Dict[str, Any]
    prompt_payload: Dict[str, Any]
    payload_json: str
    generated_output: Any
    raw_output: str
    retry_count: int
    review_passed: bool
    review_feedback: Optional[str]
    final_output: Dict[str, Any]
    error: Optional[str]


def query_node(state: CandidateRankingState) -> CandidateRankingState:
    query = build_candidate_kb_query(state["payload"].job)
    return {**state, "retrieval_query": query}


def retrieve_node(state: CandidateRankingState) -> CandidateRankingState:
    payload = state["payload"]
    tool_results = run_tool_calling_step(
        task="candidate_ranking_support_retrieval",
        inputs={
            "query": state["retrieval_query"],
            "candidate_name": payload.candidate.name,
            "role_name": payload.job.roleName,
            "resume_summary": payload.resume.resumeText[:900],
            "required_skills": payload.job.requiredSkills or "",
            "mandatory_requirements": payload.job.mandatoryRequirements or "",
            "limit": 5,
        },
        tools=[candidate_support_search_tool, chroma_retrieval_tool],
        fallback_tool_names=["candidate_support_search_tool"],
    )
    retrieved_docs = []
    for result in tool_results:
        retrieved_docs.extend((result.get("output") or {}).get("results", []))
    context = build_candidate_context(payload, kb_chunks=retrieved_docs, retrieval_query=state["retrieval_query"])
    return {
        **state,
        "formatted_context": context,
        "retrieved_docs": context.get("companyContext", []),
        "tool_results": tool_results,
        "retrieval_query": context.get("retrievalQuery") or state["retrieval_query"],
    }


def context_node(state: CandidateRankingState) -> CandidateRankingState:
    prompt_payload = build_candidate_ranking_payload(state["formatted_context"])
    payload_json = json.dumps(prompt_payload, ensure_ascii=True, separators=(",", ":"))
    return {
        **state,
        "prompt_payload": prompt_payload,
        "payload_json": payload_json,
    }


def rank_node(state: CandidateRankingState) -> CandidateRankingState:
    try:
        parsed = invoke_chain_with_model_fallback(
            lambda model_name: build_ranking_chain(model_name=model_name),
            {"payload_json": state["payload_json"]},
            label="candidate_ranking",
        )
        return {
            **state,
            "generated_output": parsed,
            "raw_output": json.dumps(parsed, ensure_ascii=True),
            "error": None,
        }
    except Exception as error:
        return {**state, "generated_output": None, "error": str(error)}


def retry_node(state: CandidateRankingState) -> CandidateRankingState:
    retry_count = increment_retry(state["retry_count"])
    try:
        parsed = invoke_chain_with_model_fallback(
            lambda model_name: build_ranking_retry_chain(model_name=model_name),
            {
                "payload_json": state["payload_json"],
                "validation_error": state.get("review_feedback") or state.get("error") or "Unknown validation error",
                "raw_output_preview": state.get("raw_output", "")[:700],
            },
            label="candidate_ranking_retry",
        )
        return {
            **state,
            "retry_count": retry_count,
            "generated_output": parsed,
            "raw_output": json.dumps(parsed, ensure_ascii=True),
            "error": None,
        }
    except Exception as error:
        return {**state, "retry_count": retry_count, "error": str(error)}


def validate_node(state: CandidateRankingState) -> CandidateRankingState:
    try:
        parsed = parse_and_validate_ranking(state["generated_output"])
        parsed["companyContext"] = state["formatted_context"].get("companyContext", [])
        parsed["rawModelOutput"] = {
            "modelOutput": state.get("raw_output", "")[:2000],
            "retrievalQuery": state["retrieval_query"],
        }
        return {
            **state,
            "review_passed": True,
            "review_feedback": None,
            "final_output": parsed,
            "error": None,
        }
    except Exception as error:
        return {
            **state,
            "review_passed": False,
            "review_feedback": str(error),
            "final_output": {},
            "error": str(error),
        }


def _should_retry(state: CandidateRankingState) -> str:
    return should_retry(state["review_passed"], state["retry_count"])


def build_candidate_ranking_graph():
    graph = StateGraph(CandidateRankingState)
    graph.add_node("query", query_node)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("context", context_node)
    graph.add_node("rank", rank_node)
    graph.add_node("validate", validate_node)
    graph.add_node("retry", retry_node)
    graph.set_entry_point("query")
    graph.add_edge("query", "retrieve")
    graph.add_edge("retrieve", "context")
    graph.add_edge("context", "rank")
    graph.add_edge("rank", "validate")
    graph.add_conditional_edges("validate", _should_retry, {"retry": "retry", "done": END})
    graph.add_edge("retry", "validate")
    return graph.compile()


candidate_ranking_graph = build_candidate_ranking_graph()


def run_candidate_ranking_graph(payload: CandidateRankingRequest):
    initial_state = CandidateRankingState(
        payload=payload,
        retrieval_query="",
        retrieved_docs=[],
        tool_results=[],
        formatted_context={},
        prompt_payload={},
        payload_json="",
        generated_output=None,
        raw_output="",
        retry_count=0,
        review_passed=False,
        review_feedback=None,
        final_output={},
        error=None,
    )
    final_state = candidate_ranking_graph.invoke(initial_state)
    if not final_state.get("final_output"):
        raise RuntimeError(final_state.get("error") or "Candidate ranking graph did not produce output")
    return final_state
