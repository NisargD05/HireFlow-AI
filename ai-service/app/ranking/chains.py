from langchain_core.output_parsers import JsonOutputParser

from app.ranking.prompts import candidate_ranking_prompt_template, candidate_ranking_retry_prompt_template
from app.shared.llm.gemini_client import get_llm
from app.shared.models.llm_output import CandidateRankingOutput


def build_ranking_chain(temperature=0.1, model_name=None):
    parser = JsonOutputParser(pydantic_object=CandidateRankingOutput)
    return candidate_ranking_prompt_template | get_llm(temperature=temperature, model_name=model_name, max_output_tokens=4096) | parser


def build_ranking_retry_chain(model_name=None):
    parser = JsonOutputParser(pydantic_object=CandidateRankingOutput)
    return candidate_ranking_retry_prompt_template | get_llm(temperature=0, model_name=model_name, max_output_tokens=4096) | parser
