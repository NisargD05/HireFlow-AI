from app.interview.graph import run_interview_packet_graph
from app.interview.schemas import InterviewGenerationRequest, InterviewGenerationResponse


def generate_interview_question_packet(payload: InterviewGenerationRequest) -> InterviewGenerationResponse:
    graph_state = run_interview_packet_graph(payload)
    final_state = graph_state["generation_state"]
    return InterviewGenerationResponse(
        success=True,
        packet=graph_state["final_packet"],
        state=final_state.model_dump(exclude_none=True),
    )
