from app.ranking.graph import run_candidate_ranking_graph


def rank_candidate_against_job(payload):
    state = run_candidate_ranking_graph(payload)
    return state["final_output"]
