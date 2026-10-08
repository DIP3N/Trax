
import { useEffect, useState } from "react";
import {
  getTopics,
  getTasks,
  createTopic,
  getTopicTasks,
  createTask,
  updateTask,
  deleteTask,
  getActivity,
  updateTopic,
  deleteTopic,
  getTopicMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  sendAssistantMessage,
} from "./services/api";

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function App() {
  const [topics, setTopics] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [editingTopicId, setEditingTopicId] = useState(null);
  const [editTopicForm, setEditTopicForm] = useState({
    name: "",
    description: "",
  });
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [activeView, setActiveView] = useState("overview");
  const [topicTasks, setTopicTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(false);
  const [error, setError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [creatingTask, setCreatingTask] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [milestones, setMilestones] = useState([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneError, setMilestoneError] = useState("");
  const [assistantMessages, setAssistantMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm TraxAssistant. Ask me anything, and I'll do my best to help.",
    },
  ]);

  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantError, setAssistantError] = useState("");

  const loadDashboard = async () => {
    try {
      const [topicData, taskData] = await Promise.all([
        getTopics(),
        getTasks(),
      ]);

      setTopics(Array.isArray(topicData) ? topicData : []);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);


  useEffect(() => {
    if (!selectedTopic?.id) {
      setMilestones([]);
      return;
    }

    let cancelled = false;

    const loadMilestones = async () => {
      setMilestonesLoading(true);

      try {
        const data = await getTopicMilestones(selectedTopic.id);
        if (!cancelled) {
          setMilestones(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load milestones.");
        }
      } finally {
        if (!cancelled) {
          setMilestonesLoading(false);
        }
      }
    };

    loadMilestones();

    return () => {
      cancelled = true;
    };
  }, [selectedTopic?.id]);

  const loadActivity = async () => {
    setActivityLoading(true);
    setActivityError("");

    try {
      // Activity is scoped to a topic in the backend, so fetch it for each topic.
      const topicList = topics.length > 0 ? topics : await getTopics();

      const activityByTopic = await Promise.all(
        topicList.map(async (topic) => {
          const data = await getActivity(topic.id);
          return (Array.isArray(data) ? data : []).map((item) => ({
            ...item,
            topic_name: item.topic_name || topic.name,
          }));
        })
      );

      const allActivity = activityByTopic
        .flat()
        .sort((a, b) => {
          const dateA = new Date(
            a.created_at || a.timestamp || a.occurred_at || 0
          ).getTime();
          const dateB = new Date(
            b.created_at || b.timestamp || b.occurred_at || 0
          ).getTime();
          return dateB - dateA;
        });

      setActivity(allActivity);
    } catch (err) {
      setActivityError(err.message || "Unable to load activity.");
    } finally {
      setActivityLoading(false);
    }
  };

  const openTopic = async (topic) => {
    setActiveView("topic");
    setSelectedTopic(topic);
    setTaskLoading(true);
    setTaskError("");
    setShowTaskForm(false);

    try {
      const data = await getTopicTasks(topic.id);
      setTopicTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      setTaskError(err.message || "Unable to load tasks.");
    } finally {
      setTaskLoading(false);
    }
  };

  const goToOverview = () => {
    setActiveView("overview");
    setSelectedTopic(null);
    setTopicTasks([]);
    setShowTaskForm(false);
    setTaskFormError("");
  };

  const goToTopics = () => {
    setActiveView("topics");
    setSelectedTopic(null);
    setTopicTasks([]);
    setShowTaskForm(false);
    setTaskFormError("");
    setTaskError("");
    setEditingTaskId(null);
    setEditTaskForm({});
  };

  const goToTasks = () => {
    setActiveView("tasks");
    setSelectedTopic(null);
    setTopicTasks([]);
    setShowTaskForm(false);
    setTaskFormError("");
    setTaskError("");
    setEditingTaskId(null);
    setEditTaskForm({});
  };

  const goToActivity = () => {
    setActiveView("activity");
    setSelectedTopic(null);
    setTopicTasks([]);
    setShowTaskForm(false);
    setTaskFormError("");
    setTaskError("");
    setEditingTaskId(null);
    setEditTaskForm({});
    loadActivity();
  };

  const today = getLocalDate();

  const isCompleted = (task) => task.status === "completed";

  const isOverdue = (task) =>
    !isCompleted(task) &&
    task.due_date &&
    String(task.due_date).slice(0, 10) < today;

  const activeTopics = topics.filter(
    (topic) => topic.status === "active"
  ).length;

  const pendingTasks = tasks.filter(
    (task) => task.status === "todo" || task.status === "in_progress"
  ).length;

  const overdueTasks = tasks.filter(isOverdue).length;
  const completedTasks = tasks.filter(isCompleted).length;

  const stats = [
    { label: "Active Topics", value: activeTopics },
    { label: "Pending Tasks", value: pendingTasks },
    { label: "Overdue Tasks", value: overdueTasks },
    { label: "Completed Tasks", value: completedTasks },
  ];

  const handleCreateTopic = async (event) => {
    event.preventDefault();

    if (!name.trim()) {
      setFormError("Topic name is required.");
      return;
    }

    setCreating(true);
    setFormError("");

    try {
      await createTopic({
        name: name.trim(),
        description: description.trim(),
      });

      setName("");
      setDescription("");
      setShowForm(false);
      await loadDashboard();
    } catch (err) {
      setFormError(err.message || "Failed to create topic.");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveTopic = async (topicId, updates) => {
    try {
      await updateTopic(topicId, updates);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to update topic.");
    }
  };


  
  const handleCreateMilestone = async (title) => {
    if (!selectedTopic?.id || !title.trim()) return;

    setMilestoneError("");

    try {
      const newMilestone = await createMilestone({
        topic_id: selectedTopic.id,
        title: title.trim(),
      });

      setMilestones((current) => [...current, newMilestone]);
      setMilestoneTitle("");
    } catch (err) {
      setMilestoneError(err.message || "Failed to create milestone.");
    }
  };

  const handleUpdateMilestone = async (milestoneId, updates) => {
    try {
      const updatedMilestone = await updateMilestone(
        milestoneId,
        updates
      );

      setMilestones((current) =>
        current.map((milestone) =>
          milestone.id === milestoneId
            ? updatedMilestone
            : milestone
        )
      );
    } catch (err) {
      setMilestoneError(err.message || "Failed to update milestone.");
    }
  };


  const handleDeleteMilestone = async (milestoneId) => {
    const milestone = milestones.find(
      (item) => item.id === milestoneId
    );

    if (!milestone) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${milestone.title}"?`
    );

    if (!confirmed) return;

    setMilestoneError("");

    try {
      await deleteMilestone(milestoneId);

      setMilestones((current) =>
        current.filter((item) => item.id !== milestoneId)
      );
    } catch (err) {
      setMilestoneError(
        err.message || "Failed to delete milestone."
      );
    }
  };

  const handleDeleteTopic = async (topicId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this topic? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      await deleteTopic(topicId);

      if (selectedTopic?.id === topicId) {
        goToTopics();
      }

      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to delete topic.");
    }
  };

  const handleCreateTask = async (event) => {
    event.preventDefault();

    if (!taskTitle.trim() || !selectedTopic) {
      setTaskFormError("Task title is required.");
      return;
    }

    setCreatingTask(true);
    setTaskFormError("");

    try {
      await createTask({
        topic_id: selectedTopic.id,
        title: taskTitle.trim(),
        description: taskDescription.trim() || null,
        assignee: assignee.trim() || null,
        priority,
        due_date: dueDate || null,
      });

      const updatedTasks = await getTopicTasks(selectedTopic.id);
      setTopicTasks(Array.isArray(updatedTasks) ? updatedTasks : []);

      setTaskTitle("");
      setTaskDescription("");
      setAssignee("");
      setPriority("medium");
      setDueDate("");
      setShowTaskForm(false);

      await loadDashboard();
    } catch (err) {
      setTaskFormError(err.message || "Failed to create task.");
    } finally {
      setCreatingTask(false);
    }
  };

  async function handleUpdateTask(taskId, updates) {
    try {
      await updateTask(taskId, updates);

      if (selectedTopic) {
        const updatedTasks = await getTopicTasks(selectedTopic.id);
        setTopicTasks(Array.isArray(updatedTasks) ? updatedTasks : []);
      }

      await loadDashboard();
    } catch (err) {
      setTaskError(err.message || "Failed to update task.");
    }
  }

  async function handleDeleteTask(taskId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this task? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      await deleteTask(taskId);

      if (selectedTopic) {
        const updatedTasks = await getTopicTasks(selectedTopic.id);
        setTopicTasks(Array.isArray(updatedTasks) ? updatedTasks : []);
      }

      await loadDashboard();
    } catch (err) {
      setTaskError(err.message || "Failed to delete task.");
    }
  }

  function handleEditTask(task) {
    setTaskError("");
    setEditingTaskId(task.id);
    setEditTaskForm({
      title: task.title || "",
      description: task.description || "",
      assignee: task.assignee || "",
      priority: task.priority || "medium",
      status: task.status || "todo",
      due_date: task.due_date ? String(task.due_date).slice(0, 10) : "",
    });
  }

  function handleCancelEdit() {
    setEditingTaskId(null);
    setEditTaskForm({});
    setTaskError("");
  }

  async function handleSaveEdit(event, taskId) {
    event.preventDefault();

    if (!editTaskForm.title.trim()) {
      setTaskError("Task title is required.");
      return;
    }
    if (!["low", "medium", "high", "urgent"].includes(editTaskForm.priority)) {
      setTaskError("Select a valid priority.");
      return;
    }

    setSavingEdit(true);
    setTaskError("");
    try {
      await updateTask(taskId, {
        title: editTaskForm.title.trim(),
        description: editTaskForm.description.trim() || null,
        assignee: editTaskForm.assignee.trim() || null,
        priority: editTaskForm.priority,
        status: editTaskForm.status,
        due_date: editTaskForm.due_date || null,
      });
      if (selectedTopic) {
        const updatedTasks = await getTopicTasks(selectedTopic.id);
        setTopicTasks(Array.isArray(updatedTasks) ? updatedTasks : []);
      }
      await loadDashboard();
      setEditingTaskId(null);
      setEditTaskForm({});
    } catch (err) {
      setTaskError(err.message || "Failed to update task.");
    } finally {
      setSavingEdit(false);
    }
  }

  const renderTaskRow = (task, showTopic = false) => {
    const topic = topics.find((item) => item.id === task.topic_id);

    return (
      <article className="task-row" key={task.id}>
        {editingTaskId === task.id ? (
          <form
            onSubmit={(event) => handleSaveEdit(event, task.id)}
            style={{ width: "100%", display: "grid", gap: "12px" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "12px",
              }}
            >
              <div>
                <label htmlFor={`edit-title-${task.id}`}>Task title *</label>
                <input
                  id={`edit-title-${task.id}`}
                  type="text"
                  value={editTaskForm.title || ""}
                  onChange={(event) =>
                    setEditTaskForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                  maxLength={200}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "5px",
                    padding: "9px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    font: "inherit",
                  }}
                />
              </div>

              <div>
                <label htmlFor={`edit-assignee-${task.id}`}>Assignee</label>
                <input
                  id={`edit-assignee-${task.id}`}
                  type="text"
                  value={editTaskForm.assignee || ""}
                  onChange={(event) =>
                    setEditTaskForm((current) => ({
                      ...current,
                      assignee: event.target.value,
                    }))
                  }
                  placeholder="Unassigned"
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "5px",
                    padding: "9px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    font: "inherit",
                  }}
                />
              </div>

              <div>
                <label htmlFor={`edit-due-${task.id}`}>Due date</label>
                <input
                  id={`edit-due-${task.id}`}
                  type="date"
                  value={editTaskForm.due_date || ""}
                  onChange={(event) =>
                    setEditTaskForm((current) => ({
                      ...current,
                      due_date: event.target.value,
                    }))
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "5px",
                    padding: "9px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    font: "inherit",
                  }}
                />
              </div>

              <div>
                <label htmlFor={`edit-priority-${task.id}`}>Priority</label>
                <select
                  id={`edit-priority-${task.id}`}
                  value={editTaskForm.priority || "medium"}
                  onChange={(event) =>
                    setEditTaskForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "5px",
                    padding: "9px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    background: "white",
                    font: "inherit",
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label htmlFor={`edit-status-${task.id}`}>Status</label>
                <select
                  id={`edit-status-${task.id}`}
                  value={editTaskForm.status || "todo"}
                  onChange={(event) =>
                    setEditTaskForm((current) => ({
                      ...current,
                      status: event.target.value,
                    }))
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "5px",
                    padding: "9px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    background: "white",
                    font: "inherit",
                  }}
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor={`edit-description-${task.id}`}>Description</label>
              <textarea
                id={`edit-description-${task.id}`}
                value={editTaskForm.description || ""}
                onChange={(event) =>
                  setEditTaskForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={2}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: "5px",
                  padding: "9px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  resize: "vertical",
                  font: "inherit",
                }}
              />
            </div>

            {taskError && (
              <p style={{ color: "#dc2626", margin: 0 }}>{taskError}</p>
            )}

            <div className="task-actions">
              <button type="submit" className="primary" disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="edit-button"
                onClick={handleCancelEdit}
                disabled={savingEdit}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="task-row-main">
              <h3>{task.title}</h3>
              {showTopic && topic && (
                <p className="muted" style={{ marginBottom: "6px" }}>
                  Topic: {topic.name}
                </p>
              )}
              {task.description && <p className="muted">{task.description}</p>}
              <div className="task-meta">
                <span>Assignee: {task.assignee || "Unassigned"}</span>
                <span>
                  Due: {task.due_date ? String(task.due_date).slice(0, 10) : "No due date"}
                </span>
              </div>
            </div>

            <div className="task-row-badges">
              <span className={`priority-badge ${task.priority}`}>{task.priority}</span>
              <span className={`task-status ${task.status}`}>
                {task.status.replace("_", " ")}
              </span>
            </div>

            <div className="task-actions">
              <select
                value={task.status}
                onChange={(event) =>
                  handleUpdateTask(task.id, { status: event.target.value })
                }
                aria-label={`Change status of ${task.title}`}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <button
                type="button"
                className="edit-button"
                onClick={() => handleEditTask(task)}
              >
                Edit
              </button>
              <button
                type="button"
                className="delete-button"
                onClick={() => handleDeleteTask(task.id)}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </article>
    );
  };

  const renderTopicTile = (topic) => {
    const topicTasksList = tasks.filter(
      (task) => task.topic_id === topic.id
    );

    const completed = topicTasksList.filter(isCompleted).length;
    const pending = topicTasksList.filter(
      (task) =>
        task.status === "todo" || task.status === "in_progress"
    ).length;
    const overdue = topicTasksList.filter(isOverdue).length;
    const total = topicTasksList.length;
    const progress =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
      <article
        className="topic-tile"
        key={topic.id}
        role="button"
        tabIndex={0}
        onClick={() => openTopic(topic)}
        onKeyDown={(event) => {
          // Ignore keyboard events from inputs, textareas and buttons
          if (event.target !== event.currentTarget) return;

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTopic(topic);
          }
        }}
        aria-label={`Open tasks for ${topic.name}`}
      >
        <div className="topic-tile-header">
          <h3>{topic.name}</h3>
          <span
            className={`status-badge ${
              topic.status === "active" ? "active" : "archived"
            }`}
          >
            {topic.status}
          </span>
        </div>

        <p className="topic-description">
          {topic.description || "No description added yet."}
        </p>

        <div className="topic-task-total">
          <span className="muted">Total tasks</span>
          <strong>{total}</strong>
        </div>

        <div className="topic-task-stats">
          <div>
            <span className="stat-dot completed-dot" />
            <span>Completed</span>
            <strong>{completed}</strong>
          </div>
          <div>
            <span className="stat-dot pending-dot" />
            <span>Pending</span>
            <strong>{pending}</strong>
          </div>
          <div>
            <span className="stat-dot overdue-dot" />
            <span>Overdue</span>
            <strong>{overdue}</strong>
          </div>
        </div>

        <div className="progress-label">
          <span>Progress</span>
          <strong>{progress}%</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${topic.name} completion`}
        >
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="tile-link">View tasks →</div>                    
          
        {editingTopicId === topic.id ? (
          <div
            className="topic-edit-form"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >

            <label htmlFor={`topic-name-${topic.id}`}>Topic name</label>
            <input
              id={`topic-name-${topic.id}`}
              type="text"
              value={editTopicForm.name}
              onChange={(event) =>
                setEditTopicForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />

            <label htmlFor={`topic-description-${topic.id}`}>Description</label>
            <textarea
              id={`topic-description-${topic.id}`}
              value={editTopicForm.description}
              onChange={(event) =>
                setEditTopicForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={3}
            />

            <div className="topic-actions">
              <button
                type="button"
                className="edit-btn"
                onClick={async () => {
                  if (!editTopicForm.name.trim()) {
                    setError("Topic name cannot be empty.");
                    return;
                  }

                  await handleSaveTopic(topic.id, {
                    name: editTopicForm.name.trim(),
                    description: editTopicForm.description.trim(),
                  });

                  setEditingTopicId(null);
                }}
              >
                Save
              </button>

              <button
                type="button"
                className="delete-btn"
                onClick={() => {
                  setEditingTopicId(null);
                  setEditTopicForm({ name: "", description: "" });
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="topic-actions">
            <button
              type="button"
              className="edit-btn"
              onClick={(event) => {
                event.stopPropagation();
                setEditingTopicId(topic.id);
                setEditTopicForm({
                  name: topic.name || "",
                  description: topic.description || "",
                });
                setError("");
              }}
            >
              Edit
            </button>

            <button
              type="button"
              className="delete-btn"
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteTopic(topic.id);
              }}
            >
              Delete
            </button>
          </div>
        )}
      </article>
    );
  };

  const handleAssistantSubmit = async (event) => {
    event.preventDefault();

    const message = assistantInput.trim();
    if (!message || assistantLoading) return;

    setAssistantMessages((current) => [
      ...current,
      { role: "user", content: message },
    ]);

    setAssistantInput("");
    setAssistantError("");
    setAssistantLoading(true);

    try {
      const result = await sendAssistantMessage(message, assistantMessages);

      setAssistantMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.reply,
        },
      ]);
    } catch (err) {
      setAssistantError(err.message || "Something went wrong.");
    } finally {
      setAssistantLoading(false);
    }
  };

  return (
    <div className="app layout">
      <aside className="sidebar">
        <div className="brand">Trax.</div>
        <div
          className={`nav-item ${activeView === "overview" ? "active" : ""}`}
          onClick={goToOverview}
          role="button"
          tabIndex={0}
        >
          ▦ &nbsp; Overview
        </div>
        <div
          className={`nav-item ${activeView === "topics" || activeView === "topic" ? "active" : ""}`}
          onClick={goToTopics}
          role="button"
          tabIndex={0}
        >
          ◫ &nbsp; Topics
        </div>
        <div
          className={`nav-item ${activeView === "tasks" ? "active" : ""}`}
          onClick={goToTasks}
          role="button"
          tabIndex={0}
        >
          ✓ &nbsp; Tasks
        </div>
        <div
          className={`nav-item ${activeView === "activity" ? "active" : ""}`}
          onClick={goToActivity}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            // Do not trigger topic navigation while this topic is being edited
            if (editingTopicId === topic.id) {
              event.stopPropagation();
              return;
            }

            if (event.target !== event.currentTarget) return;

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openTopic(topic);
            }
          }}


        >
          ◷ &nbsp; Activity
        </div>
        <div
          className={`nav-item ${activeView === "assistant" ? "active" : ""}`}
          onClick={() => {
            setActiveView("assistant");
            setSelectedTopic(null);
          }}
          role="button"
          tabIndex={0}
        >
          ✦ &nbsp; TraxAssistant
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            {selectedTopic ? (
              <>
                <button className="back-button" onClick={goToOverview}>
                  ← Back to Overview
                </button>
                <h1>{selectedTopic.name}</h1>
                <div className="muted">
                  {selectedTopic.description || "Topic details and tasks"}
                </div>
              </>
            ) : activeView === "tasks" ? (
              <>
                <h1>All Tasks</h1>
                <div className="muted">
                  Every task across your topics
                </div>
              </>
            
            ) : activeView === "topics" ? (
              <>
                <h1>Topics</h1>
                <div className="muted">
                  Manage all your workstreams
                </div>
              </>
            ) : activeView === "activity" ? (
              <>
                <h1>Activity</h1>
                <div className="muted">
                  Recent changes across Trax
                </div>
              </>
            ) : activeView === "assistant" ? (
              <>
                <h1>TraxAssistant</h1>
                <div className="muted">
                  Your AI-powered command centre for Trax
                </div>
              </>
            ) : (
              <>
                <h1>Overview</h1>
                <div className="muted">
                  Your personal command centre
                </div>
              </>
            )}
          </div>

          {selectedTopic ? (
            <button
              className="primary"
              onClick={() => {
                setShowTaskForm(!showTaskForm);
                setTaskFormError("");
              }}
            >
              {showTaskForm ? "Cancel" : "+ New Task"}
            </button>
          ) : activeView === "overview" ? (
            <button
              className="primary"
              onClick={() => {
                setShowForm(!showForm);
                setFormError("");
              }}
            >
              {showForm ? "Cancel" : "+ New Topic"}
            </button>
          ) : null}
        </header>

        {(activeView === "overview" || activeView === "topics") && !selectedTopic && showForm && (          <section className="panel" style={{ marginBottom: "24px" }}>
            <h2>Create New Topic</h2>
            <form onSubmit={handleCreateTopic}>
              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="topicName">Topic Name *</label>
                <input
                  id="topicName"
                  type="text"
                  placeholder="e.g. Website Development"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={200}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "8px",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label htmlFor="topicDescription">Description</label>
                <textarea
                  id="topicDescription"
                  placeholder="Briefly describe this topic..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "8px",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    resize: "vertical",
                    font: "inherit",
                  }}
                />
              </div>

              {formError && (
                <p style={{ color: "#dc2626" }}>{formError}</p>
              )}

              <button className="primary" type="submit" disabled={creating}>
                {creating ? "Creating..." : "Create Topic"}
              </button>
            </form>
          </section>
        )}

        {activeView === "overview" && !selectedTopic && (
          <section className="cards">
            {stats.map((stat) => (
              <div className="card" key={stat.label}>
                <div className="card-label">{stat.label}</div>
                <div className="card-value">{stat.value}</div>
              </div>
            ))}
          </section>
        )}

        {(activeView === "overview" || activeView === "topics") && !selectedTopic && (
          <section className="panel">
            <div className="topics-heading">
              <h2>Your Topics</h2>
              <span className="muted">{topics.length} total</span>
            </div>

            {loading && <p className="muted">Loading dashboard...</p>}

            {error && (
              <div>
                <p style={{ color: "#dc2626" }}>Error: {error}</p>
                <button className="primary" onClick={loadDashboard}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && topics.length === 0 && (
              <p className="muted">
                No topics yet. Create your first topic to get started.
              </p>
            )}

            {!loading && !error && topics.length > 0 && (
              <div className="topic-grid">
                {topics.map(renderTopicTile)}
              </div>
            )}
          </section>
        )}

        {activeView === "tasks" && !selectedTopic && (
          <section className="panel">
            <div className="topics-heading">
              <h2>All Tasks</h2>
              <span className="muted">{tasks.length} total</span>
            </div>

            {loading && <p className="muted">Loading tasks...</p>}

            {error && (
              <div>
                <p style={{ color: "#dc2626" }}>Error: {error}</p>
                <button className="primary" onClick={loadDashboard}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && tasks.length === 0 && (
              <p className="muted">No tasks have been created yet.</p>
            )}

            {!loading && !error && tasks.length > 0 && (
              <div className="task-list">
                {tasks.map((task) => renderTaskRow(task, true))}
              </div>
            )}
          </section>
        )}

        {activeView === "activity" && !selectedTopic && (
          <section className="panel">
            <div className="topics-heading">
              <h2>Recent Activity</h2>
              <span className="muted">{activity.length} events</span>
            </div>

            {activityLoading && (
              <p className="muted">Loading activity...</p>
            )}

            {activityError && (
              <div>
                <p style={{ color: "#dc2626" }}>Error: {activityError}</p>
                <button className="primary" onClick={loadActivity}>
                  Retry
                </button>
              </div>
            )}

            {!activityLoading && !activityError && activity.length === 0 && (
              <p className="muted">No activity has been recorded yet.</p>
            )}

            {!activityLoading && !activityError && activity.length > 0 && (
              <div
                className="activity-list"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {activity.map((item, index) => {
                  const action = item.action || item.event || item.type || "Activity";
                  const entityType = item.entity_type || item.entity || "";
                  const entityId = item.entity_id ?? "";
                  const createdAt =
                    item.created_at || item.timestamp || item.occurred_at || "";
                  let details = item.details || item.description || item.message || "";

                  if (typeof details === "object" && details !== null) {
                    details = Object.entries(details)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(" • ");
                  }

                  const label = [
                    item.topic_name,
                    entityType,
                    entityId ? `#${entityId}` : "",
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <article
                      className="activity-item"
                      key={item.id ?? index}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "24px",
                        alignItems: "flex-start",
                        padding: "16px 0",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <div
                        className="activity-item-main"
                        style={{ minWidth: 0, flex: 1 }}
                      >
                        <div
                          className="activity-item-title"
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                            marginBottom: "6px",
                          }}
                        >
                          <strong>{action}</strong>
                          {label && <span className="muted">{label}</span>}
                        </div>
                        {details && (
                          <p className="muted">{String(details)}</p>
                        )}
                      </div>
                      {createdAt && (
                        <time
                          className="muted"
                          dateTime={createdAt}
                          style={{ whiteSpace: "nowrap" }}
                        >
                          {new Date(createdAt).toLocaleString()}
                        </time>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeView === "assistant" && !selectedTopic && (
          <section className="panel">
            <h2>Chat with TraxAssistant</h2>
            <p className="muted">
              Your local AI productivity assistant
            </p>

            <div
              style={{
                minHeight: "300px",
                maxHeight: "500px",
                overflowY: "auto",
                padding: "16px",
                marginTop: "16px",
                marginBottom: "16px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {assistantMessages.map((item, index) => (
                <div
                  key={index}
                  style={{
                    alignSelf:
                      item.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background:
                      item.role === "user" ? "#dbeafe" : "#f1f5f9",
                    color: "#1e293b",
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  <strong>
                    {item.role === "user" ? "You" : "TraxAssistant"}
                  </strong>
                  <div style={{ marginTop: "6px" }}>
                    {item.content}
                  </div>
                </div>
              ))}

              {assistantLoading && (
                <p className="muted">TraxAssistant is thinking...</p>
              )}

              {assistantError && (
                <p style={{ color: "#dc2626" }}>
                  {assistantError}
                </p>
              )}
            </div>

            <form
              onSubmit={handleAssistantSubmit}
              style={{ display: "flex", gap: "10px" }}
            >
              <input
                type="text"
                placeholder="Ask TraxAssistant something..."
                value={assistantInput}
                onChange={(event) => setAssistantInput(event.target.value)}
                disabled={assistantLoading}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "12px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                }}
              />
              <button
                className="primary"
                type="submit"
                disabled={assistantLoading || !assistantInput.trim()}
              >
                {assistantLoading ? "Sending..." : "Send"}
              </button>
            </form>
            <p className="muted">
              Running locally with Ollama
            </p>
          </section>
        )}

        {selectedTopic && (
          <>
            {showTaskForm && (
              <section className="panel" style={{ marginBottom: "24px" }}>
                <h2>Create New Task</h2>
                <form onSubmit={handleCreateTask}>
                  <div style={{ marginBottom: "16px" }}>
                    <label htmlFor="taskTitle">Task Title *</label>
                    <input
                      id="taskTitle"
                      type="text"
                      placeholder="e.g. Book the venue"
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      required
                      maxLength={200}
                      style={{
                        display: "block",
                        width: "100%",
                        marginTop: "8px",
                        padding: "12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label htmlFor="taskDescription">Description</label>
                    <textarea
                      id="taskDescription"
                      value={taskDescription}
                      onChange={(event) =>
                        setTaskDescription(event.target.value)
                      }
                      rows={3}
                      placeholder="Task details..."
                      style={{
                        display: "block",
                        width: "100%",
                        marginTop: "8px",
                        padding: "12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        font: "inherit",
                      }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label htmlFor="assignee">Assignee</label>
                    <input
                      id="assignee"
                      type="text"
                      value={assignee}
                      onChange={(event) => setAssignee(event.target.value)}
                      placeholder="Person responsible"
                      style={{
                        display: "block",
                        width: "100%",
                        marginTop: "8px",
                        padding: "12px",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                      }}
                    />
                  </div>

                  <div className="task-form-row">
                    <div>
                      <label htmlFor="priority">Priority</label>
                      <select
                        id="priority"
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="dueDate">Due Date</label>
                      <input
                        id="dueDate"
                        type="date"
                        value={dueDate}
                        onChange={(event) => setDueDate(event.target.value)}
                      />
                    </div>
                  </div>

                  {taskFormError && (
                    <p style={{ color: "#dc2626" }}>{taskFormError}</p>
                  )}

                  <button
                    className="primary"
                    type="submit"
                    disabled={creatingTask}
                  >
                    {creatingTask ? "Creating..." : "Create Task"}
                  </button>
                </form>
              </section>
            )}

            <section className="panel">
              <div className="topics-heading">
                <h2>Tasks</h2>
                <span className="muted">
                  {topicTasks.length} total
                </span>
              </div>

              {taskLoading && (
                <p className="muted">Loading tasks...</p>
              )}

              {taskError && (
                <div>
                  <p style={{ color: "#dc2626" }}>{taskError}</p>
                  <button
                    className="primary"
                    onClick={() => openTopic(selectedTopic)}
                  >
                    Retry
                  </button>
                </div>
              )}

              {!taskLoading && !taskError && topicTasks.length === 0 && (
                <p className="muted">
                  No tasks in this topic yet. Create your first task.
                </p>
              )}

              {!taskLoading && !taskError && topicTasks.length > 0 && (
                <div className="task-list">
                  {topicTasks.map((task) => renderTaskRow(task))}
                </div>
              )}
            </section>

            <section className="panel" style={{ marginTop: "24px" }}>
              <div className="topics-heading">
                <h2>Milestones</h2>
                <span className="muted">{milestones.length} total</span>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreateMilestone(milestoneTitle);
                }}
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "20px",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  placeholder="Enter milestone title..."
                  value={milestoneTitle}
                  onChange={(event) => setMilestoneTitle(event.target.value)}
                  required
                  maxLength={250}
                  style={{
                    flex: "1",
                    minWidth: "200px",
                    padding: "12px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    font: "inherit",
                  }}
                />
                <button
                  type="submit"
                  className="primary"
                  disabled={!milestoneTitle.trim()}
                >
                  + Add Milestone
                </button>
              </form>

              {milestoneError && (
                <p style={{ color: "#dc2626" }}>{milestoneError}</p>
              )}

              {milestonesLoading && (
                <p className="muted">Loading milestones...</p>
              )}

              {!milestonesLoading && milestones.length === 0 && (
                <p className="muted">
                  No milestones yet. Add your first milestone above.
                </p>
              )}

              {!milestonesLoading && milestones.length > 0 && (
                <div className="task-list">
                  {milestones.map((milestone) => (
                    <article className="task-row" key={milestone.id}>
                      <div className="task-row-main">
                        <h3>{milestone.title}</h3>
                        {milestone.description && (
                          <p className="muted">{milestone.description}</p>
                        )}
                        <div className="task-meta">
                          <span>
                            Due: {milestone.due_date
                              ? String(milestone.due_date).slice(0, 10)
                              : "No due date"}
                          </span>
                        </div>
                      </div>
                      
                      <div className="task-actions">
                        <select
                          value={milestone.status}
                          onChange={(event) =>
                            handleUpdateMilestone(milestone.id, {
                              status: event.target.value,
                            })
                          }
                          aria-label={`Change status of ${milestone.title}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>

                        <button
                          type="button"
                          className="danger"
                          onClick={() => handleDeleteMilestone(milestone.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;