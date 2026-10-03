from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from typing import Literal


class TopicCreate(BaseModel):
    name: str
    description: str | None = None


class TopicResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    status: str
    created_at: datetime


class TaskCreate(BaseModel):
    topic_id: int
    title: str
    description: str | None = None
    assignee: str | None = None
    priority: str = "medium"
    due_date: datetime | None = None


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    title: str
    description: str | None
    assignee: str | None
    status: str
    priority: str
    due_date: datetime | None
    created_at: datetime




class TopicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: Literal["active", "archived"] | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = None
    assignee: str | None = None
    status: Literal["todo", "in_progress", "completed"] | None = None
    priority: Literal["low", "medium", "high", "urgent"] | None = None
    due_date: datetime | None = None


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    task_id: int | None
    action: str
    details: str
    created_at: datetime


class MilestoneCreate(BaseModel):
    topic_id: int
    title: str = Field(min_length=1, max_length=250)
    description: str | None = None
    due_date: datetime | None = None


class MilestoneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    description: str | None = None
    due_date: datetime | None = None
    status: Literal["pending", "in_progress", "completed"] | None = None


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic_id: int
    title: str
    description: str | None
    due_date: datetime | None
    status: str
    created_at: datetime