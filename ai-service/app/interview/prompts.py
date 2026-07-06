import json

from langchain_core.prompts import ChatPromptTemplate

from app.interview.schemas import InterviewGenerationState


SYSTEM_PROMPT = """You are InterviewQuestionAgent, a senior technical interviewer copilot.
Generate contextual interview question packets using resume evidence, ranking gaps, approved JD expectations, and company hiring knowledge.
Do not generate generic trivia. Every question must be tied to the candidate, role, gap, project, or hiring standard.
Return strict valid JSON only. No markdown, prose, comments, or code fences."""


interview_question_prompt_template = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        ("human", "Generate the interview packet:\n{payload_json}"),
    ]
)


interview_question_retry_prompt_template = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        (
            "human",
            "Generate the interview packet:\n{payload_json}\n\nThe previous response was invalid or incomplete. Return a complete strict JSON object only. Validation error: {validation_error}. Invalid output preview: {raw_output_preview}",
        ),
    ]
)


def build_interview_prompt_payload(state: InterviewGenerationState):
    return {
        "candidate": state.candidate,
        "resume": state.resume,
        "ranking": state.ranking,
        "job": state.job,
        "interview": state.interview,
        "companyHiringContext": state.kbChunks,
        "initialFocusAreas": state.focusAreas,
        "requiredOutputSchema": {
            "focusAreas": ["5 concise focus areas"],
            "technicalQuestions": [{"question": "string", "whyAsk": "string", "strongSignal": "string"}],
            "followUpQuestions": [{"question": "string", "whyAsk": "string", "strongSignal": "string"}],
            "weaknessProbes": [{"question": "string", "whyAsk": "string", "strongSignal": "string"}],
            "behavioralQuestions": [{"question": "string", "whyAsk": "string", "strongSignal": "string"}],
            "systemDesignQuestions": [{"question": "string", "whyAsk": "string", "strongSignal": "string"}],
            "evaluationChecklist": ["8 concrete checklist items"],
            "interviewerNotes": ["5 short practical notes"],
        },
        "constraints": [
            "Use 4 technical questions.",
            "Use 3 follow-up questions.",
            "Use 3 weakness probes.",
            "Use 3 behavioral questions.",
            "Use 2 system design questions.",
            "Keep each question under 180 characters.",
            "Mention specific weak areas where useful.",
        ],
    }


def build_interview_question_prompt(state: InterviewGenerationState) -> str:
    payload = build_interview_prompt_payload(state)
    return f"{SYSTEM_PROMPT}\n\nGenerate the interview packet:\n{json.dumps(payload, ensure_ascii=True, separators=(',', ':'))}"
