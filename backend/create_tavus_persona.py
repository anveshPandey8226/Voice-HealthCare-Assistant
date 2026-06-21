import httpx
import os
import json

TAVUS_API_KEY = "443f64c844d6499bb3b8b3eaa6401313"

def main():
    if not TAVUS_API_KEY:
        raise SystemExit("Set TAVUS_API_KEY env var first")

    resp = httpx.post(
        "https://tavusapi.com/v2/personas",
        headers={
            "x-api-key": TAVUS_API_KEY,
            "Content-Type": "application/json",
        },
        json={
            "persona_name": "My Persona",
            "pipeline_mode": "echo",
            "layers": {
                "transport": {
                    "transport_type": "livekit"
                }
            },
        },
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()
    print(json.dumps(data, indent=2))

    persona_id = data.get("persona_id") or data.get("id")
    if persona_id:
        print(f"\nTAVUS_PERSONA_ID={persona_id}")

if __name__ == "__main__":
    main()
