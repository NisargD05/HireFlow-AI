from typing import List, Optional, TypedDict

from langgraph.graph import END, StateGraph

from app.jd.parser import review_job_description
from app.jd.schemas import GenerateJDRequest
from app.jd.service import prepare_context, prepare_query, write_job_description
from app.jd.validators import validate_jd_sections
from app.shared.base.graph import increment_retry, should_retry
from app.shared.tools.hiring_tools import chroma_retrieval_tool, jd_context_search_tool, run_tool_calling_step


class JDGenerationState(TypedDict):
    payload: GenerateJDRequest
    job_input: dict
    knowledge_context: list
    retrieval_query: str
    retrieved_docs: List[dict]
    tool_results: List[dict]
    formatted_context: str
    generated_jd: str
    review_passed: bool
    review_feedback: Optional[str]
    retry_count: int
    final_jd: str
    error: Optional[str]


def query_node(state: JDGenerationState) -> JDGenerationState:
    query = prepare_query(state["payload"])
    return {**state, "retrieval_query": query}


def retrieve_node(state: JDGenerationState) -> JDGenerationState:
    job = state["payload"].jobDetails
    tool_results = run_tool_calling_step(
        task="job_description_context_retrieval",
        inputs={
            "query": state["retrieval_query"],
            "role_name": job.roleName,
            "department": job.department or "",
            "skills": job.skills or "",
            "mandatory_requirements": job.mandatoryRequirements or "",
            "seniority_level": job.seniorityLevel or "",
            "limit": 6,
        },
        tools=[jd_context_search_tool, chroma_retrieval_tool],
        fallback_tool_names=["jd_context_search_tool"],
    )
    retrieved_docs = []
    for result in tool_results:
        retrieved_docs.extend((result.get("output") or {}).get("results", []))

    if not retrieved_docs:
        retrieved_docs = [item.model_dump() for item in state["payload"].knowledgeContext]

    return {**state, "retrieved_docs": retrieved_docs, "tool_results": tool_results}


def context_node(state: JDGenerationState) -> JDGenerationState:
    return {**state, "formatted_context": prepare_context(state["retrieved_docs"])}


def write_jd_node(state: JDGenerationState) -> JDGenerationState:
    try:
        draft = write_job_description(
            state["payload"].jobDetails,
            state["formatted_context"],
            state.get("review_feedback") or "",
        )
        return {**state, "generated_jd": draft}
    except Exception as error:
        return {**state, "generated_jd": "", "error": str(error)}


def review_node(state: JDGenerationState) -> JDGenerationState:
    reviewed = review_job_description(state["generated_jd"])
    review_passed, review_feedback = validate_jd_sections(state["generated_jd"])
    return {
        **state,
        "review_passed": review_passed,
        "review_feedback": review_feedback,
        "final_jd": reviewed,
    }


def _should_retry(state: JDGenerationState) -> str:
    return should_retry(state["review_passed"], state["retry_count"])


def retry_node(state: JDGenerationState) -> JDGenerationState:
    return {**state, "retry_count": increment_retry(state["retry_count"])}


def build_jd_graph():
    graph = StateGraph(JDGenerationState)
    graph.add_node("query", query_node)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("context", context_node)
    graph.add_node("write", write_jd_node)
    graph.add_node("review", review_node)
    graph.add_node("retry", retry_node)
    graph.set_entry_point("query")
    graph.add_edge("query", "retrieve")
    graph.add_edge("retrieve", "context")
    graph.add_edge("context", "write")
    graph.add_edge("write", "review")
    graph.add_conditional_edges("review", _should_retry, {"retry": "retry", "done": END})
    graph.add_edge("retry", "write")
    return graph.compile()


jd_graph = build_jd_graph()


def run_jd_generation_graph(payload: GenerateJDRequest):
    initial_state = JDGenerationState(
        payload=payload,
        job_input=payload.jobDetails.model_dump(),
        knowledge_context=[item.model_dump() for item in payload.knowledgeContext],
        retrieval_query="",
        retrieved_docs=[],
        tool_results=[],
        formatted_context="",
        generated_jd="",
        review_passed=False,
        review_feedback=None,
        retry_count=0,
        final_jd="",
        error=None,
    )
    return jd_graph.invoke(initial_state)
