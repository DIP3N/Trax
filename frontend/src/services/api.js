
const API_BASE_URL = "http://127.0.0.1:8000";

async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `API error: ${response.status}`;

    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      // Keep the default error message.
    }

    throw new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
  }

  if (response.status === 204) return null;
  return response.json();
}


export function getTasks() {
  return apiRequest("/tasks");
}

export function getTopicTasks(topicId) {
  return apiRequest(`/topics/${topicId}/tasks`);
}

export function createTask(task) {
  return apiRequest("/tasks", {
    method: "POST",
    body: JSON.stringify(task),
  });
}

export function updateTask(taskId, updates) {
  return apiRequest(`/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteTask(taskId) {
  return apiRequest(`/tasks/${taskId}`, {
    method: "DELETE",
  });
}

export function getTopics() {
  return apiRequest("/topics");
}

export function createTopic(topic) {
  return apiRequest("/topics", {
    method: "POST",
    body: JSON.stringify(topic),
  });
}

export function updateTopic(topicId, updates) {
  return apiRequest(`/topics/${topicId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export function deleteTopic(topicId) {
  return apiRequest(`/topics/${topicId}`, {
    method: "DELETE",
  });
}

export function getActivity(topicId) {
  return apiRequest(`/topics/${topicId}/activity`);
}


// Milestones
export function getTopicMilestones(topicId) {
  return apiRequest(`/topics/${topicId}/milestones`);
}

export function createMilestone(milestone) {
  return apiRequest("/milestones", {
    method: "POST",
    body: JSON.stringify(milestone),
  });
}

export function updateMilestone(milestoneId, updates) {
  return apiRequest(`/milestones/${milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}


export function deleteMilestone(milestoneId) {
  return apiRequest(`/milestones/${milestoneId}`, {
    method: "DELETE",
  });
}

// TraxAssistant
export function sendAssistantMessage(message, messages = []) {
  return apiRequest("/assistant/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      messages,
    }),
  });
}