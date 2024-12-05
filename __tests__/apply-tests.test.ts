import { combinePatches } from '../src/apply-tests'

describe('combinePatches', () => {
  it('should combine single line patches', () => {
    const patches = [
      {
        filename: 'tests/test_todo.py',
        text: `--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -21,7 +21,7 @@ def todo_list() -> TodoList:
 @pytest.fixture
 def manager() -> TodoManager:
     # Use a dummy API URL and key for testing
-    return TodoManager(api_url="https://dummy.api.com", api_key="test-api-key")
+    return TodoManager(api_url="https://special.api.com", api_key="test-api-key")
 
 
 class TestTodo:
`
      }
    ]
    const result = combinePatches(patches, false)
    expect(result.filename).toBe('tests/test_todo.py')
    expect(result.text).toBe(`--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -24,1 +24,1 @@
-    return TodoManager(api_url="https://dummy.api.com", api_key="test-api-key")
+    return TodoManager(api_url="https://special.api.com", api_key="test-api-key")
`)
  })

  it('should combine multiple non-overlapping patches', () => {
    const patches = [
      {
        filename: 'test.ts',
        text: `--- a/test.ts
+++ b/test.ts
@@ -8,11 +8,6 @@ from todo.todo_list import TodoList
 from todo.todo_manager import TodoManager
 
 
-@pytest.fixture
-def sample_todo() -> Todo:
-    return Todo("Test task", "Description", priority=3, due_date=datetime.now() - timedelta(days=1))
-
-
 @pytest.fixture
 def todo_list() -> TodoList:
     return TodoList()
`
      },
      {
        filename: 'test.ts',
        text: `--- a/test.ts
+++ b/test.ts
@@ -21,7 +16,7 @@ def todo_list() -> TodoList:
 @pytest.fixture
 def manager() -> TodoManager:
     # Use a dummy API URL and key for testing
-    return TodoManager(api_url="https://dummy.api.com", api_key="test-api-key")
+    return TodoManager(api_url="https://special.api.com", api_key="test-api-key")
 
 
 class TestTodo:
`
      }
    ]
    const result = combinePatches(patches, false)
    expect(result.filename).toBe('test.ts')
    expect(result.text).toBe(`--- a/test.ts
+++ b/test.ts
@@ -11,5 +11,0 @@
-@pytest.fixture
-def sample_todo() -> Todo:
-    return Todo("Test task", "Description", priority=3, due_date=datetime.now() - timedelta(days=1))
-
-
@@ -24,1 +19,1 @@
-    return TodoManager(api_url="https://dummy.api.com", api_key="test-api-key")
+    return TodoManager(api_url="https://special.api.com", api_key="test-api-key")
`)
  })

  it('should throw error for empty patches array', () => {
    expect(() => combinePatches([])).toThrow('No patches to combine')
  })

  it('should combine multiple method addition patches', () => {
    const patches = [
      {
        filename: 'tests/test_todo.py',
        text: `--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -70,6 +70,12 @@ class TestTodoList:
        assert todo_list.delete_todo(todo_id)
        assert todo_list.get_todo(todo_id) is None

+    def test_getitem_method(self, todo_list: TodoList, sample_todo: Todo) -> None:
+        todo_id = todo_list.add_todo(sample_todo)
+        assert todo_list[todo_id] == sample_todo
+        assert todo_list[999] is None
+
+
     def test_get_todos_by_priority(self, todo_list: TodoList) -> None:
         todo_list.add_todo(Todo("Test1", priority=1))
         todo_list.add_todo(Todo("Test2", priority=2))
`
      },
      {
        filename: 'test_todo.py',
        text: `--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -70,6 +70,18 @@ class TestTodoList:
        assert todo_list.delete_todo(todo_id)
        assert todo_list.get_todo(todo_id) is None

+    def test_clear_completed_todos(self, todo_list: TodoList) -> None:
+        todo1 = Todo("Task 1", completed=True)
+        todo2 = Todo("Task 2", completed=False)
+        todo3 = Todo("Task 3", completed=True)
+        todo_list.add_todo(todo1)
+        todo_list.add_todo(todo2)
+        todo_list.add_todo(todo3)
+        removed_count = todo_list.clear_completed_todos()
+        assert removed_count == 2
+        assert len(todo_list.get_all_todos()) == 1
+        assert todo_list.get_all_todos()[0].title == "Task 2"
+
     def test_get_todos_by_priority(self, todo_list: TodoList) -> None:
         todo_list.add_todo(Todo("Test1", priority=1))
         todo_list.add_todo(Todo("Test2", priority=2))
`
      }
    ]
    const result = combinePatches(patches, false)
    expect(result.filename).toBe('tests/test_todo.py')
    expect(result.text).toBe(`--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -73,0 +73,18 @@
+    def test_getitem_method(self, todo_list: TodoList, sample_todo: Todo) -> None:
+        todo_id = todo_list.add_todo(sample_todo)
+        assert todo_list[todo_id] == sample_todo
+        assert todo_list[999] is None
+
+
+    def test_clear_completed_todos(self, todo_list: TodoList) -> None:
+        todo1 = Todo("Task 1", completed=True)
+        todo2 = Todo("Task 2", completed=False)
+        todo3 = Todo("Task 3", completed=True)
+        todo_list.add_todo(todo1)
+        todo_list.add_todo(todo2)
+        todo_list.add_todo(todo3)
+        removed_count = todo_list.clear_completed_todos()
+        assert removed_count == 2
+        assert len(todo_list.get_all_todos()) == 1
+        assert todo_list.get_all_todos()[0].title == "Task 2"
+
`)
  })

  it('should combine multiple addition and deletion patches', () => {
    const patches = [
      {
        filename: 'tests/test_todo.py',
        text: `--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -20,7 +20,6 @@ def todo_list() -> TodoList:

 @pytest.fixture
 def manager() -> TodoManager:
-    # Use a dummy API URL and key for testing
-    return TodoManager(api_url="https://dummy.api.com", api_key="test-api-key")
+    return TodoManager(api_url="https://special.api.com", api_key="test-api-key")

 class TestTodo:
@@ -151,9 +152,9 @@ class TestReminderService:
                 "due_date": sample_todo.due_date.isoformat(),
                 "priority": sample_todo.priority,
                 "tags": sample_todo.tags,
-                "id": sample_todo.id
+                "id": sample_todo.id,
             },
-            headers={"Authorization": "Bearer test-api-key"}
+            headers={"Authorization": "Bearer test-api-key"},
         )

         assert result is True
`
      },
      {
        filename: 'tests/test_todo.py',
        text: `--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -70,6 +70,12 @@ class TestTodoList:
         assert todo_list.delete_todo(todo_id)
         assert todo_list.get_todo(todo_id) is None
 
+    def test_getitem_method(self, todo_list: TodoList, sample_todo: Todo) -> None:
+        todo_id = todo_list.add_todo(sample_todo)
+        assert todo_list[todo_id] == sample_todo
+        assert todo_list[999] is None
+
+
     def test_get_todos_by_priority(self, todo_list: TodoList) -> None:
         todo_list.add_todo(Todo("Test1", priority=1))
         todo_list.add_todo(Todo("Test2", priority=2))
`
      },
      {
        filename: 'test_todo.py',
        text: `--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -70,6 +70,18 @@ class TestTodoList:
         assert todo_list.delete_todo(todo_id)
         assert todo_list.get_todo(todo_id) is None
 
+    def test_clear_completed_todos(self, todo_list: TodoList) -> None:
+        todo1 = Todo("Task 1", completed=True)
+        todo2 = Todo("Task 2", completed=False)
+        todo3 = Todo("Task 3", completed=True)
+        todo_list.add_todo(todo1)
+        todo_list.add_todo(todo2)
+        todo_list.add_todo(todo3)
+        removed_count = todo_list.clear_completed_todos()
+        assert removed_count == 2
+        assert len(todo_list.get_all_todos()) == 1
+        assert todo_list.get_all_todos()[0].title == "Task 2"
+
     def test_get_todos_by_priority(self, todo_list: TodoList) -> None:
         todo_list.add_todo(Todo("Test1", priority=1))
         todo_list.add_todo(Todo("Test2", priority=2))
`
      }
    ]

    const result = combinePatches(patches, false)
    expect(result.filename).toBe('tests/test_todo.py')
    expect(result.text).toBe(`--- a/tests/test_todo.py
+++ b/tests/test_todo.py
@@ -23,2 +23,1 @@
-    # Use a dummy API URL and key for testing
-    return TodoManager(api_url="https://dummy.api.com", api_key="test-api-key")
+    return TodoManager(api_url="https://special.api.com", api_key="test-api-key")
@@ -73,0 +72,18 @@
+    def test_getitem_method(self, todo_list: TodoList, sample_todo: Todo) -> None:
+        todo_id = todo_list.add_todo(sample_todo)
+        assert todo_list[todo_id] == sample_todo
+        assert todo_list[999] is None
+
+
+    def test_clear_completed_todos(self, todo_list: TodoList) -> None:
+        todo1 = Todo("Task 1", completed=True)
+        todo2 = Todo("Task 2", completed=False)
+        todo3 = Todo("Task 3", completed=True)
+        todo_list.add_todo(todo1)
+        todo_list.add_todo(todo2)
+        todo_list.add_todo(todo3)
+        removed_count = todo_list.clear_completed_todos()
+        assert removed_count == 2
+        assert len(todo_list.get_all_todos()) == 1
+        assert todo_list.get_all_todos()[0].title == "Task 2"
+
@@ -154,1 +171,1 @@
-                "id": sample_todo.id
+                "id": sample_todo.id,
@@ -156,1 +173,1 @@
-            headers={"Authorization": "Bearer test-api-key"}
+            headers={"Authorization": "Bearer test-api-key"},
`)
  })
})
