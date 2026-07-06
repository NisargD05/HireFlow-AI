import json

from langchain_core.output_parsers import JsonOutputParser

from app.interview.parser import parse_interview_packet
from app.interview.prompts import (
    build_interview_prompt_payload,
    build_interview_question_prompt,
    interview_question_prompt_template,
    interview_question_retry_prompt_template,
)
from app.interview.schemas import InterviewGenerationState, InterviewQuestionPacket
from app.shared.llm.gemini_client import get_llm
from app.shared.llm.invoker import invoke_chain_with_model_fallback
from app.shared.models.llm_output import InterviewPacketOutput


def build_interview_question_chain(temperature=0.2, model_name=None):
    parser = JsonOutputParser(pydantic_object=InterviewPacketOutput)
    return interview_question_prompt_template | get_llm(temperature=temperature, model_name=model_name, max_output_tokens=4096) | parser


def build_interview_question_retry_chain(model_name=None):
    parser = JsonOutputParser(pydantic_object=InterviewPacketOutput)
    return interview_question_retry_prompt_template | get_llm(temperature=0, model_name=model_name, max_output_tokens=4096) | parser


def _normalize_packet(parsed):
    validated = InterviewQuestionPacket(**(parsed or {}))
    return validated.model_dump(exclude_none=True)


def generate_interview_intelligence(state: InterviewGenerationState, review_feedback: str = ""):
    payload = build_interview_prompt_payload(state)
    payload_json = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))

    try:
        if review_feedback:
            parsed = invoke_chain_with_model_fallback(
                lambda model_name: build_interview_question_retry_chain(model_name=model_name),
                {
                    "payload_json": payload_json,
                    "validation_error": review_feedback,
                    "raw_output_preview": json.dumps(state.generatedQuestions or {}, ensure_ascii=True)[:900],
                },
                label="interview_packet_retry",
            )
        else:
            parsed = invoke_chain_with_model_fallback(
                lambda model_name: build_interview_question_chain(model_name=model_name),
                {"payload_json": payload_json},
                label="interview_packet",
            )
        packet = _normalize_packet(parsed)
        packet["rawModelOutput"] = {"modelOutput": json.dumps(parsed, ensure_ascii=True)[:2000]}
    except Exception as error:
        retry_payload = {
            "payload_json": payload_json,
            "validation_error": str(error),
            "raw_output_preview": "",
        }
        try:
            retry_parsed = build_interview_question_retry_chain().invoke(retry_payload)
            packet = _normalize_packet(retry_parsed)
            packet["rawModelOutput"] = {"modelOutput": json.dumps(retry_parsed, ensure_ascii=True)[:2000]}
        except Exception:
            raw_prompt_output = build_interview_question_prompt(state)
            packet = parse_interview_packet(
                json.dumps(
                    {
                        "focusAreas": state.focusAreas,
                        "technicalQuestions": [],
                        "followUpQuestions": [],
                        "weaknessProbes": [],
                        "behavioralQuestions": [],
                        "systemDesignQuestions": [],
                        "evaluationChecklist": [],
                        "interviewerNotes": [],
                        "rawModelOutput": {"modelOutput": raw_prompt_output[:2000]},
                    }
                )
            )
    return packet
