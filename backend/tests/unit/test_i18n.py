import pytest

from app.core.i18n import negotiate_language


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("es-ES,es;q=0.9,en;q=0.8", "es"),
        ("en-GB,en;q=0.9", "en"),
        ("es", "es"),
        ("fr-FR, es;q=0.5", "es"),
        ("en;q=0.4, es;q=0.6", "es"),
        ("es;q=0, en", "en"),
        ("fr, de", "en"),
        ("", "en"),
        (None, "en"),
        ("es;q=abc", "en"),
    ],
)
def test_negotiates_the_best_supported_language(header, expected):
    assert negotiate_language(header) == expected
