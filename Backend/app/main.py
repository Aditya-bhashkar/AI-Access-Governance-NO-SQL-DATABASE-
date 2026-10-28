"""
FastAPI application factory.

Responsibilities:
- Create and configure the FastAPI instance
- Register CORS middleware
- Mount all API routers
- Install global exception handlers
- Initialize MongoDB connection on startup
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    auth,
    api_access,
    audit,
    analytics,
    users,
)
from app.core.config import settings
from app.db.database import (
    connect_to_mongo,
    close_mongo_connection,
    get_database,
)
from app.utils.response import err


# ============================================================
# Lifespan
# ============================================================

@asynccontextmanager
async def lifespan(
    app: FastAPI,
) -> AsyncGenerator[None, None]:
    """
    Startup:
        Connect to MongoDB and create indexes.

    Shutdown:
        Close MongoDB connection.
    """

    # Startup
    await connect_to_mongo()

    try:
        yield
    finally:
        # Shutdown
        await close_mongo_connection()


# ============================================================
# Application
# ============================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Centralized REST API for managing AI API access "
        "records within an organization. "
        "Built with FastAPI · Motor (MongoDB) · Async Python."
    ),
    contact={
        "name": "IT Governance Team",
        "email": "it-admin@example.com",
    },
    license_info={
        "name": "MIT",
    },
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# Routers
# ============================================================

app.include_router(auth.router)
app.include_router(api_access.router)
app.include_router(audit.router)
app.include_router(analytics.router)
app.include_router(users.router)


# ============================================================
# Global exception handlers
# ============================================================

@app.exception_handler(HTTPException)
async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> JSONResponse:
    """
    Return every HTTPException in the standard
    response envelope format.
    """

    return JSONResponse(
        status_code=exc.status_code,
        content=err(
            message=str(exc.detail),
        ),
        headers=getattr(
            exc,
            "headers",
            None,
        ),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """
    Return Pydantic validation errors as a 422
    with a readable message.
    """

    messages = []

    for error in exc.errors():
        loc = " → ".join(
            str(location)
            for location in error["loc"]
            if location != "body"
        )

        if loc:
            messages.append(
                f"{loc}: {error['msg']}"
            )
        else:
            messages.append(
                error["msg"]
            )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=err(
            message="Validation failed.",
            data={
                "errors": messages,
            },
        ),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """
    Last-resort handler for unexpected errors.
    """

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=err(
            message="An unexpected server error occurred.",
        ),
    )


# ============================================================
# Health checks
# ============================================================

@app.get(
    "/",
    tags=["Health"],
    summary="Health check",
)
def root() -> dict:
    """
    Returns service metadata.

    Used by load-balancer probes.
    """

    return {
        "success": True,
        "message": (
            f"{settings.APP_NAME} is running."
        ),
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


@app.get(
    "/health",
    tags=["Health"],
    summary="Liveness probe",
)
def health() -> dict:
    """
    Simple health check.
    """

    return {
        "status": "ok",
    }


@app.get(
    "/health/db",
    tags=["Health"],
    summary="Database connectivity probe",
)
async def health_db() -> dict:
    """
    Check MongoDB connectivity.
    """

    try:
        database = await get_database()

        await database.command(
            "ping"
        )

        return {
            "status": "ok",
            "database": "connected",
        }

    except Exception as exc:
        return {
            "status": "error",
            "database": "disconnected",
            "error": str(exc),
        }