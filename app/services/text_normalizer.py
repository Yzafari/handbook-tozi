"""Text normalizer service for Persian and Kurdish text."""
def normalize_persian(text: str) -> str:
    if not text:
        return ""
    return text.replace('ي', 'ی').replace('ك', 'ک')
