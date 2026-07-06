def should_retry(review_passed: bool, retry_count: int, max_retries: int = 2) -> str:
    if not review_passed and retry_count < max_retries:
        return "retry"
    return "done"


def increment_retry(retry_count: int) -> int:
    return retry_count + 1
