from typing import Literal, get_args

Language = Literal["en", "es"]
SUPPORTED_LANGUAGES: tuple[Language, ...] = get_args(Language)
DEFAULT_LANGUAGE: Language = "en"


def negotiate_language(header: str | None) -> Language:
    ranked: list[tuple[float, int, Language]] = []
    for position, part in enumerate((header or "").split(",")):
        tag, *params = part.strip().split(";")
        primary = tag.strip().lower().split("-")[0]
        if primary not in SUPPORTED_LANGUAGES:
            continue
        quality = 1.0
        for param in params:
            name, _, value = param.strip().partition("=")
            if name == "q":
                try:
                    quality = float(value)
                except ValueError:
                    quality = 0.0
        if quality > 0:
            ranked.append((-quality, position, primary))
    return min(ranked)[2] if ranked else DEFAULT_LANGUAGE
