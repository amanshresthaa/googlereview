from __future__ import annotations

import json
from functools import lru_cache

from fastapi import Depends, FastAPI, Header
from fastapi.responses import JSONResponse

from models import ErrorResponse, GenerateDraftRequest, GenerateDraftResponse, VerifyDraftRequest, VerifyDraftResponse
from programs import ProgramManager, ServiceError
from settings import Settings, get_settings


app = FastAPI(title="GBP DSPy Service", version="1.0.0")


@app.exception_handler(ServiceError)
async def service_error_handler(_, exc: ServiceError):
    payload = ErrorResponse(error=exc.code, message=exc.message)
    return JSONResponse(status_code=exc.status_code, content=payload.model_dump())


@app.exception_handler(Exception)
async def unhandled_error_handler(_, exc: Exception):
    payload = ErrorResponse(error="INTERNAL_ERROR", message="Unhandled server error")
    return JSONResponse(status_code=500, content=payload.model_dump())


@lru_cache(maxsize=1)
def get_program_manager() -> ProgramManager:
    settings = get_settings()
    return ProgramManager(settings)


def require_auth(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = f"Bearer {settings.service_token}"
    if authorization != expected:
        raise ServiceError("INVALID_REQUEST", "Unauthorized request", 401)


@app.get("/api/healthz")
async def healthz(settings: Settings = Depends(get_settings)):
    return {
        "ok": True,
        "version": app.version,
        "programVersion": settings.program_version,
        "draftModel": settings.draft_model,
        "verifyModel": settings.verify_model,
    }


@app.post("/api/draft/generate", response_model=GenerateDraftResponse)
async def generate_draft(
    request: GenerateDraftRequest,
    _: None = Depends(require_auth),
    manager: ProgramManager = Depends(get_program_manager),
):
    evidence_json = json.dumps(request.evidence.model_dump(mode="json"), separators=(",", ":"))
    result = manager.generate_draft(
        evidence_json=evidence_json,
        previous_draft_text=request.previousDraftText,
        regeneration_attempt=request.regenerationAttempt,
    )
    return GenerateDraftResponse.model_validate(result)


@app.post("/api/draft/verify", response_model=VerifyDraftResponse)
async def verify_draft(
    request: VerifyDraftRequest,
    _: None = Depends(require_auth),
    manager: ProgramManager = Depends(get_program_manager),
):
    evidence_json = json.dumps(request.evidence.model_dump(mode="json"), separators=(",", ":"))
    result = manager.verify_draft(evidence_json=evidence_json, draft_text=request.draftText)
    return VerifyDraftResponse.model_validate(result)
