from __future__ import annotations

import json
from functools import lru_cache

from fastapi import Depends, FastAPI, Header
from fastapi.responses import JSONResponse

from models import ErrorResponse, ProcessReviewRequest, ProcessReviewResponse
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
async def healthz(
    settings: Settings = Depends(get_settings),
    manager: ProgramManager = Depends(get_program_manager),
):
    return {
        "ok": True,
        "version": app.version,
        "programVersion": settings.program_version,
        "program": manager.program_metadata(),
        "draftModel": settings.draft_model,
        "verifyModel": settings.verify_model,
    }


@app.post("/api/review/process", response_model=ProcessReviewResponse)
async def process_review(
    request: ProcessReviewRequest,
    _: None = Depends(require_auth),
    manager: ProgramManager = Depends(get_program_manager),
):
    evidence_json = json.dumps(request.evidence.model_dump(mode="json"), separators=(",", ":"))
    result = manager.process_review(
        mode=request.mode.value,
        evidence_json=evidence_json,
        current_draft_text=request.currentDraftText,
        candidate_draft_text=request.candidateDraftText,
    )
    return ProcessReviewResponse.model_validate(result)
