from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, academic, tasks, documents, submissions, evaluations, integrity, analytics, notifications, exports, special_submissions
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(academic.router, prefix="/academic", tags=["Academic Structure & Profiles"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["Tasks & Assignments"])
api_router.include_router(documents.router, prefix="/documents", tags=["Document Authoring"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["Submissions"])
api_router.include_router(special_submissions.router, prefix="/special-submissions", tags=["Special Document Submissions"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["Evaluations & Rubrics"])
api_router.include_router(integrity.router, prefix="/integrity", tags=["Security & Integrity Ledger"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Academic Analytics"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(exports.router, prefix="/exports", tags=["PDF & Document Exports"])
