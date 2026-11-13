"""Test text normalizer service."""
from app.services.text_normalizer import normalize_persian

def test_normalize():
    assert normalize_persian('كرمان') == 'کرمان'
