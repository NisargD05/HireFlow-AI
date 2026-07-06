from typing import Any, Dict, Optional, TypedDict

from langgraph.graph import END, StateGraph

from app.interview.context import (
    build_candidate_context,
    build_interview_kb_query,
    build_jd_context,
    build_ranking_context,
)
from app.interview.schemas import InterviewGenerationRequest, InterviewGenerationState
from app.interview.service import generate_interview_intelligence
from app.interview.validators import request_human_approval, validate_interview_packet
from app.shared.base.graph import increment_retry, should_retry
from app.shared.rag.retriever import retrieve_chunks
from app.shared.schemas.retrieval import RetrievalRequest
from app.shared.tools.hiring_tools import chroma_retrieval_tool, interview_support_search_tool, run_tool_calling_step



class InterviewPacketState(TypedDict):
    payload: InterviewGenerationRequest
    candidate_context: Dict[str, Any]
    jd_context: Dict[str, Any]
    ranking_context: Dict[str, Any]
    retrieval_query: str
    retrieved_docs: list
    tool_results: list
    generation_state: Optional[InterviewGenerationState]
    generated_packet: Dict[str, Any]
    review_passed: bool
    review_feedback: Optional[str]
    retry_count: int
    approval_result: dict
    approved: bool
    final_packet: Dict[str, Any]
    error: Optional[str]


def query_node(state: InterviewPacketState) -> InterviewPacketState:
    candidate_context = build_candidate_context(state["payload"])
    jd_context = build_jd_context(state["payload"])
    ranking_context = build_ranking_context(state["payload"])
    query = build_interview_kb_query(jd_context, ranking_context)
    return {
        **state,
        "candidate_context": candidate_context,
        "jd_context": jd_context,
        "ranking_context": ranking_context,
        "retrieval_query": query,
    }


def retrieve_node(state: InterviewPacketState) -> InterviewPacketState:
    job = state["jd_context"].get("job", {})
    ranking = state["ranking_context"].get("ranking", {})
    tool_results = run_tool_calling_step(
        task="interview_packet_support_retrieval",
        inputs={
            "query": state["retrieval_query"],
            "role_name": job.get("roleName", ""),
            "skills": job.get("skills", ""),
            "mandatory_requirements": job.get("mandatoryRequirements", ""),
            "focus_areas": ", ".join(state["ranking_context"].get("focusAreas", [])),
            "ranking_gaps": ", ".join(ranking.get("weaknesses", []) + ranking.get("missingWithJD", [])),
            "limit": 5,
        },
        tools=[interview_support_search_tool, chroma_retrieval_tool],
        fallback_tool_names=["interview_support_search_tool"],
    )
    retrieved_docs = []
    for result in tool_results:
        retrieved_docs.extend((result.get("output") or {}).get("results", []))

    if retrieved_docs:
        return {**state, "retrieved_docs": retrieved_docs, "tool_results": tool_results}

    results = retrieve_chunks(RetrievalRequest(query=state["retrieval_query"], limit=5)).results
    retrieved_docs = [
        {
            "sourceFileName": result.sourceFileName,
            "chunkText": (result.chunkText or "")[:350],
            "score": result.score,
        }
        for result in results
    ]
    return {**state, "retrieved_docs": retrieved_docs, "tool_results": tool_results}


def context_node(state: InterviewPacketState) -> InterviewPacketState:
    ranking = state["ranking_context"].get("ranking", {})
    generation_state = InterviewGenerationState(
        candidate=state["candidate_context"].get("candidate", {}),
        resume=state["candidate_context"].get("resume", {}),
        ranking=ranking,
        job=state["jd_context"].get("job", {}),
        interview=state["jd_context"].get("interview", {}),
        kbChunks=state["retrieved_docs"],
        focusAreas=state["ranking_context"].get("focusAreas", []),
        generatedQuestions={},
    )
    return {**state, "generation_state": generation_state}


def generate_node(state: InterviewPacketState) -> InterviewPacketState:
    try:
        packet = generate_interview_intelligence(state["generation_state"], state.get("review_feedback") or "")
        return {**state, "generated_packet": packet, "error": None}
    except Exception as error:
        return {**state, "generated_packet": {}, "error": str(error)}


def review_node(state: InterviewPacketState) -> InterviewPacketState:
    try:
        review_passed, review_feedback, packet = validate_interview_packet(state.get("generated_packet") or {})
        generation_state = state["generation_state"]
        if generation_state:
            generation_state.generatedQuestions = packet
            generation_state.focusAreas = packet.get("focusAreas") or generation_state.focusAreas
        return {
            **state,
            "generation_state": generation_state,
            "review_passed": review_passed,
            "review_feedback": review_feedback,
            "final_packet": packet,
            "error": None if review_passed else "Interview packet failed review",
        }
    except Exception as error:
        return {
            **state,
            "review_passed": False,
            "review_feedback": str(error),
            "final_packet": {},
            "error": str(error),
        }


def retry_node(state: InterviewPacketState) -> InterviewPacketState:
    return {**state, "retry_count": increment_retry(state["retry_count"])}


def approval_node(state: InterviewPacketState) -> InterviewPacketState:
    approval = request_human_approval(
        "interview_packet_generation",
        state.get("final_packet") or state.get("generated_packet") or {},
        state["review_passed"],
        state.get("review_feedback") or "",
    )
    return {
        **state,
        "approval_result": approval,
        "approved": bool(approval.get("approved")),
        "review_feedback": approval.get("feedback") or state.get("review_feedback"),
    }


def _should_retry(state: InterviewPacketState) -> str:
    return should_retry(state["approved"], state["retry_count"])


def build_interview_packet_graph():
    graph = StateGraph(InterviewPacketState)
    graph.add_node("query", query_node)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("context", context_node)
    graph.add_node("generate", generate_node)
    graph.add_node("review", review_node)
    graph.add_node("approval", approval_node)
    graph.add_node("retry", retry_node)
    graph.set_entry_point("query")
    graph.add_edge("query", "retrieve")
    graph.add_edge("retrieve", "context")
    graph.add_edge("context", "generate")
    graph.add_edge("generate", "review")
    graph.add_edge("review", "approval")
    graph.add_conditional_edges("approval", _should_retry, {"retry": "retry", "done": END})
    graph.add_edge("retry", "generate")
    return graph.compile()


interview_packet_graph = build_interview_packet_graph()


def run_interview_packet_graph(payload: InterviewGenerationRequest):
    initial_state = InterviewPacketState(
        payload=payload,
        candidate_context={},
        jd_context={},
        ranking_context={},
        retrieval_query="",
        retrieved_docs=[],
        tool_results=[],
        generation_state=None,
        generated_packet={},
        review_passed=False,
        review_feedback=None,
        retry_count=0,
        approval_result={},
        approved=False,
        final_packet={},
        error=None,
    )
    final_state = interview_packet_graph.invoke(initial_state)
    if not final_state.get("final_packet"):
        raise RuntimeError(final_state.get("error") or "Interview packet graph did not produce output")
    return final_state
