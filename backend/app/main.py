import json
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app.models import Topic, Task, ActivityLog, Milestone
from app.schemas.schemas import (
    TopicUpdate, TaskUpdate,
    TopicCreate, TopicResponse,
    TaskCreate, TaskResponse,
)
from app.schemas.schemas import (
    ActivityLogResponse,
    MilestoneCreate,
    MilestoneUpdate,
    MilestoneResponse,
)


class AssistantMessage(BaseModel):
    role: str
    content: str


class AssistantChatRequest(BaseModel):
    message: str
    messages: list[AssistantMessage] = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Trax API",
    description="Personal and work tracking command centre",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"app": "Trax", "message": "Trax API is running"}



@app.post("/assistant/chat")
async def assistant_chat(
    payload: AssistantChatRequest,
    db=Depends(get_db),
):
    message = payload.message.strip()

    if not message:
        raise HTTPException(
            status_code=400,
            detail="Message cannot be empty",
        )

    # Fetch live data from the database
    topics = db.query(Topic).order_by(Topic.id).all()
    tasks = db.query(Task).order_by(Task.id).all()
    milestones = db.query(Milestone).order_by(Milestone.id).all()

        # Calculate the current 7-day deadline window
    now = datetime.now(timezone.utc)
    seven_days_from_now = now + timedelta(days=7)

    upcoming_tasks = [
        t
        for t in tasks
        if t.due_date is not None
        and now <= t.due_date <= seven_days_from_now
    ]

    # Prepare a compact representation of the data
    workspace = {
        "topics": [
            {
                "id": t.id,
                "name": t.name,
                "description": t.description,
                "status": t.status,
            }
            for t in topics
        ],
        "tasks": [
            {
                "id": t.id,
                "topic_id": t.topic_id,
                "title": t.title,
                "description": t.description,
                "assignee": t.assignee,
                "status": t.status,
                "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None,
            }
            for t in tasks
        ],

            "upcoming_tasks_next_7_days": [
        {
            "id": t.id,
            "title": t.title,
            "status": t.status,
            "priority": t.priority,
            "assignee": t.assignee,
            "due_date": t.due_date.isoformat(),
            "topic_id": t.topic_id,
        }
        for t in upcoming_tasks
    ],

        "milestones": [
            {
                "id": m.id,
                "topic_id": m.topic_id,
                "title": m.title,
                "description": m.description,
                "status": m.status,
                "due_date": m.due_date.isoformat() if m.due_date else None,
            }
            for m in milestones
        ],
    }

    system_prompt = (
        "You are TraxAssistant, the AI assistant for the user's Trax "
        "productivity workspace. "
        "You have access to the current workspace data provided below. "
        "Use this data as the source of truth when answering questions "
        "about the user's topics, tasks, milestones, statuses, priorities, "
        "assignees, and due dates. "
        "Do not invent or modify workspace data. "
        "When the user asks for analysis, recommendations, prioritization, "
        "planning, or summaries, reason over the available workspace data "
        "and clearly distinguish facts from recommendations. "
        "You may perform calculations and date reasoning when needed. "
        "If the workspace data does not contain enough information to "
        "answer a question, say so instead of guessing. "
        "You are currently read-only and must never claim to have created, "
        "updated, or deleted anything. "
        "Be concise, clear, and practical. "
        "When recommending what the user should focus on, consider "
        "overdue tasks first, then tasks due soon, while also considering "
        "task priority and status. Do not ignore an overdue task merely "
        "because another task has a later upcoming deadline.\n\n"
        f"Trax workspace data:\n{workspace}"
        "Always report task priorities, statuses, and due dates "
        "exactly as stored in the database. Never change or "
        "assume these values. Clearly distinguish factual data "
        "from your own recommendations.\n"
    )

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                "http://localhost:11434/api/chat",
                json={
                    "model": "llama3.2:3b",
                    "messages": [
                        {
                            "role": "system",
                            "content": system_prompt,
                        },
                        *[
                            {
                                "role": chat_message.role,
                                "content": chat_message.content,
                            }
                            for chat_message in payload.messages
                        ],
                        {
                            "role": "user",
                            "content": message,
                        },
                    ],
                    "stream": False,
                },
            )

            response.raise_for_status()
            result = response.json()

            return {
                "reply": result["message"]["content"],
                "model": result["model"],
            }

    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Ollama is not running. Please start Ollama.",
        )

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Ollama took too long to respond.",
        )

    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=502,
            detail="Ollama returned an error.",
        )

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    from sqlalchemy import text
    db.execute(text("SELECT 1"))
    return {"status": "healthy", "database": "connected"}


@app.post("/topics", response_model=TopicResponse, status_code=201)
def create_topic(
    payload: TopicCreate,
    db: Session = Depends(get_db),
):
    existing = db.scalar(
        select(Topic).where(Topic.name == payload.name)
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A topic with this name already exists",
        )

    topic = Topic(**payload.model_dump())

    try:
        db.add(topic)
        db.flush()

        log_activity(
            db=db,
            topic_id=topic.id,
            action="topic_created",
            details={"name": topic.name},
        )

        db.commit()
        db.refresh(topic)
        return topic
    except Exception:
        db.rollback()
        raise

@app.get("/topics", response_model=list[TopicResponse])
def list_topics(db: Session = Depends(get_db)):
    return db.scalars(
        select(Topic).order_by(Topic.created_at.desc())
    ).all()


