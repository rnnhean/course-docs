[00:00] And we're back. So thanks for coming by. So last time we talked about executors, actually in this video, we're going to talk about concurrent collections and how they simplify thread save data handling without any need for manual synchronization. Yeah, we're going to focus on concurrent hash map. This allows multiple threads to safely interact with a shared map.
[00:28] So you can see I've opened IntelliJ and I want to create a new project in IntelliJ named Concurrent Example.
[00:52] So first up, I want to create an instance here.
[01:18] And we're actually using a concurrent hash map to store the results of our tasks. This collection is thread safe. Some multiple threads can safely add or retrieve data from it without any manual synchronization like synchronized blocks or locks.
[01:45] and creating a thread pool instance. So we create a fixed thread pool with three threads using executors.NewFixedThreadPool and add three threads. Now this thread pool will manage the execution of our tasks concurrently.
[02:12] We submit five tasks to the thread pool. Each task prints a message
[02:35] showing which thread is executing it.
[03:05] you
[03:34] Then, simulate some work using thread.sleep send 1000 pausing for a second. Inside each task, after the simulated work is done, the thread puts a result
[04:00] into the concurrent hash map. Each entry in the map stores the task name as the key, for example, Task 1, and a message indicating which thread completed the task, for example, completed by Pool 1, Thread 1. You see as each task finishes. It stores its result in the concurrent hash map using the
[04:30] put method. Now since concurrent hash map manages synchronization internally you don't need to worry about race condition. Multiple threads can write to the map simultaneously and it's going to handle everything for you. So after all the tasks are submitted we gracefully shut down the executor service by calling shutdown and
[04:54] await termination. Now this will ensure that no more tasks will be accepted and of course we wait for all the submitted tasks.
[05:22] to complete. And finally we print out the results stored in the concurrent hash map. So each task's result is displayed.
[05:33] showing which thread completed each test.
[05:58] Alrighty then, so why are we using concurrent collections?
[06:28] Well, perhaps as you can see here concurrent collections like concurrent HashMap make multi-threaded programming a whole lot easier. First, for no manual synchronization, so unlike the traditional collections like HashMap or ArrayList, you don't have to manually add synchronization to prevent race conditions. So the collection itself manages all the thread safety for you.
[06:57] Secondly, though, for better performance. Concurrent HashMap uses fine grain locking, which means that only certain parts of the map are locked when threads write to it. This allows for better performance, way better than using a synchronized block or a hash table, which locks the entire structure. And of course, it's easier to write and maintain.
[07:24] So by eliminating the need for manual synchronization, your code becomes simpler and easier to maintain, reducing the chances for bugs or deadlocks. And then finally, we explored how to use concurrent hash map. That's one of Java's concurrent collections to safely share data between multiple threads without needing to manually manage synchronization. We also demonstrated how easy it is to submit tasks to a thread pool.
[07:53] collect the results in a thread safe way, and then print the results.
[07:58] you
