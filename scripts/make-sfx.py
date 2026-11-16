"""Synthesises the journey page's UI sound effects as mono 48 kHz WAV files.

Every effect is one shaped event (no repeated taps), tonal rather than noisy,
and normalised to the same loudness ceiling. Run: python scripts/make-sfx.py
"""
import math, struct, wave, os

RATE = 48000
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sfx")


def env(t, attack, tau):
    """A fast attack, then an exponential decay."""
    return min(1.0, t / attack) * math.exp(-max(0.0, t - attack) / tau)


def render(name, length, voice):
    n = int(RATE * length)
    data = [voice(i / RATE) for i in range(n)]
    fade = int(RATE * 0.006)  # short release so the file never ends on a click
    for i in range(fade):
        data[n - 1 - i] *= i / fade
    peak = max(abs(v) for v in data) or 1
    data = [v / peak * 0.7 for v in data]  # -3 dB ceiling for every effect
    with wave.open(os.path.join(OUT, f"sfx_{name}.wav"), "wb") as w:
        w.setnchannels(1)  # mono
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(v * 32767)) for v in data))


def ui_click(t):
    # A clean, slightly musical tick: a bright partial over a softer octave below.
    return (math.sin(2 * math.pi * 2100 * t) * env(t, 0.0008, 0.008)
            + 0.5 * math.sin(2 * math.pi * 1050 * t) * env(t, 0.001, 0.014))


def ui_big_click(t):
    # A rounder "tock" for important actions: a pitched body that drops a little, with a crisp edge.
    phase = 2 * math.pi * (440 * t + 90 * 0.02 * (1 - math.exp(-t / 0.02)))
    return (math.sin(phase) * env(t, 0.002, 0.042)
            + 0.35 * math.sin(2 * math.pi * 1320 * t) * env(t, 0.001, 0.02)
            + 0.45 * math.sin(2 * math.pi * 2600 * t) * env(t, 0.0005, 0.004))


def ui_click_data(t):
    # An explicitly digital click: a band-limited square blip with a quick upward step.
    f = 2800 if t < 0.012 else 3700
    square = sum(math.sin(2 * math.pi * f * k * t) / k for k in (1, 3, 5))
    return square * env(t, 0.0005, 0.009)


def ui_pop(t):
    # The catch at the top of an overshoot: a bubble that rises in pitch, with a soft low thump.
    sweep = 380 * (980 / 380) ** min(1.0, t / 0.035)
    phase = 2 * math.pi * (380 * 0.035 / math.log(980 / 380)) * ((980 / 380) ** min(1.0, t / 0.035) - 1) if t < 0.035 \
        else 2 * math.pi * (380 * 0.035 / math.log(980 / 380)) * (980 / 380 - 1) + 2 * math.pi * 980 * (t - 0.035)
    return (math.sin(phase) * env(t, 0.003, 0.055)
            + 0.4 * math.sin(2 * math.pi * 140 * t) * env(t, 0.002, 0.03))


os.makedirs(OUT, exist_ok=True)
render("ui_click", 0.06, ui_click)
render("ui_big_click", 0.16, ui_big_click)
render("ui_click_data", 0.05, ui_click_data)
render("ui_pop", 0.2, ui_pop)
print("sfx written:", len(os.listdir(OUT)), "files")