@app.post("/tasks", response_model=TaskResponse, status_code=201)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
):
    topic = db.get(Topic, payload.topic_id)
    if not topic:
        raise HTTPException(
            status_code=404,
            detail="Topic not found",
        )

    task = Task(**payload.model_dump())

    try:
        db.add(task)
        db.flush()

        log_activity(
            db=db,
            topic_id=task.topic_id,
            task_id=task.id,
            action="task_created",
            details={
                "title": task.title,
                "assignee": task.assignee,
                "priority": task.priority,
                "status": task.status,
            },
        )

        db.commit()
        db.refresh(task)
        return task
    except Exception:
        db.rollback()
        raise

@app.get("/topics/{topic_id}/tasks", response_model=list[TaskResponse])
def list_topic_tasks(
    topic_id: int,
    db: Session = Depends(get_db),
):
    if not db.get(Topic, topic_id):
        raise HTTPException(
            status_code=404,
            detail="Topic not found",
        )

    return db.scalars(
        select(Task)
        .where(Task.topic_id == topic_id)
        .order_by(Task.created_at.desc())
    ).all()


@app.patch("/topics/{topic_id}", response_model=TopicResponse)
def update_topic(
    topic_id: int,
    payload: TopicUpdate,
    db: Session = Depends(get_db),
):
    topic = db.get(Topic, topic_id)

    if not topic:
        raise HTTPException(
            status_code=404,
            detail="Topic not found",
        )

    updates = payload.model_dump(exclude_unset=True)

    if updates.get("name") is not None:
        existing = db.scalar(
            select(Topic).where(
                Topic.name == updates["name"],
                Topic.id != topic_id,
            )
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail="A topic with this name already exists",
            )

    changes = {}

    for key, new_value in updates.items():
        old_value = getattr(topic, key)

        if old_value != new_value:
            changes[key] = {
                "old": old_value,
                "new": new_value,
            }
            setattr(topic, key, new_value)

    try:
        if changes:
            log_activity(
                db=db,
                topic_id=topic.id,
                action="topic_updated",
                details=changes,
            )

        db.commit()
        db.refresh(topic)
        return topic
    except Exception:
        db.rollback()
        raise

@app.patch("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    updates = payload.model_dump(exclude_unset=True)

    changes = {}

    for key, new_value in updates.items():
        old_value = getattr(task, key)

        if old_value != new_value:
            changes[key] = {
                "old": old_value,
                "new": new_value,
            }
            setattr(task, key, new_value)

    try:
        if changes:
            log_activity(
                db=db,
                topic_id=task.topic_id,
                task_id=task.id,
                action="task_updated",
                details=changes,
            )

        db.commit()
        db.refresh(task)
        return task
    except Exception:
        db.rollback()
        raise

@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = db.get(Task, task_id)

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    try:
        log_activity(
            db=db,
            topic_id=task.topic_id,
            task_id=None,
            action="task_deleted",
            details={
                "task_id": task.id,
                "title": task.title,
                "assignee": task.assignee,
            },
        )

        db.delete(task)
        db.commit()

        return {
            "message": "Task deleted successfully",
            "id": task_id,
        }
    except Exception:
        db.rollback()
        raise

@app.get("/tasks", response_model=list[TaskResponse])
def list_all_tasks(
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = select(Task).order_by(Task.created_at.desc())

    if status:
        allowed_statuses = {"todo", "in_progress", "completed"}

        if status not in allowed_statuses:
            raise HTTPException(
                status_code=422,
                detail="Invalid status",
            )

        query = query.where(Task.status == status)

    return db.scalars(query).all()



@app.post("/milestones", response_model=MilestoneResponse, status_code=201)
def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
):
    topic = db.get(Topic, payload.topic_id)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    milestone = Milestone(**payload.model_dump())

    db.add(milestone)
    db.commit()
    db.refresh(milestone)
    return milestone


@app.delete("/milestones/{milestone_id}")
def delete_milestone(
    milestone_id: int,
    db: Session = Depends(get_db),
):
    milestone = db.get(Milestone, milestone_id)

    if not milestone:
        raise HTTPException(
            status_code=404,
            detail="Milestone not found",
        )

    try:
        db.delete(milestone)
        db.commit()

        return {
            "message": "Milestone deleted successfully",
            "id": milestone_id,
        }
    except Exception:
        db.rollback()
        raise

@app.get(
    "/topics/{topic_id}/milestones",
    response_model=list[MilestoneResponse],
)
def list_milestones(
    topic_id: int,
    db: Session = Depends(get_db),
):
    if not db.get(Topic, topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")

    return db.scalars(
        select(Milestone)
        .where(Milestone.topic_id == topic_id)
        .order_by(Milestone.due_date.asc())
    ).all()


@app.patch("/milestones/{milestone_id}", response_model=MilestoneResponse)
def update_milestone(
    milestone_id: int,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
):
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, key, value)

    db.commit()
    db.refresh(milestone)
    return milestone


@app.get(
    "/topics/{topic_id}/activity",
    response_model=list[ActivityLogResponse],
)
def list_activity(
    topic_id: int,
    db: Session = Depends(get_db),
):
    if not db.get(Topic, topic_id):
        raise HTTPException(status_code=404, detail="Topic not found")

    return db.scalars(
        select(ActivityLog)
        .where(ActivityLog.topic_id == topic_id)
        .order_by(ActivityLog.created_at.desc())
    ).all()

def log_activity(
    db: Session,
    topic_id: int,
    action: str,
    details: dict,
    task_id: int | None = None,
):
    activity = ActivityLog(
        topic_id=topic_id,
        task_id=task_id,
        action=action,
        details=json.dumps(details, default=str),
    )
    db.add(activity)