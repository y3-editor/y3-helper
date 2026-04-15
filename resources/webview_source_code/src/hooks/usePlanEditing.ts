import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChatStore } from '../store/chat';
import { TodoItem } from '../store/workspace/tools/todo';
import userReporter from '../utils/report';
import { UserEvent } from '../types/report';
import { updateCurrentSession } from './useCurrentSession';

export function usePlanEditing() {
  const currentSession = useChatStore((state) => state.currentSession());
  const syncHistory = useChatStore((state) => state.syncHistory);

  const todos = useMemo(
    () => currentSession?.data?.todoList?.todos || [],
    [currentSession?.data?.todoList?.todos],
  );

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [draftTodos, setDraftTodos] = useState<TodoItem[]>([]);

  const isEditing = editingItemId !== null;
  const editingItem = useMemo(() => {
    if (editingItemId === null) return null;
    return draftTodos[editingItemId] || null;
  }, [editingItemId, draftTodos]);

  const [editingSnapshot, setEditingSnapshot] = useState<TodoItem[]>([]);

  useEffect(() => {
    if (editingItemId !== null && draftTodos.length > 0 && editingSnapshot.length > 0) {
      const originalTodo = todos[editingItemId];
      const snapshotTodo = editingSnapshot[editingItemId];

      if (originalTodo && snapshotTodo &&
        (originalTodo.title !== snapshotTodo.title ||
          originalTodo.description !== snapshotTodo.description ||
          originalTodo.status !== snapshotTodo.status)) {
        console.log('External change detected, cancelling edit');
        setEditingItemId(null);
        setEditingSnapshot([]);
      }
    }
  }, [todos, editingItemId, draftTodos, editingSnapshot]);

  useEffect(() => {
    if (editingItemId !== null) {
      if (editingItemId < todos.length) {
        const todosSnapshot = todos.map((t) => ({ ...t }));
        setDraftTodos(todosSnapshot);
        setEditingSnapshot(todosSnapshot);
      }
      // 如果 editingItemId >= todos.length，说明是新增任务，不要覆盖 draftTodos
    } else {
      setEditingSnapshot([]);
    }
  }, [editingItemId, todos]);

  const updateDraftTitle = useCallback((idx: number, value: string) => {
    setDraftTodos((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, title: value } : t)),
    );
  }, []);

  const updateDraftDesc = useCallback((idx: number, value: string) => {
    setDraftTodos((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, description: value } : t)),
    );
  }, []);

  const quickToggleStatus = useCallback((index: number) => {
    const currentTodo = todos[index];
    if (!currentTodo) return;

    const currentStatus = currentTodo.status;
    let newStatus: TodoItem['status'];

    switch (currentStatus) {
      case 'pending':
        newStatus = 'in_progress';
        break;
      case 'in_progress':
        newStatus = 'completed';
        break;
      case 'completed':
        newStatus = 'pending';
        break;
      default:
        newStatus = 'pending';
    }

    // 直接更新 session 中的 todos
    updateCurrentSession((session) => {
      if (session?.data?.todoList?.todos) {
        const updatedTodos = [...session.data.todoList.todos];
        updatedTodos[index] = { ...updatedTodos[index], status: newStatus };
        session.data.todoList.todos = updatedTodos;
      }
    });
    void syncHistory();
  }, [syncHistory, todos]);

  const updateDraftStatus = useCallback((idx: number, status: TodoItem['status']) => {
    setDraftTodos((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, status } : t)),
    );
  }, []);

  const startEditing = useCallback((itemId?: number) => {
    if (itemId !== undefined) {
      setEditingItemId(itemId);
    } else {
      // 如果没有指定item，编辑第一个未完成的item
      const firstEditableIndex = todos.findIndex(todo => todo.status !== 'completed');
      if (firstEditableIndex !== -1) {
        setEditingItemId(firstEditableIndex);
      }
    }
  }, [todos]);

  const saveChanges = useCallback(() => {
    const validDraftTodos = draftTodos.filter(todo => todo.title.trim() !== '' || todo.description.trim() !== '');

    const updatedDraftTodos = validDraftTodos.map((draftTodo, index) => {
      const originalTodo = todos[index];
      if (originalTodo &&
        (draftTodo.title !== originalTodo.title ||
          draftTodo.description !== originalTodo.description)) {
        if (draftTodo.status !== 'pending') {
          return { ...draftTodo, status: 'pending' as const };
        }
      }
      return draftTodo;
    });

    updateCurrentSession((session) => {
      if (session?.data) {
        session.data.todoList = { todos: updatedDraftTodos };
      }
    });
    void syncHistory();
    setEditingItemId(null);
    userReporter.report({
      event: UserEvent.CODE_CHAT_CHANGE_TODO
    });
  }, [draftTodos, syncHistory, todos]);

  const addNewTodo = useCallback(() => {
    const newTodo: TodoItem = {
      title: '',
      description: '',
      priority: "medium",
      status: 'pending',
    };

    const todosWithNew = [...todos, newTodo];
    setDraftTodos(todosWithNew);
    setEditingSnapshot(todos.map((t) => ({ ...t })));

    const newIndex = todos.length;
    setEditingItemId(newIndex);

    userReporter.report({
      event: UserEvent.CODE_CHAT_ADD_TODO
    });
  }, [todos]);

  const cancelEditing = useCallback(() => {
    setEditingItemId(null);
  }, []);

  const deleteTodo = useCallback((index: number) => {
    updateCurrentSession((session) => {
      if (session?.data?.todoList?.todos) {
        const updatedTodos = [...session.data.todoList.todos];
        updatedTodos.splice(index, 1);
        session.data.todoList.todos = updatedTodos;
      }
    });
    void syncHistory();
    userReporter.report({
      event: UserEvent.CODE_CHAT_DELETE_TODO
    });
  }, [syncHistory]);

  const clearAllTodos = useCallback(() => {
    updateCurrentSession((session) => {
      if (session?.data?.todoList) {
        session.data.todoList.todos = [];
      }
    });
    void syncHistory();
    userReporter.report({
      event: UserEvent.CODE_CHAT_DELETE_TODO
    });
  }, [syncHistory]);

  return {
    todos,
    editingItemId,
    editingItem,
    isEditing,
    startEditing,
    saveChanges,
    cancelEditing,
    updateDraftTitle,
    updateDraftDesc,
    updateDraftStatus,
    quickToggleStatus,
    addNewTodo,
    deleteTodo,
    clearAllTodos,
  };
}
